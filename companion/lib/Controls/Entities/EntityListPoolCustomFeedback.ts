import { isCustomFeedbacksConnectionId } from '@companion-app/shared/ConnectionId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	getCustomFeedbackCallDefinition,
	type CustomFeedbackModel,
} from '@companion-app/shared/Model/CustomFeedbackModel.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type EntityOwner,
	type ResolvedFeedbackStyleOverride,
	type SomeEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import { containsCustomEntityCall, createCustomEntityParser } from '../CustomEntities/CustomEntityPool.js'
import type { CustomEntityValues } from '../CustomEntities/Types.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, type ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { WithEntityEditing } from './EntityListPoolEditingMixin.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type { NewFeedbackValue } from './Types.js'

export interface ControlEntityListPoolCustomFeedbackProps extends ControlEntityListPoolProps {
	/** Get the `$(options:*)` variables for when the custom feedback is not being used, from the defaults of its inputs */
	getDefaultOptionsVariables: () => VariableValues
}

/**
 * The custom feedback entity pool. Custom feedbacks are always editable, so this single exported class IS the editable
 * pool (the structural entity-edit mutators are mixed in via {@link WithEntityEditing}).
 */
export class ControlEntityListPoolCustomFeedback extends WithEntityEditing(ControlEntityListPoolBase) {
	readonly #getDefaultOptionsVariables: () => VariableValues

	#feedbacks: ControlEntityList

	#localVariables: ControlEntityList

	constructor(props: ControlEntityListPoolCustomFeedbackProps) {
		// Its entities are inside the custom feedback itself
		super(props, false, [props.controlId])

		this.#getDefaultOptionsVariables = props.getDefaultOptionsVariables

		this.#feedbacks = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Boolean,
		})
		this.#localVariables = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
		})
	}

	loadStorage(storage: CustomFeedbackModel, skipSubscribe: boolean, isImport: boolean): void {
		this.#feedbacks.loadStorage(storage.feedbacks || [], skipSubscribe, isImport)
		this.#localVariables.loadStorage(storage.localVariables || [], skipSubscribe, isImport)
	}

	getLocalVariableEntities(): ControlEntityInstance[] {
		return this.#localVariables.getDirectEntities()
	}

	/**
	 * Get the direct feedback instances
	 */
	getFeedbackEntities(): ControlEntityInstance[] {
		return this.#feedbacks.getDirectEntities()
	}

	/**
	 * A parser for the entities of the custom feedback itself, which are only shown in the editor. Each feedback which
	 * uses the custom feedback holds a copy of its entities with their own scope (see `CustomFeedbackInstanceManager`).
	 * It has no location, so gets no `this:*` context, and its inputs have their default values.
	 */
	createVariablesAndExpressionParser(
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	): VariablesAndExpressionParser {
		return this.variableValues.createVariablesAndExpressionParser(
			null,
			this.getLocalVariableEntities(),
			{ ...this.#getDefaultOptionsVariables(), ...overrideVariableValues },
			null,
			options
		)
	}

	/**
	 * A parser for the entities of a copy of this custom feedback, held by a feedback which uses it.
	 * The `this:*` and `page:*` variables are those of the control of the caller, and the `local:*` variables are
	 * those of the copy.
	 * @param values The inputs of the copy
	 * @param localVariableEntities The local variables of the copy
	 * @param callerLocation The location of the control of the caller
	 * @param callerPageEntities The page variables of the control of the caller
	 * @param overrideVariableValues Any additional variables, including the `options:*` of the copy
	 * @param options Options for the parser
	 */
	createCopyParser(
		values: CustomEntityValues,
		localVariableEntities: ControlEntityInstance[],
		callerLocation: ControlLocation | null,
		callerPageEntities: ControlEntityInstance[] | null,
		overrideVariableValues: VariableValues,
		options: ExpressionParserOptions
	): VariablesAndExpressionParser {
		return createCustomEntityParser(
			this.variableValues,
			values,
			localVariableEntities,
			callerLocation,
			callerPageEntities,
			overrideVariableValues,
			options
		)
	}

	/**
	 * A custom feedback can't depend on itself, so refuse to add any feedback which would
	 */
	override entityAdd(
		listId: SomeSocketEntityLocation,
		ownerId: EntityOwner | null,
		...entityModels: SomeEntityModel[]
	): boolean {
		if (this.#containsSelfCall(entityModels)) return false
		return super.entityAdd(listId, ownerId, ...entityModels)
	}

	override entityReplaceAll(listId: SomeSocketEntityLocation, entities: SomeEntityModel[]): boolean {
		if (this.#containsSelfCall(entities)) return false
		return super.entityReplaceAll(listId, entities)
	}

	override entitySetConnection(listId: SomeSocketEntityLocation, id: string, connectionId: string | number): boolean {
		if (isCustomFeedbacksConnectionId(String(connectionId))) return false
		return super.entitySetConnection(listId, id, connectionId)
	}

	/**
	 * Check if any of some entities (or their children) is a feedback which uses this custom feedback
	 */
	#containsSelfCall(entityModels: SomeEntityModel[]): boolean {
		const selfCall = getCustomFeedbackCallDefinition(this.controlId)
		return !!selfCall && containsCustomEntityCall(entityModels, selfCall)
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		if (listId === 'feedbacks') return this.#feedbacks
		if (listId === 'local-variables') return this.#localVariables
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		return [this.#feedbacks, this.#localVariables]
	}

	/**
	 * Update the feedbacks on the custom feedback with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: ReadonlyMap<string, NewFeedbackValue>): void {
		this.#feedbacks.updateFeedbackValues(connectionId, newValues)

		const changedVariableEntities = this.#localVariables.updateFeedbackValues(connectionId, newValues)

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	public getFeedbackStyleOverrides(
		_defaultNoTopBar: boolean | undefined
	): ReadonlyMap<string, ReadonlyMap<string, ResolvedFeedbackStyleOverride>> {
		return new Map()
	}

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	updateIsInvertedValues(newValues: ReadonlyMap<string, NewSpecialExpressionValue<'isInverted'>>): void {
		this.#feedbacks.updateIsInvertedValues(newValues)

		const changedVariableEntities = this.#localVariables.updateIsInvertedValues(newValues)

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	/**
	 * Update the storeResult values on the control with new calculated storeResult values
	 * @param _newValues The new storeResult values
	 */
	updateStoreResultValues(_newValues: ReadonlyMap<string, NewSpecialExpressionValue<'storeResult'>>): void {
		// No actions, so nothing has a storeResult
	}
}
