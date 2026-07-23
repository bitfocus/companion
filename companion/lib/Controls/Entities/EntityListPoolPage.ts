import type { JsonValue } from 'type-fest'
import { ParseControlId } from '@companion-app/shared/ControlId.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { PageControlModel } from '@companion-app/shared/Model/PageControlModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { IPageStore } from '../../Page/Store.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, type ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { WithEntityEditing } from './EntityListPoolEditingMixin.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type { NewFeedbackValue } from './Types.js'

/**
 * The page-control entity pool. A page control exists purely to own a page's local variables,
 * which are exposed to the rest of the page as `$(page:varname)`.
 */
export class EntityListPoolPage extends WithEntityEditing(ControlEntityListPoolBase) {
	#localVariables: ControlEntityList
	readonly #pageStore: IPageStore

	constructor(props: ControlEntityListPoolProps) {
		super(props, false)

		this.#pageStore = props.pageStore

		this.#localVariables = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
		})
	}

	/** A page control has no grid location, so its parser gets the page's `this:page` context instead. */
	createVariablesAndExpressionParser(overrideVariableValues: VariableValues | null): VariablesAndExpressionParser {
		const parsed = ParseControlId(this.controlId)
		const pageNumber = parsed?.type === 'page' ? this.#pageStore.getPageNumber(parsed.pageId) : null

		return this.variableValues.createVariablesAndExpressionParserForPage(
			pageNumber,
			this.getLocalVariableEntities(),
			overrideVariableValues
		)
	}

	loadStorage(storage: PageControlModel, skipSubscribe: boolean, isImport: boolean): void {
		this.#localVariables.loadStorage(storage.localVariables, skipSubscribe, isImport)
	}

	getLocalVariableEntities(): ControlEntityInstance[] {
		return this.#localVariables.getDirectEntities()
	}

	/**
	 * Remove all of the page's variables (used when the page is wiped).
	 * @returns true if anything was removed
	 */
	clearVariables(): boolean {
		const entities = this.#localVariables.getDirectEntities()
		if (entities.length === 0) return false

		const removedNames = entities.map((e) => e.localVariableName).filter((name): name is string => !!name)

		this.#localVariables.loadStorage([], false, false)

		this.reportChange({ redraw: false })
		this.tryTriggerLocalVariablesChanged(...removedNames)

		return true
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

	public getFeedbackStyleOverrides(
		_defaultNoTopBar: boolean | undefined
	): ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>> {
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
