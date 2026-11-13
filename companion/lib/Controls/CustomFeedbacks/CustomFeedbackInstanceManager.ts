import { EventEmitter } from 'node:events'
import debounceFn from 'debounce-fn'
import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import { CUSTOM_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import {
	CreateCustomFeedbackControlId,
	type CustomFeedbackControlId,
	type SomeControlId,
} from '@companion-app/shared/ControlId.js'
import { isCustomFeedbackUse } from '@companion-app/shared/Model/EntityModel.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import type {
	VariableDependency,
	VariableDependencyListener,
	VariableDependencyRegistry,
} from '../../Variables/DependencyRegistry.js'
import { ControlCustomFeedback } from '../ControlTypes/CustomFeedback.js'
import { MAX_CUSTOM_ACTION_DEPTH } from '../CustomActionRunFrame.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { EntityScope, FeedbackExecutionContext, NewFeedbackValue } from '../Entities/Types.js'
import type { IControlStore } from '../IControlStore.js'
import type { RenderClock } from '../RenderClock.js'
import { CustomFeedbackCopy } from './CustomFeedbackCopy.js'

/** The key of the copy of a custom feedback held by a feedback which uses it */
export const CUSTOM_FEEDBACK_HELD_COPY = 'custom-feedback'

export type CustomFeedbackInstancesForEntity = Pick<
	CustomFeedbackInstanceManager,
	'entityUpdate' | 'entityDelete' | 'evaluateLive'
>

/**
 * What is kept for each feedback which uses a custom feedback: how it parses its inputs, and the copy it holds
 */
interface CallerState {
	/** The control holding the calling feedback */
	readonly controlId: SomeControlId
	/** The scope the calling feedback parses its options in */
	callerScope: EntityScope
	/** The control id of the custom feedback which was copied, if there is a copy */
	customFeedbackControlId: CustomFeedbackControlId | null
	/** The copy held by the caller, or null if there is none, such as while its inputs are invalid */
	heldCopy: CustomFeedbackCopy | null
	/** The variables the inputs of the copy referenced when they were parsed, so that they are re-parsed when one changes */
	readonly inputVariables: VariableDependency<ControlEntityInstance>
}

export interface CustomFeedbackInstanceEvents {
	/** A feedback which uses a custom feedback has been added, changed or removed */
	usageChanged: []
}

/**
 * Every feedback which uses a custom feedback holds a copy of the custom feedback's feedbacks and local variables,
 * subscribed with the inputs given by that feedback.
 *
 * The value of the calling feedback is computed from its copy, and given to it in the same way as a connection gives
 * a feedback its value. Unlike a custom action there is no run, whose inputs need freezing while it runs, so the copy
 * held by the calling feedback is the only one.
 *
 * The copies are never persisted, and are rebuilt whenever the custom feedback changes.
 */
export class CustomFeedbackInstanceManager implements VariableDependencyListener<ControlEntityInstance> {
	readonly #logger: Logger = LogController.createLogger('Controls/CustomFeedbacks/InstanceManager')

	readonly #controlStore: Pick<IControlStore, 'getControl' | 'updateFeedbackValues'>
	readonly #renderClock: RenderClock
	readonly #variableDependencies: VariableDependencyRegistry

	/** The copies, by the feedback which uses the custom feedback */
	readonly #callers = new Map<ControlEntityInstance, CallerState>()

	readonly events = new EventEmitter<CustomFeedbackInstanceEvents>()

	/** The custom feedbacks which have changed, so their copies need rebuilding */
	#changedCustomFeedbackIds = new Set<CustomFeedbackControlId>()

	/** The calling feedbacks whose value needs computing again */
	#pendingValueCallers = new Set<ControlEntityInstance>()

	constructor(
		controlStore: Pick<IControlStore, 'getControl' | 'updateFeedbackValues'>,
		renderClock: RenderClock,
		variableDependencies: VariableDependencyRegistry
	) {
		this.#controlStore = controlStore
		this.#renderClock = renderClock
		this.#variableDependencies = variableDependencies
	}

	/**
	 * A feedback which uses a custom feedback has been added or changed, so build or update its copy
	 * @param caller The feedback which uses a custom feedback
	 * @param controlId The control holding the feedback
	 * @param callerScope The scope the feedback parses its options in
	 */
	entityUpdate(caller: ControlEntityInstance, controlId: SomeControlId, callerScope: EntityScope): void {
		this.events.emit('usageChanged')

		// A change to the calling feedback clears its value, even when its copy is unchanged
		this.#queueValueUpdate(caller)

		if (caller.disabled) {
			// A disabled feedback has nothing subscribed
			this.#forgetCaller(caller)
			return
		}

		const state = this.#callers.get(caller)
		if (state && state.customFeedbackControlId === CreateCustomFeedbackControlId(caller.definitionId)) {
			state.callerScope = callerScope
			this.#refreshInputs(caller, state)
		} else {
			const newState: CallerState = state ?? {
				controlId,
				callerScope,
				customFeedbackControlId: null,
				heldCopy: null,
				inputVariables: this.#variableDependencies.create(this, controlId, caller),
			}
			newState.callerScope = callerScope
			this.#callers.set(caller, newState)
			this.#build(caller, newState)
		}
	}

	/**
	 * A feedback which uses a custom feedback has been removed or disabled, so remove its copy
	 * @param caller The feedback which uses a custom feedback
	 */
	entityDelete(caller: ControlEntityInstance): void {
		this.#forgetCaller(caller)
		this.events.emit('usageChanged')
	}

	/**
	 * Get the copy held by a feedback which uses a custom feedback
	 * @param caller The feedback which uses a custom feedback
	 * @returns The copy, or undefined if the feedback has none
	 */
	getHeldCopy(caller: ControlEntityInstance): CustomFeedbackCopy | undefined {
		return this.#callers.get(caller)?.heldCopy ?? undefined
	}

	/**
	 * Evaluate a calling feedback now, in the execution context of an action it is a condition of, rather than using
	 * its cached value. Its inputs are parsed in that context, so that they see what the action has just done, and
	 * the internal feedbacks of its copy are evaluated with them and the `$(this:*)` variables of the execution.
	 * As anywhere else, connection feedbacks can only provide their cached values, from the inputs of the copy
	 * @param caller The feedback which uses a custom feedback
	 * @param context The execution context
	 */
	evaluateLive(caller: ControlEntityInstance, context: FeedbackExecutionContext): boolean {
		const state = this.#callers.get(caller)
		if (!state) return false

		// Not only the copy held by the caller, as its inputs are parsed outside of any execution, so may be invalid where
		// they are not here (eg using $(this:delta))
		const customFeedbackControlId = CreateCustomFeedbackControlId(caller.definitionId)
		const customFeedback = this.#controlStore.getControl(customFeedbackControlId)
		if (!(customFeedback instanceof ControlCustomFeedback)) return false

		const chain = state.callerScope.customActionChain
		if (chain.includes(customFeedbackControlId) || chain.length >= MAX_CUSTOM_ACTION_DEPTH) return false

		// Invalid inputs make it inactive, as they do the copy
		const parseRes = customFeedback.parseCallInputs(caller.rawOptions, context.parser, state.controlId)
		if (!parseRes.ok) return false

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
			this.#variableDependencies,
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
	 * Give the copy held by a calling feedback the runtime values of the copy held by another, which is a copy of the
	 * same calling feedback in the same circumstances (eg for a run of a custom action). This lets the new copy be used
	 * straight away, without waiting for the values to be recomputed
	 * @param target The calling feedback of the new copy
	 * @param source The calling feedback of the existing copy
	 */
	copyRuntimeValues(target: ControlEntityInstance, source: ControlEntityInstance): void {
		const targetCopy = this.getHeldCopy(target)
		const sourceCopy = this.getHeldCopy(source)
		if (!targetCopy || !sourceCopy || !isEqual(targetCopy.values.inputValues, sourceCopy.values.inputValues)) return

		const sourcePrefix = `${source.id}/`
		const targetPrefix = `${target.id}/`

		const sourceEntities = new Map<string, ControlEntityInstance>()
		for (const entity of sourceCopy.lists.flatMap((list) => list.getAllEntities())) {
			sourceEntities.set(entity.id.slice(sourcePrefix.length), entity)
		}

		for (const entity of targetCopy.lists.flatMap((list) => list.getAllEntities())) {
			const sourceEntity = sourceEntities.get(entity.id.slice(targetPrefix.length))
			if (!sourceEntity) continue

			entity.copyRuntimeValuesFrom(sourceEntity)

			if (isCustomFeedbackUse(entity)) this.copyRuntimeValues(entity, sourceEntity)
		}

		this.#queueValueUpdate(target)
	}

	/**
	 * A custom feedback has been changed or deleted, so its copies need rebuilding
	 * @param customFeedbackControlId The control id of the custom feedback
	 */
	onCustomFeedbackChanged(customFeedbackControlId: CustomFeedbackControlId): void {
		this.#changedCustomFeedbackIds.add(customFeedbackControlId)
		this.#debounceRebuildChanged()
	}

	readonly #debounceRebuildChanged = debounceFn(
		() => {
			const changedIds = this.#changedCustomFeedbackIds
			this.#changedCustomFeedbackIds = new Set()

			// Building a copy adds and removes the copies nested inside it, so work from a snapshot
			for (const [caller, state] of [...this.#callers]) {
				if (this.#callers.get(caller) !== state) continue

				if (changedIds.has(CreateCustomFeedbackControlId(caller.definitionId))) {
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
	 * Build the copy held by a calling feedback, replacing any existing copy
	 */
	#build(caller: ControlEntityInstance, state: CallerState): void {
		this.#clearHeldCopy(caller, state)

		const customFeedbackControlId = CreateCustomFeedbackControlId(caller.definitionId)
		state.customFeedbackControlId = customFeedbackControlId

		const customFeedback = this.#controlStore.getControl(customFeedbackControlId)
		if (!(customFeedback instanceof ControlCustomFeedback)) return

		const chain = state.callerScope.customActionChain
		if (chain.includes(customFeedbackControlId)) {
			this.#logger.warn(`Not using "${customFeedback.options.name}" in ${state.controlId}, as it uses itself`)
			return
		}
		if (chain.length >= MAX_CUSTOM_ACTION_DEPTH) {
			this.#logger.warn(`Not using "${customFeedback.options.name}" in ${state.controlId}, as it is nested too deeply`)
			return
		}

		const parseRes = customFeedback.parseCallInputs(
			caller.rawOptions,
			state.callerScope.createVariablesAndExpressionParser(null),
			state.controlId
		)
		// Even when invalid, so that the copy is built once a variable they use changes
		state.inputVariables.set(parseRes.referencedVariableIds)
		if (!parseRes.ok) {
			// Inactive until its inputs can be parsed, as a module feedback is
			this.#logger.warn(
				`Failed to parse the inputs of custom feedback "${customFeedback.options.name}" in ${state.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
			)
			return
		}

		const copy = new CustomFeedbackCopy(
			customFeedback,
			caller,
			state.controlId,
			`${caller.id}/`,
			[...chain, customFeedbackControlId],
			state.callerScope.customActionInstances,
			this,
			this.#renderClock,
			this.#variableDependencies,
			{ customFeedbackControlId, inputValues: parseRes.inputValues, localValues: new Map() },
			() => this.#queueValueUpdate(caller)
		)
		state.heldCopy = copy
		caller.setTransientCopy(CUSTOM_FEEDBACK_HELD_COPY, copy)

		this.#queueValueUpdate(caller)
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

		const customFeedback = this.#controlStore.getControl(heldCopy.values.customFeedbackControlId)
		if (!(customFeedback instanceof ControlCustomFeedback)) return

		const parseRes = customFeedback.parseCallInputs(
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
		caller.removeTransientCopy(CUSTOM_FEEDBACK_HELD_COPY)

		state.heldCopy?.destroy()
		state.heldCopy = null
		state.customFeedbackControlId = null
		state.inputVariables.set(null)

		// Without a copy, the feedback is false
		this.#queueValueUpdate(caller)
	}

	#forgetCaller(caller: ControlEntityInstance): void {
		const state = this.#callers.get(caller)
		if (!state) return

		this.#callers.delete(caller)
		this.#clearHeldCopy(caller, state)
		state.inputVariables.dispose()
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
			const state = this.#callers.get(caller)
			if (!state) continue

			// Without a copy, such as when it was refused one for using itself, it is false
			const value = isAllTrue(state.heldCopy?.feedbacks.getChildBooleanFeedbackValues(null))
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
