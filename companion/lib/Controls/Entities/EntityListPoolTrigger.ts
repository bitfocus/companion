import type { JsonValue } from 'type-fest'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, type ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { WithEntityEditing } from './EntityListPoolEditingMixin.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type { NewFeedbackValue } from './Types.js'

/**
 * The trigger entity pool. Triggers are always editable, so this single exported class IS the editable pool
 * (the structural entity-edit mutators are mixed in via {@link WithEntityEditing}); there is no separate
 * read-only variant. The shared read-only machinery lives on the internal {@link ControlEntityListPoolBase}.
 */
export class ControlEntityListPoolTrigger extends WithEntityEditing(ControlEntityListPoolBase) {
	#feedbacks: ControlEntityList

	#actions: ControlEntityList

	#localVariables: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props, false)

		this.#feedbacks = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Boolean,
		})
		this.#actions = this.createEntityList({ type: EntityModelType.Action })
		this.#localVariables = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
		})
	}

	loadStorage(storage: TriggerModel, skipSubscribe: boolean, isImport: boolean): void {
		this.#feedbacks.loadStorage(storage.condition || [], skipSubscribe, isImport)
		this.#actions.loadStorage(storage.actions || [], skipSubscribe, isImport)
		this.#localVariables.loadStorage(storage.localVariables || [], skipSubscribe, isImport)
	}

	/**
	 * Get the value from all feedbacks as a single boolean
	 */
	checkConditionValue(): boolean {
		return this.#feedbacks.getBooleanFeedbackValue()
	}

	/**
	 * Get direct the feedback instances
	 */
	getFeedbackEntities(): ControlEntityInstance[] {
		return this.#feedbacks.getDirectEntities()
	}

	getLocalVariableEntities(): ControlEntityInstance[] {
		return this.#localVariables.getDirectEntities()
	}

	/** A trigger has no location, so its parser gets no `this:*` context. */
	createVariablesAndExpressionParser(overrideVariableValues: VariableValues | null): VariablesAndExpressionParser {
		return this.variableValues.createVariablesAndExpressionParser(
			null,
			this.getLocalVariableEntities(),
			overrideVariableValues
		)
	}

	/**
	 * Get direct the action instances
	 */
	getActionEntities(): ControlEntityInstance[] {
		return this.#actions.getDirectEntities()
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		if (listId === 'feedbacks') return this.#feedbacks
		if (listId === 'trigger_actions') return this.#actions
		if (listId === 'local-variables') return this.#localVariables
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		return [this.#feedbacks, this.#actions, this.#localVariables]
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: ReadonlyMap<string, NewFeedbackValue>): void {
		this.#actions.updateFeedbackValues(connectionId, newValues)

		const changedVariableEntities = this.#localVariables.updateFeedbackValues(connectionId, newValues)

		if (this.#feedbacks.updateFeedbackValues(connectionId, newValues).length > 0) {
			this.reportChange({
				redraw: true,
				noSave: true,
			})
		}

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	public getFeedbackStyleOverrides(
		_defaultNoTopBar: boolean | undefined
	): ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>> {
		return new Map()
	}

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	updateIsInvertedValues(newValues: ReadonlyMap<string, NewSpecialExpressionValue<'isInverted'>>): void {
		this.#actions.updateIsInvertedValues(newValues)

		const changedVariableEntities = this.#localVariables.updateIsInvertedValues(newValues)

		if (this.#feedbacks.updateIsInvertedValues(newValues).length > 0) {
			this.reportChange({
				redraw: true,
				noSave: true,
			})
		}

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	/**
	 * Update the storeResult values on the control with new calculated
	 * storeResult values
	 * @param newValues The new storeResult values
	 */
	updateStoreResultValues(newValues: ReadonlyMap<string, NewSpecialExpressionValue<'storeResult'>>): void {
		this.#actions.updateStoreResultValues(newValues)

		// this.#feedbacks and this.#localVariables contain only feedbacks, not
		// actions, so do not require updating.
	}
}
