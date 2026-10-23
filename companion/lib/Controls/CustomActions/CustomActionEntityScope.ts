import debounceFn from 'debounce-fn'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlCustomAction } from '../ControlTypes/CustomAction.js'
import type { CustomActionValues } from '../CustomActionRunFrame.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import { EntityPoolSpecialExpressionManager } from '../Entities/EntitySpecialExpressionManager.js'
import type { EntityScope } from '../Entities/Types.js'
import type { RenderClock } from '../RenderClock.js'
import type { CustomActionInstancesForEntity } from './CustomActionInstanceManager.js'

/**
 * The scope of the entities of a copy of a custom action, held by an action which calls it, either while it waits to
 * be run or for one run of it.
 * The entities see the `this:*` variables of the control holding the copy, the inputs of the copy as
 * `$(options:*)`, and the local variables of the copy.
 */
export class CustomActionEntityScope implements EntityScope {
	readonly specialExpressionManager: EntityPoolSpecialExpressionManager
	readonly customActionChain: ReadonlyArray<string>
	readonly customActionInstances: CustomActionInstancesForEntity

	readonly #customAction: ControlCustomAction
	readonly #callerControlId: string

	#values: CustomActionValues
	#actions: ControlEntityList | null = null
	#localVariables: ControlEntityList | null = null

	get values(): CustomActionValues {
		return this.#values
	}

	/**
	 * @param customAction The custom action this is a copy of
	 * @param callerControlId The control which holds the copy
	 * @param customActionChain The custom actions this copy is running inside, ending with this one
	 * @param customActionInstances For any copies of custom actions called by this copy
	 * @param renderClock The render clock, for special expressions which depend on it
	 * @param values The inputs and local variable values of the copy
	 */
	constructor(
		customAction: ControlCustomAction,
		callerControlId: string,
		customActionChain: ReadonlyArray<string>,
		customActionInstances: CustomActionInstancesForEntity,
		renderClock: RenderClock,
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
					this.#actions?.updateIsInvertedValues(values)
					this.#localVariables?.updateIsInvertedValues(values)
				},
				storeResult: (values) => {
					this.#actions?.updateStoreResultValues(values)
				},
			},
			renderClock
		)
	}

	/**
	 * Set the lists holding the entities of the copy
	 */
	setEntityLists(actions: ControlEntityList | null, localVariables: ControlEntityList | null): void {
		this.#actions = actions
		this.#localVariables = localVariables
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
		this.specialExpressionManager.onVariablesChanged(new Set([`local:${name}`]))

		// A run may set its variables many times in quick succession
		this.#debounceResubscribeEntities()
	}

	readonly #debounceResubscribeEntities = debounceFn(() => this.#resubscribeEntities(), { wait: 10, maxWait: 50 })

	#resubscribeEntities(): void {
		this.#localVariables?.subscribe(true)
		this.#actions?.subscribe(true)
	}

	createVariablesAndExpressionParser(
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	): VariablesAndExpressionParser {
		return this.#customAction.createCopyParser(
			this.#values,
			this.#callerControlId,
			this.#localVariables?.getDirectEntities() ?? [],
			overrideVariableValues,
			options ?? {}
		)
	}

	destroy(): void {
		this.#debounceResubscribeEntities.cancel()
		this.specialExpressionManager.destroy()
	}
}
