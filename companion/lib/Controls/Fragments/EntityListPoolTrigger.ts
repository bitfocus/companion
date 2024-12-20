import {
	EntityModelType,
	SomeEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { transformEntityToFeedbacks } from './Util.js'
import { ActionSetsModel } from '@companion-app/shared/Model/ActionModel.js'

export class ControlEntityListPoolTrigger extends ControlEntityListPoolBase {
	#feedbacks: ControlEntityList

	#actions: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#feedbacks = this.createEntityList({
			type: EntityModelType.Feedback,
			groupId: 'conditions',
			label: 'Conditions',
			booleanFeedbacksOnly: true,
		})

		this.#actions = this.createEntityList({
			type: EntityModelType.Action,
			groupId: 'actions',
			label: 'Actions',
		})
	}

	loadStorage(storage: TriggerModel, skipSubscribe: boolean, isImport: boolean) {
		this.#feedbacks.loadStorage(storage.condition || [], skipSubscribe, isImport)
		this.#feedbacks.loadStorage(storage.action_sets?.[0] || [], skipSubscribe, isImport) // TODO - move this
	}

	/**
	 * Get the value from all feedbacks as a single boolean
	 */
	checkConditionValue(): boolean {
		return this.#feedbacks.getBooleanFeedbackValue()
	}

	/**
	 * Get all the feedback instances
	 */
	getFeedbackInstances(): FeedbackInstance[] {
		return transformEntityToFeedbacks(this.#feedbacks.getDirectEntities())
	}

	asActionStepModel(): ActionSetsModel {
		const actions: ActionSetsModel = {
			down: undefined,
			up: undefined,
			rotate_left: undefined,
			rotate_right: undefined,
			0: this.#actions.getDirectEntities().map((ent) => ent.asEntityModel(true)),
		}

		return actions
	}

	getActionsToExecute(): SomeEntityModel[] {
		return this.#actions.getDirectEntities().map((e) => e.asEntityModel(true))
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		if (listId === 'feedbacks') return this.#feedbacks
		if (listId === 'trigger_actions') return this.#feedbacks
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		return [this.#feedbacks, this.#actions]
	}
}
