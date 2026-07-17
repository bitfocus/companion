import type { JsonValue } from 'type-fest'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { PageControlModel } from '@companion-app/shared/Model/PageControlModel.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, type ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { WithEntityEditing } from './EntityListPoolEditingMixin.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type { NewFeedbackValue } from './Types.js'

/**
 * The page-control entity pool. A page control has no drawing and no "root" entity - it exists purely
 * to own a page's local variables, which are exposed to the rest of the page as `$(page:varname)`.
 *
 * So, unlike {@link ./EntityListPoolExpressionVariable.js EntityListPoolExpressionVariable}, this pool
 * has ONLY the `local-variables` list. Always editable, so this single class is the editable pool
 * (mutators mixed in via {@link WithEntityEditing}).
 */
export class EntityListPoolPage extends WithEntityEditing(ControlEntityListPoolBase) {
	#localVariables: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props, false)

		this.#localVariables = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
		})
	}

	loadStorage(storage: PageControlModel, skipSubscribe: boolean, isImport: boolean): void {
		this.#localVariables.loadStorage(storage.localVariables, skipSubscribe, isImport)
	}

	getLocalVariableEntities(): ControlEntityInstance[] {
		return this.#localVariables.getDirectEntities()
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		if (listId === 'local-variables') return this.#localVariables
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		return [this.#localVariables]
	}

	/**
	 * Update the feedbacks on the control with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: ReadonlyMap<string, NewFeedbackValue>): void {
		const changedVariableEntities = this.#localVariables.updateFeedbackValues(connectionId, newValues)

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	public getFeedbackStyleOverrides(): ReadonlyMap<
		string,
		ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>
	> {
		return new Map()
	}

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	override updateIsInvertedValues(newValues: ReadonlyMap<string, NewSpecialExpressionValue<'isInverted'>>): void {
		const changedVariableEntities = this.#localVariables.updateIsInvertedValues(newValues)

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	/**
	 * Update the storeResult values on the control with new calculated storeResult values
	 */
	override updateStoreResultValues(_newValues: ReadonlyMap<string, NewSpecialExpressionValue<'storeResult'>>): void {
		// this.#localVariables contains feedbacks, not actions, so nothing to do
	}
}
