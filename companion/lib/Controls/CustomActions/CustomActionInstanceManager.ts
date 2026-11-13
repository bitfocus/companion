import { EventEmitter } from 'node:events'
import debounceFn from 'debounce-fn'
import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import { isCustomActionsConnectionId } from '@companion-app/shared/ConnectionId.js'
import {
	CreateCustomActionControlId,
	type CustomActionControlId,
	type SomeControlId,
} from '@companion-app/shared/ControlId.js'
import type { CustomActionRunInfo } from '@companion-app/shared/Model/CustomActionModel.js'
import type { RunActionExtras } from '../../Instance/Connection/ChildHandlerApi.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import type {
	VariableDependency,
	VariableDependencyListener,
	VariableDependencyRegistry,
} from '../../Variables/DependencyRegistry.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import { ControlCustomAction, type CustomActionRunExtras } from '../ControlTypes/CustomAction.js'
import { MAX_CUSTOM_ACTION_DEPTH, type CustomActionRunFrame } from '../CustomActionRunFrame.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import { resolveStoreResult } from '../Entities/EntitySpecialExpressionManager.js'
import type { EntityScope, StoreResult } from '../Entities/Types.js'
import type { IControlStore } from '../IControlStore.js'
import type { RenderClock } from '../RenderClock.js'
import { CustomActionCopy } from './CustomActionCopy.js'

/** The key of the copy of a custom action held by an action which calls it, while it waits to be run */
export const CUSTOM_ACTION_HELD_COPY = 'custom-action'

export type CustomActionInstancesForEntity = Pick<CustomActionInstanceManager, 'entityUpdate' | 'entityDelete'>

/**
 * What is kept for each action which calls a custom action: how it parses its inputs, and the copy it holds
 */
interface CallerState {
	/** The control holding the calling action */
	readonly controlId: SomeControlId
	/** The scope the calling action parses its options in */
	callerScope: EntityScope
	/** The control id of the custom action which was copied, if there is a copy */
	customActionControlId: CustomActionControlId | null
	/** The copy held by the caller, or null if there is none, such as while its inputs are invalid */
	heldCopy: CustomActionCopy | null
	/** The variables the inputs of the copy referenced when they were parsed, so that they are re-parsed when one changes */
	readonly inputVariables: VariableDependency<ControlEntityInstance>
}

/**
 * A run of a custom action which is in progress
 */
interface ActiveRun extends CustomActionRunInfo {
	readonly customActionControlId: CustomActionControlId
	/** The id of the action which called it, as it is stored */
	readonly useEntityId: string
	readonly abortController: AbortController
}

export interface CustomActionInstanceEvents {
	/** An action which calls a custom action has been added, changed or removed, or a run has started or finished */
	usageChanged: []
}

/**
 * The id of an action calling a custom action, as it is stored. The copies of a custom action, and of those it calls,
 * prefix the ids of the entities they copy, so a copy of a stored action ends with its id
 */
function getUseEntityId(callerId: string): string {
	return callerId.slice(callerId.lastIndexOf('/') + 1)
}

/**
 * Every action which calls a custom action holds a copy of the custom action's actions and local variables.
 * The copy is subscribed with the inputs given by that action, so that the feedbacks and actions of the custom action
 * can depend on its inputs, and have their values ready before the custom action is run.
 *
 * Each run of the custom action uses a further copy of its own, with the inputs as they were when it started and its
 * own local variables, so that nothing changes underneath the run. This starts with the values of the copy held by
 * the calling action.
 *
 * The copies are never persisted, and are rebuilt whenever the custom action changes.
 */
export class CustomActionInstanceManager implements VariableDependencyListener<ControlEntityInstance> {
	readonly #logger: Logger = LogController.createLogger('Controls/CustomActions/InstanceManager')

	readonly #controlStore: Pick<IControlStore, 'getControl'>
	readonly #renderClock: RenderClock
	readonly #variableDependencies: VariableDependencyRegistry

	/** The copies, by the action which calls the custom action */
	readonly #callers = new Map<ControlEntityInstance, CallerState>()

	/** The runs in progress, by their id */
	readonly #runs = new Map<string, ActiveRun>()

	readonly events = new EventEmitter<CustomActionInstanceEvents>()

	/** The custom actions which have changed, so their copies need rebuilding */
	#changedCustomActionIds = new Set<CustomActionControlId>()

	constructor(
		controlStore: Pick<IControlStore, 'getControl'>,
		renderClock: RenderClock,
		variableDependencies: VariableDependencyRegistry
	) {
		this.#controlStore = controlStore
		this.#renderClock = renderClock
		this.#variableDependencies = variableDependencies
	}

	/**
	 * An action which calls a custom action has been added or changed, so build or update its copy
	 * @param caller The action which calls a custom action
	 * @param controlId The control holding the action
	 * @param callerScope The scope the action parses its options in
	 */
	entityUpdate(caller: ControlEntityInstance, controlId: SomeControlId, callerScope: EntityScope): void {
		this.events.emit('usageChanged')

		if (caller.disabled) {
			// A disabled action has nothing subscribed
			this.#forgetCaller(caller)
			return
		}

		const state = this.#callers.get(caller)
		if (state && state.customActionControlId === CreateCustomActionControlId(caller.definitionId)) {
			state.callerScope = callerScope
			this.#refreshInputs(caller, state)
		} else {
			const newState: CallerState = state ?? {
				controlId,
				callerScope,
				customActionControlId: null,
				heldCopy: null,
				inputVariables: this.#variableDependencies.create(this, controlId, caller),
			}
			newState.callerScope = callerScope
			this.#callers.set(caller, newState)
			this.#build(caller, newState)
		}
	}

	/**
	 * An action which calls a custom action has been removed or disabled, so remove its copy
	 * @param caller The action which calls a custom action
	 */
	entityDelete(caller: ControlEntityInstance): void {
		this.#forgetCaller(caller)
		this.events.emit('usageChanged')
	}

	/**
	 * The runs of a custom action which are in progress
	 * @param customActionControlId The custom action
	 * @returns Each run, with the id of the action which called it as it is stored
	 */
	getRuns(customActionControlId: CustomActionControlId): Array<{ run: CustomActionRunInfo; useEntityId: string }> {
		const runs: Array<{ run: CustomActionRunInfo; useEntityId: string }> = []
		for (const run of this.#runs.values()) {
			if (run.customActionControlId !== customActionControlId) continue
			runs.push({
				run: { runId: run.runId, controlId: run.controlId, startedAt: run.startedAt },
				useEntityId: run.useEntityId,
			})
		}
		return runs
	}

	/**
	 * Abort the runs of a custom action which are in progress
	 * @param customActionControlId The custom action
	 * @param useEntityId Only the runs called by this action, as it is stored, or null for every run
	 * @returns How many runs were aborted
	 */
	abortRuns(customActionControlId: CustomActionControlId, useEntityId: string | null): number {
		let count = 0
		for (const run of this.#runs.values()) {
			if (run.customActionControlId !== customActionControlId) continue
			if (useEntityId !== null && run.useEntityId !== useEntityId) continue

			run.abortController.abort()
			count++
		}
		return count
	}

	/**
	 * Get the copy held by an action which calls a custom action
	 * @param caller The action which calls a custom action
	 * @returns The copy, or undefined if the action has none
	 */
	getHeldCopy(caller: ControlEntityInstance): CustomActionCopy | undefined {
		return this.#callers.get(caller)?.heldCopy ?? undefined
	}

	/**
	 * Run the custom action called by an action, using a copy of it for just this run
	 * @param caller The action which calls a custom action
	 * @param parser A parser in the execution context of the caller, for its inputs
	 * @param extras The execution context of the caller
	 * @param storeOutput Writes an output of the custom action where the caller chose
	 * @param runActions Runs the actions of the copy, as the actions of a control are run
	 * @returns The result of the custom action
	 */
	async runCall(
		caller: ControlEntityInstance,
		parser: VariablesAndExpressionParser,
		extras: RunActionExtras,
		storeOutput: (target: StoreResult, value: JsonValue | undefined) => void,
		runActions: (actions: ControlEntityInstance[], extras: CustomActionRunExtras) => Promise<void>
	): Promise<undefined> {
		const state = this.#callers.get(caller)
		if (!state) {
			this.#logger.silly(`Not running custom action "${caller.definitionId}", as its caller is not known`)
			return undefined
		}

		// Not the copy held by the caller, as its inputs are parsed outside of any execution, so may be invalid where
		// they are not when run (eg using $(this:delta))
		const customActionControlId = CreateCustomActionControlId(caller.definitionId)
		const customAction = this.#controlStore.getControl(customActionControlId)
		if (!(customAction instanceof ControlCustomAction)) return undefined

		const chain = state.callerScope.customActionChain
		if (chain.includes(customActionControlId) || chain.length >= MAX_CUSTOM_ACTION_DEPTH) {
			this.#logger.silly(`Not running custom action "${caller.definitionId}", as it would loop or nest too deeply`)
			return undefined
		}

		// The inputs are fixed for the run, in the execution context of the caller
		const parseRes = customAction.parseCallInputs(caller.rawOptions, parser, state.controlId)
		if (!parseRes.ok) {
			this.#logger.warn(
				`Failed to parse the inputs of custom action "${customAction.options.name}" in ${state.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
			)
			throw new Error(
				`Failed to parse the inputs of custom action "${customAction.options.name}". One or more inputs were invalid\nErrors: ${JSON.stringify(parseRes.optionErrors)}`
			)
		}
		const inputValues = parseRes.inputValues

		const runId = nanoid()

		// A run can be aborted on its own, as well as with its caller
		const abortController = new AbortController()
		const runExtras: RunActionExtras = {
			...extras,
			abortDelayed: AbortSignal.any([extras.abortDelayed, abortController.signal]),
		}

		const copyKey = `custom-action-run:${runId}`

		this.#runs.set(runId, {
			runId,
			controlId: state.controlId,
			startedAt: Date.now(),
			customActionControlId: customAction.controlId,
			useEntityId: getUseEntityId(caller.id),
			abortController,
		})
		this.events.emit('usageChanged')

		let runCopy: CustomActionCopy | undefined
		try {
			// Built inside the try, so that the run is forgotten again if building it fails
			const copy = new CustomActionCopy(
				customAction,
				caller,
				state.controlId,
				`${caller.id}@${runId}/`,
				[...chain, customActionControlId],
				this,
				this.#renderClock,
				this.#variableDependencies,
				{ customActionControlId: customAction.controlId, inputValues, localValues: new Map() }
			)
			runCopy = copy
			caller.setTransientCopy(copyKey, copy)

			// When the run sees what the copy held by the caller sees, it can start with its values
			if (state.heldCopy && isEqual(inputValues, state.heldCopy.values.inputValues)) {
				this.#copyRuntimeValues(copy, `${caller.id}@${runId}/`, state.heldCopy, `${caller.id}/`)
			}

			// Where each local variable of the run is written as an output, resolved in the context of the caller
			const outputTargets = new Map<string, StoreResult[]>()
			for (const output of customAction.outputs) {
				if (!output.variableName) continue
				const rawTarget = Object.hasOwn(caller.rawOutputTargets, output.variableName)
					? caller.rawOutputTargets[output.variableName]
					: undefined
				const target = resolveStoreResult(rawTarget, parser, this.#logger)
				if (!target) continue

				const targets = outputTargets.get(output.variableName) ?? []
				targets.push(target)
				outputTargets.set(output.variableName, targets)
			}

			const writeOutput = (variableName: string) => {
				const targets = outputTargets.get(variableName)
				// Once aborted the caller has moved on, so must not see anything the run does after
				if (!targets || runExtras.abortDelayed.aborted) return

				// An output is a user value, so it is what the run has set it to, or else its startup value
				const value = frame.localValues.has(variableName)
					? frame.localValues.get(variableName)
					: copy.localVariables.getDirectEntities().find((entity) => entity.rawLocalVariableName === variableName)
							?.feedbackValue
				for (const target of targets) storeOutput(target, value)
			}

			const frame: CustomActionRunFrame = {
				...copy.values,
				getLocalVariableEntities: () => copy.localVariables.getDirectEntities(),
				localValueChanged: (name) => {
					copy.localValueChanged(name)
					// Outputs are written as they change, so that the caller can see the progress of a run
					writeOutput(name)
				},
			}

			// The caller sees where each output starts, then each change as the run sets it
			for (const variableName of outputTargets.keys()) writeOutput(variableName)

			await runActions(copy.actions.getDirectEntities(), { ...runExtras, frame })

			return undefined
		} finally {
			this.#runs.delete(runId)
			this.events.emit('usageChanged')

			caller.removeTransientCopy(copyKey)
			runCopy?.destroy()
		}
	}

	/**
	 * A custom action has been changed or deleted, so its copies need rebuilding
	 * @param customActionControlId The control id of the custom action
	 */
	onCustomActionChanged(customActionControlId: CustomActionControlId): void {
		this.#changedCustomActionIds.add(customActionControlId)
		this.#debounceRebuildChanged()
	}

	readonly #debounceRebuildChanged = debounceFn(
		() => {
			const changedIds = this.#changedCustomActionIds
			this.#changedCustomActionIds = new Set()

			// Building a copy adds and removes the copies nested inside it, so work from a snapshot
			for (const [caller, state] of [...this.#callers]) {
				if (this.#callers.get(caller) !== state) continue

				if (changedIds.has(CreateCustomActionControlId(caller.definitionId))) {
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
	 * Build the copy held by a calling action, replacing any existing copy
	 */
	#build(caller: ControlEntityInstance, state: CallerState): void {
		this.#clearHeldCopy(caller, state)

		const customActionControlId = CreateCustomActionControlId(caller.definitionId)
		state.customActionControlId = customActionControlId

		const customAction = this.#controlStore.getControl(customActionControlId)
		if (!(customAction instanceof ControlCustomAction)) return

		const chain = state.callerScope.customActionChain
		if (chain.includes(customActionControlId)) {
			this.#logger.warn(`Not running "${customAction.options.name}" in ${state.controlId}, as it calls itself`)
			return
		}
		if (chain.length >= MAX_CUSTOM_ACTION_DEPTH) {
			this.#logger.warn(`Not running "${customAction.options.name}" in ${state.controlId}, as it is nested too deeply`)
			return
		}

		const parseRes = customAction.parseCallInputs(
			caller.rawOptions,
			state.callerScope.createVariablesAndExpressionParser(null),
			state.controlId
		)
		// Even when invalid, so that the copy is built once a variable they use changes
		state.inputVariables.set(parseRes.referencedVariableIds)
		if (!parseRes.ok) {
			// Inactive until its inputs can be parsed, as a module feedback is
			this.#logger.warn(
				`Failed to parse the inputs of custom action "${customAction.options.name}" in ${state.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
			)
			return
		}
		const inputValues = parseRes.inputValues

		const copy = new CustomActionCopy(
			customAction,
			caller,
			state.controlId,
			`${caller.id}/`,
			[...chain, customActionControlId],
			this,
			this.#renderClock,
			this.#variableDependencies,
			{ customActionControlId, inputValues, localValues: new Map() }
		)
		state.heldCopy = copy
		caller.setTransientCopy(CUSTOM_ACTION_HELD_COPY, copy)
	}

	/**
	 * Give the entities of a new copy the runtime values of an existing copy of the same custom action, including the
	 * copies of any custom actions they call which have the same inputs
	 * @param target The new copy
	 * @param targetPrefix The prefix of the ids in the new copy
	 * @param source The existing copy
	 * @param sourcePrefix The prefix of the ids in the existing copy
	 */
	#copyRuntimeValues(
		target: CustomActionCopy,
		targetPrefix: string,
		source: CustomActionCopy,
		sourcePrefix: string
	): void {
		const sourceEntities = new Map<string, ControlEntityInstance>()
		for (const entity of [...source.localVariables.getAllEntities(), ...source.actions.getAllEntities()]) {
			sourceEntities.set(entity.id.slice(sourcePrefix.length), entity)
		}

		for (const entity of [...target.localVariables.getAllEntities(), ...target.actions.getAllEntities()]) {
			const sourceEntity = sourceEntities.get(entity.id.slice(targetPrefix.length))
			if (!sourceEntity) continue

			entity.copyRuntimeValuesFrom(sourceEntity)

			if (!isCustomActionsConnectionId(entity.connectionId)) continue

			// The custom action this calls has its own copy, which can start from the existing one if it sees the same
			const targetHeld = this.getHeldCopy(entity)
			const sourceHeld = this.getHeldCopy(sourceEntity)
			if (!targetHeld || !sourceHeld || !isEqual(targetHeld.values.inputValues, sourceHeld.values.inputValues)) continue

			this.#copyRuntimeValues(targetHeld, `${entity.id}/`, sourceHeld, `${sourceEntity.id}/`)
		}
	}

	/**
	 * Re-parse the inputs of a caller, and update its held copy if they have changed
	 */
	#refreshInputs(caller: ControlEntityInstance, state: CallerState): void {
		const heldCopy = state.heldCopy
		if (!heldCopy) {
			// Inactive because its inputs were invalid, so try building it again
			this.#build(caller, state)
			return
		}

		const customAction = this.#controlStore.getControl(heldCopy.values.customActionControlId)
		if (!(customAction instanceof ControlCustomAction)) return

		const parseRes = customAction.parseCallInputs(
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
	#clearHeldCopy(caller: ControlEntityInstance, state: CallerState): void {
		caller.removeTransientCopy(CUSTOM_ACTION_HELD_COPY)

		state.heldCopy?.destroy()
		state.heldCopy = null
		state.customActionControlId = null
		state.inputVariables.set(null)
	}

	#forgetCaller(caller: ControlEntityInstance): void {
		const state = this.#callers.get(caller)
		if (!state) return

		this.#callers.delete(caller)
		this.#clearHeldCopy(caller, state)
		state.inputVariables.dispose()
	}
}
