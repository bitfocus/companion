import {
	EntityModelType,
	FeedbackEntitySubType,
	SomeEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, ControlEntityListPoolProps, NewFeedbackValue } from './EntityListPoolBase.js'
import type { ControlEntityInstance } from './EntityInstance.js'

export class ControlEntityListPoolTrigger extends ControlEntityListPoolBase {
	#feedbacks: ControlEntityList

	#actions: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#feedbacks = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Boolean,
		})
		this.#actions = this.createEntityList({ type: EntityModelType.Action })
	}

	loadStorage(storage: TriggerModel, skipSubscribe: boolean, isImport: boolean) {
		this.#feedbacks.loadStorage(storage.condition || [], skipSubscribe, isImport)
		this.#actions.loadStorage(storage.actions || [], skipSubscribe, isImport)
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
	getFeedbackEntities(): SomeEntityModel[] {
		return this.#feedbacks.getDirectEntities().map((ent) => ent.asEntityModel(true))
	}

	getLocalVariableEntities(): ControlEntityInstance[] {
		return []
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
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		return [this.#feedbacks, this.#actions]
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: NewFeedbackValue[]): void {
		const feedbackValues: Record<string, NewFeedbackValue> = {}
		for (const val of newValues) {
			feedbackValues[val.entityId] = val
		}

		this.#actions.updateFeedbackValues(connectionId, feedbackValues)

		if (this.#feedbacks.updateFeedbackValues(connectionId, feedbackValues)) this.invalidateControl()
	}
}
