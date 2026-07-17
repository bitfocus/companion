import debounceFn from 'debounce-fn'
import type { ExecuteExpressionResultError } from '@companion-app/shared/ExpressionResult.js'
import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { ExpressionOrValue, JsonValue } from '@companion-module/host'
import LogController, { type Logger } from '../../Log/Controller.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { RenderClock } from '../RenderClock.js'
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
	/**
	 * The entity containing the special expression being tracked.
	 */
	readonly entity: WeakRef<ControlEntityInstance>

	/**
	 * If null, then the pertinent special expression is in need of initial
	 * computation or subsequent recomputation, and so the set of variables it
	 * uses is unknown.
	 *
	 * Otherwise the special expression *has* been computed, that computed value
	 * has been recorded, and the special expression depends upon this *nonempty*
	 * set of variables.
	 *
	 * No wrapper is tracked for a special expression that has been computed that
	 * depends upon no variables and is not clock-sensitive.
	 */
	referencedVariableIds: null | ReadonlySet<string>

	/** Whether the last computed value depends on the render clock */
	dependsOnRenderClock: boolean
}

type SpecialExpressionComputation<Expression extends SpecialExpression> = {
	referencedVariableIds: EntityWrapper['referencedVariableIds']
	computedValue: SpecialExpressions[Expression]
	clockSensitive: boolean
}

type ComputeSpecialExpressionValueFn<Expression extends SpecialExpression> = (
	entity: ControlEntityInstance,
	parser: VariablesAndExpressionParser,
	logger: Logger
) => SpecialExpressionComputation<Expression>

type EvaluationResult<T> = { variableIds: ReadonlySet<string>; clockSensitive: boolean } & (
	{ ok: true; value: T } | { ok: false; error: ExecuteExpressionResultError['error'] }
)

const NoVariables = new Set<string>()

function evaluateBoolean(
	exprOrVal: ExpressionOrValue<JsonValue>,
	parser: VariablesAndExpressionParser
): EvaluationResult<boolean> {
	if (!exprOrVal.isExpression) {
		return { ok: true, variableIds: NoVariables, clockSensitive: false, value: !!exprOrVal.value }
	}

	const parsed = parser.executeExpression(exprOrVal.value, 'boolean')
	return parsed.ok
		? { ok: true, variableIds: parsed.variableIds, clockSensitive: parsed.clockSensitive, value: !!parsed.value }
		: {
				ok: false,
				variableIds: parsed.variableIds,
				clockSensitive: parsed.clockSensitive,
				error: parsed.error,
			}
}

const ComputeIsInverted: ComputeSpecialExpressionValueFn<'isInverted'> = (
	entity: ControlEntityInstance,
	parser: VariablesAndExpressionParser,
	logger: Logger
): SpecialExpressionComputation<'isInverted'> => {
	const isInvertedExpression = entity.rawIsInverted
	if (!isInvertedExpression || !isExpressionOrValue(isInvertedExpression)) {
		return { referencedVariableIds: null, computedValue: false, clockSensitive: false }
	}

	const result = evaluateBoolean(isInvertedExpression, parser)
	let isInverted: boolean
	if (result.ok) {
		isInverted = result.value
	} else {
		logger.warn(`Failed to parse boolean expression: ${result.error}`)
		isInverted = false
	}
	return { referencedVariableIds: result.variableIds, computedValue: isInverted, clockSensitive: result.clockSensitive }
}

function evaluateString(
	exprOrVal: ExpressionOrValue<JsonValue>,
	parser: VariablesAndExpressionParser
): EvaluationResult<string> {
	if (!exprOrVal.isExpression) {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		const parsed = parser.parseVariables(String(exprOrVal.value))
		return { ok: true, variableIds: parsed.variableIds, clockSensitive: false, value: parsed.text }
	}

	const parsed = parser.executeExpression(exprOrVal.value, 'string')
	return parsed.ok
		? {
				ok: true,
				variableIds: parsed.variableIds,
				clockSensitive: parsed.clockSensitive,
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				value: String(parsed.value),
			}
		: {
				ok: false,
				variableIds: parsed.variableIds,
				clockSensitive: parsed.clockSensitive,
				error: parsed.error,
			}
}

const ComputeStoreResult: ComputeSpecialExpressionValueFn<'storeResult'> = (
	entity: ControlEntityInstance,
	parser: VariablesAndExpressionParser,
	logger: Logger
): SpecialExpressionComputation<'storeResult'> => {
	const rawStoreResult = entity.rawStoreResult
	if (rawStoreResult === undefined) {
		return { referencedVariableIds: null, computedValue: undefined, clockSensitive: false }
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

		return {
			referencedVariableIds: locationResult.variableIds.union(variableNameResult.variableIds),
			computedValue: {
				type: 'local-variable',
				location,
				variableName,
			},
			clockSensitive: locationResult.clockSensitive || variableNameResult.clockSensitive,
		}
	}

	return {
		referencedVariableIds: variableNameResult.variableIds,
		computedValue: {
			type: 'custom-variable',
			variableName,
			createIfNotExists: rawStoreResult.createIfNotExists,
		},
		clockSensitive: variableNameResult.clockSensitive,
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
	readonly #unsubscribeRenderClock: (() => void) | null
	#destroyed = false

	private readonly specialExpressions: {
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
		},
		renderClock: RenderClock
	) {
		this.#controlId = controlId
		this.#createVariablesAndExpressionParser = createVariablesAndExpressionParser
		this.#unsubscribeRenderClock = renderClock.subscribe(() => this.onRenderClockTick()) ?? null

		this.specialExpressions = {
			isInverted: {
				entities: new Map(),
				computeNewValueFn: ComputeIsInverted,
				updateFn: updateFns.isInverted,
				logger: LogController.createLogger(`Controls/${controlId}/EntityPoolSpecialExpressionManager/isInverted`),
			},
			storeResult: {
				entities: new Map(),
				computeNewValueFn: ComputeStoreResult,
				updateFn: updateFns.storeResult,
				logger: LogController.createLogger(`Controls/${controlId}/EntityPoolSpecialExpressionManager/storeResult`),
			},
		}
	}

	readonly #debounceProcessPending = debounceFn(
		() => {
			if (this.#destroyed) return

			const parser = this.#createVariablesAndExpressionParser(null)

			for (const [type, specialExpression] of Object.entries(this.specialExpressions)) {
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

					// Check whether referenced variables have already been computed
					if (wrapper.referencedVariableIds) continue

					const { referencedVariableIds, computedValue, clockSensitive } = computeNewValueFn(entity, parser, logger)
					if (!referencedVariableIds || referencedVariableIds.size === 0) {
						if (!clockSensitive) {
							// Do not track a special expression that refers to no variables and is not clock-sensitive.
							logger.silly(`Stopped tracking ${entity.id}/${type} as it refers to no variables`)
							entities.delete(entity.id)
						} else {
							// Keep the entity in the map because it depends on the render clock
							wrapper.referencedVariableIds = referencedVariableIds || new Set()
						}
					} else {
						wrapper.referencedVariableIds = referencedVariableIds
					}
					wrapper.dependsOnRenderClock = clockSensitive

					updatedValues.set(entity.id, {
						entityId: entity.id,
						controlId: this.#controlId,
						value: computedValue,
					})
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
		this.#unsubscribeRenderClock?.()
		for (const { entities } of Object.values(this.specialExpressions)) {
			entities.clear()
		}
	}

	/**
	 * Track a special expression in an entity.  This ensures that the special
	 * expression's new value is computed whenever the special expression, or the
	 * value of any variables it depends upon, change.
	 */
	trackEntity(entity: ControlEntityInstance, expression: SpecialExpression): void {
		const { entities, logger } = this.specialExpressions[expression]

		// This may replace an existing entity, if so it needs to restart the process
		entities.set(entity.id, {
			entity: new WeakRef(entity),
			referencedVariableIds: null,
			dependsOnRenderClock: false,
		})

		logger.silly(`Queued entity ${entity.id}/${expression} for processing`)

		this.#debounceProcessPending()
	}

	/**
	 * Stop tracking any special expressions in an entity.  This aborts pending
	 * processing of those special expressions to compute their new values.
	 */
	forgetEntity(entityId: string): void {
		for (const { entities } of Object.values(this.specialExpressions)) {
			entities.delete(entityId)
		}
	}

	/**
	 * Inform the entity manager that the render clock has ticked.
	 * This will cause any clock-sensitive entities to be re-parsed.
	 */
	onRenderClockTick(): void {
		if (this.#destroyed) return

		let anyInvalidated = false
		for (const { entities } of Object.values(this.specialExpressions)) {
			for (const wrapper of entities.values()) {
				if (!wrapper.dependsOnRenderClock) continue

				// Clock-sensitive entities always need recomputation on tick
				wrapper.referencedVariableIds = null
				anyInvalidated = true
			}
		}

		if (anyInvalidated) this.#debounceProcessPending()
	}

	/**
	 * Inform the entity manager that some variables have changed.
	 * This will cause any entities that reference those variables to be re-parsed and sent to the module.
	 */
	onVariablesChanged(variableIds: ReadonlySet<string>): void {
		if (this.#destroyed) return

		let anyInvalidated = false
		for (const { entities } of Object.values(this.specialExpressions)) {
			for (const wrapper of entities.values()) {
				// Check if already queued for processing
				const referencedVariableIds = wrapper.referencedVariableIds
				if (!referencedVariableIds) continue

				if (variableIds.isDisjointFrom(referencedVariableIds)) {
					// No variables changed that we care about, nothing to do
					continue
				}

				// The entity needs re-processing
				wrapper.referencedVariableIds = null
				anyInvalidated = true
			}
		}

		if (anyInvalidated) this.#debounceProcessPending()
	}
}
