import { EventEmitter } from 'node:events'
import debounceFn from 'debounce-fn'
import isEqual from 'fast-deep-equal'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { Logger } from '../../Log/Controller.js'
import type {
	VariableDependency,
	VariableDependencyListener,
	VariableDependencyRegistry,
} from '../../Variables/DependencyRegistry.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import { MAX_CUSTOM_ACTION_DEPTH } from '../CustomActionRunFrame.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { EntityScope } from '../Entities/Types.js'
import type { CustomEntityCopy, CustomEntityCopyValues } from './CustomEntityCopy.js'

/**
 * A custom action or feedback, as seen by the entities which use it
 */
export interface CustomEntityControl {
	readonly options: { readonly name: string }
	/**
	 * Parse the options of an entity which uses it into the values of its inputs
	 * @param rawOptions The options of the calling entity
	 * @param parser A parser in the context of the caller
	 * @param callerControlId The control holding the calling entity, if there is one
	 */
	parseCallInputs(
		rawOptions: ExpressionableOptionsObject,
		parser: VariablesAndExpressionParser,
		callerControlId: SomeControlId | null
	):
		| { ok: true; inputValues: CompanionOptionValues; referencedVariableIds: ReadonlySet<string> }
		| { ok: false; optionErrors: Record<string, string | undefined>; referencedVariableIds: ReadonlySet<string> }
}

/**
 * What is kept for each entity which uses a custom action or feedback: how it parses its inputs, and the copy it holds
 */
export interface CustomEntityCallerState<TControlId extends string, TCopy> {
	/** The control holding the calling entity */
	readonly controlId: SomeControlId
	/** The scope the calling entity parses its options in */
	callerScope: EntityScope
	/** The control id of the custom action or feedback which was copied, if there is a copy */
	customControlId: TControlId | null
	/** The copy held by the caller, or null if there is none, such as while its inputs are invalid */
	heldCopy: TCopy | null
	/** The variables the inputs of the copy referenced when they were parsed, so that they are re-parsed when one changes */
	readonly inputVariables: VariableDependency<ControlEntityInstance>
}

export interface CustomEntityInstanceEvents {
	/** An entity which uses a custom action or feedback has been added, changed or removed, or a run has started or finished */
	usageChanged: []
}

/**
 * Whether a copy of a custom action or feedback would be inside a copy of itself, or nested too deeply
 * @param chain The custom actions and feedbacks the caller is inside
 * @param customControlId The custom action or feedback to copy
 */
export function isCustomCopyRecursive(chain: ReadonlyArray<string>, customControlId: string): boolean {
	return chain.includes(customControlId) || chain.length >= MAX_CUSTOM_ACTION_DEPTH
}

/**
 * Every entity which uses a custom action or feedback holds a copy of its entities and local variables, subscribed
 * with the inputs given by that entity. This keeps those copies up to date with the caller, its inputs and the custom
 * action or feedback itself. What the copy is used for is up to each kind.
 *
 * The copies are never persisted, and are rebuilt whenever the custom action or feedback changes.
 */
export abstract class CustomEntityInstanceManager<
	TControlId extends string,
	TControl extends CustomEntityControl,
	TValues extends CustomEntityCopyValues,
	TCopy extends CustomEntityCopy<TValues>,
> implements VariableDependencyListener<ControlEntityInstance> {
	protected readonly logger: Logger
	protected readonly variableDependencies: VariableDependencyRegistry
	/** What is copied, for log messages, eg 'custom action' */
	readonly #noun: string
	/** The key of the copy held by a caller */
	readonly #heldCopyKey: string

	/** The copies, by the entity which uses the custom action or feedback */
	readonly #callers = new Map<ControlEntityInstance, CustomEntityCallerState<TControlId, TCopy>>()

	readonly events = new EventEmitter<CustomEntityInstanceEvents>()

	/** The custom actions or feedbacks which have changed, so their copies need rebuilding */
	#changedIds = new Set<TControlId>()

	/**
	 * @param logger The logger
	 * @param variableDependencies Where the inputs of the copies register the variables they reference
	 * @param noun What is copied, for log messages, eg 'custom action'
	 * @param heldCopyKey The key of the copy held by a caller
	 */
	constructor(logger: Logger, variableDependencies: VariableDependencyRegistry, noun: string, heldCopyKey: string) {
		this.logger = logger
		this.variableDependencies = variableDependencies
		this.#noun = noun
		this.#heldCopyKey = heldCopyKey
	}

	/** The control id of the custom action or feedback used by a caller, from its definition id */
	protected abstract toCustomControlId(definitionId: string): TControlId

	/** Get the custom action or feedback, or undefined if it doesn't exist */
	protected abstract getCustomControl(customControlId: TControlId): TControl | undefined

	/**
	 * Create the copy to be held by a caller
	 * @param customControl The custom action or feedback to copy
	 * @param caller The entity which will hold the copy
	 * @param state The state of the caller
	 * @param chain The custom actions and feedbacks the copy is inside, ending with this one
	 * @param values The values of the copy
	 */
	protected abstract createHeldCopy(
		customControl: TControl,
		caller: ControlEntityInstance,
		state: CustomEntityCallerState<TControlId, TCopy>,
		chain: ReadonlyArray<string>,
		inputValues: CompanionOptionValues
	): TCopy

	/**
	 * Give the copy held by an entity of a new copy, if it uses a custom action or feedback, the runtime values of the
	 * copy held by the same entity of an existing copy
	 */
	protected abstract copyNestedRuntimeValues(target: ControlEntityInstance, source: ControlEntityInstance): void

	/**
	 * A caller has been changed, or the copy it holds has been replaced or removed
	 */
	protected abstract callerChanged(caller: ControlEntityInstance): void

	/**
	 * An entity which uses a custom action or feedback has been added or changed, so build or update its copy
	 * @param caller The entity which uses a custom action or feedback
	 * @param controlId The control holding the entity
	 * @param callerScope The scope the entity parses its options in
	 */
	entityUpdate(caller: ControlEntityInstance, controlId: SomeControlId, callerScope: EntityScope): void {
		this.events.emit('usageChanged')

		this.callerChanged(caller)

		if (caller.disabled) {
			// A disabled entity has nothing subscribed
			this.#forgetCaller(caller)
			return
		}

		const state = this.#callers.get(caller)
		if (state && state.customControlId === this.toCustomControlId(caller.definitionId)) {
			state.callerScope = callerScope
			this.#refreshInputs(caller, state)
		} else {
			const newState: CustomEntityCallerState<TControlId, TCopy> = state ?? {
				controlId,
				callerScope,
				customControlId: null,
				heldCopy: null,
				inputVariables: this.variableDependencies.create(this, controlId, caller),
			}
			newState.callerScope = callerScope
			this.#callers.set(caller, newState)
			this.#build(caller, newState)
		}
	}

	/**
	 * An entity which uses a custom action or feedback has been removed or disabled, so remove its copy
	 * @param caller The entity which uses a custom action or feedback
	 */
	entityDelete(caller: ControlEntityInstance): void {
		this.#forgetCaller(caller)
		this.events.emit('usageChanged')
	}

	/**
	 * Get the state of a caller
	 * @param caller The entity which uses a custom action or feedback
	 * @returns The state, or undefined if the caller is not known, such as when it is disabled
	 */
	protected getCallerState(caller: ControlEntityInstance): CustomEntityCallerState<TControlId, TCopy> | undefined {
		return this.#callers.get(caller)
	}

	/**
	 * Get the copy held by an entity which uses a custom action or feedback
	 * @param caller The entity which uses a custom action or feedback
	 * @returns The copy, or undefined if the entity has none
	 */
	getHeldCopy(caller: ControlEntityInstance): TCopy | undefined {
		return this.#callers.get(caller)?.heldCopy ?? undefined
	}

	/**
	 * Give the copy held by a caller the runtime values of the copy held by another, which is a copy of the same caller
	 * in the same circumstances (eg for a run of a custom action). This lets the new copy be used straight away, without
	 * waiting for the values to be recomputed
	 * @param target The caller of the new copy
	 * @param source The caller of the existing copy
	 */
	copyRuntimeValues(target: ControlEntityInstance, source: ControlEntityInstance): void {
		const targetCopy = this.getHeldCopy(target)
		const sourceCopy = this.getHeldCopy(source)
		if (!targetCopy || !sourceCopy || !isEqual(targetCopy.values.inputValues, sourceCopy.values.inputValues)) return

		this.copyRuntimeValuesBetween(targetCopy, `${target.id}/`, sourceCopy, `${source.id}/`)

		this.callerChanged(target)
	}

	/**
	 * Give the entities of a new copy the runtime values of an existing copy of the same custom action or feedback,
	 * including the copies held by any of them which use a custom action or feedback with the same inputs
	 * @param target The new copy
	 * @param targetPrefix The prefix of the ids in the new copy
	 * @param source The existing copy
	 * @param sourcePrefix The prefix of the ids in the existing copy
	 */
	protected copyRuntimeValuesBetween(target: TCopy, targetPrefix: string, source: TCopy, sourcePrefix: string): void {
		const sourceEntities = new Map<string, ControlEntityInstance>()
		for (const entity of source.lists.flatMap((list) => list.getAllEntities())) {
			sourceEntities.set(entity.id.slice(sourcePrefix.length), entity)
		}

		for (const entity of target.lists.flatMap((list) => list.getAllEntities())) {
			const sourceEntity = sourceEntities.get(entity.id.slice(targetPrefix.length))
			if (!sourceEntity) continue

			entity.copyRuntimeValuesFrom(sourceEntity)

			this.copyNestedRuntimeValues(entity, sourceEntity)
		}
	}

	/**
	 * A custom action or feedback has been changed or deleted, so its copies need rebuilding
	 * @param customControlId The control id of the custom action or feedback
	 */
	protected customControlChanged(customControlId: TControlId): void {
		this.#changedIds.add(customControlId)
		this.#debounceRebuildChanged()
	}

	readonly #debounceRebuildChanged = debounceFn(
		() => {
			const changedIds = this.#changedIds
			this.#changedIds = new Set()

			// Building a copy adds and removes the copies nested inside it, so work from a snapshot
			for (const [caller, state] of [...this.#callers]) {
				if (this.#callers.get(caller) !== state) continue

				if (changedIds.has(this.toCustomControlId(caller.definitionId))) {
					this.#build(caller, state)
				}
			}
		},
		{ wait: 20, maxWait: 100 }
	)

	/**
	 * Some variables read by the inputs of copies have changed, so re-parse those inputs. The entities of the copies
	 * are told of the changes by the registry themselves
	 */
	onVariableDependenciesChanged(hits: ReadonlyArray<VariableDependency<ControlEntityInstance>>): void {
		for (const hit of hits) {
			// Re-parsing the inputs of a copy can remove the copies nested inside it
			const state = this.#callers.get(hit.data)
			if (state?.inputVariables !== hit) continue

			this.#refreshInputs(hit.data, state)
		}
	}

	/**
	 * Build the copy held by a caller, replacing any existing copy
	 */
	#build(caller: ControlEntityInstance, state: CustomEntityCallerState<TControlId, TCopy>): void {
		this.#clearHeldCopy(caller, state)

		const customControlId = this.toCustomControlId(caller.definitionId)
		state.customControlId = customControlId

		const customControl = this.getCustomControl(customControlId)
		if (!customControl) return

		const chain = state.callerScope.customActionChain
		if (chain.includes(customControlId)) {
			this.logger.warn(
				`Not using ${this.#noun} "${customControl.options.name}" in ${state.controlId}, as it uses itself`
			)
			return
		}
		if (chain.length >= MAX_CUSTOM_ACTION_DEPTH) {
			this.logger.warn(
				`Not using ${this.#noun} "${customControl.options.name}" in ${state.controlId}, as it is nested too deeply`
			)
			return
		}

		const parseRes = customControl.parseCallInputs(
			caller.rawOptions,
			state.callerScope.createVariablesAndExpressionParser(null),
			state.controlId
		)
		// Even when invalid, so that the copy is built once a variable they use changes
		state.inputVariables.set(parseRes.referencedVariableIds)
		if (!parseRes.ok) {
			// Inactive until its inputs can be parsed, as a module entity is
			this.logger.warn(
				`Failed to parse the inputs of ${this.#noun} "${customControl.options.name}" in ${state.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
			)
			return
		}

		const copy = this.createHeldCopy(customControl, caller, state, [...chain, customControlId], parseRes.inputValues)
		state.heldCopy = copy
		caller.setTransientCopy(this.#heldCopyKey, copy)

		this.callerChanged(caller)
	}

	/**
	 * Re-parse the inputs of a caller, and update its held copy if they have changed
	 */
	#refreshInputs(caller: ControlEntityInstance, state: CustomEntityCallerState<TControlId, TCopy>): void {
		const heldCopy = state.heldCopy
		if (!heldCopy || !state.customControlId) {
			// Inactive because its inputs were invalid, so try building it again
			this.#build(caller, state)
			return
		}

		const customControl = this.getCustomControl(state.customControlId)
		if (!customControl) return

		const parseRes = customControl.parseCallInputs(
			caller.rawOptions,
			state.callerScope.createVariablesAndExpressionParser(null),
			state.controlId
		)
		if (!parseRes.ok) {
			// It becomes inactive, which building it again does
			this.#build(caller, state)
			return
		}
		state.inputVariables.set(parseRes.referencedVariableIds)

		if (isEqual(parseRes.inputValues, heldCopy.values.inputValues)) return

		heldCopy.setValues({ ...heldCopy.values, inputValues: parseRes.inputValues })
	}

	/**
	 * Remove the copy held by a caller
	 */
	#clearHeldCopy(caller: ControlEntityInstance, state: CustomEntityCallerState<TControlId, TCopy>): void {
		caller.removeTransientCopy(this.#heldCopyKey)

		state.heldCopy?.destroy()
		state.heldCopy = null
		state.customControlId = null
		state.inputVariables.set(null)

		this.callerChanged(caller)
	}

	#forgetCaller(caller: ControlEntityInstance): void {
		const state = this.#callers.get(caller)
		if (!state) return

		this.#callers.delete(caller)
		this.#clearHeldCopy(caller, state)
		state.inputVariables.dispose()
	}
}
