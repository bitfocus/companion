import debounceFn from 'debounce-fn'
import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type {
	NewSpecialExpressionValue,
	SpecialExpression,
	SpecialExpressions,
	UpdateSpecialExpressionValuesFn,
} from './SpecialExpressions.js'

export type CreateVariablesAndExpressionParser = (
	overrideVariableValues: VariableValues | null
) => VariablesAndExpressionParser

interface EntityWrapper {
	readonly entity: WeakRef<ControlEntityInstance>
	needsProcessing: boolean
	lastReferencedVariableIds: ReadonlySet<string> | null
}

type ComputeSpecialExpressionValueFn<Expression extends SpecialExpression> = (
	entity: ControlEntityInstance,
	wrapper: EntityWrapper,
	parser: VariablesAndExpressionParser,
	logger: Logger
) => SpecialExpressions[Expression]

/**
 * A manager to handle various expression not contained in entity options.  It
 * tracks entities that possess these additional expressions, parses the
 * expressions, and invalidates the parsed results and reevaluates them when the
 * variables used within them change.
 */
export class EntityPoolSpecialExpressionManager {
	readonly #controlId: string
	readonly #createVariablesAndExpressionParser: CreateVariablesAndExpressionParser
	#destroyed = false

	readonly #specialExpressions: {
		readonly [Expression in SpecialExpression]: {
			readonly entities: Map<string, EntityWrapper>
			readonly computeNewValueFn: ComputeSpecialExpressionValueFn<Expression>
			readonly updateFn: UpdateSpecialExpressionValuesFn<Expression>
			readonly logger: Logger
		}
	}

	constructor(
		controlId: string,
		createVariablesAndExpressionParser: CreateVariablesAndExpressionParser,
		updateFns: {
			[Expression in SpecialExpression]: UpdateSpecialExpressionValuesFn<Expression>
		}
	) {
		this.#controlId = controlId
		this.#createVariablesAndExpressionParser = createVariablesAndExpressionParser

		this.#specialExpressions = {
			isInverted: {
				entities: new Map(),
				computeNewValueFn: this.#computeIsInverted.bind(this),
				updateFn: updateFns.isInverted,
				logger: LogController.createLogger(`Controls/${controlId}/EntityPoolSpecialExpressionManager/isInverted`),
			},
		}
	}

	#computeIsInverted(
		entity: ControlEntityInstance,
		wrapper: EntityWrapper,
		parser: VariablesAndExpressionParser,
		logger: Logger
	): boolean {
		let isInverted: boolean

		const isInvertedExpression = entity.rawIsInverted
		if (!isInvertedExpression || !isExpressionOrValue(isInvertedExpression)) {
			isInverted = false

			wrapper.lastReferencedVariableIds = null
		} else if (!isInvertedExpression.isExpression) {
			isInverted = !!isInvertedExpression.value

			wrapper.lastReferencedVariableIds = null
		} else {
			const parsed = parser.executeExpression(isInvertedExpression.value, 'boolean')

			wrapper.lastReferencedVariableIds = parsed.variableIds

			if (!parsed.ok) {
				logger.warn(`Failed to parse boolean expression: ${parsed.error}`)
				isInverted = false
			} else {
				isInverted = !!parsed.value
			}
		}

		return isInverted
	}

	readonly #debounceProcessPending = debounceFn(
		() => {
			if (this.#destroyed) return

			const parser = this.#createVariablesAndExpressionParser(null)

			for (const specialExpression of Object.values(this.#specialExpressions)) {
				// Skip a special expression when no entities track it.
				const entities = specialExpression.entities
				if (entities.size === 0) continue

				const { computeNewValueFn, updateFn, logger } = specialExpression

				const updatedValues = new Map<string, NewSpecialExpressionValue<any>>()

				for (const [entityId, wrapper] of entities) {
					// Resolve the entity, and make sure it still exists
					const entity = wrapper.entity.deref()
					if (!entity) {
						entities.delete(entityId)
						continue
					}

					// Check if processing is needed
					if (!wrapper.needsProcessing) continue

					updatedValues.set(entity.id, {
						entityId: entity.id,
						controlId: this.#controlId,
						value: computeNewValueFn(entity, wrapper, parser, logger),
					})

					wrapper.needsProcessing = false
				}

				// Propagate the updates if needed
				if (updatedValues.size > 0) {
					updateFn(updatedValues)
				}
			}
		},
		{
			before: false,
			after: true,
			maxWait: 50,
			wait: 10,
		}
	)

	/**
	 * Destroy the entity manager, clearing all entities and aborting any pending processing.
	 * Cleanup is not performed, it is assumed that the module is no longer running.
	 */
	destroy(): void {
		this.#destroyed = true
		this.#debounceProcessPending.cancel()
		for (const { entities } of Object.values(this.#specialExpressions)) {
			entities.clear()
		}
	}

	/**
	 * Track an entity in the manager.  This will ensure that the entity is
	 * processed and associated expressions parsed.
	 */
	trackEntity(entity: ControlEntityInstance, expression: SpecialExpression): void {
		const { entities, logger } = this.#specialExpressions[expression]

		// This may replace an existing entity, if so it needs to restart the process
		entities.set(entity.id, {
			entity: new WeakRef(entity),
			needsProcessing: true,
			lastReferencedVariableIds: null,
		})

		logger.silly(`Queued entity ${entity.id} for processing`)

		this.#debounceProcessPending()
	}

	/**
	 * Forget an entity in the manager.  This will remove the entity from the
	 * manager and abort any pending processing.
	 */
	forgetEntity(entityId: string): void {
		for (const { entities } of Object.values(this.#specialExpressions)) {
			entities.delete(entityId)
		}
	}

	/**
	 * Inform the entity manager that some variables have changed.
	 * This will cause any entities that reference those variables to be re-parsed and sent to the module.
	 */
	onVariablesChanged(variableIds: ReadonlySet<string>): void {
		if (this.#destroyed) return

		let anyInvalidated = false
		for (const { entities } of Object.values(this.#specialExpressions)) {
			for (const wrapper of entities.values()) {
				// Check if already queued for processing
				if (wrapper.needsProcessing) continue

				if (!wrapper.lastReferencedVariableIds || wrapper.lastReferencedVariableIds.size === 0) {
					// No variables to check, nothing to do
					continue
				}

				if (variableIds.isDisjointFrom(wrapper.lastReferencedVariableIds)) {
					// No variables changed that we care about, nothing to do
					continue
				}

				// The entity needs re-processing
				wrapper.needsProcessing = true
				anyInvalidated = true
			}
		}

		if (anyInvalidated) this.#debounceProcessPending()
	}
}
