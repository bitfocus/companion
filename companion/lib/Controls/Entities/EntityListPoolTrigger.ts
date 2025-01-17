import {
	EntityModelType,
	SomeEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, ControlEntityListPoolProps } from './EntityListPoolBase.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlEntityInstance } from './EntityInstance.js'

export class ControlEntityListPoolTrigger extends ControlEntityListPoolBase {
	#feedbacks: ControlEntityList

	#actions: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#feedbacks = this.createEntityList({
			type: EntityModelType.Feedback,
			booleanFeedbacksOnly: true,
		})
		this.#actions = this.createEntityList({ type: EntityModelType.Action })
	}

	get baseStyle(): ButtonStyleProperties {
		throw new Error('baseStyle not supported for triggers.')
	}

	loadStorage(storage: TriggerModel, skipSubscribe: boolean, isImport: boolean) {
		this.#feedbacks.loadStorage(storage.condition || [], skipSubscribe, isImport)
		this.#feedbacks.loadStorage(storage.actions || [], skipSubscribe, isImport)
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

	/**
	 * Get direct the action instances
	 */
	getActionEntities(): ControlEntityInstance[] {
		return this.#actions.getDirectEntities()
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
