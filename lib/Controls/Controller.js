import { cloneDeep } from 'lodash-es'
import Registry from '../Registry.js'
import CoreBase from '../Core/Base.js'
import ControlButtonPress from './Button/Press.js'
import ControlButtonStep from './Button/Step.js'
import ControlButtonPageDown from './Button/PageDown.js'
import ControlButtonPageNumber from './Button/PageNumber.js'
import ControlButtonPageUp from './Button/PageUp.js'
import { CreateBankControlId, ParseControlId } from '../Resources/Util.js'
import { ControlConfigRoom } from './ControlBase.js'
import ActionRunner from './ActionRunner.js'
import ActionRecorder from './ActionRecorder.js'

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
	#controls = {}

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'controls', 'Controls/Controller')

		this.actions = new ActionRunner(registry)
		this.actionRecorder = new ActionRecorder(registry)

		// Init all the control classes
		const config = this.db.getKey('controls', {})
		for (const [controlId, controlObj] of Object.entries(config)) {
			if (controlObj && controlObj.type) {
				const inst = this.#createClassForControl(controlId, controlObj.type, controlObj, false)
				if (inst) this.#controls[controlId] = inst
			}
		}
	}

	/**
	 * Check the instance-status of every control
	 * @access public
	 */
	checkAllStatus() {
		for (const control of Object.values(this.#controls)) {
			if (typeof control.checkButtonStatus === 'function') {
				control.checkButtonStatus()
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.actionRecorder.clientConnect(client)

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

					this.#controls[toControlId] = newControl
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

					this.#controls[toControlId] = newControl
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
				if (newControlA) this.#controls[controlIdB] = newControlA
			}
			if (controlBJson) {
				const newControlB = this.#createClassForControl(controlIdA, controlBJson.type, controlBJson, true)
				if (newControlB) this.#controls[controlIdA] = newControlB
			}

			return true
		})

		client.onPromise('controls:set-config-fields', (controlId, diff) => {
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

		client.onPromise('controls:feedback:learn', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackLearn === 'function') {
				return control.feedbackLearn(id)
			} else {
				throw new Error(`Control "${controlId}" does not support feedbacks`)
			}
		})

		client.onPromise('controls:feedback:enabled', (controlId, id, enabled) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackEnabled === 'function') {
				return control.feedbackEnabled(id, enabled)
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

		client.onPromise('controls:feedback:duplicate', (controlId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.feedbackDuplicate === 'function') {
				return control.feedbackDuplicate(id)
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

		client.onPromise('controls:action:learn', (controlId, setId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionLearn === 'function') {
				return control.actionLearn(setId, id)
			} else {
				throw new Error(`Control "${controlId}" does not support actions`)
			}
		})

		client.onPromise('controls:action:enabled', (controlId, setId, id, enabled) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionEnabled === 'function') {
				return control.actionEnabled(setId, id, enabled)
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

		client.onPromise('controls:action:duplicate', (controlId, setId, id) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionDuplicate === 'function') {
				return control.actionDuplicate(setId, id)
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
		client.onPromise('controls:action:reorder', (controlId, dragSetId, dragIndex, dropSetId, dropIndex) => {
			const control = this.getControl(controlId)
			if (!control) return false

			if (typeof control.actionReorder === 'function') {
				return control.actionReorder(dragSetId, dragIndex, dropSetId, dropIndex)
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

	/**
	 * Create a new control class isntance
	 * @param {string} controlId Id of the control
	 * @param {string} controlType The type of the control
	 * @param {object | null} controlObj The existing configuration of the control, or null if it is a new control. Note: the control must be given a clone of an object
	 * @param {boolean} isImport Whether this is an import, and needs additional processing
	 * @returns
	 * @access private
	 */
	#createClassForControl(controlId, controlType, controlObj, isImport) {
		switch (controlType) {
			case 'press':
				return new ControlButtonPress(this.registry, controlId, controlObj, isImport)
			case 'step':
				return new ControlButtonStep(this.registry, controlId, controlObj, isImport)
			case 'pagenum':
				return new ControlButtonPageNumber(this.registry, controlId, controlObj, isImport)
			case 'pageup':
				return new ControlButtonPageUp(this.registry, controlId, controlObj, isImport)
			case 'pagedown':
				return new ControlButtonPageDown(this.registry, controlId, controlObj, isImport)
			default:
				// Unknown type
				this.logger.warn(`Cannot create control "${controlId}" of unknown type "${controlType}"`)
				return null
		}
	}

	/**
	 * Get the export for all the controls
	 * @param {boolean} clone
	 * @returns
	 * @access public
	 */
	exportAll(clone = true) {
		const result = {}

		for (const [controlId, control] of Object.entries(this.#controls)) {
			result[controlId] = control.toJSON(false)
		}

		return clone ? cloneDeep(result) : result
	}

	/**
	 * Get the export for all the controls
	 * @param {boolean} clone
	 * @returns
	 * @access public
	 */
	exportPage(page, clone = true) {
		const result = {}

		for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
			const controlId = CreateBankControlId(page, bank)
			const control = this.getControl(controlId)
			if (control) result[controlId] = control.toJSON(clone)
		}

		return result
	}

	/**
	 * Update all controls to forget an instance
	 * @param {string} instanceId
	 * @access public
	 */
	forgetInstance(instanceId) {
		for (const control of Object.values(this.#controls)) {
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
		return {
			// Shallow clone
			...this.#controls,
		}
	}

	/**
	 * Get a control if it has been populated
	 * @param {string} controlId
	 * @returns
	 * @access public
	 */
	getControl(controlId) {
		return this.#controls[controlId]
	}

	/**
	 * Get the 'extended' info about a page for the tablet views (locations of page buttons)
	 * @param {number} page
	 * @returns
	 * @access public
	 */
	getExtendedPageInfo(page) {
		const pageInfo = {
			pagenum: [],
			pageup: [],
			pagedown: [],
		}

		for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
			const controlId = CreateBankControlId(page, bank)
			const control = this.getControl(controlId)
			if (control) {
				if (control instanceof ControlButtonPageUp) {
					pageInfo.pageup.push(bank)
				} else if (control instanceof ControlButtonPageDown) {
					pageInfo.pagedown.push(bank)
				} else if (control instanceof ControlButtonPageNumber) {
					pageInfo.pagenum.push(bank)
				}
			}
		}

		return pageInfo
	}

	/**
	 * Import a control
	 * @param {string} controlId Id of the control/location
	 * @param {object} definition object to import
	 * @returns
	 * @access public
	 */
	importControl(controlId, definition) {
		if (!this.#validateBankControlId(controlId)) {
			// Control id is not valid!
			return false
		}

		const newControl = this.#createClassForControl(controlId, definition.type, definition, true)
		if (newControl) {
			this.resetControl(controlId)
			this.#controls[controlId] = newControl

			// Ensure it is stored to the db
			newControl.commitChange()

			return true
		}

		return false
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
			for (const control of Object.values(this.#controls)) {
				if (typeof control.onVariablesChanged === 'function') {
					control.onVariablesChanged(allChangedVariables)
				}
			}
		}
	}

	/**
	 * Execute a press of a control
	 * @param {string} controlId Id of the control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} deviceId The surface that intiated this press
	 * @returns {boolean} success
	 * @access public
	 */
	pressControl(controlId, pressed, deviceId) {
		const control = this.getControl(controlId)
		if (!control) return false

		const parsedId = ParseControlId(controlId)
		if (parsedId?.type === 'bank') {
			this.triggers.onBankPress(parsedId.page, parsedId.bank, pressed, deviceId)
		}

		control.pressControl(pressed, deviceId)
		return true
	}

	/**
	 * Rename an instance for variables used in the controls
	 * @param {string} fromlabel - the old instance short name
	 * @param {string} tolabel - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom, labelTo) {
		for (const control of Object.values(this.#controls)) {
			if (typeof control.renameVariables === 'function') {
				control.renameVariables(labelFrom, labelTo)
			}
		}
	}

	/**
	 * Reset/reinitialise a control
	 * @param {string} controlId The id of the control to reset
	 * @param {string | undefined} newType The type of the new control to create (if any)
	 * @returns {boolean} success
	 * @access public
	 */
	resetControl(controlId, newType) {
		const control = this.getControl(controlId)
		if (control) {
			control.destroy()
			delete this.#controls[controlId]

			this.db.setKey(['controls', controlId], undefined)
		}

		if (!this.#validateBankControlId(controlId)) {
			// Control id is not valid!
			return false
		}

		// Notify interested parties
		const parsedId = ParseControlId(controlId)
		if (parsedId?.type === 'bank') {
			this.services.emberplus.updateBankState(parsedId.page, parsedId.bank, false)

			this.preview.updateWebButtonsPage(parsedId.page)
		}

		if (newType) {
			// Initialise to new type
			this.#controls[controlId] = this.#createClassForControl(controlId, newType, null, false)
		} else {
			// Force a redraw
			this.graphics.invalidateControl(controlId)
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
	 * Verify a controlId is valid for the current id scheme and grid size
	 * @param {string} controlId
	 * @returns {boolean} control is valid
	 * @access private
	 */
	#validateBankControlId(controlId) {
		const parsed = ParseControlId(controlId)
		if (parsed?.type !== 'bank') return false
		if (parsed.page < 1 || parsed.page > 99) return false
		if (parsed.bank < 1 || parsed.bank > global.MAX_BUTTONS) return false

		return true
	}

	/**
	 * Prune any items on controls which belong to an unknown instanceId
	 * @access public
	 */
	verifyInstanceIds() {
		const knownInstanceIds = new Set(this.instance.getAllInstanceIds())
		knownInstanceIds.add('internal')

		for (const control of Object.values(this.#controls)) {
			if (typeof control.verifyInstanceIds === 'function') {
				control.verifyInstanceIds(knownInstanceIds)
			}
		}
	}
}

export default ControlsController
