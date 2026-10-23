import { isCustomActionsConnectionId, isInternalConnectionId } from '@companion-app/shared/ConnectionId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { getCustomActionCallDefinition, type CustomActionModel } from '@companion-app/shared/Model/CustomActionModel.js'
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
import type { CustomActionRunFrame } from '../CustomActionRunFrame.js'
import { isInternalUserValueFeedback, type ControlEntityInstance } from './EntityInstance.js'
import type { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, type ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { WithEntityEditing } from './EntityListPoolEditingMixin.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type { NewFeedbackValue } from './Types.js'

export interface ControlEntityListPoolCustomActionProps extends ControlEntityListPoolProps {
	/** Get the `$(options:*)` variables for when the custom action is not being run, from the defaults of its inputs */
	getDefaultOptionsVariables: () => VariableValues
}

/**
 * The custom action entity pool. Custom actions are always editable, so this single exported class IS the editable
 * pool (the structural entity-edit mutators are mixed in via {@link WithEntityEditing}).
 */
export class ControlEntityListPoolCustomAction extends WithEntityEditing(ControlEntityListPoolBase) {
	readonly #getDefaultOptionsVariables: () => VariableValues

	#actions: ControlEntityList

	#localVariables: ControlEntityList

	constructor(props: ControlEntityListPoolCustomActionProps) {
		// Its entities run inside the custom action itself
		super(props, false, [props.controlId])

		this.#getDefaultOptionsVariables = props.getDefaultOptionsVariables

		this.#actions = this.createEntityList({ type: EntityModelType.Action })
		this.#localVariables = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
		})
	}

	loadStorage(storage: CustomActionModel, skipSubscribe: boolean, isImport: boolean): void {
		this.#actions.loadStorage(storage.actions || [], skipSubscribe, isImport)
		this.#localVariables.loadStorage(storage.localVariables || [], skipSubscribe, isImport)
	}

	getLocalVariableEntities(): ControlEntityInstance[] {
		return this.#localVariables.getDirectEntities()
	}

	/**
	 * Get direct the action instances
	 */
	getActionEntities(): ControlEntityInstance[] {
		return this.#actions.getDirectEntities()
	}

	/**
	 * A parser for when the custom action is not being run (eg evaluating its entities for the editor).
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
	 * A parser for an action being executed as part of a run of this custom action.
	 * The `this:*` and `page:*` variables are those of the control which called the custom action, and the
	 * `local:*` variables are those of this custom action, with the values they have in this run.
	 * @param frame The run of the custom action
	 * @param localVariableEntities The local variables to use, either those of this custom action or of a copy of it
	 * @param callerLocation The location of the control which called the custom action
	 * @param callerPageEntities The page variables of the control which called the custom action
	 * @param overrideVariableValues The execution context variables, including the `options:*` of the run
	 * @param options Options for the parser
	 */
	createRunParser(
		frame: CustomActionRunFrame,
		localVariableEntities: ControlEntityInstance[],
		callerLocation: ControlLocation | null,
		callerPageEntities: ControlEntityInstance[] | null,
		overrideVariableValues: VariableValues,
		options: ExpressionParserOptions
	): VariablesAndExpressionParser {
		const createParser = (values: VariableValues) =>
			this.variableValues.createVariablesAndExpressionParser(callerLocation, null, values, callerPageEntities, options)

		// The local variables are passed as overrides, which resolve when the parser has no local values of its own
		const values: VariableValues = { ...overrideVariableValues }

		// Resolve the variables in order, so that a computed variable can use the values of those before it
		for (const entity of localVariableEntities) {
			const name = entity.rawLocalVariableName
			if (!name) continue

			if (frame.localValues.has(name)) {
				values[`local:${name}`] = frame.localValues.get(name)
			} else if (isInternalUserValueFeedback(entity) || !isInternalConnectionId(entity.connectionId)) {
				// A user value which has not been set in this run has its startup value, and a module feedback can
				// only provide its cached value
				values[`local:${name}`] = entity.getResolvedFeedbackValue(null)
			} else {
				// A computed variable is evaluated for this run, so that it sees the inputs and variables of the run
				values[`local:${name}`] = entity.getResolvedFeedbackValue({ parser: createParser(values) })
			}
		}

		return createParser(values)
	}

	/**
	 * A custom action can't run itself, so refuse to add any action which would
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
		if (isCustomActionsConnectionId(String(connectionId))) return false
		return super.entitySetConnection(listId, id, connectionId)
	}

	/**
	 * Check if any of some entities (or their children) is an action which runs this custom action
	 */
	#containsSelfCall(entityModels: SomeEntityModel[]): boolean {
		const selfCall = getCustomActionCallDefinition(this.controlId)
		if (!selfCall) return false

		return entityModels.some(
			(entity) =>
				(entity.connectionId === selfCall.connectionId && entity.definitionId === selfCall.definitionId) ||
				Object.values(entity.children ?? {}).some((children) => this.#containsSelfCall(children ?? []))
		)
	}

	/**
	 * Check if a local variable can be set during a run, as it is a user value
	 */
	hasSettableLocalVariable(name: string): boolean {
		return this.getLocalVariableEntities().some(
			(entity) => entity.rawLocalVariableName === name && isInternalUserValueFeedback(entity)
		)
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		if (listId === 'custom_action_actions') return this.#actions
		if (listId === 'local-variables') return this.#localVariables
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		return [this.#actions, this.#localVariables]
	}

	/**
	 * Update the feedbacks on the custom action with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: ReadonlyMap<string, NewFeedbackValue>): void {
		this.#actions.updateFeedbackValues(connectionId, newValues)

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
		this.#actions.updateIsInvertedValues(newValues)

		const changedVariableEntities = this.#localVariables.updateIsInvertedValues(newValues)

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	/**
	 * Update the storeResult values on the control with new calculated
	 * storeResult values
	 * @param newValues The new storeResult values
	 */
	updateStoreResultValues(newValues: ReadonlyMap<string, NewSpecialExpressionValue<'storeResult'>>): void {
		this.#actions.updateStoreResultValues(newValues)
	}
}
