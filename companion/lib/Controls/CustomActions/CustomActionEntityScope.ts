import debounceFn from 'debounce-fn'
import isEqual from 'fast-deep-equal'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlCustomAction } from '../ControlTypes/CustomAction.js'
import type { CustomActionValues } from '../CustomActionRunFrame.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import { EntityPoolSpecialExpressionManager } from '../Entities/EntitySpecialExpressionManager.js'
import type { EntityCopy, EntityScope } from '../Entities/Types.js'
import type { RenderClock } from '../RenderClock.js'
import type { CustomActionInstancesForEntity } from './CustomActionInstanceManager.js'

/**
 * The scope of the entities of a copy of a custom action, held by an action which calls it, either while it waits to
 * be run or for one run of it.
 * The entities see the `this:*` variables of the control holding the copy, the inputs of the copy as
 * `$(options:*)`, and the local variables of the copy.
 */
export class CustomActionEntityScope implements EntityScope, EntityCopy {
	readonly specialExpressionManager: EntityPoolSpecialExpressionManager
	readonly customActionChain: ReadonlyArray<string>
	readonly customActionInstances: CustomActionInstancesForEntity
	readonly isTransient = true

	readonly #customAction: ControlCustomAction
	readonly #callerControlId: SomeControlId
	readonly #variableDependencies: VariableDependencyRegistry

	readonly actions: ControlEntityList
	readonly localVariables: ControlEntityList
	readonly lists: ReadonlyArray<ControlEntityList>

	#values: CustomActionValues

	get values(): CustomActionValues {
		return this.#values
	}

	/**
	 * @param customAction The custom action this is a copy of
	 * @param caller The action which holds the copy
	 * @param callerControlId The control which holds the copy
	 * @param idPrefix The prefix for the ids of the copied entities, which must be unique within the control
	 * @param customActionChain The custom actions this copy is running inside, ending with this one
	 * @param customActionInstances For any copies of custom actions called by this copy
	 * @param renderClock The render clock, for special expressions which depend on it
	 * @param variableDependencies Where the special expressions register the variables they reference
	 * @param values The inputs and local variable values of the copy
	 */
	constructor(
		customAction: ControlCustomAction,
		caller: ControlEntityInstance,
		callerControlId: SomeControlId,
		idPrefix: string,
		customActionChain: ReadonlyArray<string>,
		customActionInstances: CustomActionInstancesForEntity,
		renderClock: RenderClock,
		variableDependencies: VariableDependencyRegistry,
		values: CustomActionValues
	) {
		this.#customAction = customAction
		this.#callerControlId = callerControlId
		this.#variableDependencies = variableDependencies
		this.customActionChain = customActionChain
		this.customActionInstances = customActionInstances
		this.#values = values

		this.specialExpressionManager = new EntityPoolSpecialExpressionManager(
			callerControlId,
			this.createVariablesAndExpressionParser.bind(this),
			{
				isInverted: (values) => {
					this.actions.updateIsInvertedValues(values)
					this.localVariables.updateIsInvertedValues(values)
				},
				storeResult: (values) => {
					this.actions.updateStoreResultValues(values)
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
			customAction.entities.getLocalVariableEntities().map((entity) => entity.asEntityModel(true)),
			newIds
		)
		this.actions = caller.createTransientList(
			`${idPrefix}actions`,
			this,
			{ type: EntityModelType.Action },
			customAction.entities.getActionEntities().map((entity) => entity.asEntityModel(true)),
			newIds
		)
		// The local variables first, as the actions use them as they are subscribed
		this.lists = [this.localVariables, this.actions]
	}

	/**
	 * Replace the inputs and local variable values of the copy, and re-parse whatever uses an input which changed
	 */
	setValues(values: CustomActionValues): void {
		const oldInputValues = this.#values.inputValues
		this.#values = values

		const changed = new Set<string>()
		for (const id of new Set([...Object.keys(oldInputValues), ...Object.keys(values.inputValues)])) {
			if (!isEqual(oldInputValues[id], values.inputValues[id])) changed.add(`options:${id}`)
		}
		this.#variablesChanged(changed)
	}

	/**
	 * A local variable of the copy has been set, so re-parse whatever uses it
	 * @param name The name of the variable, without the `local:` prefix
	 */
	localValueChanged(name: string): void {
		this.#variablesChanged(new Set([`local:${name}`]))
	}

	localVariablesChanged(names: ReadonlySet<string>): void {
		this.#variablesChanged(names)
	}

	/** The variables of the copy which have changed, and not yet been dispatched */
	#pendingChanges = new Set<string>()

	/**
	 * Some variables of the copy have changed. The values are its own, so nothing else reports them, but its entities
	 * are registered by the variables they read, under the caller's control, so only those which use one are re-parsed.
	 *
	 * This is noisier than it needs to be, but safe: `local:` variables are only keyed by control, so the change also
	 * reaches whatever else on the caller's control reads a variable of the same name, such as the caller's own local
	 * variable or the copy of another call, which are re-parsed for nothing. A notification only means "possibly
	 * affected", so they find nothing changed.
	 * TODO: invalidate precisely, by keying the variables of a copy by the copy rather than the caller's control
	 */
	#variablesChanged(changed: ReadonlySet<string>): void {
		if (changed.size === 0) return

		for (const id of changed) this.#pendingChanges.add(id)
		// A run may set its variables many times in quick succession
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
		return this.#customAction.createCopyParser(
			this.#values,
			this.localVariables.getDirectEntities(),
			this.#callerControlId,
			null,
			overrideVariableValues,
			options ?? {}
		)
	}

	destroy(): void {
		this.#debounceDispatchChanges.cancel()
		this.specialExpressionManager.destroy()
	}
}
