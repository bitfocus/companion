import Registry from '../Registry.js'
import CoreBase from '../Core/Base.js'
import ControlButtonNormal from './ControlTypes/Button/Normal.js'
import ControlButtonPageDown from './ControlTypes/PageDown.js'
import ControlButtonPageNumber from './ControlTypes/PageNumber.js'
import ControlButtonPageUp from './ControlTypes/PageUp.js'
import { CreateBankControlId, CreateTriggerControlId, ParseControlId, formatLocation } from '../Shared/ControlId.js'
import { ControlConfigRoom } from './ControlBase.js'
import ActionRunner from './ActionRunner.js'
import ActionRecorder from './ActionRecorder.js'
import ControlTrigger from './ControlTypes/Triggers/Trigger.js'
import { nanoid } from 'nanoid'
import TriggerEvents from './TriggerEvents.js'
import debounceFn from 'debounce-fn'

export const TriggersListRoom = 'triggers:list'

/**
 * The class that manages the controls
 *
 * @extends CoreBase
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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class ControlsController extends CoreBase {
	/**
	 * Actions runner
	 * @type {ActionRunner}
	 * @access public
	 */
	actions

	/**
	 * Actions recorder
	 * @type {ActionRecorder}
	 * @access public
	 */
	actionRecorder

	/**
	 * The currently configured controls
	 * @access private
	 */
	#controls = new Map()

	/**
	 * Triggers events
	 * @type {TriggerEvents}
	 * @access public
	 */
	triggers

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'controls', 'Controls/Controller')

		this.actions = new ActionRunner(registry)
		this.actionRecorder = new ActionRecorder(registry)
		this.triggers = new TriggerEvents(registry)

		// Init all the control classes
		const config = this.db.getKey('controls', {})
		for (const [controlId, controlObj] of Object.entries(config)) {
			if (controlObj && controlObj.type) {
				const inst = this.#createClassForControl(controlId, 'all', controlObj.type, controlObj, false)
				if (inst) this.#controls.set(controlId, inst)
			}
		}
	}

	/**
	 * Check the instance-status of every control
	 * @access public
	 */
	checkAllStatus = debounceFn(
		() => {
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
	 * Remove any tracked state for an instance
	 * @param {string} instanceId
	 * @access public
	 */
	clearInstanceState(instanceId) {
		for (const control of this.#controls.values()) {
			if (typeof control.clearInstanceState === 'function') {
				control.clearInstanceState(instanceId)
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.actionRecorder.clientConnect(client)

		this.triggers.emit('client_connect')

		client.onPromise('controls:subscribe', (controlId) => {
			client.join(ControlConfigRoom(controlId))

			setImmediate(() => {
				// Send the preview image shortly after
				const location = this.page.getLocationOfControlId(controlId)
				if (location) {
					const img = this.graphics.getBank(location)
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
			const controlId = this.page.getControlIdAt(location)

			if (controlId) {
				this.deleteControl(controlId)
			}

			if (type) {
				this.createBankControl(location, type)
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
			if (!this.page.isPageValid(toLocation.pageNumber)) return false

			// Make sure there is something to copy
			const fromControlId = this.page.getControlIdAt(fromLocation)
			if (!fromControlId) return false

			const fromControl = this.getControl(fromControlId)
			if (!fromControl) return false
			const controlJson = fromControl.toJSON(true)

			// Delete the control at the destination
			const toControlId = this.page.getControlIdAt(toLocation)
			if (toControlId) {
				this.deleteControl(toControlId)
			}

			const newControlId = CreateBankControlId(nanoid())
			const newControl = this.#createClassForControl(newControlId, 'bank', controlJson.type, controlJson, true)
			if (newControl) {
				this.#controls.set(toControlId, newControl)

				this.page.setControlIdAt(toLocation, newControlId)

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
			if (!this.page.isPageValid(toLocation.pageNumber)) return false

			// Make sure there is something to move
			const fromControlId = this.page.getControlIdAt(fromLocation)
			if (!fromControlId) return false

			// Delete the control at the destination
			const toControlId = this.page.getControlIdAt(toLocation)
			if (toControlId) {
				this.deleteControl(toControlId)
			}

			// Perform the move
			this.page.setControlIdAt(fromLocation, null)
			this.page.setControlIdAt(toLocation, fromControlId)

			// Inform the control it was moved
			const control = this.getControl(fromControlId)
			if (control) control.triggerLocationHasChanged()

			// Force a redraw
			this.graphics.invalidateButton(fromLocation)
			this.graphics.invalidateButton(toLocation)

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
			if (!this.page.isPageValid(toLocation.pageNumber) || !this.page.isPageValid(fromLocation.pageNumber)) return false

			// Find the ids to move
			const fromControlId = this.page.getControlIdAt(fromLocation)
			const toControlId = this.page.getControlIdAt(toLocation)

			// Perform the swap
			this.page.setControlIdAt(toLocation, null)
			this.page.setControlIdAt(fromLocation, toControlId)
			this.page.setControlIdAt(toLocation, fromControlId)

			// Inform the controls they were moved
			const controlA = this.getControl(fromControlId)
			if (controlA) controlA.triggerLocationHasChanged()
			const controlB = this.getControl(toControlId)
			if (controlB) controlB.triggerLocationHasChanged()

			// Force a redraw
			this.graphics.invalidateButton(fromLocation)
			this.graphics.invalidateButton(toLocation)

			return true
		})

		client.onPromise('controls:set-style-fields', (controlId, diff) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.styleSetFields === 'function') {
				return control.styleSetFields(diff)
			} else {
				throw new Error(`Control "${controlId}" does not support config`)
			}
		})

		client.onPromise('controls:set-options-field', (controlId, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.optionsSetField === 'function') {
				return control.optionsSetField(key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support options`)
			}
		})

		client.onPromise('controls:feedback:add', (controlId, instanceId, feedbackId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackAdd === 'function') {
				const feedbackItem = this.instance.definitions.createFeedbackItem(
					instanceId,
					feedbackId,
					control.feedbacks.isBooleanOnly
				)
				if (feedbackItem) {
					return control.feedbacks.feedbackAdd(feedbackItem)
				} else {
					return false
				}
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:learn', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackLearn === 'function') {
				return control.feedbacks.feedbackLearn(id)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:enabled', (controlId, id, enabled) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackEnabled === 'function') {
				return control.feedbacks.feedbackEnabled(id, enabled)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:remove', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackRemove === 'function') {
				return control.feedbacks.feedbackRemove(id)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:duplicate', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackDuplicate === 'function') {
				return control.feedbacks.feedbackDuplicate(id)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:set-option', (controlId, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackSetOptions === 'function') {
				return control.feedbacks.feedbackSetOptions(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:set-inverted', (controlId, id, isInverted) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackSetInverted === 'function') {
				return control.feedbacks.feedbackSetInverted(id, isInverted)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:reorder', (controlId, oldIndex, newIndex) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackReorder === 'function') {
				return control.feedbacks.feedbackReorder(oldIndex, newIndex)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})
		client.onPromise('controls:feedback:set-style-selection', (controlId, id, selected) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackSetStyleSelection === 'function') {
				return control.feedbacks.feedbackSetStyleSelection(id, selected)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})
		client.onPromise('controls:feedback:set-style-value', (controlId, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (control.feedbacks && typeof control.feedbacks.feedbackSetStyleValue === 'function') {
				return control.feedbacks.feedbackSetStyleValue(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:hot-press', (location, direction, deviceId) => {
			this.logger.silly(`being told from gui to hot press ${formatLocation(location)} ${direction} ${deviceId}`)
			if (!deviceId) throw new Error('Missing deviceId')

			const controlId = this.page.getControlIdAt(location)

			this.pressControl(controlId, direction, `hot:${deviceId}`)
		})

		client.onPromise('controls:hot-rotate', (location, direction, deviceId) => {
			this.logger.silly(`being told from gui to hot rotate ${formatLocation(location)} ${direction} ${deviceId}`)

			const controlId = this.page.getControlIdAt(location)

			this.rotateControl(controlId, direction, deviceId ? `hot:${deviceId}` : undefined)
		})

		client.onPromise('controls:action:add', (controlId, stepId, setId, instanceId, actionId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionAdd === 'function') {
				const actionItem = this.instance.definitions.createActionItem(instanceId, actionId)
				if (actionItem) {
					return control.actionAdd(stepId, setId, actionItem)
				} else {
					return false
				}
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:learn', (controlId, stepId, setId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionLearn === 'function') {
				return control.actionLearn(stepId, setId, id)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:enabled', (controlId, stepId, setId, id, enabled) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionEnabled === 'function') {
				return control.actionEnabled(stepId, setId, id, enabled)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:remove', (controlId, stepId, setId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionRemove === 'function') {
				return control.actionRemove(stepId, setId, id)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:duplicate', (controlId, stepId, setId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionDuplicate === 'function') {
				return control.actionDuplicate(stepId, setId, id)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:set-delay', (controlId, stepId, setId, id, delay) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetDelay === 'function') {
				return control.actionSetDelay(stepId, setId, id, delay)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:set-option', (controlId, stepId, setId, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetOption === 'function') {
				return control.actionSetOption(stepId, setId, id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})
		client.onPromise(
			'controls:action:reorder',
			(controlId, dragStepId, dragSetId, dragIndex, dropStepId, dropSetId, dropIndex) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (typeof control.actionReorder === 'function') {
					return control.actionReorder(dragStepId, dragSetId, dragIndex, dropStepId, dropSetId, dropIndex)
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)
		client.onPromise('controls:action-set:add', (controlId, stepId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetAdd === 'function') {
				return control.actionSetAdd(stepId)
			} else {
				throw new Error(`Control "${controlId}" does not support this operation`)
			}
		})
		client.onPromise('controls:action-set:remove', (controlId, stepId, setId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetRemove === 'function') {
				return control.actionSetRemove(stepId, setId)
			} else {
				throw new Error(`Control "${controlId}" does not support this operation`)
			}
		})

		client.onPromise('controls:action-set:rename', (controlId, stepId, oldSetId, newSetId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetRename === 'function') {
				return control.actionSetRename(stepId, oldSetId, newSetId)
			} else {
				throw new Error(`Control "${controlId}" does not support this operation`)
			}
		})

		client.onPromise('controls:action-set:set-run-while-held', (controlId, stepId, setId, runWhileHeld) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetRunWhileHeld === 'function') {
				return control.actionSetRunWhileHeld(stepId, setId, runWhileHeld)
			} else {
				throw new Error(`Control "${controlId}" does not support this operation`)
			}
		})

		client.onPromise('controls:step:add', (controlId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.stepAdd === 'function') {
				return control.stepAdd()
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})
		client.onPromise('controls:step:remove', (controlId, stepId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.stepRemove === 'function') {
				return control.stepRemove(stepId)
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})

		client.onPromise('controls:step:swap', (controlId, stepId1, stepId2) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.stepSwap === 'function') {
				return control.stepSwap(stepId1, stepId2)
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})

		client.onPromise('controls:step:set-current', (controlId, stepId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.stepSelectCurrent === 'function') {
				return control.stepSelectCurrent(stepId)
			} else {
				throw new Error(`Control "${controlId}" does not support steps`)
			}
		})

		client.onPromise('triggers:subscribe', () => {
			client.join(TriggersListRoom)

			const triggers = {}

			for (const [controlId, control] of this.#controls.entries()) {
				if (typeof control.toTriggerJSON === 'function') {
					triggers[controlId] = control.toTriggerJSON(false)
				}
			}

			return triggers
		})
		client.onPromise('triggers:unsubscribe', () => {
			client.leave(TriggersListRoom)
		})
		client.onPromise('triggers:create', () => {
			const controlId = CreateTriggerControlId(nanoid())

			const newControl = new ControlTrigger(this.registry, this.triggers, controlId, null, false)
			this.#controls.set(controlId, newControl)

			// Add trigger to the end of the list
			const allTriggers = Array.from(this.#controls.values()).filter((control) => control.type === 'trigger')
			const maxRank = Math.max(0, ...allTriggers.map((control) => control.options.sortOrder))
			newControl.optionsSetField('sortOrder', maxRank, true)

			// Ensure it is stored to the db
			newControl.commitChange()

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

				this.db.setKey(['controls', controlId], undefined)

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

				const newControl = this.#createClassForControl(newControlId, 'trigger', controlJson.type, controlJson, true)
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
			if (control) {
				control.executeActions(Date.now(), true)
			}

			return false
		})
		client.onPromise('triggers:set-order', (triggerIds) => {
			if (!Array.isArray(triggerIds)) throw new Error('Expected array of ids')

			triggerIds = triggerIds.filter((id) => this.#validateTriggerControlId(id))

			// This is a bit naive, but should be sufficient if the client behaves

			// Update the order based on the ids provided
			triggerIds.forEach((id, index) => {
				const control = this.getControl(id)
				if (control && typeof control.optionsSetField === 'function') control.optionsSetField('sortOrder', index, true)
			})

			// Fill in for any which weren't specified
			const updatedTriggerIds = new Set(triggerIds)
			const triggerControls = Array.from(this.#controls.values()).filter((c) => c.type === 'trigger')
			triggerControls.sort((a, b) => a.options.sortOrder - b.options.sortOrder)

			let nextIndex = triggerIds.length
			for (const control of triggerControls) {
				if (!updatedTriggerIds.has(control.controlId) && typeof control.optionsSetField === 'function') {
					control.optionsSetField('sortOrder', nextIndex++, true)
				}
			}

			return true
		})

		client.onPromise('controls:event:add', (controlId, eventType) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.eventAdd === 'function') {
				const feedbackItem = this.instance.definitions.createEventItem(eventType)
				if (feedbackItem) {
					return control.eventAdd(feedbackItem)
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

			if (typeof control.eventEnabled === 'function') {
				return control.eventEnabled(id, enabled)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:remove', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.eventRemove === 'function') {
				return control.eventRemove(id)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:duplicate', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.eventDuplicate === 'function') {
				return control.eventDuplicate(id)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:set-option', (controlId, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.eventSetOptions === 'function') {
				return control.eventSetOptions(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})

		client.onPromise('controls:event:reorder', (controlId, oldIndex, newIndex) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.eventReorder === 'function') {
				return control.eventReorder(oldIndex, newIndex)
			} else {
				throw new Error(`Control "${controlId}" does not support events`)
			}
		})
	}

	/**
	 * Create a new control class instance
	 * @param {string} controlId Id of the control
	 * @param {string} category 'bank' | 'trigger' | 'all'
	 * @param {string} controlType The type of the control
	 * @param {object | null} controlObj The existing configuration of the control, or null if it is a new control. Note: the control must be given a clone of an object
	 * @param {boolean} isImport Whether this is an import, and needs additional processing
	 * @returns
	 * @access private
	 */
	#createClassForControl(controlId, category, controlType, controlObj, isImport) {
		if (category === 'all' || category === 'bank') {
			switch (controlType) {
				case 'button':
					return new ControlButtonNormal(this.registry, controlId, controlObj, isImport)
				case 'pagenum':
					return new ControlButtonPageNumber(this.registry, controlId, controlObj, isImport)
				case 'pageup':
					return new ControlButtonPageUp(this.registry, controlId, controlObj, isImport)
				case 'pagedown':
					return new ControlButtonPageDown(this.registry, controlId, controlObj, isImport)
			}
		}

		if (category === 'all' || category === 'trigger') {
			switch (controlType) {
				case 'trigger':
					return new ControlTrigger(this.registry, this.triggers, controlId, controlObj, isImport)
			}
		}

		// Unknown type
		this.logger.warn(`Cannot create control "${controlId}" of unknown type "${controlType}"`)
		return null
	}

	/**
	 * Update all controls to forget an instance
	 * @param {string} instanceId
	 * @access public
	 */
	forgetInstance(instanceId) {
		for (const control of this.#controls.values()) {
			if (typeof control.forgetInstance === 'function') {
				control.forgetInstance(instanceId)
			}
		}
	}

	/**
	 * Get all of the populated controls
	 * @returns
	 * @access public
	 */
	getAllControls() {
		return this.#controls // TODO - readonly?
	}

	/**
	 * Get a control if it has been populated
	 * @param {string} controlId
	 * @returns
	 * @access public
	 */
	getControl(controlId) {
		if (!controlId) return undefined
		return this.#controls.get(controlId)
	}

	/**
	 * Import a control
	 * @param {string} controlId Id of the control/location
	 * @param {object} definition object to import
	 * @returns
	 * @access public
	 */
	importControl(location, definition, forceControlId) {
		if (forceControlId && !this.#validateBankControlId(forceControlId)) {
			// Control id is not valid!
			return false
		}

		// Delete old control at the coordintae
		const oldControlId = this.page.getControlIdAt(location)
		if (oldControlId) {
			this.deleteControl(oldControlId)
		}

		const newControlId = forceControlId || CreateBankControlId(nanoid())
		const newControl = this.#createClassForControl(newControlId, 'bank', definition.type, definition, true)
		if (newControl) {
			this.#controls.set(newControlId, newControl)

			this.page.setControlIdAt(location, newControlId)

			newControl.triggerRedraw()

			// Ensure it is stored to the db
			newControl.commitChange()

			return true
		}

		return false
	}

	/**
	 * Import a trigger
	 * @param {string} controlId Id for the trigger
	 * @param {object} definition object to import
	 * @returns
	 * @access public
	 */
	importTrigger(controlId, definition) {
		if (!this.#validateTriggerControlId(controlId)) {
			// Control id is not valid!
			return false
		}

		if (this.#controls.has(controlId)) throw new Error(`Trigger ${controlId} already exists`)

		const newControl = this.#createClassForControl(controlId, 'trigger', definition.type, definition, true)
		if (newControl) {
			this.#controls.set(controlId, newControl)

			// Ensure it is stored to the db
			newControl.commitChange()

			return true
		}

		return false
	}

	/**
	 * Propagate variable changes to the banks
	 * @param {Set<string>} all_changed_variables_set
	 * @access public
	 */
	onVariablesChanged(all_changed_variables_set) {
		// Inform triggers of the change
		this.triggers.emit('variables_changed', all_changed_variables_set)

		if (all_changed_variables_set.size > 0) {
			for (const control of this.#controls.values()) {
				if (typeof control.onVariablesChanged === 'function') {
					control.onVariablesChanged(all_changed_variables_set)
				}
			}
		}
	}

	/**
	 * Execute a press of a control
	 * @param {string} controlId Id of the control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} deviceId The surface that intiated this press
	 * @param {boolean} force Trigger actions even if already in the state
	 * @returns {boolean} success
	 * @access public
	 */
	pressControl(controlId, pressed, deviceId, force) {
		const control = this.getControl(controlId)
		if (control && typeof control.pressControl === 'function') {
			this.triggers.emit('control_press', controlId, pressed, deviceId)

			control.pressControl(pressed, deviceId, force)

			return true
		}

		return false
	}

	/**
	 * Execute rotation of a control
	 * @param {string} controlId Id of the control
	 * @param {boolean} direction Whether the control is rotated to the right
	 * @param {string | undefined} deviceId The surface that intiated this rotate
	 * @returns {boolean} success
	 * @access public
	 */
	rotateControl(controlId, direction, deviceId) {
		const control = this.getControl(controlId)
		if (control && typeof control.rotateControl === 'function') {
			control.rotateControl(direction, deviceId)
			return true
		}

		return false
	}

	/**
	 * Rename an instance for variables used in the controls
	 * @param {string} fromlabel - the old instance short name
	 * @param {string} tolabel - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom, labelTo) {
		for (const control of this.#controls.values()) {
			if (typeof control.renameVariables === 'function') {
				control.renameVariables(labelFrom, labelTo)
			}
		}
	}

	deleteControl(controlId) {
		const control = this.getControl(controlId)
		if (control) {
			control.destroy()
			this.#controls.delete(controlId)

			this.db.setKey(['controls', controlId], undefined)
		}

		const location = this.page.getLocationOfControlId(controlId)
		if (location) {
			this.page.setControlIdAt(location, null)

			// Notify interested parties
			this.services.emberplus.updateBankState(location, false)

			// Force a redraw
			this.graphics.invalidateButton(location)
		}
	}

	/**
	 * Create a control
	 * @param {string} newType The type of the new control to create (if any)
	 * @access public
	 */
	createBankControl(location, newType) {
		if (!this.page.isPageValid(location.pageNumber)) return null

		const controlId = CreateBankControlId(nanoid())
		const newControl = this.#createClassForControl(controlId, 'bank', newType, null, false)
		if (!newControl) return null

		this.#controls.set(controlId, newControl)
		this.page.setControlIdAt(location, controlId)

		// Notify interested parties
		this.services.emberplus.updateBankState(location, false)

		// Force a redraw
		this.graphics.invalidateButton(location)
	}

	/**
	 * Update values for some feedbacks
	 * @param {string} instanceId
	 * @param {Array} result - object containing new values for the feedbacks that have changed
	 * @access public
	 */
	updateFeedbackValues(instanceId, result) {
		if (result.length === 0) return

		const values = {}

		for (const item of result) {
			if (!values[item.controlId]) values[item.controlId] = {}

			values[item.controlId][item.id] = item.value
		}

		// Pass values to controls
		for (const [controlId, newValues] of Object.entries(values)) {
			const control = this.getControl(controlId)
			if (control && control.feedbacks && typeof control.feedbacks.updateFeedbackValues === 'function') {
				control.feedbacks.updateFeedbackValues(instanceId, newValues)
			}
		}
	}

	/**
	 * Verify a controlId is valid for the current id scheme and grid size
	 * @param {string} controlId
	 * @returns {boolean} control is valid
	 * @access private
	 */
	#validateBankControlId(controlId) {
		const parsed = ParseControlId(controlId)
		if (parsed?.type !== 'bank') return false

		return true
	}

	/**
	 * Verify a controlId is valid for the current id scheme and grid size
	 * @param {string} controlId
	 * @returns {boolean} control is valid
	 * @access private
	 */
	#validateTriggerControlId(controlId) {
		const parsed = ParseControlId(controlId)
		if (parsed?.type !== 'trigger') return false

		return true
	}

	/**
	 * Prune any items on controls which belong to an unknown instanceId
	 * @access public
	 */
	verifyInstanceIds() {
		const knownInstanceIds = new Set(this.instance.getAllInstanceIds())
		knownInstanceIds.add('internal')

		for (const control of this.#controls.values()) {
			if (typeof control.verifyInstanceIds === 'function') {
				control.verifyInstanceIds(knownInstanceIds)
			}
		}
	}
}

export default ControlsController
