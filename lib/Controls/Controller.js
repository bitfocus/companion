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
	controls = {}

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'controls', 'Controls/Controller')

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

			const control = this.getControl(controlId)
			return control?.toJSON(false)
		})

		client.onPromise('controls:unsubscribe', (page, bank) => {
			const controlId = CreateBankControlId(page, bank)
			client.leave(ControlConfigRoom(controlId))
		})

		client.onPromise('controls:reset', (page, bank, type) => {
			const controlId = CreateBankControlId(page, bank)

			this.resetControl(controlId)
		})

		client.onPromise('controls:setConfigFields', (page, bank, diff) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control || typeof control.setConfigFields !== 'function') {
				// TODO - log?
				return
			}

			return control.setConfigFields(diff)
		})

		client.onPromise('controls:feedback:add', (page, bank, instanceId, feedbackId) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.addFeedback === 'function') {
				const feedbackItem = this.instance.definitions.createFeedbackItem(instanceId, feedbackId)
				if (feedbackItem) {
					return control.addFeedback(feedbackItem)
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

			if (typeof control.removeFeedback === 'function') {
				return control.removeFeedback(id)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:set-option', (page, bank, id, key, value) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.setFeedbackOptions === 'function') {
				return control.setFeedbackOptions(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:reorder', (page, bank, oldIndex, newIndex) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.reorderFeedback === 'function') {
				return control.reorderFeedback(oldIndex, newIndex)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})
		client.onPromise('controls:feedback:set-style-selection', (page, bank, id, selected) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.setFeedbackStyleSelection === 'function') {
				return control.setFeedbackStyleSelection(id, selected)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})
		client.onPromise('controls:feedback:set-style-value', (page, bank, id, key, value) => {
			const controlId = CreateBankControlId(page, bank)

			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.setFeedbackStyleValue === 'function') {
				return control.setFeedbackStyleValue(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		//
	}

	resetControl(controlId, newType) {
		const control = this.getControl(controlId)
		if (control) {
			control.destroy()
			delete this.controls[controlId]
		}

		if (newType) {
			// Initialise to new type
			this.controls[controlId] = this.#createClassForControl(controlId, newType, null)
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

		for (const control of Object.values(this.controls)) {
			if (typeof control.verifyInstanceIds === 'function') {
				control.verifyInstanceIds(knownInstanceIds)
			}
		}
	}

	forgetInstance(instanceId) {
		// TODO
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
		// TODO
	}

	renameVariables(labelFrom, labelTo) {
		// TODO
	}

	onVariablesChanged(changed_variables, removed_variables) {
		// TODO
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
}

export default ControlsController
