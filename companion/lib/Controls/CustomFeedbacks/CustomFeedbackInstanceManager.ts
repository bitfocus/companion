import isEqual from 'fast-deep-equal'
import { CUSTOM_FEEDBACKS_CONNECTION_ID, isCustomFeedbacksConnectionId } from '@companion-app/shared/ConnectionId.js'
import { CreateCustomFeedbackControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { ControlCustomFeedback } from '../ControlTypes/CustomFeedback.js'
import { CustomEntityCopyManager, deriveEntityIds } from '../CustomEntities/CustomEntityCopyManager.js'
import { CustomEntityScope } from '../CustomEntities/CustomEntityScope.js'
import type { CustomEntityValues } from '../CustomEntities/Types.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { EntityScope, NewFeedbackValue } from '../Entities/Types.js'
import type { IControlStore } from '../IControlStore.js'
import type { RenderClock } from '../RenderClock.js'

/** The transient child group of a calling feedback, holding the feedbacks of its copy of the custom feedback */
export const CUSTOM_FEEDBACK_COPY_FEEDBACKS_GROUP = 'custom-feedback-copy:feedbacks'
/** The transient child group of a calling feedback, holding the local variables of its copy of the custom feedback */
export const CUSTOM_FEEDBACK_COPY_LOCAL_VARIABLES_GROUP = 'custom-feedback-copy:local-variables'

export type CustomFeedbackInstancesForEntity = Pick<CustomFeedbackInstanceManager, 'entityUpdate' | 'entityDelete'>

/**
 * Every feedback which uses a custom feedback holds a copy of the custom feedback's feedbacks and local variables,
 * subscribed with the inputs given by that feedback.
 *
 * The value of the calling feedback is computed from its copy, and given to it in the same way as a connection gives
 * a feedback its value. Unlike a custom action, there is no run to keep apart from changes, so the copy held by the
 * calling feedback is the only one.
 *
 * The copies are never persisted, and are rebuilt whenever the custom feedback changes.
 */
export class CustomFeedbackInstanceManager extends CustomEntityCopyManager<ControlCustomFeedback> {
	/** The calling feedbacks whose value needs computing again */
	#pendingValueCallers = new Set<ControlEntityInstance>()

	constructor(controlStore: Pick<IControlStore, 'getControl' | 'updateFeedbackValues'>, renderClock: RenderClock) {
		super('Controls/CustomFeedbacks/InstanceManager', controlStore, renderClock)
	}

	override entityUpdate(caller: ControlEntityInstance, controlId: string, callerScope: EntityScope): void {
		super.entityUpdate(caller, controlId, callerScope)

		// A change to the calling feedback clears its value, even when its copy is unchanged
		this.#queueValueUpdate(caller)
	}

	protected getSourceControlId(caller: ControlEntityInstance): string {
		return CreateCustomFeedbackControlId(caller.definitionId)
	}

	protected getSource(controlId: string): ControlCustomFeedback | undefined {
		const control = this.controlStore.getControl(controlId)
		return control instanceof ControlCustomFeedback ? control : undefined
	}

	protected createScope(
		caller: ControlEntityInstance,
		callerScope: EntityScope,
		source: ControlCustomFeedback,
		callerControlId: string,
		chain: ReadonlyArray<string>,
		values: CustomEntityValues
	): CustomEntityScope {
		return new CustomEntityScope(
			source,
			callerControlId,
			chain,
			// A custom feedback has no actions, but its entities share the scope of the caller for any it may gain
			callerScope.customActionInstances,
			this,
			this.renderClock,
			values,
			() => this.#queueValueUpdate(caller)
		)
	}

	protected buildHeldCopy(
		caller: ControlEntityInstance,
		scope: CustomEntityScope,
		source: ControlCustomFeedback
	): void {
		const idPrefix = `${caller.id}/`

		// The local variables are built first, so that they are available to the feedbacks as they are subscribed
		const localVariables = caller.setTransientChildGroup(
			CUSTOM_FEEDBACK_COPY_LOCAL_VARIABLES_GROUP,
			scope,
			{ type: EntityModelType.Feedback, feedbackListType: FeedbackEntitySubType.Value },
			deriveEntityIds(
				idPrefix,
				source.entities.getLocalVariableEntities().map((entity) => entity.asEntityModel(true))
			),
			(changed) => {
				// Nothing is run to read the variables at the time, so anything using them must be told
				for (const entity of changed) {
					const name = entity.rawLocalVariableName
					if (name) scope.localValueChanged(name)
				}
			}
		)
		scope.setEntityLists(null, localVariables)

		const feedbacks = caller.setTransientChildGroup(
			CUSTOM_FEEDBACK_COPY_FEEDBACKS_GROUP,
			scope,
			{ type: EntityModelType.Feedback, feedbackListType: FeedbackEntitySubType.Boolean },
			deriveEntityIds(
				idPrefix,
				source.entities.getFeedbackEntities().map((entity) => entity.asEntityModel(true))
			),
			() => this.#queueValueUpdate(caller)
		)
		scope.setEntityLists(feedbacks, localVariables)

		this.#queueValueUpdate(caller)
	}

	protected clearHeldCopy(caller: ControlEntityInstance): void {
		caller.removeTransientChildGroup(CUSTOM_FEEDBACK_COPY_FEEDBACKS_GROUP)
		caller.removeTransientChildGroup(CUSTOM_FEEDBACK_COPY_LOCAL_VARIABLES_GROUP)

		// Without a copy, the feedback is false
		this.#queueValueUpdate(caller)
	}

	/**
	 * Give the copy held by a calling feedback the runtime values of the copy held by another, which is a copy of the
	 * same calling feedback in the same circumstances (eg for a run of a custom action). This lets the new copy be used
	 * straight away, without waiting for the values to be recomputed
	 * @param target The calling feedback of the new copy
	 * @param source The calling feedback of the existing copy
	 */
	copyRuntimeValues(target: ControlEntityInstance, source: ControlEntityInstance): void {
		const targetScope = this.getCopyScope(target)
		const sourceScope = this.getCopyScope(source)
		if (!targetScope || !sourceScope || !isEqual(targetScope.values.options, sourceScope.values.options)) return

		const sourceEntities = new Map<string, ControlEntityInstance>()
		for (const entity of getCopyEntities(source)) {
			sourceEntities.set(entity.id.slice(source.id.length + 1), entity)
		}

		for (const entity of getCopyEntities(target)) {
			const sourceEntity = sourceEntities.get(entity.id.slice(target.id.length + 1))
			if (!sourceEntity) continue

			entity.copyRuntimeValuesFrom(sourceEntity)

			if (isCustomFeedbacksConnectionId(entity.connectionId)) this.copyRuntimeValues(entity, sourceEntity)
		}

		this.#queueValueUpdate(target)
	}

	/**
	 * Compute the value of a calling feedback again, once the current changes are complete
	 */
	#queueValueUpdate(caller: ControlEntityInstance): void {
		if (this.#pendingValueCallers.size === 0) queueMicrotask(() => this.#updateValues())
		this.#pendingValueCallers.add(caller)
	}

	#updateValues(): void {
		const callers = this.#pendingValueCallers
		this.#pendingValueCallers = new Set()

		const newValues: NewFeedbackValue[] = []
		for (const caller of callers) {
			// A feedback which no longer has a copy has been removed or disabled, so has no value to give
			const copy = this.getPlacedCopy(caller)
			if (!copy) continue

			newValues.push({ entityId: caller.id, controlId: copy.controlId, value: computeCopyValue(caller, !!copy.scope) })
		}

		if (newValues.length > 0) this.controlStore.updateFeedbackValues(CUSTOM_FEEDBACKS_CONNECTION_ID, newValues)
	}
}

/**
 * Compute the value of a calling feedback from its copy: true when it has some feedbacks, and all of them are true
 * @param caller The feedback which uses the custom feedback
 * @param hasCopy Whether the feedback has a copy, as it may have been refused one (eg for using itself)
 */
function computeCopyValue(caller: ControlEntityInstance, hasCopy: boolean): boolean {
	if (!hasCopy) return false

	const values = caller
		.getTransientChildGroup(CUSTOM_FEEDBACK_COPY_FEEDBACKS_GROUP)
		?.getChildBooleanFeedbackValues(null)
	return !!values && values.length > 0 && values.every((value) => value)
}

/**
 * Get all the entities of the copy held by a calling feedback
 */
function getCopyEntities(caller: ControlEntityInstance): ControlEntityInstance[] {
	return [CUSTOM_FEEDBACK_COPY_LOCAL_VARIABLES_GROUP, CUSTOM_FEEDBACK_COPY_FEEDBACKS_GROUP].flatMap(
		(groupId) => caller.getTransientChildGroup(groupId)?.getAllEntities() ?? []
	)
}
