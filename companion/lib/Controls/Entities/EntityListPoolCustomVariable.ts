import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, ControlEntityListPoolProps } from './EntityListPoolBase.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { CustomVariableModel } from '@companion-app/shared/Model/CustomVariableModel.js'

export class EntityListPoolCustomVariable extends ControlEntityListPoolBase {
	#entities: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#entities = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
			maximumChildren: 1,
		})
	}

	loadStorage(storage: CustomVariableModel, skipSubscribe: boolean, isImport: boolean): void {
		this.#entities.loadStorage(storage.entity ? [storage.entity] : [], skipSubscribe, isImport)
	}

	getLocalVariableEntities(): ControlEntityInstance[] {
		return []
	}

	/**
	 * Get direct the entities
	 */
	getRootEntity(): ControlEntityInstance | undefined {
		return this.#entities.getDirectEntities()[0]
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		if (listId === 'feedbacks') return this.#entities
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		return [this.#entities]
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: Record<string, any>): void {
		if (this.#entities.updateFeedbackValues(connectionId, newValues)) this.invalidateControl()
	}
}
