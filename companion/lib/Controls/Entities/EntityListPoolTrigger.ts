import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, type ControlEntityListPoolProps } from './EntityListPoolBase.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { NewFeedbackValue, NewIsInvertedValue } from './Types.js'

export class ControlEntityListPoolTrigger extends ControlEntityListPoolBase {
	#feedbacks: ControlEntityList

	#actions: ControlEntityList

	#localVariables: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

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
			this.invalidateControl()
		}

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	updateIsInvertedValues(newValues: ReadonlyMap<string, NewIsInvertedValue>): void {
		this.#actions.updateIsInvertedValues(newValues)

		const changedVariableEntities = this.#localVariables.updateIsInvertedValues(newValues)

		if (this.#feedbacks.updateIsInvertedValues(newValues).length > 0) {
			this.invalidateControl()
		}

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}
}
