import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, ControlEntityListPoolProps } from './EntityListPoolBase.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { CustomVariablesControlModel } from '@companion-app/shared/Model/CustomVariableModel.js'

export class ControlEntityListPoolCustomVariables extends ControlEntityListPoolBase {
	readonly #localVariables: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#localVariables = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
		})
	}

	loadStorage(storage: CustomVariablesControlModel, skipSubscribe: boolean, isImport: boolean): void {
		this.#localVariables.loadStorage(storage.variables || [], skipSubscribe, isImport)
	}

	getLocalVariableEntities(): ControlEntityInstance[] {
		return this.#localVariables.getAllEntities()
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		if (listId === 'variables') return this.#localVariables

		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		return [this.#localVariables]
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: Record<string, any>): void {
		const changedVariableEntities = this.#localVariables.updateFeedbackValues(connectionId, newValues)

		const changedVariables = new Set<string>()
		for (const entity of changedVariableEntities) {
			const localName = entity.localVariableName
			if (localName) changedVariables.add(localName)
		}

		if (changedVariables.size > 0) {
			this.localVariablesChanged?.(changedVariables)
		}
	}
}
