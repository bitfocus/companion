import debounceFn from 'debounce-fn'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import type { CustomActionInstancesForEntity } from '../CustomActions/CustomActionInstanceManager.js'
import type { CustomFeedbackInstancesForEntity } from '../CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import { EntityPoolSpecialExpressionManager } from '../Entities/EntitySpecialExpressionManager.js'
import type { EntityScope } from '../Entities/Types.js'
import type { RenderClock } from '../RenderClock.js'
import type { CustomEntitySource, CustomEntityValues } from './Types.js'

/**
 * The scope of the entities of a copy of a custom action or feedback, held by an entity which calls it, either while
 * it waits to be run or for one run of it.
 * The entities see the `this:*` variables of the control holding the copy, the inputs of the copy as
 * `$(options:*)`, and the local variables of the copy.
 */
export class CustomEntityScope implements EntityScope {
	readonly specialExpressionManager: EntityPoolSpecialExpressionManager
	readonly customActionChain: ReadonlyArray<string>
	readonly customActionInstances: CustomActionInstancesForEntity
	readonly customFeedbackInstances: CustomFeedbackInstancesForEntity

	readonly #source: CustomEntitySource
	readonly #callerControlId: string

	#values: CustomEntityValues
	#entities: ControlEntityList | null = null
	#localVariables: ControlEntityList | null = null

	get values(): CustomEntityValues {
		return this.#values
	}

	/**
	 * @param source The custom action or feedback this is a copy of
	 * @param callerControlId The control which holds the copy
	 * @param customActionChain The custom actions and feedbacks this copy is inside, ending with this one
	 * @param customActionInstances For any copies of custom actions called by this copy
	 * @param customFeedbackInstances For any copies of custom feedbacks used by this copy
	 * @param renderClock The render clock, for special expressions which depend on it
	 * @param values The inputs and local variable values of the copy
	 * @param onValuesChanged Called when the isInverted value of any entity of the copy changes, or null
	 */
	constructor(
		source: CustomEntitySource,
		callerControlId: string,
		customActionChain: ReadonlyArray<string>,
		customActionInstances: CustomActionInstancesForEntity,
		customFeedbackInstances: CustomFeedbackInstancesForEntity,
		renderClock: RenderClock,
		values: CustomEntityValues,
		onValuesChanged: ((changed: ControlEntityInstance[]) => void) | null
	) {
		this.#source = source
		this.#callerControlId = callerControlId
		this.customActionChain = customActionChain
		this.customActionInstances = customActionInstances
		this.customFeedbackInstances = customFeedbackInstances
		this.#values = values

		this.specialExpressionManager = new EntityPoolSpecialExpressionManager(
			callerControlId,
			this.createVariablesAndExpressionParser.bind(this),
			{
				isInverted: (values) => {
					const changed = [
						...(this.#entities?.updateIsInvertedValues(values) ?? []),
						...(this.#localVariables?.updateIsInvertedValues(values) ?? []),
					]
					if (changed.length > 0) onValuesChanged?.(changed)
				},
				storeResult: (values) => {
					this.#entities?.updateStoreResultValues(values)
				},
			},
			renderClock
		)
	}

	/**
	 * Set the lists holding the entities of the copy
	 * @param entities The actions or feedbacks of the copy
	 * @param localVariables The local variables of the copy
	 */
	setEntityLists(entities: ControlEntityList | null, localVariables: ControlEntityList | null): void {
		this.#entities = entities
		this.#localVariables = localVariables
	}

	/**
	 * Replace the inputs and local variable values of the copy, and re-subscribe its entities so that they are parsed
	 * with the new values
	 */
	setValues(values: CustomEntityValues): void {
		this.#values = values

		this.#resubscribeEntities()
	}

	/**
	 * A local variable of the copy has been set or has a new value, so re-parse anything which may use it
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
		this.#entities?.subscribe(true)
	}

	createVariablesAndExpressionParser(
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	): VariablesAndExpressionParser {
		return this.#source.createCopyParser(
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
