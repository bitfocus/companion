import { ControlButtonNormal } from './ControlTypes/Button/Normal.js'
import { ControlButtonPageDown } from './ControlTypes/PageDown.js'
import { ControlButtonPageNumber } from './ControlTypes/PageNumber.js'
import { ControlButtonPageUp } from './ControlTypes/PageUp.js'
import {
	CreateBankControlId,
	CreateTriggerControlId,
	ParseControlId,
	formatLocation,
} from '@companion-app/shared/ControlId.js'
import { ControlConfigRoom } from './ControlBase.js'
import { ActionRunner } from './ActionRunner.js'
import { ActionRecorder } from './ActionRecorder.js'
import { ControlTrigger } from './ControlTypes/Triggers/Trigger.js'
import { nanoid } from 'nanoid'
import { TriggerEvents } from './TriggerEvents.js'
import debounceFn from 'debounce-fn'
import type { SomeButtonModel, NormalButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ClientTriggerData, TriggerCollection, TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { SomeControl } from './IControlFragments.js'
import type { Registry } from '../Registry.js'
import type { ClientSocket } from '../UI/Handler.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EventEmitter } from 'events'
import type { ControlCommonEvents, ControlDependencies, SomeControlModel } from './ControlDependencies.js'
import { TriggerExecutionSource } from './ControlTypes/Triggers/TriggerExecutionSource.js'
import { ControlButtonLayered } from './ControlTypes/Button/Layered.js'
import { CompanionVariableValues } from '@companion-module/base'
import { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import LogController from '../Log/Controller.js'
import { DataStoreTableView } from '../Data/StoreBase.js'
import { TriggerCollections } from './TriggerCollections.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { ButtonControlBase } from './ControlTypes/Button/Base.js'

export const TriggersListRoom = 'triggers:list'
const ActiveLearnRoom = 'learn:active'

/**
 * The class that manages the controls
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.4
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlsController {
	readonly #logger = LogController.createLogger('Controls/Controller')

	readonly #registry: Pick<
		Registry,
		'db' | 'page' | 'ui' | 'io' | 'graphics' | 'surfaces' | 'internalModule' | 'instance' | 'variables' | 'userconfig'
	>
	readonly #controlEvents: EventEmitter<ControlCommonEvents>

	/**
	 * Actions runner
	 */
	readonly actionRunner: ActionRunner

	/**
	 * Actions recorder
	 */
	readonly actionRecorder: ActionRecorder

	/**
	 * The currently configured controls
	 */
	#controls = new Map<string, SomeControl<any>>()

	/**
	 * Triggers events
	 */
	readonly triggers: TriggerEvents

	/**
	 * Active learn requests. Ids of actions & feedbacks
	 */
	readonly #activeLearnRequests = new Set<string>()

	readonly #dbTable: DataStoreTableView<Record<string, SomeControlModel>>

	readonly #triggerCollections: TriggerCollections

	constructor(registry: Registry, controlEvents: EventEmitter<ControlCommonEvents>) {
		this.#registry = registry
		this.#controlEvents = controlEvents

		this.#dbTable = registry.db.getTableView('controls')

		this.triggers = new TriggerEvents()
		this.#triggerCollections = new TriggerCollections(
			registry.io,
			registry.db,
			this.triggers,
			(collectionIds) => this.#cleanUnknownTriggerCollectionIds(collectionIds),
			(enabledCollectionIds) => this.#checkTriggerCollectionsEnabled(enabledCollectionIds)
		)

		this.actionRunner = new ActionRunner(registry)
		this.actionRecorder = new ActionRecorder(registry)
	}

	#cleanUnknownTriggerCollectionIds(validCollectionIds: Set<string>): void {
		for (const control of this.#controls.values()) {
			if (control instanceof ControlTrigger) {
				control.checkCollectionIdIsValid(validCollectionIds)
			}
		}
	}

	#checkTriggerCollectionsEnabled(enabledCollectionIds: ReadonlySet<string>): void {
		for (const control of this.#controls.values()) {
			if (control instanceof ControlTrigger) {
				control.setCollectionEnabled(
					!control.options.collectionId || enabledCollectionIds.has(control.options.collectionId)
				)
			}
		}
	}

	/**
	 * Abort all delayed actions across all controls
	 */
	abortAllDelayedActions(exceptSignal: AbortSignal | null): void {
		for (const control of this.#controls.values()) {
			if (control.supportsActions) {
				control.abortDelayedActions(false, exceptSignal)
			}
		}
	}

	#createControlDependencies(): ControlDependencies {
		// This has to be done lazily for now, as the registry is not fully populated at the time of construction
		return {
			dbTable: this.#dbTable,
			io: this.#registry.ui.io,
			graphics: this.#registry.graphics,
			surfaces: this.#registry.surfaces,
			page: this.#registry.page,
			internalModule: this.#registry.internalModule,
			instance: this.#registry.instance,
			variables: this.#registry.variables,
			userconfig: this.#registry.userconfig,
			actionRunner: this.actionRunner,
			events: this.#controlEvents,
		}
	}

	/**
	 * Check the connection-status of every control
	 */
	checkAllStatus = debounceFn(
		(): void => {
			for (const control of this.#controls.values()) {
				if (typeof control.checkButtonStatus === 'function') {
					control.checkButtonStatus()
				}
			}
		},
		{
			before: false,
			after: true,
			wait: 100,
			maxWait: 500,
		}
	)

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		for (const control of this.#controls.values()) {
			if (control.supportsEntities) {
				control.clearConnectionState(connectionId)
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.actionRecorder.clientConnect(client)
		this.#triggerCollections.clientConnect(client)

		this.triggers.emit('client_connect')

		client.onPromise('controls:subscribe', (controlId) => {
			client.join(ControlConfigRoom(controlId))

			setImmediate(() => {
				// Send the preview image shortly after
				const location = this.#registry.page.getLocationOfControlId(controlId)
				if (location) {
					const img = this.#registry.graphics.getCachedRenderOrGeneratePlaceholder(location)
					// TODO - rework this to use the shared render cache concept
					client.emit(`controls:preview-${controlId}`, img?.asDataUrl)
				}
			})

			const control = this.getControl(controlId)
			return {
				config: control?.toJSON(false),
				runtime: control?.toRuntimeJSON(),
			}
		})

		client.onPromise('controls:unsubscribe', (controlId) => {
			client.leave(ControlConfigRoom(controlId))
		})

		client.onPromise('controls:reset', (location, type) => {
			const controlId = this.#registry.page.getControlIdAt(location)

			if (controlId) {
				this.deleteControl(controlId)
			}

			if (type) {
				this.createButtonControl(location, type)
			}
		})
		client.onPromise('controls:copy', (fromLocation, toLocation) => {
			// Don't try copying over itself
			if (
				fromLocation.pageNumber === toLocation.pageNumber &&
				fromLocation.column === toLocation.column &&
				fromLocation.row === toLocation.row
			)
				return false

			// Make sure target page number is valid
			if (!this.#registry.page.isPageValid(toLocation.pageNumber)) return false

			// Make sure there is something to copy
			const fromControlId = this.#registry.page.getControlIdAt(fromLocation)
			if (!fromControlId) return false

			const fromControl = this.getControl(fromControlId)
			if (!fromControl) return false
			const controlJson = fromControl.toJSON(true)

			// Delete the control at the destination
			const toControlId = this.#registry.page.getControlIdAt(toLocation)
			if (toControlId) {
				this.deleteControl(toControlId)
			}

			const newControlId = CreateBankControlId(nanoid())
			const newControl = this.#createClassForControl(newControlId, 'button', controlJson, true)
			if (newControl) {
				this.#controls.set(newControlId, newControl)

				this.#registry.page.setControlIdAt(toLocation, newControlId)

				newControl.triggerRedraw()

				return true
			}

			return false
		})
		client.onPromise('controls:move', (fromLocation, toLocation) => {
			// Don't try moving over itself
			if (
				fromLocation.pageNumber === toLocation.pageNumber &&
				fromLocation.column === toLocation.column &&
				fromLocation.row === toLocation.row
			)
				return false

			// Make sure target page number is valid
			if (!this.#registry.page.isPageValid(toLocation.pageNumber)) return false

			// Make sure there is something to move
			const fromControlId = this.#registry.page.getControlIdAt(fromLocation)
			if (!fromControlId) return false

			// Delete the control at the destination
			const toControlId = this.#registry.page.getControlIdAt(toLocation)
			if (toControlId) {
				this.deleteControl(toControlId)
			}

			// Perform the move
			this.#registry.page.setControlIdAt(fromLocation, null)
			this.#registry.page.setControlIdAt(toLocation, fromControlId)

			// Inform the control it was moved
			const control = this.getControl(fromControlId)
			if (control) control.triggerLocationHasChanged()

			// Force a redraw
			this.#registry.graphics.invalidateButton(fromLocation)
			this.#registry.graphics.invalidateButton(toLocation)

			return false
		})
		client.onPromise('controls:shortcut', (fromLocation, toLocation) => {
			// Don't try shortcutting to itself
			if (
				fromLocation.pageNumber === toLocation.pageNumber &&
				fromLocation.column === toLocation.column &&
				fromLocation.row === toLocation.row
			)
				return false

			// Make sure target page number is valid
			if (!this.#registry.page.isPageValid(toLocation.pageNumber)) return false

			// Make sure there is something to shortcut to
			const fromControlId = this.#registry.page.getControlIdAt(fromLocation)
			if (!fromControlId) return false

			const fromControl = this.getControl(fromControlId)
			if (!fromControl) return false

			// Delete the control at the destination
			const toControlId = this.#registry.page.getControlIdAt(toLocation)
			if (toControlId) {
				this.deleteControl(toControlId)
			}

			const createRotaryActions = fromControl.supportsOptions && fromControl.options.rotaryActions
			const newControlJson = this.createShortcutButtonDefinitionModel(fromLocation, createRotaryActions)

			const newControlId = CreateBankControlId(nanoid())
			const newControl = this.#createClassForControl(newControlId, 'button', newControlJson, true)
			if (newControl) {
				this.#controls.set(newControlId, newControl)

				this.#registry.page.setControlIdAt(toLocation, newControlId)

				return true
			}

			return false
		})
		client.onPromise('controls:swap', (fromLocation, toLocation) => {
			// Don't try moving over itself
			if (
				fromLocation.pageNumber === toLocation.pageNumber &&
				fromLocation.column === toLocation.column &&
				fromLocation.row === toLocation.row
			)
				return false

			// Make sure both page numbers are valid
			if (
				!this.#registry.page.isPageValid(toLocation.pageNumber) ||
				!this.#registry.page.isPageValid(fromLocation.pageNumber)
			)
				return false

			// Find the ids to move
			const fromControlId = this.#registry.page.getControlIdAt(fromLocation)
			const toControlId = this.#registry.page.getControlIdAt(toLocation)

			// Perform the swap
			this.#registry.page.setControlIdAt(toLocation, null)
			this.#registry.page.setControlIdAt(fromLocation, toControlId)
			this.#registry.page.setControlIdAt(toLocation, fromControlId)

			// Inform the controls they were moved
			const controlA = fromControlId && this.getControl(fromControlId)
			if (controlA) controlA.triggerLocationHasChanged()
			const controlB = toControlId && this.getControl(toControlId)
			if (controlB) controlB.triggerLocationHasChanged()

			// Force a redraw
			this.#registry.graphics.invalidateButton(fromLocation)
			this.#registry.graphics.invalidateButton(toLocation)

			return true
		})

		client.onPromise('controls:set-style-fields', (controlId, diff) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsStyle) {
				return control.styleSetFields(diff)
			} else {
				throw new Error(`Control "${controlId}" does not support config`)
			}
		})

		client.onPromise('controls:set-options-field', (controlId, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsOptions) {
				return control.optionsSetField(key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support options`)
			}
		})

		client.onPromise(
			'controls:entity:add',
			(controlId, entityLocation, ownerId, connectionId, entityTypeLabel, entityDefinition) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				const newEntity = this.#registry.instance.definitions.createEntityItem(
					connectionId,
					entityTypeLabel,
					entityDefinition
				)
				if (!newEntity) return false

				return control.entities.entityAdd(entityLocation, ownerId, newEntity)
			}
		)

		client.onPromise('controls:entity:learn', async (controlId, entityLocation, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			if (this.#activeLearnRequests.has(id)) throw new Error('Learn is already running')
			try {
				this.#setIsLearning(id, true)

				control.entities
					.entityLearn(entityLocation, id)
					.catch((e) => {
						this.#logger.error(`Learn failed: ${e}`)
					})
					.then(() => {
						this.#setIsLearning(id, false)
					})

				return true
			} catch (e) {
				this.#setIsLearning(id, false)
				throw e
			}
		})

		client.onPromise('controls:entity:enabled', (controlId, entityLocation, id, enabled) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entityEnabled(entityLocation, id, enabled)
		})

		client.onPromise('controls:entity:set-headline', (controlId, entityLocation, id, headline) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entityHeadline(entityLocation, id, headline)
		})

		client.onPromise('controls:entity:remove', (controlId, entityLocation, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entityRemove(entityLocation, id)
		})

		client.onPromise('controls:entity:duplicate', (controlId, entityLocation, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entityDuplicate(entityLocation, id)
		})

		client.onPromise('controls:entity:set-option', (controlId, entityLocation, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entrySetOptions(entityLocation, id, key, value)
		})

		client.onPromise('controls:entity:set-connection', (controlId, entityLocation, id, connectionId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entitySetConnection(entityLocation, id, connectionId)
		})

		client.onPromise('controls:entity:set-inverted', (controlId, entityLocation, id, isInverted) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entitySetInverted(entityLocation, id, isInverted)
		})

		client.onPromise('controls:entity:set-variable-name', (controlId, entityLocation, id, name) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entitySetVariableName(entityLocation, id, name)
		})

		client.onPromise('controls:entity:set-variable-value', (controlId, entityLocation, id, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entitySetVariableValue(entityLocation, id, value)
		})

		client.onPromise(
			'controls:entity:move',
			(controlId, moveEntityLocation, moveEntityId, newOwnerId, newEntityLocation, newIndex) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entityMoveTo(moveEntityLocation, moveEntityId, newOwnerId, newEntityLocation, newIndex)
			}
		)
		client.onPromise('controls:entity:set-style-selection', (controlId, entityLocation, id, selected) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities || !control.supportsStyle)
				throw new Error(`Control "${controlId}" does not support entities or styles`)

			return control.entities.entitySetStyleSelection(entityLocation, control.baseStyle, id, selected)
		})
		client.onPromise('controls:entity:set-style-value', (controlId, entityLocation, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.entitySetStyleValue(entityLocation, id, key, value)
		})

		client.onPromise('controls:hot-press', (location, direction, surfaceId) => {
			this.#logger.silly(`being told from gui to hot press ${formatLocation(location)} ${direction} ${surfaceId}`)
			if (!surfaceId) throw new Error('Missing surfaceId')

			const controlId = this.#registry.page.getControlIdAt(location)
			if (!controlId) return

			this.pressControl(controlId, direction, `hot:${surfaceId}`)
		})

		client.onPromise('controls:hot-rotate', (location, direction, surfaceId) => {
			this.#logger.silly(`being told from gui to hot rotate ${formatLocation(location)} ${direction} ${surfaceId}`)

			const controlId = this.#registry.page.getControlIdAt(location)
			if (!controlId) return

			this.rotateControl(controlId, direction, surfaceId ? `hot:${surfaceId}` : undefined)
		})

		client.onPromise('controls:action-set:add', (controlId, stepId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.actionSetAdd(stepId)
			} else {
				throw new Error(`Control "${controlId}" does not support this operation`)
			}
		})
		client.onPromise('controls:action-set:remove', (controlId, stepId, setId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.actionSetRemove(stepId, setId)
			} else {
				throw new Error(`Control "${controlId}" does not support this operation`)
			}
		})

		client.onPromise('controls:action-set:rename', (controlId, stepId, oldSetId, newSetId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.actionSetRename(stepId, oldSetId, newSetId)
			} else {
				throw new Error(`Control "${controlId}" does not support this operation`)
			}
		})

		client.onPromise('controls:action-set:set-run-while-held', (controlId, stepId, setId, runWhileHeld) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.actionSetRunWhileHeld(stepId, setId, runWhileHeld)
			} else {
				throw new Error(`Control "${controlId}" does not support this operation`)
			}
		})

		client.onPromise('controls:step:add', (controlId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.stepAdd()
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})
		client.onPromise('controls:step:duplicate', (controlId, stepId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.stepDuplicate(stepId)
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})
		client.onPromise('controls:step:remove', (controlId, stepId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.stepRemove(stepId)
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})

		client.onPromise('controls:step:swap', (controlId, stepId1, stepId2) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.stepSwap(stepId1, stepId2)
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})

		client.onPromise('controls:step:set-current', (controlId, stepId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.stepSelectCurrent(stepId)
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})

		client.onPromise('controls:step:rename', (controlId, stepId, newName) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsActionSets) {
				return control.actionSets.stepRename(stepId, newName)
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})

		client.onPromise('triggers:subscribe', () => {
			client.join(TriggersListRoom)

			const triggers: Record<string, ClientTriggerData> = {}

			for (const [controlId, control] of this.#controls.entries()) {
				if (control instanceof ControlTrigger) {
					triggers[controlId] = control.toTriggerJSON()
				}
			}

			return triggers
		})
		client.onPromise('triggers:unsubscribe', () => {
			client.leave(TriggersListRoom)
		})
		client.onPromise('triggers:create', () => {
			const controlId = CreateTriggerControlId(nanoid())

			const newControl = new ControlTrigger(this.#createControlDependencies(), this.triggers, controlId, null, false)
			this.#controls.set(controlId, newControl)

			// Add trigger to the end of the list
			const allTriggers: ControlTrigger[] = []
			for (const control of this.#controls.values()) {
				if (control instanceof ControlTrigger) {
					allTriggers.push(control)
				}
			}
			const maxRank = Math.max(0, ...allTriggers.map((control) => control.options.sortOrder))
			newControl.optionsSetField('sortOrder', maxRank, true)

			// Ensure it is stored to the db
			newControl.commitChange()

			// No collectionId yet so mark as enabled
			newControl.setCollectionEnabled(true)

			return controlId
		})
		client.onPromise('triggers:delete', (controlId) => {
			if (!this.#validateTriggerControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const control = this.getControl(controlId)
			if (control) {
				control.destroy()

				this.#controls.delete(controlId)

				this.#dbTable.delete(controlId)

				return true
			}

			return false
		})
		client.onPromise('triggers:clone', (controlId) => {
			if (!this.#validateTriggerControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const newControlId = CreateTriggerControlId(nanoid())

			const fromControl = this.getControl(controlId)
			if (fromControl) {
				const controlJson = fromControl.toJSON(true)

				const newControl = this.#createClassForControl(newControlId, 'trigger', controlJson, true)
				if (newControl) {
					this.#controls.set(newControlId, newControl)

					return newControlId
				}
			}

			return false
		})
		client.onPromise('triggers:test', (controlId) => {
			if (!this.#validateTriggerControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const control = this.getControl(controlId)
			if (control && control instanceof ControlTrigger) {
				control.executeActions(Date.now(), TriggerExecutionSource.Test)
			}

			return false
		})
		client.onPromise('triggers:reorder', (collectionId: string | null, controlId: string, dropIndex: number) => {
			const thisTrigger = this.#controls.get(controlId)
			if (!thisTrigger || !(thisTrigger instanceof ControlTrigger)) return false

			if (!this.#triggerCollections.doesCollectionIdExist(collectionId)) return false

			// update the collectionId of the trigger being moved if needed
			if (thisTrigger.options.collectionId !== (collectionId ?? undefined)) {
				thisTrigger.optionsSetField('collectionId', collectionId ?? undefined, true)
				thisTrigger.setCollectionEnabled(this.#triggerCollections.isCollectionEnabled(collectionId))
			}

			// find all the other triggers with the matching collectionId
			const sortedTriggers = Array.from(this.#controls.values())
				.filter(
					(control): control is ControlTrigger =>
						control.controlId !== controlId &&
						control instanceof ControlTrigger &&
						((!control.options.collectionId && !collectionId) || control.options.collectionId === collectionId)
				)
				.sort((a, b) => (a.options.sortOrder || 0) - (b.options.sortOrder || 0))

			if (dropIndex < 0) {
				// Push the trigger to the end of the array
				sortedTriggers.push(thisTrigger)
			} else {
				// Insert the trigger at the drop index
				sortedTriggers.splice(dropIndex, 0, thisTrigger)
			}

			// update the sort order of the connections in the store, tracking which ones changed
			sortedTriggers.forEach((trigger, index) => {
				if (trigger.options.sortOrder === index) return // No change

				trigger.optionsSetField('sortOrder', index, true)
			})

			return true
		})

		client.onPromise('controls:event:add', (controlId, eventType) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsEvents) {
				const eventItem = this.#registry.instance.definitions.createEventItem(eventType)
				if (eventItem) {
					return control.eventAdd(eventItem)
				} else {
					return false
				}
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:enabled', (controlId, id, enabled) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsEvents) {
				return control.eventEnabled(id, enabled)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:set-headline', (controlId, id, headline) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsEvents) {
				return control.eventHeadline(id, headline)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:remove', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsEvents) {
				return control.eventRemove(id)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:duplicate', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsEvents) {
				return control.eventDuplicate(id)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:set-option', (controlId, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsEvents) {
				return control.eventSetOptions(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:reorder', (controlId, oldIndex, newIndex) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.supportsEvents) {
				return control.eventReorder(oldIndex, newIndex)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:subscribe:learn', async () => {
			client.join(ActiveLearnRoom)

			return Array.from(this.#activeLearnRequests)
		})
		client.onPromise('controls:unsubscribe:learn', async () => {
			client.leave(ActiveLearnRoom)
		})

		client.onPromise('controls:style:add-element', async (controlId, type, index) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsLayeredStyle) throw new Error(`Control "${controlId}" does not support layer styles`)

			return control.layeredStyleAddElement(type, index)
		})
		client.onPromise('controls:style:remove-element', async (controlId, elementId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsLayeredStyle) throw new Error(`Control "${controlId}" does not support layer styles`)

			return control.layeredStyleRemoveElement(elementId)
		})
		client.onPromise('controls:style:move-element', async (controlId, elementId, parentElementId, newIndex) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsLayeredStyle) throw new Error(`Control "${controlId}" does not support layer styles`)

			return control.layeredStyleMoveElement(elementId, parentElementId, newIndex)
		})
		client.onPromise('controls:style:set-element-name', async (controlId, elementId, name) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsLayeredStyle) throw new Error(`Control "${controlId}" does not support layer styles`)

			return control.layeredStyleSetElementName(elementId, name)
		})
		client.onPromise('controls:style:set-element-usage', async (controlId, elementId, usage) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsLayeredStyle) throw new Error(`Control "${controlId}" does not support layer styles`)

			return control.layeredStyleSetElementUsage(elementId, usage)
		})
		client.onPromise('controls:style:update-option-value', async (controlId, elementId, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsLayeredStyle) throw new Error(`Control "${controlId}" does not support layer styles`)

			return control.layeredStyleUpdateOptionValue(elementId, key, value)
		})
		client.onPromise('controls:style:update-option-is-expression', async (controlId, elementId, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (!control.supportsLayeredStyle) throw new Error(`Control "${controlId}" does not support layer styles`)

			return control.layeredStyleUpdateOptionIsExpression(elementId, key, value)
		})

		client.onPromise('controls:local-variables-values', (controlId) => {
			const control = this.getControl(controlId)
			if (!control) return {}

			if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

			return control.entities.getLocalVariableValues()
		})
	}

	/**
	 * Create a new control class instance
	 * @param controlId Id of the control
	 * @param category 'button' | 'trigger' | 'all'
	 * @param controlObj The existing configuration of the control, or string type if it is a new control. Note: the control must be given a clone of an object
	 * @param isImport Whether this is an import, and needs additional processing
	 */
	#createClassForControl(
		controlId: string,
		category: 'button' | 'trigger' | 'all',
		controlObj: SomeControlModel | string,
		isImport: boolean
	): SomeControl<any> | null {
		const controlType = typeof controlObj === 'object' ? controlObj.type : controlObj
		const controlObj2 = typeof controlObj === 'object' ? controlObj : null
		if (category === 'all' || category === 'button') {
			if (controlObj2?.type === 'button' || (controlType === 'button' && !controlObj2)) {
				return new ControlButtonNormal(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'button-layered' || (controlType === 'button-layered' && !controlObj2)) {
				return new ControlButtonLayered(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagenum' || (controlType === 'pagenum' && !controlObj2)) {
				return new ControlButtonPageNumber(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pageup' || (controlType === 'pageup' && !controlObj2)) {
				return new ControlButtonPageUp(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagedown' || (controlType === 'pagedown' && !controlObj2)) {
				return new ControlButtonPageDown(this.#createControlDependencies(), controlId, controlObj2, isImport)
			}
		}

		if (category === 'all' || category === 'trigger') {
			if (controlObj2?.type === 'trigger' || (controlType === 'trigger' && !controlObj2)) {
				const trigger = new ControlTrigger(
					this.#createControlDependencies(),
					this.triggers,
					controlId,
					controlObj2,
					isImport
				)
				setImmediate(() => {
					// Ensure the trigger is enabled, on a slight debounce
					trigger.setCollectionEnabled(this.#triggerCollections.isCollectionEnabled(trigger.options.collectionId))
				})
				return trigger
			}
		}

		// Unknown type
		this.#logger.warn(`Cannot create control "${controlId}" of unknown type "${controlType}"`)
		return null
	}

	/**
	 * Update all controls to forget a connection
	 */
	forgetConnection(connectionId: string): void {
		for (const control of this.#controls.values()) {
			if (control.supportsEntities) {
				control.forgetConnection(connectionId)
			}
		}
	}

	/**
	 * Get all of the populated controls
	 */
	getAllControls(): ReadonlyMap<string, SomeControl<any>> {
		return this.#controls // TODO - readonly?
	}

	/**
	 * Get all of the trigger controls
	 */
	getAllTriggers(): ControlTrigger[] {
		const triggers: ControlTrigger[] = []
		for (const control of this.#controls.values()) {
			if (control instanceof ControlTrigger) {
				triggers.push(control)
			}
		}
		return triggers
	}

	/**
	 * Get a control if it has been populated
	 */
	getControl(controlId: string): SomeControl<any> | undefined {
		if (!controlId) return undefined
		return this.#controls.get(controlId)
	}

	/**
	 * Get a Trigger control if it exists
	 */
	getTrigger(triggerId: string): ControlTrigger | undefined {
		const controlId = CreateTriggerControlId(triggerId)
		const control = this.#controls.get(controlId)
		if (!control || !(control instanceof ControlTrigger)) return undefined
		return control
	}

	/**
	 * Import a control
	 */
	importControl(location: ControlLocation, definition: SomeButtonModel, forceControlId?: string): boolean {
		if (forceControlId && !this.#validateBankControlId(forceControlId)) {
			// Control id is not valid!
			return false
		}

		// Delete old control at the coordinate
		const oldControlId = this.#registry.page.getControlIdAt(location)
		if (oldControlId) {
			this.deleteControl(oldControlId)
		}

		const newControlId = forceControlId || CreateBankControlId(nanoid())
		const newControl = this.#createClassForControl(newControlId, 'button', definition, true)
		if (newControl) {
			this.#controls.set(newControlId, newControl)

			this.#registry.page.setControlIdAt(location, newControlId)

			newControl.triggerRedraw()

			// Ensure it is stored to the db
			newControl.commitChange()

			return true
		}

		return false
	}

	/**
	 * Import a trigger
	 */
	importTrigger(controlId: string, definition: TriggerModel): boolean {
		if (!this.#validateTriggerControlId(controlId)) {
			// Control id is not valid!
			return false
		}

		if (this.#controls.has(controlId)) throw new Error(`Trigger ${controlId} already exists`)

		const newControl = this.#createClassForControl(controlId, 'trigger', definition, true)
		if (newControl) {
			this.#controls.set(controlId, newControl)

			// Ensure it is stored to the db
			newControl.commitChange()

			return true
		}

		return false
	}

	/**
	 * Initialise the controls
	 */
	init(): void {
		// Init all the control classes
		const config = this.#dbTable.all()
		for (const [controlId, controlObj] of Object.entries(config)) {
			if (controlObj && controlObj.type) {
				const inst = this.#createClassForControl(controlId, 'all', controlObj, false)
				if (inst) this.#controls.set(controlId, inst)
			}
		}

		// Ensure all trigger collections are valid
		this.#cleanUnknownTriggerCollectionIds(this.#triggerCollections.collectAllCollectionIds())
	}

	/**
	 * Propagate variable changes to the controls
	 */
	onVariablesChanged(allChangedVariablesSet: Set<string>, fromControlId: string | null): void {
		// Inform triggers of the change
		this.triggers.emit('variables_changed', allChangedVariablesSet, fromControlId)

		if (allChangedVariablesSet.size > 0) {
			for (const control of this.#controls.values()) {
				// If the changes are local variables and from another control, ignore them
				if (fromControlId && fromControlId !== control.controlId) continue

				if (control.supportsStyle || control.supportsLayeredStyle) {
					control.onVariablesChanged(allChangedVariablesSet)
				}
			}
		}
	}

	/**
	 * Execute a press of a control
	 * @param controlId Id of the control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 * @param force Trigger actions even if already in the state
	 */
	pressControl(controlId: string, pressed: boolean, surfaceId: string | undefined, force?: boolean): boolean {
		const control = this.getControl(controlId)
		if (control) {
			this.triggers.emit('control_press', controlId, pressed, surfaceId)

			control.pressControl(pressed, surfaceId, force)

			return true
		}

		return false
	}

	/**
	 * Execute rotation of a control
	 * @param controlId Id of the control
	 * @param direction Whether the control is rotated to the right
	 * @param surfaceId The surface that initiated this rotate
	 */
	rotateControl(controlId: string, direction: boolean, surfaceId: string | undefined): boolean {
		const control = this.getControl(controlId)
		if (control && control.supportsActionSets) {
			control.rotateControl(direction, surfaceId)
			return true
		}

		return false
	}

	/**
	 * Rename a connection for variables used in the controls
	 * @param labelFrom - the old connection short name
	 * @param labelTo - the new connection short name
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		for (const control of this.#controls.values()) {
			control.renameVariables(labelFrom, labelTo)
		}
	}

	/**
	 * Delete a control
	 */
	deleteControl(controlId: string): void {
		const control = this.getControl(controlId)
		if (control) {
			control.destroy()
			this.#controls.delete(controlId)

			this.#dbTable.delete(controlId)
		}

		const location = this.#registry.page.getLocationOfControlId(controlId)
		if (location) {
			this.#registry.page.setControlIdAt(location, null)

			// Notify interested parties
			this.#controlEvents.emit('updateButtonState', location, false, undefined)

			// Force a redraw
			this.#registry.graphics.invalidateButton(location)
		}
	}

	discardTriggerCollections(): void {
		this.#triggerCollections.discardAllCollections()
	}

	exportTriggerCollections(): TriggerCollection[] {
		return this.#triggerCollections.collectionData
	}

	replaceTriggerCollections(collections: TriggerCollection[]): void {
		this.#triggerCollections.replaceCollections(collections)
	}

	/**
	 * Create a control
	 * Danger: This will not delete an existing control from the specified location
	 * @param location Location to place in the grid
	 * @param newType The type of the new control to create (if any)
	 * @returns controlId
	 * @access public
	 */
	createButtonControl(location: ControlLocation, newType: string): string | null {
		if (!this.#registry.page.isPageValid(location.pageNumber)) return null

		const controlId = CreateBankControlId(nanoid())
		const newControl = this.#createClassForControl(controlId, 'button', newType, false)
		if (!newControl) return null

		this.#controls.set(controlId, newControl)
		this.#registry.page.setControlIdAt(location, controlId)

		// Notify interested parties
		this.#controlEvents.emit('updateButtonState', location, false, undefined)

		// Force a redraw
		this.#registry.graphics.invalidateButton(location)

		return controlId
	}

	/**
	 * Set an item as learning, or not
	 */
	#setIsLearning(id: string, isActive: boolean): void {
		if (isActive) {
			this.#activeLearnRequests.add(id)
			this.#registry.io.emitToRoom(ActiveLearnRoom, 'learn:add', id)
		} else {
			this.#activeLearnRequests.delete(id)
			this.#registry.io.emitToRoom(ActiveLearnRoom, 'learn:remove', id)
		}
	}

	setTriggerCollectionEnabled(collectionId: string, enabled: boolean | 'toggle'): void {
		this.#triggerCollections.setCollectionEnabled(collectionId, enabled)
	}
	isTriggerCollectionEnabled(collectionId: string, onlyDirect: boolean): boolean {
		return this.#triggerCollections.isCollectionEnabled(collectionId, onlyDirect)
	}

	/**
	 * Update values for some feedbacks
	 * @param connectionId
	 * @param result - object containing new values for the feedbacks that have changed
	 */
	updateFeedbackValues(connectionId: string, result: NewFeedbackValue[]): void {
		if (result.length === 0) return

		const values: Record<string, Record<string, any>> = {}

		for (const item of result) {
			if (!values[item.controlId]) values[item.controlId] = {}

			values[item.controlId][item.id] = item.value
		}

		// Pass values to controls
		for (const [controlId, newValues] of Object.entries(values)) {
			const control = this.getControl(controlId)
			if (control && control.supportsEntities) {
				control.entities.updateFeedbackValues(connectionId, newValues)
			}
		}
	}

	/**
	 * Verify a controlId is valid for the current id scheme and grid size
	 */
	#validateBankControlId(controlId: string): boolean {
		const parsed = ParseControlId(controlId)
		if (parsed?.type !== 'bank') return false

		return true
	}

	/**
	 * Verify a controlId is valid for the current id scheme and grid size
	 */
	#validateTriggerControlId(controlId: string): boolean {
		const parsed = ParseControlId(controlId)
		if (parsed?.type !== 'trigger') return false

		return true
	}

	/**
	 * Prune any items on controls which belong to an unknown connectionId
	 * @access public
	 */
	verifyConnectionIds(): void {
		const knownConnectionIds = new Set(this.#registry.instance.getAllInstanceIds())
		knownConnectionIds.add('internal')

		for (const control of this.#controls.values()) {
			if (!control.supportsEntities) continue
			control.entities.verifyConnectionIds(knownConnectionIds)
		}
	}

	createShortcutButtonDefinitionModel(
		targetLocation: ControlLocation,
		createRotaryActions: boolean
	): NormalButtonModel {
		const locationOptions = {
			location_target: 'text',
			location_text: formatLocation(targetLocation),
		}

		const entity = (type: EntityModelType, definitionId: string) => {
			const entity = this.#registry.instance.definitions.createEntityItem('internal', type, definitionId)
			if (!entity) {
				throw new Error(`Failed to create action entity for definition "${definitionId}"`)
			}
			entity.options = locationOptions
			return entity
		}

		return {
			type: 'button',
			style: ControlButtonNormal.DefaultStyle,
			feedbacks: [entity(EntityModelType.Feedback, 'bank_style')],
			steps: {
				'0': {
					action_sets: {
						down: [entity(EntityModelType.Action, 'button_pressrelease')],
						up: [],
						rotate_left: createRotaryActions ? [entity(EntityModelType.Action, 'button_rotate_left')] : undefined,
						rotate_right: createRotaryActions ? [entity(EntityModelType.Action, 'button_rotate_right')] : undefined,
					},
					options: { runWhileHeld: [] },
				},
			},
			options: {
				...ButtonControlBase.DefaultOptions,
				rotaryActions: createRotaryActions,
			},
			localVariables: [],
		}
	}

	createVariablesAndExpressionParser(
		controlLocation: ControlLocation | null | undefined,
		overrideVariableValues: CompanionVariableValues | null
	): VariablesAndExpressionParser {
		const controlId = controlLocation && this.#registry.page.getControlIdAt(controlLocation)
		const control = controlId && this.getControl(controlId)

		const variableEntities = control && control.supportsEntities ? control.entities.getLocalVariableEntities() : []

		return this.#registry.variables.values.createVariablesAndExpressionParser(
			controlLocation,
			variableEntities,
			overrideVariableValues
		)
	}
}

export interface NewFeedbackValue {
	id: string
	controlId: string
	value: any
}
