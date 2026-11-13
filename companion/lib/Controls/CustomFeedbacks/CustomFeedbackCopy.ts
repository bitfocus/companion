import debounceFn from 'debounce-fn'
import isEqual from 'fast-deep-equal'
import type { CustomFeedbackControlId, SomeControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { VariableValue, VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlCustomFeedback } from '../ControlTypes/CustomFeedback.js'
import type { CustomActionInstancesForEntity } from '../CustomActions/CustomActionInstanceManager.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import { EntityPoolSpecialExpressionManager } from '../Entities/EntitySpecialExpressionManager.js'
import type { EntityScope, TransientCopy } from '../Entities/Types.js'
import type { RenderClock } from '../RenderClock.js'
import type { CustomFeedbackInstancesForEntity } from './CustomFeedbackInstanceManager.js'

/**
 * The values seen by the entities of a copy of a custom feedback
 */
export interface CustomFeedbackValues {
	/** The control id of the custom feedback */
	readonly customFeedbackControlId: CustomFeedbackControlId
	/** The values of the inputs, exposed to the entities as `$(options:<id>)` */
	readonly inputValues: VariableValues
	/**
	 * The values of the local variables which have been set, by name (without the `local:` prefix). Nothing sets the
	 * variables of a custom feedback, so this is always empty, and each has its startup value or that of its feedback
	 */
	readonly localValues: ReadonlyMap<string, VariableValue>
}

/**
 * A copy of the feedbacks and local variables of a custom feedback, held by a feedback which uses it. It is also the
 * scope its entities parse their options in: they see the `this:*` variables of the control holding the copy, the
 * inputs of the copy as `$(options:*)`, and the local variables of the copy.
 */
export class CustomFeedbackCopy implements EntityScope, TransientCopy {
	readonly specialExpressionManager: EntityPoolSpecialExpressionManager
	readonly customActionChain: ReadonlyArray<string>
	readonly customActionInstances: CustomActionInstancesForEntity
	readonly customFeedbackInstances: CustomFeedbackInstancesForEntity
	readonly isTransient = true

	readonly #customFeedback: ControlCustomFeedback
	readonly #callerControlId: SomeControlId
	readonly #variableDependencies: VariableDependencyRegistry
	readonly #onValuesChanged: () => void

	readonly feedbacks: ControlEntityList
	readonly localVariables: ControlEntityList
	readonly lists: ReadonlyArray<ControlEntityList>

	#values: CustomFeedbackValues

	get values(): CustomFeedbackValues {
		return this.#values
	}

	/**
	 * @param customFeedback The custom feedback this is a copy of
	 * @param caller The feedback which holds the copy
	 * @param callerControlId The control which holds the copy
	 * @param idPrefix The prefix for the ids of the copied entities, which must be unique within the control
	 * @param customActionChain The custom actions and feedbacks this copy is inside, ending with this one
	 * @param customActionInstances For any copies of custom actions inside this copy
	 * @param customFeedbackInstances For any copies of custom feedbacks used by this copy
	 * @param renderClock The render clock, for special expressions which depend on it
	 * @param variableDependencies Where the special expressions register the variables they reference
	 * @param values The inputs of the copy
	 * @param onValuesChanged Called when the value or isInverted value of any entity of the copy changes
	 */
	constructor(
		customFeedback: ControlCustomFeedback,
		caller: ControlEntityInstance,
		callerControlId: SomeControlId,
		idPrefix: string,
		customActionChain: ReadonlyArray<string>,
		customActionInstances: CustomActionInstancesForEntity,
		customFeedbackInstances: CustomFeedbackInstancesForEntity,
		renderClock: RenderClock,
		variableDependencies: VariableDependencyRegistry,
		values: CustomFeedbackValues,
		onValuesChanged: () => void
	) {
		this.#customFeedback = customFeedback
		this.#callerControlId = callerControlId
		this.#variableDependencies = variableDependencies
		this.#onValuesChanged = onValuesChanged
		this.customActionChain = customActionChain
		this.customActionInstances = customActionInstances
		this.customFeedbackInstances = customFeedbackInstances
		this.#values = values

		this.specialExpressionManager = new EntityPoolSpecialExpressionManager(
			callerControlId,
			this.createVariablesAndExpressionParser.bind(this),
			{
				isInverted: (values) => {
					// The lists are given these directly, rather than through the caller, so it doesn't tell the copy
					const changed = [
						...this.feedbacks.updateIsInvertedValues(values),
						...this.localVariables.updateIsInvertedValues(values),
					]
					if (changed.length > 0) onValuesChanged()
				},
				storeResult: () => {
					// A custom feedback has no actions, so nothing has a storeResult
				},
			},
			renderClock,
			variableDependencies
		)

		// The copied entities are told apart from the originals by a prefix, so that they can be matched up again
		const newIds = (id: string) => `${idPrefix}${id}`
		this.localVariables = caller.createTransientList(
			`${idPrefix}local-variables`,
			this,
			{ type: EntityModelType.Feedback, feedbackListType: FeedbackEntitySubType.Value },
			customFeedback.entities.getLocalVariableEntities().map((entity) => entity.asEntityModel(true)),
			newIds
		)
		this.feedbacks = caller.createTransientList(
			`${idPrefix}feedbacks`,
			this,
			{ type: EntityModelType.Feedback, feedbackListType: FeedbackEntitySubType.Boolean },
			customFeedback.entities.getFeedbackEntities().map((entity) => entity.asEntityModel(true)),
			newIds
		)
		// The local variables first, as the feedbacks use them as they are subscribed
		this.lists = [this.localVariables, this.feedbacks]
	}

	/**
	 * Replace the inputs of the copy, and re-parse whatever uses an input which changed
	 */
	setValues(values: CustomFeedbackValues): void {
		const oldInputValues = this.#values.inputValues
		this.#values = values

		const changed = new Set<string>()
		for (const id of new Set([...Object.keys(oldInputValues), ...Object.keys(values.inputValues)])) {
			if (!isEqual(oldInputValues[id], values.inputValues[id])) changed.add(`options:${id}`)
		}
		this.#variablesChanged(changed)
	}

	valuesChanged(): void {
		this.#onValuesChanged()
	}

	localVariablesChanged(names: ReadonlySet<string>): void {
		this.#variablesChanged(names)
	}

	/** The variables of the copy which have changed, and not yet been dispatched */
	#pendingChanges = new Set<string>()

	/**
	 * Some variables of the copy have changed. The values are its own, so nothing else reports them, but its entities
	 * are registered by the variables they read, under the caller's control, so only those which use one are re-parsed.
	 * As for a copy of a custom action, this also reaches anything else on the caller's control which reads a variable
	 * of the same name, which is re-parsed for nothing
	 */
	#variablesChanged(changed: ReadonlySet<string>): void {
		if (changed.size === 0) return

		for (const id of changed) this.#pendingChanges.add(id)
		// A connection may give its values many times in quick succession
		this.#debounceDispatchChanges()
	}

	readonly #debounceDispatchChanges = debounceFn(
		() => {
			const changed = this.#pendingChanges
			this.#pendingChanges = new Set()
			this.#variableDependencies.dispatch(changed, new Set([this.#callerControlId]))
		},
		{ wait: 10, maxWait: 50 }
	)

	createVariablesAndExpressionParser(
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	): VariablesAndExpressionParser {
		return this.#customFeedback.createCopyParser(
			this.#values,
			this.localVariables.getDirectEntities(),
			this.#callerControlId,
			overrideVariableValues,
			options ?? {}
		)
	}

	destroy(): void {
		this.#debounceDispatchChanges.cancel()
		this.specialExpressionManager.destroy()
	}
}
