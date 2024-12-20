import { EntityModelType, type SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { transformEntityToFeedbacks } from './Util.js'

export class ControlEntityListPoolTrigger extends ControlEntityListPoolBase {
	#feedbacks: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#feedbacks = new ControlEntityList(
			props.instanceDefinitions,
			props.internalModule,
			props.moduleHost,
			props.controlId,
			null,
			{
				type: EntityModelType.Feedback,
				groupId: 'feedbacks',
				label: 'Feedbacks',
				booleanFeedbacksOnly: true,
			}
		)
	}

	loadStorage(storage: TriggerModel, skipSubscribe: boolean, isImport: boolean) {
		this.#feedbacks.loadStorage(storage.condition || [], skipSubscribe, isImport)
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

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		// TODO - expand
		if (listId === 'feedbacks') return this.#feedbacks
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		// TODO - expand
		return [this.#feedbacks]
	}
}
