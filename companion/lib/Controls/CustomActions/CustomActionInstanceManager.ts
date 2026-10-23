import debounceFn from 'debounce-fn'
import isEqual from 'fast-deep-equal'
import { CreateCustomActionControlId } from '@companion-app/shared/ControlId.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import { ControlCustomAction } from '../ControlTypes/CustomAction.js'
import { MAX_CUSTOM_ACTION_DEPTH } from '../CustomActionRunFrame.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
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
	/** The action which calls the custom action */
	readonly caller: ControlEntityInstance
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
 * Every action which calls a custom action holds a copy of the custom action's actions and local variables.
 * The copy is subscribed with the inputs given by that action, so that the feedbacks and actions of the custom action
 * can depend on its inputs, and have their values ready before the custom action is run.
 *
 * The copies are never persisted, and are rebuilt whenever the custom action changes.
 */
export class CustomActionInstanceManager {
	readonly #logger: Logger = LogController.createLogger('Controls/CustomActions/InstanceManager')

	readonly #controlStore: Pick<IControlStore, 'getControl'>
	readonly #renderClock: RenderClock

	/** The copies, by the control id and id of the calling action */
	readonly #copies = new Map<string, PlacedCopy>()

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
		const key = copyKey(controlId, caller.id)

		const existing = this.#copies.get(key)
		if (existing && existing.caller !== caller) this.#removeCopy(key)

		if (caller.disabled) {
			// A disabled action has nothing subscribed
			this.#removeCopy(key)
			return
		}

		const copy = this.#copies.get(key)
		if (copy && copy.customActionControlId === CreateCustomActionControlId(caller.definitionId)) {
			copy.callerScope = callerScope
			this.#refreshInputs(copy)
		} else {
			const newCopy: PlacedCopy = copy ?? {
				caller,
				controlId,
				callerScope,
				customActionControlId: null,
				scope: null,
				referencedVariableIds: new Set(),
			}
			newCopy.callerScope = callerScope
			this.#copies.set(key, newCopy)
			this.#build(newCopy)
		}
	}

	/**
	 * An action which calls a custom action has been removed or disabled, so remove its copy
	 * @param caller The action which calls a custom action
	 * @param controlId The control holding the action
	 */
	entityDelete(caller: ControlEntityInstance, controlId: string): void {
		const key = copyKey(controlId, caller.id)
		if (this.#copies.get(key)?.caller !== caller) return

		this.#removeCopy(key)
	}

	/**
	 * Get the scope of the copy held by an action which calls a custom action
	 * @param caller The action which calls a custom action
	 * @param controlId The control holding the action
	 * @returns The scope, or undefined if the action has no copy
	 */
	getCopyScope(caller: ControlEntityInstance, controlId: string): CustomActionEntityScope | undefined {
		const copy = this.#copies.get(copyKey(controlId, caller.id))
		if (copy?.caller !== caller) return undefined
		return copy.scope ?? undefined
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
			for (const [key, copy] of [...this.#copies]) {
				if (this.#copies.get(key) !== copy) continue

				if (changedIds.has(CreateCustomActionControlId(copy.caller.definitionId))) {
					this.#build(copy)
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
		for (const [key, copy] of [...this.#copies]) {
			if (this.#copies.get(key) !== copy) continue
			if (controlIdFilter && !controlIdFilter.has(copy.controlId)) continue

			copy.scope?.specialExpressionManager.onVariablesChanged(changedVariables)

			if (!changedVariables.isDisjointFrom(copy.referencedVariableIds)) {
				this.#refreshInputs(copy)
			}
		}
	}

	/**
	 * Build the copy held by a calling action, replacing any existing copy
	 */
	#build(copy: PlacedCopy): void {
		this.#clearCopy(copy)

		const customActionControlId = CreateCustomActionControlId(copy.caller.definitionId)
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
			copy.caller.rawOptions,
			copy.callerScope.createVariablesAndExpressionParser(null)
		)
		copy.referencedVariableIds = referencedVariableIds

		const scope = new CustomActionEntityScope(
			customAction,
			copy.controlId,
			[...chain, customActionControlId],
			this,
			this.#renderClock,
			{
				customActionControlId,
				options: options,
				localValues: new Map(),
				depth: chain.length + 1,
			}
		)
		copy.scope = scope

		// The ids are derived from the calling action, so that they are stable and unique within the control
		const idPrefix = `${copy.caller.id}/`

		// The local variables are built first, so that they are available to the actions as they are subscribed
		const localVariables = copy.caller.setTransientChildGroup(
			CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP,
			scope,
			{ type: EntityModelType.Feedback, feedbackListType: FeedbackEntitySubType.Value },
			deriveEntityIds(
				idPrefix,
				customAction.entities.getLocalVariableEntities().map((entity) => entity.asEntityModel(true))
			)
		)
		scope.setEntityLists(null, localVariables)

		const actions = copy.caller.setTransientChildGroup(
			CUSTOM_ACTION_COPY_ACTIONS_GROUP,
			scope,
			{ type: EntityModelType.Action },
			deriveEntityIds(
				idPrefix,
				customAction.entities.getActionEntities().map((entity) => entity.asEntityModel(true))
			)
		)
		scope.setEntityLists(actions, localVariables)
	}

	/**
	 * Re-parse the inputs of a copy, and re-subscribe its entities if they have changed
	 */
	#refreshInputs(copy: PlacedCopy): void {
		const scope = copy.scope
		if (!scope) return

		const customAction = this.#controlStore.getControl(scope.frame.customActionControlId)
		if (!(customAction instanceof ControlCustomAction)) return

		const { options, referencedVariableIds } = customAction.parseCallInputs(
			copy.caller.rawOptions,
			copy.callerScope.createVariablesAndExpressionParser(null)
		)
		copy.referencedVariableIds = referencedVariableIds

		if (isEqual(options, scope.frame.options)) return

		scope.setFrame({ ...scope.frame, options: options })

		// Re-subscribe the entities, so that they are parsed with the new inputs
		copy.caller.getTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)?.subscribe(true)
		copy.caller.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)?.subscribe(true)
	}

	/**
	 * Remove the entities and scope of a copy
	 */
	#clearCopy(copy: PlacedCopy): void {
		copy.caller.removeTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)
		copy.caller.removeTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)

		copy.scope?.destroy()
		copy.scope = null
		copy.customActionControlId = null
		copy.referencedVariableIds = new Set()
	}

	#removeCopy(key: string): void {
		const copy = this.#copies.get(key)
		if (!copy) return

		this.#copies.delete(key)
		this.#clearCopy(copy)
	}
}

function copyKey(controlId: string, entityId: string): string {
	return `${controlId}\0${entityId}`
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
