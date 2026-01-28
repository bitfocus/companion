import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, type ControlEntityListPoolProps } from './EntityListPoolBase.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { NewFeedbackValue, NewIsInvertedValue } from './Types.js'

export class EntityListPoolExpressionVariable extends ControlEntityListPoolBase {
	#entities: ControlEntityList
	#localVariables: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#entities = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
			maximumChildren: 1,
		})
		this.#localVariables = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
		})
	}

	loadStorage(storage: ExpressionVariableModel, skipSubscribe: boolean, isImport: boolean): void {
		this.#entities.loadStorage(storage.entity ? [storage.entity] : [], skipSubscribe, isImport)
		this.#localVariables.loadStorage(storage.localVariables, skipSubscribe, isImport)
	}

	getLocalVariableEntities(): ControlEntityInstance[] {
		return this.#localVariables.getDirectEntities()
	}

	/**
	 * Get direct the entities
	 */
	getRootEntity(): ControlEntityInstance | undefined {
		return this.#entities.getDirectEntities()[0]
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		if (listId === 'feedbacks') return this.#entities
		if (listId === 'local-variables') return this.#localVariables
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		return [this.#entities, this.#localVariables]
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: ReadonlyMap<string, NewFeedbackValue>): void {
		const changedVariableEntities = this.#localVariables.updateFeedbackValues(connectionId, newValues)

		if (this.#entities.updateFeedbackValues(connectionId, newValues).length > 0) {
			this.invalidateControl()
		}

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	updateIsInvertedValues(newValues: ReadonlyMap<string, NewIsInvertedValue>): void {
		const changedVariableEntities = this.#localVariables.updateIsInvertedValues(newValues)

		if (this.#entities.updateIsInvertedValues(newValues).length > 0) {
			this.invalidateControl()
		}

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}
}
