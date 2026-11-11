import debounceFn from 'debounce-fn'
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

		this.localVariables = caller.createTransientList(
			`${idPrefix}local-variables`,
			this,
			{ type: EntityModelType.Feedback, feedbackListType: FeedbackEntitySubType.Value },
			deriveEntityIds(
				idPrefix,
				customAction.entities.getLocalVariableEntities().map((entity) => entity.asEntityModel(true))
			)
		)
		this.actions = caller.createTransientList(
			`${idPrefix}actions`,
			this,
			{ type: EntityModelType.Action },
			deriveEntityIds(
				idPrefix,
				customAction.entities.getActionEntities().map((entity) => entity.asEntityModel(true))
			)
		)
		// The local variables first, as the actions use them as they are subscribed
		this.lists = [this.localVariables, this.actions]
	}

	/**
	 * Replace the inputs and local variable values of the copy, and re-subscribe its entities so that they are parsed
	 * with the new values
	 */
	setValues(values: CustomActionValues): void {
		this.#values = values

		this.#resubscribeEntities()
	}

	/**
	 * A local variable of the copy has been set, so re-parse anything which may use it
	 * @param name The name of the variable, without the `local:` prefix
	 */
	localValueChanged(name: string): void {
		// The values of the copy are its own, so the registry doesn't know of them
		this.specialExpressionManager.onVariableDependenciesChanged([], new Set([`local:${name}`]))

		// A run may set its variables many times in quick succession
		this.#debounceResubscribeEntities()
	}

	localVariablesChanged(names: ReadonlySet<string>): void {
		for (const name of names) this.localValueChanged(name.slice('local:'.length))
	}

	readonly #debounceResubscribeEntities = debounceFn(() => this.#resubscribeEntities(), { wait: 10, maxWait: 50 })

	#resubscribeEntities(): void {
		this.localVariables.subscribe(true)
		this.actions.subscribe(true)
	}

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
		this.#debounceResubscribeEntities.cancel()
		this.specialExpressionManager.destroy()
	}
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
