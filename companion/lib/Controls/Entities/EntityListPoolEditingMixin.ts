import isEqual from 'fast-deep-equal'
import type { JsonValue } from 'type-fest'
import { isLabelValid } from '@companion-app/shared/Label.js'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import {
	type EntityOwner,
	type FeedbackEntityStyleOverride,
	type RawStoreResult,
	type SomeEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { ControlActionSetAndStepsEditor } from './ControlActionSetAndStepsManager.js'
import { isInternalUserValueFeedback, type ControlEntityInstance } from './EntityInstance.js'
import type { ControlEntityListPoolBase } from './EntityListPoolBase.js'
import type { ButtonEntityListPoolBase } from './EntityListPoolButton.js'

type Constructor<T = object> = new (...args: any[]) => T
type AbstractConstructor<T = object> = abstract new (...args: any[]) => T

/**
 * The read-only side of the entity-pool discriminated union. Same as the base pool, with the `isEditable`
 * discriminant pinned to `false` so it can be distinguished from {@link EditableEntityListPool}.
 */
export interface ReadonlyEntityPool extends ControlEntityListPoolBase {
	readonly isEditable: false
}

/**
 * The editable entity-pool surface: the read-only pool plus the structural entity-edit mutators added by
 * {@link WithEntityEditing}, with the `isEditable` discriminant pinned to `true`. Used (via
 * {@link SomeEntityPool}) to type `control.entities`; editing code narrows the union on `isEditable`.
 */
export interface EditableEntityListPool extends ControlEntityListPoolBase {
	readonly isEditable: true

	/**
	 * Add one or more entities to this control
	 * @param entityModels the items to add
	 * @param ownerId the ids of parent entity that these entities should be added as a child of
	 */
	entityAdd(listId: SomeSocketEntityLocation, ownerId: EntityOwner | null, ...entityModels: SomeEntityModel[]): boolean

	/** Duplicate an entity on this control */
	entityDuplicate(listId: SomeSocketEntityLocation, id: string): boolean

	/** Enable or disable an entity */
	entityEnabled(listId: SomeSocketEntityLocation, id: string, enabled: boolean): boolean

	/** Set the headline for an entity */
	entityHeadline(listId: SomeSocketEntityLocation, id: string, headline: string): boolean

	/** Learn the options for an entity, by asking the connection for the current values */
	entityLearn(listId: SomeSocketEntityLocation, id: string): Promise<boolean>

	/** Remove an entity from this control */
	entityRemove(listId: SomeSocketEntityLocation, id: string): boolean

	/**
	 * Move an entity within the hierarchy
	 * @param moveListId the id of the list to move the entity from
	 * @param moveEntityId the id of the entity to move
	 * @param newOwnerId the target new owner of the entity
	 * @param newListId the id of the list to move the entity to
	 * @param newIndex the target index of the entity
	 */
	entityMoveTo(
		moveListId: SomeSocketEntityLocation,
		moveEntityId: string,
		newOwnerId: EntityOwner | null,
		newListId: SomeSocketEntityLocation,
		newIndex: number
	): boolean

	/**
	 * Replace all the entities in a list
	 * @param listId the list to update
	 * @param entities entities to populate
	 */
	entityReplaceAll(listId: SomeSocketEntityLocation, entities: SomeEntityModel[]): boolean

	/**
	 * Update an option for an entity
	 * @param id the id of the entity
	 * @param key the key/name of the property
	 * @param value the new value
	 */
	entitySetOption(
		listId: SomeSocketEntityLocation,
		id: string,
		key: string,
		value: ExpressionOrValue<JsonValue | undefined>
	): boolean

	/**
	 * Set a new connection instance for an entity
	 * @param id the id of the entity
	 * @param connectionId the id of the new connection
	 */
	entitySetConnection(listId: SomeSocketEntityLocation, id: string, connectionId: string | number): boolean

	/**
	 * Set whether a boolean feedback should be inverted
	 * @param id the id of the entity
	 * @param isInverted the new value
	 */
	entitySetInverted(listId: SomeSocketEntityLocation, id: string, isInverted: ExpressionOrValue<boolean>): boolean

	/** Set where this action's result will be stored (if at all) */
	entitySetRawStoreResult(listId: SomeSocketEntityLocation, id: string, target: RawStoreResult | undefined): boolean

	/**
	 * Set the local variable name for an entity
	 * @param id the id of the entity
	 * @param name the new name for the variable
	 */
	entitySetVariableName(listId: SomeSocketEntityLocation, id: string, name: string): boolean

	/**
	 * Set the variable value for an entity, if this is a user local variable
	 * @param id the id of the entity
	 * @param value the new value for the variable
	 */
	entitySetVariableValue(listId: SomeSocketEntityLocation, id: string, value: JsonValue | undefined): boolean

	/** Replace a feedback's style override */
	entityReplaceStyleOverride(
		listId: SomeSocketEntityLocation,
		entityId: string,
		override: FeedbackEntityStyleOverride
	): boolean

	/** Remove a style override from a feedback */
	entityRemoveStyleOverride(listId: SomeSocketEntityLocation, entityId: string, overrideId: string): boolean
}

/**
 * The entity pool as seen by a control: a read-only-or-editable discriminated union. Narrow on `isEditable`
 * to reach the structural edit mutators.
 */
export type SomeEntityPool = ReadonlyEntityPool | EditableEntityListPool

/**
 * Mixin that adds the structural entity-edit mutators to a read-only {@link ControlEntityListPoolBase}.
 * These methods exist only on editable pools, so a read-only control (e.g. a preset reference) is read-only
 * by construction - it never inherits these, and there is no runtime flag to forget.
 */
export function WithEntityEditing<TBase extends AbstractConstructor<ControlEntityListPoolBase>>(
	Base: TBase
): Constructor<InstanceType<TBase> & EditableEntityListPool> {
	abstract class EntityEditingPool extends Base implements EditableEntityListPool {
		readonly isEditable = true

		entityAdd(
			listId: SomeSocketEntityLocation,
			ownerId: EntityOwner | null,
			...entityModels: SomeEntityModel[]
		): boolean {
			if (entityModels.length === 0) return false

			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			let newEntities: ControlEntityInstance[]
			if (ownerId) {
				const parent = entityList.findById(ownerId.parentId)
				if (!parent) throw new Error(`Failed to find parent entity ${ownerId.parentId} when adding child entity`)

				newEntities = entityModels.map((entity) => parent.addChild(ownerId.childGroup, entity))
			} else {
				newEntities = entityModels.map((entity) => entityList.addEntity(entity))
			}

			// Inform relevant module
			for (const entity of newEntities) {
				entity.subscribe(true)
			}

			this.tryTriggerLocalVariablesChanged(...newEntities)

			this.reportChange({
				// Ensure new feedbacks clear caches
				redraw: true, // Need to recheck status icon
				invalidateAllElements: listId === 'feedbacks',
			})

			return true
		}

		entityDuplicate(listId: SomeSocketEntityLocation, id: string): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.duplicateEntity(id)
			if (!entity) return false

			this.tryTriggerLocalVariablesChanged(entity)

			this.reportChange({
				// Ensure new feedbacks clear caches
				redraw: listId === 'feedbacks',
				changedElementIds: listId === 'feedbacks' ? entity.styleOverrideAffectedElementIds : undefined,
			})

			return true
		}

		entityEnabled(listId: SomeSocketEntityLocation, id: string, enabled: boolean): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(id)
			if (!entity) return false

			// Collect element IDs referenced by style overrides
			const affectedElementIds = listId === 'feedbacks' ? entity.styleOverrideAffectedElementIds : undefined

			entity.setEnabled(enabled)

			this.tryTriggerLocalVariablesChanged(entity)

			this.reportChange({
				redraw: true,
				changedElementIds: affectedElementIds,
			})

			return true
		}

		entityHeadline(listId: SomeSocketEntityLocation, id: string, headline: string): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(id)
			if (!entity) return false

			entity.setHeadline(headline)

			this.reportChange({
				redraw: false,
			})

			return true
		}

		async entityLearn(listId: SomeSocketEntityLocation, id: string): Promise<boolean> {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(id)
			if (!entity) return false

			const changed = await entity.learnOptions()
			if (!changed) return false

			// Time has passed due to the `await`
			// So the entity may not still exist, meaning we should find it again to be sure
			const entityAfter = entityList.findById(id)
			if (!entityAfter) return false

			this.tryTriggerLocalVariablesChanged(entityAfter)

			this.reportChange({
				redraw: listId === 'feedbacks',
			})

			return true
		}

		entityRemove(listId: SomeSocketEntityLocation, id: string): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const removedEntity = entityList.removeEntity(id)
			if (removedEntity) {
				this.reportChange({
					redraw: true, // Need to recheck status icon
					changedElementIds: listId === 'feedbacks' ? removedEntity.styleOverrideAffectedElementIds : undefined,
				})

				this.tryTriggerLocalVariablesChanged(removedEntity.localVariableName)

				return true
			} else {
				return false
			}
		}

		entityMoveTo(
			moveListId: SomeSocketEntityLocation,
			moveEntityId: string,
			newOwnerId: EntityOwner | null,
			newListId: SomeSocketEntityLocation,
			newIndex: number
		): boolean {
			if (newOwnerId && moveEntityId === newOwnerId.parentId) return false

			const oldInfo = this.getEntityList(moveListId)?.findParentAndIndex(moveEntityId)
			if (!oldInfo) return false

			let movedEntity: ControlEntityInstance | undefined

			if (
				isEqual(moveListId, newListId) &&
				oldInfo.parent.ownerId?.parentId === newOwnerId?.parentId &&
				oldInfo.parent.ownerId?.childGroup === newOwnerId?.childGroup
			) {
				movedEntity = oldInfo.parent.moveEntity(oldInfo.index, newIndex)
				if (!movedEntity) return false
			} else {
				const newEntityList = this.getEntityList(newListId)
				if (!newEntityList) return false

				const newParent = newOwnerId ? newEntityList.findById(newOwnerId.parentId) : null
				if (newOwnerId && !newParent) return false

				// Ensure the new parent is not a child of the entity being moved
				if (newOwnerId && oldInfo.item.findChildById(newOwnerId.parentId)) return false

				// Check if the new parent can hold the entity being moved
				if (newParent && !newParent.canAcceptChild(newOwnerId!.childGroup, oldInfo.item)) return false
				if (!newParent && !newEntityList.canAcceptEntity(oldInfo.item)) return false

				movedEntity = oldInfo.parent.popEntity(oldInfo.index)
				if (!movedEntity) return false

				if (newParent) {
					newParent.pushChild(movedEntity, newOwnerId!.childGroup, newIndex)
				} else {
					newEntityList.pushEntity(movedEntity, newIndex)
				}
			}

			this.reportChange({
				redraw: true,
				// If it moved at all, that could invalidate the overrides. Play it safe
				changedElementIds: movedEntity?.styleOverrideAffectedElementIds,
			})

			return true
		}

		entityReplaceAll(listId: SomeSocketEntityLocation, entities: SomeEntityModel[]): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			entityList.loadStorage(entities, false, false)

			this.reportChange({
				redraw: true,
				invalidateAllElements: listId === 'feedbacks',
			})

			return true
		}

		entitySetOption(
			listId: SomeSocketEntityLocation,
			id: string,
			key: string,
			value: ExpressionOrValue<JsonValue | undefined>
		): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(id)
			if (!entity) return false

			entity.setOption(key, value)

			this.tryTriggerLocalVariablesChanged(entity)

			this.reportChange({ redraw: false })

			return true
		}

		entitySetConnection(listId: SomeSocketEntityLocation, id: string, connectionId: string | number): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(id)
			if (!entity) return false

			entity.setConnectionId(connectionId)

			this.tryTriggerLocalVariablesChanged(entity)

			this.reportChange({
				redraw: true,
				// No need to invalidate caches, feedback values havent changed
			})

			return true
		}

		entitySetInverted(listId: SomeSocketEntityLocation, id: string, isInverted: ExpressionOrValue<boolean>): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(id)
			if (!entity) return false

			entity.setInverted(isInverted)

			this.tryTriggerLocalVariablesChanged(entity)

			this.reportChange({
				redraw: true,
				changedElementIds: listId === 'feedbacks' ? entity.styleOverrideAffectedElementIds : undefined,
			})

			return true
		}

		entitySetRawStoreResult(listId: SomeSocketEntityLocation, id: string, target: RawStoreResult | undefined): boolean {
			const entity = this.getEntityList(listId)?.findById(id)
			if (!entity) return false

			entity.setRawStoreResult(target)

			this.reportChange({ redraw: false })

			return true
		}

		entitySetVariableName(listId: SomeSocketEntityLocation, id: string, name: string): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(id)
			if (!entity) return false

			// Make sure the new name is valid
			if (name !== '' && !isLabelValid(name)) {
				// throw new Error(`Invalid local variable name "${name}"`)
				return false
			}

			const oldLocalVariableName = entity.localVariableName

			entity.setVariableName(name)

			this.tryTriggerLocalVariablesChanged(entity, oldLocalVariableName)

			this.reportChange({ redraw: false })

			return true
		}

		entitySetVariableValue(listId: SomeSocketEntityLocation, id: string, value: JsonValue | undefined): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(id)
			if (!entity) return false

			if (!isInternalUserValueFeedback(entity)) return false

			const needsPersistence = entity.setUserValue(value)

			// Persist value if needed
			if (needsPersistence) {
				this.reportChange({ redraw: false })
			}

			this.tryTriggerLocalVariablesChanged(entity)

			return true
		}

		entityReplaceStyleOverride(
			listId: SomeSocketEntityLocation,
			entityId: string,
			override: FeedbackEntityStyleOverride
		): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(entityId)
			if (!entity) return false

			const result = entity.replaceStyleOverride(override)
			if (result) {
				// Invalidate the specific element if the feedback is enabled
				this.reportChange({
					redraw: !entity.disabled,
					changedElementIds: !entity.disabled ? new Set([result.elementId]) : undefined,
				})

				return true
			}

			return false
		}

		entityRemoveStyleOverride(listId: SomeSocketEntityLocation, entityId: string, overrideId: string): boolean {
			const entityList = this.getEntityList(listId)
			if (!entityList) return false

			const entity = entityList.findById(entityId)
			if (!entity) return false

			const removed = entity.removeStyleOverride(overrideId)
			if (removed) {
				// Invalidate the specific element if the feedback is enabled
				this.reportChange({
					redraw: !entity.disabled,
					changedElementIds: !entity.disabled ? new Set([removed.elementId]) : undefined,
				})

				return true
			}

			return false
		}
	}

	return EntityEditingPool as unknown as Constructor<InstanceType<TBase> & EditableEntityListPool>
}

/**
 * Mixin that adds the structural step/action-set edit mutators to the shared {@link ButtonEntityListPoolBase}.
 * Applied on top of {@link WithEntityEditing} (which provides the `isEditable: true` discriminant), so the
 * resulting class is a {@link ControlActionSetAndStepsEditor}.
 */
export function WithStepEditing<TBase extends AbstractConstructor<ButtonEntityListPoolBase>>(
	Base: TBase
): Constructor<InstanceType<TBase> & ControlActionSetAndStepsEditor> {
	abstract class StepEditingPool extends Base {
		actionSetAdd(stepId: string): boolean {
			const step = this.steps.get(stepId)
			if (!step) return false

			const existingKeys = step.sets
				.keys()
				.map((k) => Number(k))
				.filter((k) => !isNaN(k))
				.toArray()
			if (existingKeys.length === 0) {
				// add the default '1000' set
				step.sets.set(1000, this.createActionEntityList([], false, false))

				this.reportChange({ redraw: true })

				return true
			} else {
				// add one after the last
				const max = Math.max(...existingKeys)
				const newIndex = Math.floor(max / 1000) * 1000 + 1000

				step.sets.set(newIndex, this.createActionEntityList([], false, false))

				this.reportChange({ redraw: false })

				return true
			}
		}

		actionSetRemove(stepId: string, setId: ActionSetId): boolean {
			const step = this.steps.get(stepId)
			if (!step) return false

			// Ensure is a valid number
			const setIdNumber = Number(setId)
			if (isNaN(setIdNumber)) return false

			const setToRemove = step.sets.get(setIdNumber)
			if (!setToRemove) return false

			// Inform modules of the change
			setToRemove.cleanup()

			// Forget the step from the options
			step.options.runWhileHeld = step.options.runWhileHeld.filter((id) => id !== setIdNumber)

			// Assume it exists
			step.sets.delete(setIdNumber)

			// Save the change, and perform a draw
			this.reportChange({ redraw: true })

			return true
		}

		actionSetRename(stepId: string, oldSetId: ActionSetId, newSetId: ActionSetId): boolean {
			const step = this.steps.get(stepId)
			if (!step) return false

			const newSetIdNumber = Number(newSetId)
			const oldSetIdNumber = Number(oldSetId)

			// Only valid when both are numbers
			if (isNaN(newSetIdNumber) || isNaN(oldSetIdNumber)) return false

			// Ensure old set exists
			const oldSet = step.sets.get(oldSetIdNumber)
			if (!oldSet) return false

			// Ensure new set doesnt already exist
			if (step.sets.has(newSetIdNumber)) return false

			// Rename the set
			step.sets.set(newSetIdNumber, oldSet)
			step.sets.delete(oldSetIdNumber)

			// Update the runWhileHeld options
			const runWhileHeldIndex = step.options.runWhileHeld.indexOf(oldSetIdNumber)
			if (runWhileHeldIndex !== -1) step.options.runWhileHeld[runWhileHeldIndex] = newSetIdNumber

			this.reportChange({ redraw: false })

			return true
		}

		actionSetRunWhileHeld(stepId: string, setId: ActionSetId, runWhileHeld: boolean): boolean {
			const step = this.steps.get(stepId)
			if (!step) return false

			// Ensure it is a number
			const setIdNumber = Number(setId)

			// Only valid when step is a number
			if (isNaN(setIdNumber)) return false

			// Ensure set exists
			if (!step.sets.get(setIdNumber)) return false

			const runWhileHeldIndex = step.options.runWhileHeld.indexOf(setIdNumber)
			if (runWhileHeld && runWhileHeldIndex === -1) {
				step.options.runWhileHeld.push(setIdNumber)
			} else if (!runWhileHeld && runWhileHeldIndex !== -1) {
				step.options.runWhileHeld.splice(runWhileHeldIndex, 1)
			}

			this.reportChange({ redraw: false })

			return true
		}

		/**
		 * Add a step to this control
		 * @returns Id of new step
		 */
		stepAdd(): string {
			const existingKeys = this.getStepIds()
				.map((k) => Number(k))
				.filter((k) => !isNaN(k))

			const stepId = existingKeys.length === 0 ? '0' : `${Math.max(...existingKeys) + 1}`

			this.steps.set(stepId, this.getNewStepValue(null, null))

			// Ensure current step is valid
			this.stepCheckExpression(true)

			this.reportChange({ redraw: true })

			return stepId
		}

		/**
		 * Duplicate a step on this control
		 * @param stepId the id of the step to duplicate
		 */
		stepDuplicate(stepId: string): boolean {
			const existingKeys = this.getStepIds()
				.map((k) => Number(k))
				.filter((k) => !isNaN(k))

			const stepToCopy = this.steps.get(stepId)
			if (!stepToCopy) return false

			const newStep = this.getNewStepValue(
				structuredClone(this.stepAsActionSetsModel(stepToCopy)),
				structuredClone(stepToCopy.options)
			)

			// add one after the last
			const max = Math.max(...existingKeys)

			const newStepId = `${max + 1}`
			this.steps.set(newStepId, newStep)

			// Ensure current step is valid
			this.stepCheckExpression(false)

			// Ensure the ui knows which step is current
			this.sendRuntimePropsChange()

			// Save the change, and perform a draw
			this.reportChange({ redraw: true })

			return true
		}

		/**
		 * Remove an action-set from this control
		 * @param stepId the id of the action-set
		 */
		stepRemove(stepId: string): boolean {
			const oldKeys = this.getStepIds()

			// Ensure there is at least one step
			if (oldKeys.length === 1) return false

			const step = this.steps.get(stepId)
			if (!step) return false

			for (const set of step.sets.values()) {
				set.cleanup()
			}
			this.steps.delete(stepId)

			// Update the current step
			if (this.currentStep.type === 'id') {
				if (this.currentStep.id === stepId) {
					const oldIndex = oldKeys.indexOf(stepId)
					const newIndex = oldIndex + 1 >= oldKeys.length ? 0 : oldIndex + 1
					this.currentStep.id = oldKeys[newIndex]

					this.sendRuntimePropsChange()
				}
			} else {
				// Ensure current step is valid
				this.stepCheckExpression(true)
			}

			// Save the change, and perform a draw
			this.reportChange({ redraw: true })

			return true
		}

		/**
		 * Swap two action-sets
		 * @param stepId1 One of the action-sets
		 * @param stepId2 The other action-set
		 */
		stepSwap(stepId1: string, stepId2: string): boolean {
			const step1 = this.steps.get(stepId1)
			const step2 = this.steps.get(stepId2)

			if (!step1 || !step2) return false

			this.steps.set(stepId1, step2)
			this.steps.set(stepId2, step1)

			// Ensure current step is valid
			this.stepCheckExpression(true)

			this.reportChange({ redraw: false })

			return true
		}

		/**
		 * Rename step
		 * @param stepId the id of the action-set
		 * @param newName the new name of the step
		 */
		stepRename(stepId: string, newName: string): boolean {
			const step = this.steps.get(stepId)
			if (!step) return false

			step.options.name = newName

			this.reportChange({ redraw: false })

			return true
		}
	}

	return StepEditingPool as unknown as Constructor<InstanceType<TBase> & ControlActionSetAndStepsEditor>
}
