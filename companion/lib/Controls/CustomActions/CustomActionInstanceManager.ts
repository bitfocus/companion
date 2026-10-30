import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import { isCustomActionsConnectionId, isCustomFeedbacksConnectionId } from '@companion-app/shared/ConnectionId.js'
import { CreateCustomActionControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { RunActionExtras } from '../../Instance/Connection/ChildHandlerApi.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import { ControlCustomAction } from '../ControlTypes/CustomAction.js'
import type { CustomActionRunFrame } from '../CustomActionRunFrame.js'
import { CustomEntityCopyManager, deriveEntityIds } from '../CustomEntities/CustomEntityCopyManager.js'
import { CustomEntityScope } from '../CustomEntities/CustomEntityScope.js'
import type { CustomEntityValues } from '../CustomEntities/Types.js'
import type { CustomFeedbackInstanceManager } from '../CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import { resolveStoreResult } from '../Entities/EntitySpecialExpressionManager.js'
import type { EntityScope, StoreResult } from '../Entities/Types.js'
import type { IControlStore } from '../IControlStore.js'
import type { RenderClock } from '../RenderClock.js'

/** The transient child group of a calling action, holding the actions of its copy of the custom action */
export const CUSTOM_ACTION_COPY_ACTIONS_GROUP = 'custom-action-copy:actions'
/** The transient child group of a calling action, holding the local variables of its copy of the custom action */
export const CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP = 'custom-action-copy:local-variables'

export type CustomActionInstancesForEntity = Pick<CustomActionInstanceManager, 'entityUpdate' | 'entityDelete'>

type CustomFeedbackInstancesForCustomActions = Pick<
	CustomFeedbackInstanceManager,
	'entityUpdate' | 'entityDelete' | 'copyRuntimeValues'
>

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
export class CustomActionInstanceManager extends CustomEntityCopyManager<ControlCustomAction> {
	/** For any copies of custom feedbacks inside the copies */
	readonly #customFeedbackInstances: CustomFeedbackInstancesForCustomActions

	constructor(
		controlStore: Pick<IControlStore, 'getControl' | 'updateFeedbackValues'>,
		renderClock: RenderClock,
		customFeedbackInstances: CustomFeedbackInstancesForCustomActions
	) {
		super('Controls/CustomActions/InstanceManager', controlStore, renderClock)

		this.#customFeedbackInstances = customFeedbackInstances
	}

	protected getSourceControlId(caller: ControlEntityInstance): string {
		return CreateCustomActionControlId(caller.definitionId)
	}

	protected getSource(controlId: string): ControlCustomAction | undefined {
		const control = this.controlStore.getControl(controlId)
		return control instanceof ControlCustomAction ? control : undefined
	}

	protected createScope(
		_caller: ControlEntityInstance,
		_callerScope: EntityScope,
		source: ControlCustomAction,
		callerControlId: string,
		chain: ReadonlyArray<string>,
		values: CustomEntityValues
	): CustomEntityScope {
		// The values of the copy are only read when it is run, so nothing needs telling when they change
		return new CustomEntityScope(
			source,
			callerControlId,
			chain,
			this,
			this.#customFeedbackInstances,
			this.renderClock,
			values,
			null
		)
	}

	protected buildHeldCopy(caller: ControlEntityInstance, scope: CustomEntityScope, source: ControlCustomAction): void {
		this.#buildCopyLists(
			caller,
			scope,
			source,
			{ actions: CUSTOM_ACTION_COPY_ACTIONS_GROUP, localVariables: CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP },
			`${caller.id}/`
		)
	}

	protected clearHeldCopy(caller: ControlEntityInstance): void {
		caller.removeTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)
		caller.removeTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)
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
		const copy = this.getPlacedCopy(caller)
		const copyScope = copy?.scope
		if (!copy || !copyScope || !copy.sourceControlId) {
			// The custom action is unknown, or calling it would loop or nest too deeply
			this.logger.silly(`Not running custom action "${caller.definitionId}", as it has no copy`)
			return undefined
		}

		const customAction = this.getSource(copy.sourceControlId)
		if (!customAction) return undefined

		// The inputs are fixed for the run, in the execution context of the caller
		const { options } = customAction.parseCallInputs(caller.rawOptions, parser, copy.controlId)

		const scope = new CustomEntityScope(
			customAction,
			copy.controlId,
			copyScope.customActionChain,
			this,
			this.#customFeedbackInstances,
			this.renderClock,
			{ options, localValues: new Map() },
			null
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

		// Where each local variable of the run is written as an output, resolved in the context of the caller
		const outputTargets = new Map<string, StoreResult[]>()
		for (const output of customAction.outputs) {
			if (!output.variableName) continue
			const target = resolveStoreResult(caller.rawOutputTargets[output.id], parser, this.logger)
			if (!target) continue

			const targets = outputTargets.get(output.variableName) ?? []
			targets.push(target)
			outputTargets.set(output.variableName, targets)
		}

		const writeOutput = (variableName: string) => {
			const targets = outputTargets.get(variableName)
			if (!targets) return

			const value = customAction.readRunLocalVariable(frame, extras, variableName)
			for (const target of targets) storeOutput(target, value)
		}

		const frame: CustomActionRunFrame = {
			...scope.values,
			customActionControlId: customAction.controlId,
			getLocalVariableEntities: () => lists.localVariables.getDirectEntities(),
			localValueChanged: (name) => {
				scope.localValueChanged(name)
				// Outputs are written as they change, so that the caller can see the progress of a run
				writeOutput(name)
			},
		}

		try {
			await customAction.runActions(lists.actions.getDirectEntities(), frame, extras)

			// Write the final value of each output, which covers those computed from other variables
			if (!extras.abortDelayed.aborted) {
				for (const variableName of outputTargets.keys()) writeOutput(variableName)
			}

			return undefined
		} finally {
			caller.removeTransientChildGroup(groupIds.actions)
			caller.removeTransientChildGroup(groupIds.localVariables)
			scope.destroy()
		}
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
		scope: CustomEntityScope,
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
			),
			null
		)
		scope.setEntityLists(null, localVariables)

		const actions = caller.setTransientChildGroup(
			groupIds.actions,
			scope,
			{ type: EntityModelType.Action },
			deriveEntityIds(
				idPrefix,
				customAction.entities.getActionEntities().map((entity) => entity.asEntityModel(true))
			),
			null
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

			if (isCustomFeedbacksConnectionId(entity.connectionId)) {
				// The custom feedback this uses has its own copy, which can also start from the existing one
				this.#customFeedbackInstances.copyRuntimeValues(entity, sourceEntity)
				continue
			}
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
