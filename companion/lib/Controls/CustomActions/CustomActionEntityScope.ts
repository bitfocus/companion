import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlCustomAction } from '../ControlTypes/CustomAction.js'
import type { CustomActionRunFrame } from '../CustomActionRunFrame.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import { EntityPoolSpecialExpressionManager } from '../Entities/EntitySpecialExpressionManager.js'
import type { EntityScope } from '../Entities/Types.js'
import type { RenderClock } from '../RenderClock.js'
import type { CustomActionInstancesForEntity } from './CustomActionInstanceManager.js'

/**
 * The scope of the entities of a copy of a custom action, held by an action which calls it.
 * The entities see the `this:*` variables of the control holding the copy, the inputs of the copy as
 * `$(options:*)`, and the local variables of the copy.
 */
export class CustomActionEntityScope implements EntityScope {
	readonly specialExpressionManager: EntityPoolSpecialExpressionManager
	readonly customActionChain: ReadonlyArray<string>
	readonly customActionInstances: CustomActionInstancesForEntity

	readonly #customAction: ControlCustomAction
	readonly #callerControlId: string

	#frame: CustomActionRunFrame
	#actions: ControlEntityList | null = null
	#localVariables: ControlEntityList | null = null

	get frame(): CustomActionRunFrame {
		return this.#frame
	}

	/**
	 * @param customAction The custom action this is a copy of
	 * @param callerControlId The control which holds the copy
	 * @param customActionChain The custom actions this copy is running inside, ending with this one
	 * @param customActionInstances For any copies of custom actions called by this copy
	 * @param renderClock The render clock, for special expressions which depend on it
	 * @param frame The inputs and local variable values of the copy
	 */
	constructor(
		customAction: ControlCustomAction,
		callerControlId: string,
		customActionChain: ReadonlyArray<string>,
		customActionInstances: CustomActionInstancesForEntity,
		renderClock: RenderClock,
		frame: CustomActionRunFrame
	) {
		this.#customAction = customAction
		this.#callerControlId = callerControlId
		this.customActionChain = customActionChain
		this.customActionInstances = customActionInstances
		this.#frame = frame

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
	 * Replace the inputs and local variable values of the copy. The caller is responsible for re-subscribing the
	 * entities, so that they are parsed with the new values
	 */
	setFrame(frame: CustomActionRunFrame): void {
		this.#frame = frame
	}

	createVariablesAndExpressionParser(
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	): VariablesAndExpressionParser {
		return this.#customAction.createCopyParser(
			this.#frame,
			this.#callerControlId,
			this.#localVariables?.getDirectEntities() ?? [],
			overrideVariableValues,
			options ?? {}
		)
	}

	destroy(): void {
		this.specialExpressionManager.destroy()
	}
}
