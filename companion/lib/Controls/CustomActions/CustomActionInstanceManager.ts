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
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { RunActionExtras } from '../../Instance/Connection/ChildHandlerApi.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import type {
	VariableDependency,
	VariableDependencyListener,
	VariableDependencyRegistry,
} from '../../Variables/DependencyRegistry.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import { ControlCustomAction } from '../ControlTypes/CustomAction.js'
import { MAX_CUSTOM_ACTION_DEPTH, type CustomActionRunFrame } from '../CustomActionRunFrame.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import { resolveStoreResult } from '../Entities/EntitySpecialExpressionManager.js'
import type { EntityScope, StoreResult } from '../Entities/Types.js'
import type { IControlStore } from '../IControlStore.js'
import type { RenderClock } from '../RenderClock.js'
import { CustomActionEntityScope } from './CustomActionEntityScope.js'

/** The transient child group of a calling action, holding the actions of its copy of the custom action */
export const CUSTOM_ACTION_COPY_ACTIONS_GROUP = 'custom-action-copy:actions'
/** The transient child group of a calling action, holding the local variables of its copy of the custom action */
export const CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP = 'custom-action-copy:local-variables'

export type CustomActionInstancesForEntity = Pick<CustomActionInstanceManager, 'entityUpdate' | 'entityDelete'>

/**
 * The copy of a custom action held by an action which calls it
 */
interface PlacedCopy {
	/** The control holding the calling action */
	readonly controlId: SomeControlId
	/** The scope the calling action parses its options in */
	callerScope: EntityScope
	/** The control id of the custom action which was copied, if there is a copy */
	customActionControlId: CustomActionControlId | null
	/** The scope of the copy, or null if there is no copy */
	scope: CustomActionEntityScope | null
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
 * The lists of entities of a copy of a custom action
 */
interface CopyLists {
	readonly actions: ControlEntityList
	readonly localVariables: ControlEntityList
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
	readonly #copies = new Map<ControlEntityInstance, PlacedCopy>()

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
			this.#removeCopy(caller)
			return
		}

		const copy = this.#copies.get(caller)
		if (copy && copy.customActionControlId === CreateCustomActionControlId(caller.definitionId)) {
			copy.callerScope = callerScope
			this.#refreshInputs(caller, copy)
		} else {
			const newCopy: PlacedCopy = copy ?? {
				controlId,
				callerScope,
				customActionControlId: null,
				scope: null,
				inputVariables: this.#variableDependencies.create(this, controlId, caller),
			}
			newCopy.callerScope = callerScope
			this.#copies.set(caller, newCopy)
			this.#build(caller, newCopy)
		}
	}

	/**
	 * An action which calls a custom action has been removed or disabled, so remove its copy
	 * @param caller The action which calls a custom action
	 */
	entityDelete(caller: ControlEntityInstance): void {
		this.#removeCopy(caller)
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
	 * Get the scope of the copy held by an action which calls a custom action
	 * @param caller The action which calls a custom action
	 * @returns The scope, or undefined if the action has no copy
	 */
	getCopyScope(caller: ControlEntityInstance): CustomActionEntityScope | undefined {
		return this.#copies.get(caller)?.scope ?? undefined
	}

	/**
	 * Run the custom action called by an action, using a copy of it for just this run
	 * @param caller The action which calls a custom action
	 * @param parser A parser in the execution context of the caller, for its inputs
	 * @param extras The execution context of the caller
	 * @returns The result of the custom action
	 */
	async runCall(
		caller: ControlEntityInstance,
		parser: VariablesAndExpressionParser,
		extras: RunActionExtras,
		storeOutput: (target: StoreResult, value: JsonValue | undefined) => void
	): Promise<undefined> {
		const copy = this.#copies.get(caller)
		const copyScope = copy?.scope
		if (!copy || !copyScope) {
			// The custom action is unknown, or calling it would loop or nest too deeply
			this.#logger.silly(`Not running custom action "${caller.definitionId}", as it has no copy`)
			return undefined
		}

		const customAction = this.#controlStore.getControl(copyScope.values.customActionControlId)
		if (!(customAction instanceof ControlCustomAction)) return undefined

		// The inputs are fixed for the run, in the execution context of the caller
		const parseRes = customAction.parseCallInputs(caller.rawOptions, parser, copy.controlId)
		if (!parseRes.ok) {
			this.#logger.warn(
				`Failed to parse the inputs of custom action "${customAction.options.name}" in ${copy.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
			)
			throw new Error(
				`Failed to parse the inputs of custom action "${customAction.options.name}". One or more inputs were invalid\nErrors: ${JSON.stringify(parseRes.optionErrors)}`
			)
		}
		const options = parseRes.options

		const scope = new CustomActionEntityScope(
			customAction,
			copy.controlId,
			copyScope.customActionChain,
			this,
			this.#renderClock,
			this.#variableDependencies,
			{ customActionControlId: customAction.controlId, options, localValues: new Map() }
		)

		const runId = nanoid()

		// A run can be aborted on its own, as well as with its caller
		const abortController = new AbortController()
		const runExtras: RunActionExtras = {
			...extras,
			abortDelayed: AbortSignal.any([extras.abortDelayed, abortController.signal]),
		}

		const groupIds = {
			actions: `custom-action-run:${runId}:actions`,
			localVariables: `custom-action-run:${runId}:local-variables`,
		}

		this.#runs.set(runId, {
			runId,
			controlId: copy.controlId,
			startedAt: Date.now(),
			customActionControlId: customAction.controlId,
			useEntityId: getUseEntityId(caller.id),
			abortController,
		})
		this.events.emit('usageChanged')

		try {
			// Built inside the try, so that the groups are removed again if building them fails
			const lists = this.#buildCopyLists(caller, scope, customAction, groupIds, `${caller.id}@${runId}/`)

			// When the run sees what the copy held by the caller sees, it can start with its values
			if (isEqual(options, copyScope.values.options)) {
				const copyLists = getCopyLists(
					caller,
					CUSTOM_ACTION_COPY_ACTIONS_GROUP,
					CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP
				)
				if (copyLists) this.#copyRuntimeValues(lists, `${caller.id}@${runId}/`, copyLists, `${caller.id}/`)
			}

			// Where each local variable of the run is written as an output, resolved in the context of the caller
			const outputTargets = new Map<string, StoreResult[]>()
			for (const output of customAction.outputs) {
				if (!output.variableName) continue
				const rawTarget = Object.hasOwn(caller.rawOutputTargets, output.id)
					? caller.rawOutputTargets[output.id]
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

				const value = customAction.readRunLocalVariable(frame, runExtras, variableName)
				for (const target of targets) storeOutput(target, value)
			}

			const frame: CustomActionRunFrame = {
				...scope.values,
				getLocalVariableEntities: () => lists.localVariables.getDirectEntities(),
				localValueChanged: (name) => {
					scope.localValueChanged(name)
					// Outputs are written as they change, so that the caller can see the progress of a run
					writeOutput(name)
				},
			}

			await customAction.runActions(lists.actions.getDirectEntities(), frame, runExtras)

			// Write the final value of each output, which covers those computed from other variables
			for (const variableName of outputTargets.keys()) writeOutput(variableName)

			return undefined
		} finally {
			this.#runs.delete(runId)
			this.events.emit('usageChanged')

			caller.removeTransientChildGroup(groupIds.actions)
			caller.removeTransientChildGroup(groupIds.localVariables)
			scope.destroy()
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
			for (const [caller, copy] of [...this.#copies]) {
				if (this.#copies.get(caller) !== copy) continue

				if (changedIds.has(CreateCustomActionControlId(caller.definitionId))) {
					this.#build(caller, copy)
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
			const copy = this.#copies.get(hit.data)
			if (copy?.inputVariables !== hit) continue

			this.#refreshInputs(hit.data, copy)
		}
	}

	/**
	 * Build the copy held by a calling action, replacing any existing copy
	 */
	#build(caller: ControlEntityInstance, copy: PlacedCopy): void {
		this.#clearCopy(caller, copy)

		const customActionControlId = CreateCustomActionControlId(caller.definitionId)
		copy.customActionControlId = customActionControlId

		const customAction = this.#controlStore.getControl(customActionControlId)
		if (!(customAction instanceof ControlCustomAction)) return

		const chain = copy.callerScope.customActionChain
		if (chain.includes(customActionControlId)) {
			this.#logger.warn(`Not running "${customAction.options.name}" in ${copy.controlId}, as it calls itself`)
			return
		}
		if (chain.length >= MAX_CUSTOM_ACTION_DEPTH) {
			this.#logger.warn(`Not running "${customAction.options.name}" in ${copy.controlId}, as it is nested too deeply`)
			return
		}

		const parseRes = customAction.parseCallInputs(
			caller.rawOptions,
			copy.callerScope.createVariablesAndExpressionParser(null),
			copy.controlId
		)
		// Even when invalid, so that the copy is built once a variable they use changes
		copy.inputVariables.set(parseRes.referencedVariableIds)
		if (!parseRes.ok) {
			// Inactive until its inputs can be parsed, as a module feedback is
			this.#logger.warn(
				`Failed to parse the inputs of custom action "${customAction.options.name}" in ${copy.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
			)
			return
		}
		const options = parseRes.options

		const scope = new CustomActionEntityScope(
			customAction,
			copy.controlId,
			[...chain, customActionControlId],
			this,
			this.#renderClock,
			this.#variableDependencies,
			{ customActionControlId, options, localValues: new Map() }
		)
		copy.scope = scope

		this.#buildCopyLists(
			caller,
			scope,
			customAction,
			{ actions: CUSTOM_ACTION_COPY_ACTIONS_GROUP, localVariables: CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP },
			`${caller.id}/`
		)
	}

	/**
	 * Build the lists of entities of a copy of a custom action, as transient child groups of the calling action
	 * @param caller The action which calls the custom action
	 * @param scope The scope of the copy
	 * @param customAction The custom action to copy
	 * @param groupIds The ids of the child groups to hold the copy
	 * @param idPrefix The prefix for the ids of the copied entities, which must be unique within the control
	 */
	#buildCopyLists(
		caller: ControlEntityInstance,
		scope: CustomActionEntityScope,
		customAction: ControlCustomAction,
		groupIds: { actions: string; localVariables: string },
		idPrefix: string
	): CopyLists {
		// The local variables are built first, so that they are available to the actions as they are subscribed
		const localVariables = caller.setTransientChildGroup(
			groupIds.localVariables,
			scope,
			{ type: EntityModelType.Feedback, feedbackListType: FeedbackEntitySubType.Value },
			deriveEntityIds(
				idPrefix,
				customAction.entities.getLocalVariableEntities().map((entity) => entity.asEntityModel(true))
			)
		)
		scope.setEntityLists(null, localVariables)

		const actions = caller.setTransientChildGroup(
			groupIds.actions,
			scope,
			{ type: EntityModelType.Action },
			deriveEntityIds(
				idPrefix,
				customAction.entities.getActionEntities().map((entity) => entity.asEntityModel(true))
			)
		)
		scope.setEntityLists(actions, localVariables)

		return { actions, localVariables }
	}

	/**
	 * Give the entities of a new copy the runtime values of an existing copy of the same custom action, including the
	 * copies of any custom actions they call which have the same inputs
	 * @param target The lists of the new copy
	 * @param targetPrefix The prefix of the ids in the new copy
	 * @param source The lists of the existing copy
	 * @param sourcePrefix The prefix of the ids in the existing copy
	 */
	#copyRuntimeValues(target: CopyLists, targetPrefix: string, source: CopyLists, sourcePrefix: string): void {
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
			const targetScope = this.getCopyScope(entity)
			const sourceScope = this.getCopyScope(sourceEntity)
			if (!targetScope || !sourceScope || !isEqual(targetScope.values.options, sourceScope.values.options)) continue

			const targetLists = getCopyLists(
				entity,
				CUSTOM_ACTION_COPY_ACTIONS_GROUP,
				CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP
			)
			const sourceLists = getCopyLists(
				sourceEntity,
				CUSTOM_ACTION_COPY_ACTIONS_GROUP,
				CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP
			)
			if (targetLists && sourceLists) {
				this.#copyRuntimeValues(targetLists, `${entity.id}/`, sourceLists, `${sourceEntity.id}/`)
			}
		}
	}

	/**
	 * Re-parse the inputs of a copy, and re-subscribe its entities if they have changed
	 */
	#refreshInputs(caller: ControlEntityInstance, copy: PlacedCopy): void {
		const scope = copy.scope
		if (!scope) {
			// Inactive because its inputs were invalid, so try building it again
			this.#build(caller, copy)
			return
		}

		const customAction = this.#controlStore.getControl(scope.values.customActionControlId)
		if (!(customAction instanceof ControlCustomAction)) return

		const parseRes = customAction.parseCallInputs(
			caller.rawOptions,
			copy.callerScope.createVariablesAndExpressionParser(null),
			copy.controlId
		)
		if (!parseRes.ok) {
			// It becomes inactive, which building it again does
			this.#build(caller, copy)
			return
		}
		copy.inputVariables.set(parseRes.referencedVariableIds)

		if (isEqual(parseRes.options, scope.values.options)) return

		scope.setValues({ ...scope.values, options: parseRes.options })
	}

	/**
	 * Remove the entities and scope of a copy
	 */
	#clearCopy(caller: ControlEntityInstance, copy: PlacedCopy): void {
		caller.removeTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)
		caller.removeTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)

		copy.scope?.destroy()
		copy.scope = null
		copy.customActionControlId = null
		copy.inputVariables.set(null)
	}

	#removeCopy(caller: ControlEntityInstance): void {
		const copy = this.#copies.get(caller)
		if (!copy) return

		this.#copies.delete(caller)
		this.#clearCopy(caller, copy)
		copy.inputVariables.dispose()
	}
}

/**
 * Get the lists of a copy of a custom action held by a calling action
 */
function getCopyLists(
	caller: ControlEntityInstance,
	actionsGroupId: string,
	localVariablesGroupId: string
): CopyLists | null {
	const actions = caller.getTransientChildGroup(actionsGroupId)
	const localVariables = caller.getTransientChildGroup(localVariablesGroupId)
	if (!actions || !localVariables) return null
	return { actions, localVariables }
}

/**
 * Prefix the ids of some entities and their children, so that copies of them have their own ids
 */
function deriveEntityIds(prefix: string, models: SomeEntityModel[]): SomeEntityModel[] {
	return models.map((model) => {
		const children = model.children
		return {
			...model,
			id: `${prefix}${model.id}`,
			...(children && {
				children: Object.fromEntries(
					Object.entries(children).map(([groupId, entities]) => [
						groupId,
						entities ? deriveEntityIds(prefix, entities) : entities,
					])
				),
			}),
		}
	})
}
