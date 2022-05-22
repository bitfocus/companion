import fs from 'fs-extra'
import path, { parse } from 'path'
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
				const inst = this.#createClassForControl(controlId, controlObj.type, controlObj, false)
				if (inst) this.controls[controlId] = inst
			}
		}
	}

	/**
	 * Create a new control class isntance
	 * @param {string} controlId Id of the control
	 * @param {string} controlType The type of the control
	 * @param {object | null} controlObj The existing configuration of the control, or null if it is a new control. Note: the control must be given a clone of an object
	 * @param {boolean} isImport Whether this is an import, and needs additional processing
	 * @returns
	 */
	#createClassForControl(controlId, controlType, controlObj, isImport) {
		switch (controlType) {
			case 'press':
				return new PressButtonControl(this.registry, controlId, controlObj, isImport)
			case 'step':
				return new SteppedButtonControl(this.registry, controlId, controlObj, isImport)
			case 'pagenum':
				return new PageNumberButtonControl(this.registry, controlId, controlObj, isImport)
			case 'pageup':
				return new PageUpButtonControl(this.registry, controlId, controlObj, isImport)
			case 'pagedown':
				return new PageDownButtonControl(this.registry, controlId, controlObj, isImport)
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
		client.onPromise('controls:subscribe', (controlId) => {
			client.join(ControlConfigRoom(controlId))

			setImmediate(() => {
				// Send the preview image shortly after
				const parsedId = ParseControlId(controlId)
				if (parsedId?.type === 'bank') {
					const img = this.graphics.getBank(parsedId.page, parsedId.bank)
					client.emit(`controls:preview-${controlId}`, img?.buffer)
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

		client.onPromise('controls:reset', (controlId, type) => {
			return this.resetControl(controlId, type)
		})
		client.onPromise('controls:copy', (fromControlId, toControlId) => {
			if (!this.#validateBankControlId(toControlId)) {
				// Control id is not valid!
				return false
			}

			const fromControl = this.getControl(fromControlId)
			if (fromControl && fromControlId !== toControlId) {
				const controlJson = fromControl.toJSON(true)

				const newControl = this.#createClassForControl(toControlId, controlJson.type, controlJson, true)
				if (newControl) {
					this.resetControl(toControlId)

					this.controls[toControlId] = newControl
					return true
				}
			}

			return false
		})
		client.onPromise('controls:move', (fromControlId, toControlId) => {
			if (!this.#validateBankControlId(toControlId)) {
				// Control id is not valid!
				return false
			}

			const fromControl = this.getControl(fromControlId)
			if (fromControl && fromControlId !== toControlId) {
				const controlJson = fromControl.toJSON(true)

				const newControl = this.#createClassForControl(toControlId, controlJson.type, controlJson, true)
				if (newControl) {
					this.resetControl(toControlId)
					this.resetControl(fromControlId)

					this.controls[toControlId] = newControl
					return true
				}
			}

			return false
		})
		client.onPromise('controls:sawp', (controlIdA, controlIdB) => {
			if (!this.#validateBankControlId(controlIdA) || !this.#validateBankControlId(controlIdB)) {
				// Control id is not valid!
				return false
			}

			const controlA = this.getControl(controlIdA)
			const controlB = this.getControl(controlIdB)

			// shortcut
			if (!controlA && !controlB) return true

			const controlAJson = controlA ? controlA.toJSON(true) : undefined
			const controlBJson = controlB ? controlB.toJSON(true) : undefined

			// destroy old ones
			this.resetControl(controlIdA)
			this.resetControl(controlIdB)

			// create new controls
			if (controlAJson) {
				const newControlA = this.#createClassForControl(controlIdB, controlAJson.type, controlAJson, true)
				if (newControlA) this.controls[controlIdB] = newControlA
			}
			if (controlBJson) {
				const newControlB = this.#createClassForControl(controlIdA, controlBJson.type, controlBJson, true)
				if (newControlB) this.controls[controlIdA] = newControlB
			}

			return true
		})

		client.onPromise('controls:set-config-fields', (controlId, diff) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.configSetFields === 'function') {
				return control.configSetFields(diff)
			} else {
				throw new Error(`Control "${controlId}" does not support config`)
			}
		})

		client.onPromise('controls:feedback:add', (controlId, instanceId, feedbackId) => {
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

		client.onPromise('controls:feedback:remove', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackRemove === 'function') {
				return control.feedbackRemove(id)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:set-option', (controlId, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackSetOptions === 'function') {
				return control.feedbackSetOptions(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:reorder', (controlId, oldIndex, newIndex) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackReorder === 'function') {
				return control.feedbackReorder(oldIndex, newIndex)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})
		client.onPromise('controls:feedback:set-style-selection', (controlId, id, selected) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackSetStyleSelection === 'function') {
				return control.feedbackSetStyleSelection(id, selected)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})
		client.onPromise('controls:feedback:set-style-value', (controlId, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackSetStyleValue === 'function') {
				return control.feedbackSetStyleValue(id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:hot-press', (controlId, direction) => {
			this.logger.silly(`being told from gui to hot press ${controlId} ${direction}`)

			this.pressControl(controlId, direction)
		})

		client.on('hot_press', (page, button, direction) => {
			// Legacy handler for tablets
			this.logger.silly(`being told from gui to hot press ${page}-${button} ${direction}`)

			this.pressControl(CreateBankControlId(page, button), direction)
		})

		client.onPromise('controls:action:add', (controlId, setId, instanceId, actionId) => {
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

		client.onPromise('controls:action:remove', (controlId, setId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionRemove === 'function') {
				return control.actionRemove(setId, id)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:set-delay', (controlId, setId, id, delay) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetDelay === 'function') {
				return control.actionSetDelay(setId, id, delay)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:set-option', (controlId, setId, id, key, value) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetOption === 'function') {
				return control.actionSetOption(setId, id, key, value)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})
		client.onPromise('controls:action:reorder', (controlId, setId, oldIndex, newIndex) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionReorder === 'function') {
				return control.actionReorder(setId, oldIndex, newIndex)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})
		client.onPromise('controls:action-set:add', (controlId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetAdd === 'function') {
				return control.actionSetAdd()
			} else {
				throw new Error(`Control "${controlId}" does not support action-sets`)
			}
		})
		client.onPromise('controls:action-set:remove', (controlId, setId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetRemove === 'function') {
				return control.actionSetRemove(setId)
			} else {
				throw new Error(`Control "${controlId}" does not support action-sets`)
			}
		})

		client.onPromise('controls:action-set:swap', (controlId, setId1, setId2) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetSwap === 'function') {
				return control.actionSetSwap(setId1, setId2)
			} else {
				throw new Error(`Control "${controlId}" does not support action-sets`)
			}
		})

		client.onPromise('controls:action-set:set-next', (controlId, setId) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionSetSelectNext === 'function') {
				return control.actionSetSelectNext(setId)
			} else {
				throw new Error(`Control "${controlId}" does not support action-sets`)
			}
		})
	}

	pressControl(controlId, direction, deviceId) {
		const control = this.getControl(controlId)
		if (!control) return false

		const parsedId = ParseControlId(controlId)
		if (parsedId?.type === 'bank') {
			this.triggers.onBankPress(parsedId.page, parsedId.bank, direction, deviceId)
		}

		control.pressBank(direction, deviceId)
		return true
	}

	resetControl(controlId, newType) {
		const control = this.getControl(controlId)
		if (control) {
			control.destroy()
			delete this.controls[controlId]
		}

		if (!this.#validateBankControlId(controlId)) {
			// Control id is not valid!
			return false
		}

		// Notify interested parties
		const parsedId = ParseControlId(controlId)
		if (parsedId?.type === 'bank') {
			this.services.emberplus.updateBankState(parsedId.page, parsedId.bank, false)
		}

		if (newType) {
			// Initialise to new type
			this.controls[controlId] = this.#createClassForControl(controlId, newType, null, false)
		} else {
			// Force a redraw
			this.graphics.invalidateControl(controlId)
		}
	}

	#validateBankControlId(controlId) {
		const parsed = ParseControlId(controlId)
		if (parsed?.type !== 'bank') return false
		if (parsed.page < 1 || parsed.page > 99) return false
		if (parsed.bank < 1 || parsed.bank > global.MAX_BUTTONS) return false

		return true
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
