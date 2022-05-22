import fs from 'fs-extra'
import path from 'path'
import { cloneDeep } from 'lodash-es'
import Registry from '../Registry.js'
import CoreBase from '../Core/Base.js'

import PressButtonControl from './PressButton.js'
import SteppedButtonControl from './SteppedButton.js'
import PageDownButtonControl from './PageDownButton.js'
import PageNumberButtonControl from './PageNumberButton.js'
import PageUpButtonControl from './PageUpButton.js'
import { CreateBankControlId, ParseControlId } from '../Resources/Util.js'
import { ControlConfigRoom } from './ControlBase.js'
import ActionRunner from './ActionRunner.js'

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
	actions

	controls = {}

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'controls', 'Controls/Controller')

		this.actions = new ActionRunner(registry)

		// Init all the control classes
		const config = this.db.getKey('controls', {})
		for (const [controlId, controlObj] of Object.entries(config)) {
			if (controlObj && controlObj.type) {
				const inst = this.#createClassForControl(controlId, controlObj.type, controlObj)
				if (inst) this.controls[controlId] = inst
			}
		}
	}

	#createClassForControl(controlId, controlType, controlObj) {
		switch (controlType) {
			case 'press':
				return new PressButtonControl(this.registry, controlId, controlObj)
			case 'step':
				return new SteppedButtonControl(this.registry, controlId, controlObj)
			case 'pagenum':
				return new PageNumberButtonControl(this.registry, controlId, controlObj)
			case 'pageup':
				return new PageUpButtonControl(this.registry, controlId, controlObj)
			case 'pagedown':
				return new PageDownButtonControl(this.registry, controlId, controlObj)
			default:
				// Unknown type
				this.logger.warn(`Cannot create control "${controlId}" of unknown type "${controlType}"`)
				return null
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('controls:subscribe', (page, bank) => {
			const controlId = CreateBankControlId(page, bank)
			client.join(ControlConfigRoom(controlId))

			setImmediate(() => {
				// Send the preview image shortly after
				const img = this.graphics.getBank(page, bank)
				client.emit(`controls:preview-${controlId}`, img?.buffer)
			})

			const control = this.getControl(controlId)
			return {
				config: control?.toJSON(false),
				runtime: control?.toRuntimeJSON(),
			}
		})

		client.onPromise('controls:unsubscribe', (page, bank) => {
			const controlId = CreateBankControlId(page, bank)
			client.leave(ControlConfigRoom(controlId))
		})

		client.onPromise('controls:reset', (page, bank, type) => {
			const controlId = CreateBankControlId(page, bank)

			return this.resetControl(controlId, type)
		})

		client.onPromise('controls:set-config-fields', (page, bank, diff) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.configSetFields === 'function') {
				return control.configSetFields(diff)
			} else {
				throw new Error(`Control "${controlId}" does not support config`)
			}
		})

		client.onPromise('controls:feedback:add', (page, bank, instanceId, feedbackId) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackAdd === 'function') {
				const feedbackItem = this.instance.definitions.createFeedbackItem(instanceId, feedbackId)
				if (feedbackItem) {
					return control.feedbackAdd(feedbackItem)
				} else {
					return false
				}
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:remove', (page, bank, id) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackRemove === 'function') {
				return control.feedbackRemove(id)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:set-option', (page, bank, id, key, value) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackSetOptions === 'function') {
				return control.feedbackSetOptions(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:reorder', (page, bank, oldIndex, newIndex) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackReorder === 'function') {
				return control.feedbackReorder(oldIndex, newIndex)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})
		client.onPromise('controls:feedback:set-style-selection', (page, bank, id, selected) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackSetStyleSelection === 'function') {
				return control.feedbackSetStyleSelection(id, selected)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})
		client.onPromise('controls:feedback:set-style-value', (page, bank, id, key, value) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackSetStyleValue === 'function') {
				return control.feedbackSetStyleValue(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:hot-press', (page, bank, direction) => {
			this.logger.silly(`being told from gui to hot press ${page}-${bank} ${direction}`)

			this.pressControl(page, bank, direction)
		})

		client.on('hot_press', (page, button, direction) => {
			// Legacy handler for tablets
			this.logger.silly(`being told from gui to hot press ${page}-${button} ${direction}`)

			this.pressControl(page, button, direction)
		})

		client.onPromise('controls:action:add', (page, bank, setId, instanceId, actionId) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionAdd === 'function') {
				const actionItem = this.instance.definitions.createActionItem(instanceId, actionId)
				if (actionItem) {
					return control.actionAdd(setId, actionItem)
				} else {
					return false
				}
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:remove', (page, bank, setId, id) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionRemove === 'function') {
				return control.actionRemove(setId, id)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:set-delay', (page, bank, setId, id, delay) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetDelay === 'function') {
				return control.actionSetDelay(setId, id, delay)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:set-option', (page, bank, setId, id, key, value) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetOption === 'function') {
				return control.actionSetOption(setId, id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})
		client.onPromise('controls:action:reorder', (page, bank, setId, oldIndex, newIndex) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionReorder === 'function') {
				return control.actionReorder(setId, oldIndex, newIndex)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})
		client.onPromise('controls:action-set:add', (page, bank) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetAdd === 'function') {
				return control.actionSetAdd()
			} else {
				throw new Error(`Control "${controlId}" does not support action-sets`)
			}
		})
		client.onPromise('controls:action-set:remove', (page, bank, setId) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetRemove === 'function') {
				return control.actionSetRemove(setId)
			} else {
				throw new Error(`Control "${controlId}" does not support action-sets`)
			}
		})

		client.onPromise('controls:action-set:swap', (page, bank, setId1, setId2) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetSwap === 'function') {
				return control.actionSetSwap(setId1, setId2)
			} else {
				throw new Error(`Control "${controlId}" does not support action-sets`)
			}
		})

		client.onPromise('controls:action-set:set-next', (page, bank, setId) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetSelectNext === 'function') {
				return control.actionSetSelectNext(setId)
			} else {
				throw new Error(`Control "${controlId}" does not support action-sets`)
			}
		})

		//
	}

	pressControl(page, bank, direction, deviceId) {
		const controlId = CreateBankControlId(page, bank)

		const control = this.getControl(controlId)
		if (!control) return false

		this.triggers.onBankPress(page, bank, direction, deviceId)

		control.pressBank(direction, deviceId)
		return true
	}

	resetControl(controlId, newType) {
		const control = this.getControl(controlId)
		if (control) {
			control.destroy()
			delete this.controls[controlId]
		}

		// Notify interested parties
		const parsedId = ParseControlId(controlId)
		if (parsedId?.type === 'bank') {
			this.services.emberplus.updateBankState(parsedId.page, parsedId.bank, false)
		}

		if (newType) {
			// Initialise to new type
			this.controls[controlId] = this.#createClassForControl(controlId, newType, null)
		} else {
			// Force a redraw
			this.graphics.invalidateControl(controlId)
		}
	}

	getControl(controlId) {
		return this.controls[controlId]
	}

	getAllControls() {
		return {
			// Shallow clone
			...this.controls,
		}
	}

	verifyInstanceIds() {
		const knownInstanceIds = new Set(this.instance.getAllInstanceIds())
		knownInstanceIds.add('internal')

		for (const control of Object.values(this.controls)) {
			if (typeof control.verifyInstanceIds === 'function') {
				control.verifyInstanceIds(knownInstanceIds)
			}
		}
	}

	forgetInstance(instanceId) {
		for (const control of Object.values(this.controls)) {
			if (typeof control.forgetInstance === 'function') {
				control.forgetInstance(instanceId)
			}
		}
	}

	importControl(controlId, definition) {
		// TODO
	}

	checkAllStatus() {
		for (const control of Object.values(this.controls)) {
			if (typeof control.checkBankStatus === 'function') {
				control.checkBankStatus()
			}
		}
	}

	/**
	 * Rename an instance for variables used in the controls
	 * @param {string} fromlabel - the old instance short name
	 * @param {string} tolabel - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom, labelTo) {
		for (const control of Object.values(this.controls)) {
			if (typeof control.renameVariables === 'function') {
				control.renameVariables(labelFrom, labelTo)
			}
		}
	}

	/**
	 * Propogate variable changes to the banks
	 * @param {Object} changedVariables - variables with text changes
	 * @param {Object} removedVariables - variables that have been removed
	 * @access public
	 */
	onVariablesChanged(changedVariables, removedVariables) {
		const allChangedVariables = [...removedVariables, ...Object.keys(changedVariables)]

		if (allChangedVariables.length > 0) {
			for (const control of Object.values(this.controls)) {
				if (typeof control.onVariablesChanged === 'function') {
					control.onVariablesChanged(allChangedVariables)
				}
			}
		}
	}

	/**
	 * Update values for some feedbacks
	 * @param {string} instanceId
	 * @param {object} result - object containing new values for the feedbacks that have changed
	 * @access public
	 */
	updateFeedbackValues(instanceId, result) {
		const valuesForTriggers = {}
		const valuesForControls = {}

		for (const item of result) {
			const parsedControl = ParseControlId(item.controlId)
			if (parsedControl?.type === 'bank') {
				if (!valuesForControls[item.controlId]) valuesForControls[item.controlId] = {}

				valuesForControls[item.controlId][item.id] = item.value
			} else if (parsedControl?.type === 'trigger') {
				valuesForTriggers[item.id] = item
			} else {
				// Ignore for now
			}
		}

		// Pass values to controls
		for (const [controlId, newValues] of Object.entries(valuesForControls)) {
			const control = this.getControl(controlId)
			if (control && typeof control.updateFeedbackValues === 'function') {
				control.updateFeedbackValues(instanceId, newValues)
			}
		}

		this.triggers.updateFeedbackValues(valuesForTriggers, instanceId)
	}

	/**
	 * Get the export for all the controls
	 * @returns
	 */
	exportAll() {
		const result = {}

		for (const [controlId, control] of Object.entries(this.controls)) {
			result[controlId] = control.toJSON(false)
		}

		return result
	}
}

export default ControlsController
