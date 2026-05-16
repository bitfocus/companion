import debounceFn from 'debounce-fn'
import type { ExecuteExpressionResultError } from '@companion-app/shared/Expression/ExpressionResult.js'
import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { ExpressionOrValue, JsonValue } from '@companion-module/host'
import LogController, { type Logger } from '../../Log/Controller.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type {
	NewSpecialExpressionValue,
	SpecialExpression,
	SpecialExpressions,
	UpdateSpecialExpressionValuesFn,
} from './SpecialExpressions.js'
import type { StoreResult } from './Types.js'

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

type EvaluationResult<T> = { variableIds: ReadonlySet<string> } & (
	| { ok: true; value: T }
	| { ok: false; error: ExecuteExpressionResultError['error'] }
)

const NoVariables = new Set<string>()

function evaluateBoolean(
	exprOrVal: ExpressionOrValue<JsonValue>,
	parser: VariablesAndExpressionParser
): EvaluationResult<boolean> {
	if (!exprOrVal.isExpression) {
		return { ok: true, variableIds: NoVariables, value: !!exprOrVal.value }
	}

	const parsed = parser.executeExpression(exprOrVal.value, 'boolean')
	return parsed.ok
		? { ok: true, variableIds: parsed.variableIds, value: !!parsed.value }
		: {
				ok: false,
				variableIds: parsed.variableIds,
				error: parsed.error,
			}
}

function evaluateString(
	exprOrVal: ExpressionOrValue<JsonValue>,
	parser: VariablesAndExpressionParser
): EvaluationResult<string> {
	if (!exprOrVal.isExpression) {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		const parsed = parser.parseVariables(String(exprOrVal.value))
		return { ok: true, variableIds: parsed.variableIds, value: parsed.text }
	}

	const parsed = parser.executeExpression(exprOrVal.value, 'string')
	return parsed.ok
		? {
				ok: true,
				variableIds: parsed.variableIds,
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				value: String(parsed.value),
			}
		: {
				ok: false,
				variableIds: parsed.variableIds,
				error: parsed.error,
			}
}

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
			storeResult: {
				entities: new Map(),
				computeNewValueFn: this.#computeStoreResult.bind(this),
				updateFn: updateFns.storeResult,
				logger: LogController.createLogger(`Controls/${controlId}/EntityPoolSpecialExpressionManager/storeResult`),
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
		} else {
			const result = evaluateBoolean(isInvertedExpression, parser)
			if (result.ok) {
				isInverted = result.value
			} else {
				logger.warn(`Failed to parse boolean expression: ${result.error}`)
				isInverted = false
			}
			wrapper.lastReferencedVariableIds = result.variableIds
		}

		return isInverted
	}

	#computeStoreResult(
		entity: ControlEntityInstance,
		wrapper: EntityWrapper,
		parser: VariablesAndExpressionParser,
		logger: Logger
	): StoreResult | undefined {
		const rawStoreResult = entity.rawStoreResult
		if (rawStoreResult === undefined) {
			wrapper.lastReferencedVariableIds = null
			return undefined
		}

		const variableNameResult = evaluateString(rawStoreResult.variableName, parser)
		let variableName: string
		if (variableNameResult.ok) {
			variableName = variableNameResult.value
		} else {
			logger.warn(`Failed to parse string expression: ${variableNameResult.error}`)
			variableName = ''
		}

		if (rawStoreResult.type === 'local-variable') {
			const locationResult = evaluateString(rawStoreResult.location, parser)

			let location: string
			if (locationResult.ok) {
				location = locationResult.value
			} else {
				logger.warn(`Failed to parse string expression: ${locationResult.error}`)
				location = ''
			}

			wrapper.lastReferencedVariableIds = locationResult.variableIds.union(variableNameResult.variableIds)

			return {
				type: 'local-variable',
				location,
				variableName,
			}
		}

		wrapper.lastReferencedVariableIds = variableNameResult.variableIds

		return {
			type: 'custom-variable',
			variableName,
			createIfNotExists: rawStoreResult.createIfNotExists,
		}
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
