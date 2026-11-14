import debounceFn from 'debounce-fn'
import isEqual from 'fast-deep-equal'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import type { CustomActionInstancesForEntity } from '../CustomActions/CustomActionInstanceManager.js'
import type { CustomFeedbackInstancesForEntity } from '../CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityList, ControlEntityListDefinition } from '../Entities/EntityList.js'
import { EntityPoolSpecialExpressionManager } from '../Entities/EntitySpecialExpressionManager.js'
import type { EntityScope, TransientCopy } from '../Entities/Types.js'
import type { RenderClock } from '../RenderClock.js'

/**
 * What every copy of a custom action or feedback is given: the inputs of the copy
 */
export interface CustomEntityCopyValues {
	/** The values of the inputs, exposed to the entities as `$(options:<id>)` */
	readonly inputValues: VariableValues
}

/**
 * The custom action or feedback which a copy is of: the entities it copies, and how they parse their options
 */
export interface CustomEntityCopySource<TValues extends CustomEntityCopyValues> {
	/** The name of the list, used in the ids of the copied lists */
	readonly listName: string
	/** The type of the entities of the list */
	readonly listDefinition: ControlEntityListDefinition
	/** The local variables to copy */
	readonly localVariables: SomeEntityModel[]
	/** The entities to copy, which run or are evaluated with the local variables */
	readonly entities: SomeEntityModel[]
	/**
	 * Create a parser for the entities of the copy
	 * @param values The values of the copy
	 * @param localVariableEntities The local variables of the copy
	 * @param overrideVariableValues Any additional variables, such as those of an action being executed
	 * @param options Options for the parser
	 */
	readonly createParser: (
		values: TValues,
		localVariableEntities: ControlEntityInstance[],
		overrideVariableValues: VariableValues | null,
		options: ExpressionParserOptions
	) => VariablesAndExpressionParser
}

/**
 * A copy of the entities and local variables of a custom action or feedback, held by an entity which uses it. It is
 * also the scope its entities parse their options in: they see the `this:*` variables of the control holding the
 * copy, the inputs of the copy as `$(options:*)`, and the local variables of the copy.
 */
export class CustomEntityCopy<TValues extends CustomEntityCopyValues> implements EntityScope, TransientCopy {
	readonly specialExpressionManager: EntityPoolSpecialExpressionManager
	readonly customActionChain: ReadonlyArray<string>
	readonly customActionInstances: CustomActionInstancesForEntity
	readonly customFeedbackInstances: CustomFeedbackInstancesForEntity
	readonly isTransient = true

	readonly #source: CustomEntityCopySource<TValues>
	readonly #callerControlId: SomeControlId
	readonly #variableDependencies: VariableDependencyRegistry
	readonly #onValuesChanged: () => void

	readonly localVariables: ControlEntityList
	/** The actions or feedbacks of the copy */
	protected readonly entities: ControlEntityList
	readonly lists: ReadonlyArray<ControlEntityList>

	#values: TValues

	get values(): TValues {
		return this.#values
	}

	/**
	 * @param source The entities to copy
	 * @param caller The entity which holds the copy
	 * @param callerControlId The control which holds the copy
	 * @param idPrefix The prefix for the ids of the copied entities, which must be unique within the control
	 * @param customActionChain The custom actions and feedbacks this copy is inside, ending with this one
	 * @param customActionInstances For any copies of custom actions inside this copy
	 * @param customFeedbackInstances For any copies of custom feedbacks inside this copy
	 * @param renderClock The render clock, for special expressions which depend on it
	 * @param variableDependencies Where the special expressions register the variables they reference
	 * @param values The inputs of the copy
	 * @param onValuesChanged Called when the value or isInverted value of any entity of the copy changes
	 */
	constructor(
		source: CustomEntityCopySource<TValues>,
		caller: ControlEntityInstance,
		callerControlId: SomeControlId,
		idPrefix: string,
		customActionChain: ReadonlyArray<string>,
		customActionInstances: CustomActionInstancesForEntity,
		customFeedbackInstances: CustomFeedbackInstancesForEntity,
		renderClock: RenderClock,
		variableDependencies: VariableDependencyRegistry,
		values: TValues,
		onValuesChanged: () => void
	) {
		this.#source = source
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
						...this.entities.updateIsInvertedValues(values),
						...this.localVariables.updateIsInvertedValues(values),
					]
					if (changed.length > 0) onValuesChanged()
				},
				storeResult: (values) => {
					// Only actions have a storeResult
					this.entities.updateStoreResultValues(values)
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
			source.localVariables,
			newIds
		)
		this.entities = caller.createTransientList(
			`${idPrefix}${source.listName}`,
			this,
			source.listDefinition,
			source.entities,
			newIds
		)
		// The local variables first, as the other entities use them as they are subscribed
		this.lists = [this.localVariables, this.entities]
	}

	/**
	 * Replace the inputs of the copy, and re-parse whatever uses an input which changed
	 */
	setValues(values: TValues): void {
		const oldInputValues = this.#values.inputValues
		this.#values = values

		const changed = new Set<string>()
		for (const id of new Set([...Object.keys(oldInputValues), ...Object.keys(values.inputValues)])) {
			if (!isEqual(oldInputValues[id], values.inputValues[id])) changed.add(`options:${id}`)
		}
		this.variablesChanged(changed)
	}

	valuesChanged(): void {
		this.#onValuesChanged()
	}

	localVariablesChanged(names: ReadonlySet<string>): void {
		this.variablesChanged(names)
	}

	/** The variables of the copy which have changed, and not yet been dispatched */
	#pendingChanges = new Set<string>()

	/**
	 * Some variables of the copy have changed. The values are its own, so nothing else reports them, but its entities
	 * are registered by the variables they read, under the caller's control, so only those which use one are re-parsed.
	 *
	 * This is noisier than it needs to be, but safe: `local:` variables are only keyed by control, so the change also
	 * reaches whatever else on the caller's control reads a variable of the same name, such as the caller's own local
	 * variable or another copy, which are re-parsed for nothing. A notification only means "possibly affected", so they
	 * find nothing changed.
	 * TODO: invalidate precisely, by keying the variables of a copy by the copy rather than the caller's control
	 */
	protected variablesChanged(changed: ReadonlySet<string>): void {
		if (changed.size === 0) return

		for (const id of changed) this.#pendingChanges.add(id)
		// The inputs, or a run of a custom action, may change many times in quick succession
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
		return this.#source.createParser(
			this.#values,
			this.localVariables.getDirectEntities(),
			overrideVariableValues,
			options ?? {}
		)
	}

	destroy(): void {
		this.#debounceDispatchChanges.cancel()
		this.specialExpressionManager.destroy()
	}
}
