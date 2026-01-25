import debounceFn from 'debounce-fn'
import type { ControlEntityInstance } from '../../Controls/Entities/EntityInstance.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import type { NewIsInvertedValue } from './Types.js'
import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'

interface EntityWrapper {
	readonly entity: WeakRef<ControlEntityInstance>

	needsProcessing: boolean

	lastReferencedVariableIds: ReadonlySet<string> | null
}

export type UpdateIsInvertedValuesFn = (newValues: ReadonlyMap<string, NewIsInvertedValue>) => void
export type CreateVariablesAndExpressionParser = (
	overrideVariableValues: VariableValues | null
) => VariablesAndExpressionParser

/**
 * A manager to handle isInverted expressions for a control's entity pool.
 * This will track entities, parse their isInverted expressions, and recalcalulate
 * them when variables change.
 */
export class EntityPoolIsInvertedManager {
	readonly #logger: Logger

	readonly #controlId: string
	readonly #createVariablesAndExpressionParser: CreateVariablesAndExpressionParser
	readonly #updateFn: UpdateIsInvertedValuesFn

	readonly #entities = new Map<string, EntityWrapper>()

	#destroyed = false

	constructor(
		controlId: string,
		createVariablesAndExpressionParser: CreateVariablesAndExpressionParser,
		updateFn: UpdateIsInvertedValuesFn
	) {
		this.#logger = LogController.createLogger(`Controls/${controlId}/EntityPoolIsInvertedManager`)
		this.#controlId = controlId
		this.#createVariablesAndExpressionParser = createVariablesAndExpressionParser
		this.#updateFn = updateFn
	}

	readonly #debounceProcessPending = debounceFn(
		() => {
			if (this.#destroyed) return

			const updatedValues = new Map<string, NewIsInvertedValue>()

			const parser = this.#createVariablesAndExpressionParser(null)

			for (const [entityId, wrapper] of this.#entities) {
				// Resolve the entity, and make sure it still exists
				const entity = wrapper.entity.deref()
				if (!entity) {
					this.#entities.delete(entityId)
					continue
				}

				// Check if processing is needed
				if (!wrapper.needsProcessing) continue

				let isInverted = false

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
						this.#logger.warn(`Failed to parse boolean expression: ${parsed.error}`)
						isInverted = false
					} else {
						isInverted = !!parsed.value
					}
				}

				// Note: it feels like we could optimize this by passing it through directly,
				// but that is complicated because of the needed invalidation logic
				updatedValues.set(entity.id, {
					entityId: entity.id,
					controlId: this.#controlId,
					isInverted,
				})

				wrapper.needsProcessing = false
			}

			// Propagate the updates if needed
			if (updatedValues.size > 0) {
				this.#updateFn(updatedValues)
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
		this.#entities.clear()
	}

	/**
	 * Track an entity in the manager.
	 * This will ensure that the entity is processed and isInverted is parsed.
	 */
	trackEntity(entity: ControlEntityInstance): void {
		// This may replace an existing entity, if so it needs to restart the process
		this.#entities.set(entity.id, {
			entity: new WeakRef(entity),
			needsProcessing: true,
			lastReferencedVariableIds: null,
		})

		this.#logger.silly(`Queued entity ${entity.id} for processing`)

		this.#debounceProcessPending()
	}

	/**
	 * Forget an entity in the manager.
	 * This will remove the entity from the manager and abort any pending processing.
	 */
	forgetEntity(entityId: string): void {
		this.#entities.delete(entityId)
	}

	/**
	 * Inform the entity manager that some variables have changed.
	 * This will cause any entities that reference those variables to be re-parsed and sent to the module.
	 */
	onVariablesChanged(variableIds: ReadonlySet<string>): void {
		let anyInvalidated = false

		for (const wrapper of this.#entities.values()) {
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

		if (anyInvalidated) this.#debounceProcessPending()
	}
}
