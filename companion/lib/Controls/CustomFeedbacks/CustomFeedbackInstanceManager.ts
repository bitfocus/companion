import { nanoid } from 'nanoid'
import { CUSTOM_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { CreateCustomFeedbackControlId, type CustomFeedbackControlId } from '@companion-app/shared/ControlId.js'
import { isCustomFeedbackUse } from '@companion-app/shared/Model/EntityModel.js'
import type { CompanionOptionValues } from '@companion-module/base'
import LogController from '../../Log/Controller.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import { ControlCustomFeedback } from '../ControlTypes/CustomFeedback.js'
import {
	CustomEntityInstanceManager,
	isCustomCopyRecursive,
	type CustomEntityCallerState,
} from '../CustomEntities/CustomEntityInstanceManager.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { FeedbackExecutionContext, NewFeedbackValue } from '../Entities/Types.js'
import type { IControlStore } from '../IControlStore.js'
import type { RenderClock } from '../RenderClock.js'
import { CustomFeedbackCopy, type CustomFeedbackValues } from './CustomFeedbackCopy.js'

/** The key of the copy of a custom feedback held by a feedback which uses it */
export const CUSTOM_FEEDBACK_HELD_COPY = 'custom-feedback'

export type CustomFeedbackInstancesForEntity = Pick<
	CustomFeedbackInstanceManager,
	'entityUpdate' | 'entityDelete' | 'evaluateLive'
>

/**
 * Every feedback which uses a custom feedback holds a copy of the custom feedback's feedbacks and local variables,
 * subscribed with the inputs given by that feedback.
 *
 * The value of the calling feedback is computed from its copy, and given to it in the same way as a connection gives
 * a feedback its value. Unlike a custom action there is no run, whose inputs need freezing while it runs, so the copy
 * held by the calling feedback is the only one.
 */
export class CustomFeedbackInstanceManager extends CustomEntityInstanceManager<
	CustomFeedbackControlId,
	ControlCustomFeedback,
	CustomFeedbackValues,
	CustomFeedbackCopy
> {
	readonly #controlStore: Pick<IControlStore, 'getControl' | 'updateFeedbackValues'>
	readonly #renderClock: RenderClock

	/** The calling feedbacks whose value needs computing again */
	#pendingValueCallers = new Set<ControlEntityInstance>()

	constructor(
		controlStore: Pick<IControlStore, 'getControl' | 'updateFeedbackValues'>,
		renderClock: RenderClock,
		variableDependencies: VariableDependencyRegistry
	) {
		super(
			LogController.createLogger('Controls/CustomFeedbacks/InstanceManager'),
			variableDependencies,
			'custom feedback',
			CUSTOM_FEEDBACK_HELD_COPY
		)
		this.#controlStore = controlStore
		this.#renderClock = renderClock
	}

	protected toCustomControlId(definitionId: string): CustomFeedbackControlId {
		return CreateCustomFeedbackControlId(definitionId)
	}

	protected getCustomControl(customControlId: CustomFeedbackControlId): ControlCustomFeedback | undefined {
		const control = this.#controlStore.getControl(customControlId)
		return control instanceof ControlCustomFeedback ? control : undefined
	}

	protected createHeldCopy(
		customFeedback: ControlCustomFeedback,
		caller: ControlEntityInstance,
		state: CustomEntityCallerState<CustomFeedbackControlId, CustomFeedbackCopy>,
		chain: ReadonlyArray<string>,
		inputValues: CompanionOptionValues
	): CustomFeedbackCopy {
		return new CustomFeedbackCopy(
			customFeedback,
			caller,
			state.controlId,
			`${caller.id}/`,
			chain,
			state.callerScope.customActionInstances,
			this,
			this.#renderClock,
			this.variableDependencies,
			{ customFeedbackControlId: this.toCustomControlId(caller.definitionId), inputValues, localValues: new Map() },
			() => this.#queueValueUpdate(caller)
		)
	}

	protected copyNestedRuntimeValues(target: ControlEntityInstance, source: ControlEntityInstance): void {
		if (isCustomFeedbackUse(target)) this.copyRuntimeValues(target, source)
	}

	protected callerChanged(caller: ControlEntityInstance): void {
		// The value of a calling feedback comes from its copy, so is computed again whenever either changes
		this.#queueValueUpdate(caller)
	}

	/**
	 * A custom feedback has been changed or deleted, so its copies need rebuilding
	 * @param customFeedbackControlId The control id of the custom feedback
	 */
	onCustomFeedbackChanged(customFeedbackControlId: CustomFeedbackControlId): void {
		this.customControlChanged(customFeedbackControlId)
	}

	/**
	 * Evaluate a calling feedback now, in the execution context of an action it is a condition of, rather than using
	 * its cached value. Its inputs are parsed in that context, so that they see what the action has just done, and
	 * the internal feedbacks of its copy are evaluated with them and the `$(this:*)` variables of the execution.
	 * As anywhere else, connection feedbacks can only provide their cached values, from the inputs of the copy
	 * @param caller The feedback which uses a custom feedback
	 * @param context The execution context
	 * @returns Its value, or undefined when it has none, such as when an input is invalid
	 */
	evaluateLive(caller: ControlEntityInstance, context: FeedbackExecutionContext): boolean | undefined {
		const state = this.getCallerState(caller)
		if (!state) return undefined

		// Not only the copy held by the caller, as its inputs are parsed outside of any execution, so may be invalid where
		// they are not here (eg using $(this:delta))
		const customFeedbackControlId = CreateCustomFeedbackControlId(caller.definitionId)
		const customFeedback = this.#controlStore.getControl(customFeedbackControlId)
		if (!(customFeedback instanceof ControlCustomFeedback)) return undefined

		const chain = state.callerScope.customActionChain
		if (isCustomCopyRecursive(chain, customFeedbackControlId)) return undefined

		// Invalid inputs make it inactive, as they do the copy
		const parseRes = customFeedback.parseCallInputs(caller.rawOptions, context.parser, state.controlId)
		if (!parseRes.ok) return undefined

		const evaluateCopy = (copy: CustomFeedbackCopy): boolean => {
			const parser = customFeedback.createCopyParser(
				{ ...copy.values, inputValues: parseRes.inputValues },
				copy.localVariables.getDirectEntities(),
				state.controlId,
				context.executionVariables,
				context.parserOptions
			)
			return isAllTrue(copy.feedbacks.getChildBooleanFeedbackValues({ ...context, parser }))
		}

		if (state.heldCopy) return evaluateCopy(state.heldCopy)

		// The caller holds no copy, such as when its inputs can only be parsed in an execution, so hold one for just this
		// evaluation, as a run of a custom action does. Holding it builds the copies of any custom feedbacks it uses
		const evaluationId = nanoid()
		const copyKey = `custom-feedback-evaluation:${evaluationId}`
		const copy = new CustomFeedbackCopy(
			customFeedback,
			caller,
			state.controlId,
			`${caller.id}@${evaluationId}/`,
			[...chain, customFeedbackControlId],
			state.callerScope.customActionInstances,
			this,
			this.#renderClock,
			this.variableDependencies,
			{ customFeedbackControlId, inputValues: parseRes.inputValues, localValues: new Map() },
			// Its values are only read now, so nothing needs telling when they change
			() => undefined
		)
		try {
			caller.setTransientCopy(copyKey, copy)
			return evaluateCopy(copy)
		} finally {
			caller.removeTransientCopy(copyKey)
			copy.destroy()
		}
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
			// A feedback which is no longer known has been removed or disabled, so has no value to give
			const state = this.getCallerState(caller)
			if (!state) continue

			// Without a copy, such as when its inputs are invalid or it was refused one for using itself, it has no value,
			// so that it stays inactive when inverted
			const value = state.heldCopy ? isAllTrue(state.heldCopy.feedbacks.getChildBooleanFeedbackValues(null)) : undefined
			newValues.push({ entityId: caller.id, controlId: state.controlId, value })
		}

		if (newValues.length > 0) this.#controlStore.updateFeedbackValues(CUSTOM_CONNECTION_ID, newValues)
	}
}

/**
 * The value of a custom feedback from the values of its feedbacks: true when it has some, and all of them are true
 */
function isAllTrue(values: boolean[] | undefined): boolean {
	return !!values && values.length > 0 && values.every((value) => value)
}
