import type { JsonValue } from 'type-fest'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, type ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { WithEntityEditing } from './EntityListPoolEditingMixin.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type { NewFeedbackValue } from './Types.js'

/**
 * The expression-variable entity pool. Always editable, so this single exported class IS the editable pool
 * (entity-edit mutators mixed in via {@link WithEntityEditing}); there is no separate read-only variant. The
 * shared read-only machinery lives on the internal {@link ControlEntityListPoolBase}.
 */
export class EntityListPoolExpressionVariable extends WithEntityEditing(ControlEntityListPoolBase) {
	#entities: ControlEntityList
	#localVariables: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props, false)

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

	/** An expression variable has no location, so its parser gets no `this:*` context. */
	createVariablesAndExpressionParser(overrideVariableValues: VariableValues | null): VariablesAndExpressionParser {
		return this.variableValues.createVariablesAndExpressionParser(
			null,
			this.getLocalVariableEntities(),
			overrideVariableValues
		)
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
			this.reportChange({
				redraw: true,
				noSave: true,
			})
		}

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

		if (this.#entities.updateIsInvertedValues(newValues).length > 0) {
			this.reportChange({
				redraw: true,
				noSave: true,
			})
		}

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	/**
	 * Update the storeResult values on the control with new calculated
	 * storeResult values
	 * @param _newValues The new storeResult values
	 */
	override updateStoreResultValues(_newValues: ReadonlyMap<string, NewSpecialExpressionValue<'storeResult'>>): void {
		// this.#entities and this.#localVariables contain feedbacks, not actions,
		// so nothing to do
	}
}
