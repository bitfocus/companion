import debounceFn from 'debounce-fn'
import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import { isCustomActionsConnectionId } from '@companion-app/shared/ConnectionId.js'
import { CreateCustomActionControlId } from '@companion-app/shared/ControlId.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { RunActionExtras } from '../../Instance/Connection/ChildHandlerApi.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import { ControlCustomAction } from '../ControlTypes/CustomAction.js'
import { MAX_CUSTOM_ACTION_DEPTH, type CustomActionRunFrame } from '../CustomActionRunFrame.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import type { EntityScope } from '../Entities/Types.js'
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
	readonly controlId: string
	/** The scope the calling action parses its options in */
	callerScope: EntityScope
	/** The control id of the custom action which was copied, if there is a copy */
	customActionControlId: string | null
	/** The scope of the copy, or null if there is no copy */
	scope: CustomActionEntityScope | null
	/** The variables the inputs of the copy referenced when they were parsed */
	referencedVariableIds: ReadonlySet<string>
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
export class CustomActionInstanceManager {
	readonly #logger: Logger = LogController.createLogger('Controls/CustomActions/InstanceManager')

	readonly #controlStore: Pick<IControlStore, 'getControl'>
	readonly #renderClock: RenderClock

	/** The copies, by the action which calls the custom action */
	readonly #copies = new Map<ControlEntityInstance, PlacedCopy>()

	/** The custom actions which have changed, so their copies need rebuilding */
	#changedCustomActionIds = new Set<string>()

	constructor(controlStore: Pick<IControlStore, 'getControl'>, renderClock: RenderClock) {
		this.#controlStore = controlStore
		this.#renderClock = renderClock
	}

	/**
	 * An action which calls a custom action has been added or changed, so build or update its copy
	 * @param caller The action which calls a custom action
	 * @param controlId The control holding the action
	 * @param callerScope The scope the action parses its options in
	 */
	entityUpdate(caller: ControlEntityInstance, controlId: string, callerScope: EntityScope): void {
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
				referencedVariableIds: new Set(),
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
		extras: RunActionExtras
	): Promise<JsonValue | undefined> {
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
		const { options } = customAction.parseCallInputs(caller.rawOptions, parser)

		const scope = new CustomActionEntityScope(
			customAction,
			copy.controlId,
			copyScope.customActionChain,
			this,
			this.#renderClock,
			{ customActionControlId: customAction.controlId, options, localValues: new Map() }
		)

		const runId = nanoid()
		const groupIds = {
			actions: `custom-action-run:${runId}:actions`,
			localVariables: `custom-action-run:${runId}:local-variables`,
		}
		const lists = this.#buildCopyLists(caller, scope, customAction, groupIds, `${caller.id}@${runId}/`)

		// When the run sees what the copy held by the caller sees, it can start with its values
		if (isEqual(options, copyScope.values.options)) {
			const copyLists = getCopyLists(caller, CUSTOM_ACTION_COPY_ACTIONS_GROUP, CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)
			if (copyLists) this.#copyRuntimeValues(lists, `${caller.id}@${runId}/`, copyLists, `${caller.id}/`)
		}

		const frame: CustomActionRunFrame = {
			...scope.values,
			getLocalVariableEntities: () => lists.localVariables.getDirectEntities(),
			localValueChanged: (name) => scope.localValueChanged(name),
		}

		try {
			return await customAction.runActions(lists.actions.getDirectEntities(), frame, extras)
		} finally {
			caller.removeTransientChildGroup(groupIds.actions)
			caller.removeTransientChildGroup(groupIds.localVariables)
			scope.destroy()
		}
	}

	/**
	 * A custom action has been changed or deleted, so its copies need rebuilding
	 * @param customActionControlId The control id of the custom action
	 */
	onCustomActionChanged(customActionControlId: string): void {
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
	 * Some variables have changed, so re-parse the inputs of any copies which used them
	 * @param changedVariables The ids of the variables which changed
	 * @param controlIdFilter If set, only the controls the change applies to
	 */
	onVariablesChanged(changedVariables: ReadonlySet<string>, controlIdFilter: ReadonlySet<string> | null): void {
		// Re-parsing the inputs of a copy can replace the copies nested inside it, so work from a snapshot
		for (const [caller, copy] of [...this.#copies]) {
			if (this.#copies.get(caller) !== copy) continue
			if (controlIdFilter && !controlIdFilter.has(copy.controlId)) continue

			copy.scope?.specialExpressionManager.onVariablesChanged(changedVariables)

			if (!changedVariables.isDisjointFrom(copy.referencedVariableIds)) {
				this.#refreshInputs(caller, copy)
			}
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

		const { options, referencedVariableIds } = customAction.parseCallInputs(
			caller.rawOptions,
			copy.callerScope.createVariablesAndExpressionParser(null)
		)
		copy.referencedVariableIds = referencedVariableIds

		const scope = new CustomActionEntityScope(
			customAction,
			copy.controlId,
			[...chain, customActionControlId],
			this,
			this.#renderClock,
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
		if (!scope) return

		const customAction = this.#controlStore.getControl(scope.values.customActionControlId)
		if (!(customAction instanceof ControlCustomAction)) return

		const { options, referencedVariableIds } = customAction.parseCallInputs(
			caller.rawOptions,
			copy.callerScope.createVariablesAndExpressionParser(null)
		)
		copy.referencedVariableIds = referencedVariableIds

		if (isEqual(options, scope.values.options)) return

		scope.setValues({ ...scope.values, options })
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
		copy.referencedVariableIds = new Set()
	}

	#removeCopy(caller: ControlEntityInstance): void {
		const copy = this.#copies.get(caller)
		if (!copy) return

		this.#copies.delete(caller)
		this.#clearCopy(caller, copy)
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
