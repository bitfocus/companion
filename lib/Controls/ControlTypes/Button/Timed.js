import ButtonControlBase from './Base.js'
import Registry from '../../../Registry.js'
import { cloneDeep } from 'lodash-es'

/**
 * Class for the timed button control.
 *
 * @extends ButtonControlBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
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
export default class ControlButtonTimed extends ButtonControlBase {
	/**
	 * Last down press from a deviceId
	 * @access private
	 */
	#lastDownForDevices = {}

	/**
	 * @param {Registry} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {object} storage - persisted storage object
	 * @param {boolean} isImport - if this is importing a button, not creating at startup
	 */
	constructor(registry, controlId, storage, isImport) {
		super(registry, controlId, 'timed-button', 'Controls/Button/Timed')

		this.type = 'timed'

		this.style = cloneDeep(ButtonControlBase.DefaultStyle)
		this.options = cloneDeep(ButtonControlBase.DefaultOptions)

		this.feedbacks.feedbacks = []
		this.actions.action_sets = {
			down: [],
			0: [],
		}

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
			this.sendRuntimePropsChange()
		} else {
			if (storage.type !== 'timed') throw new Error(`Invalid type given to ControlButtonTimed: "${storage.type}"`)

			this.style = storage.style || this.style
			this.options = storage.options || this.options
			this.feedbacks.feedbacks = storage.feedbacks || this.feedbacks.feedbacks
			this.actions.action_sets = storage.action_sets || this.actions.action_sets

			if (isImport) this.postProcessImport()
		}
	}

	/**
	 * Add an action set to this control
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetAdd() {
		let redraw = false

		const existingKeys = Object.keys(this.actions.action_sets)
			.filter((k) => !isNaN(k))
			.map((k) => Number(k))
		if (existingKeys.length === 0) {
			// add the default '0' set
			this.actions.action_sets['0'] = []
			redraw = true
		} else {
			// add one after the last
			const max = Math.max(...existingKeys)
			const newIndex = Math.floor(max / 1000) * 1000 + 1000
			this.actions.action_sets[newIndex] = []
		}

		this.commitChange(redraw)

		return true
	}

	/**
	 * Remove an action-set from this control
	 * @param {string} setId the id of the action-set
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetRemove(setId) {
		// Ensure valid
		if (isNaN(setId) || Number(setId) === 0) return false

		const oldKeys = Object.keys(this.actions.action_sets)

		if (oldKeys.length > 1) {
			let redraw = false

			if (this.actions.action_sets[setId]) {
				// Inform modules of the change
				for (const action of this.actions.action_sets[setId]) {
					this.actions.cleanupAction(action)
				}

				// Assume it exists
				delete this.actions.action_sets[setId]

				// Check if the status has changed
				if (this.checkButtonStatus()) redraw = true

				// Save the change, and perform a draw
				this.commitChange(redraw)

				return true
			}
		}

		return false
	}

	/**
	 * Rename an action-sets
	 * @param {string} oldSetId The old id of the set
	 * @param {string} newSetId The new id for the set
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetRename(oldSetId, newSetId) {
		// Only valid when both are numbers
		if (isNaN(newSetId) || isNaN(oldSetId)) return false
		// Can't rename the 'short' set
		if (Number(oldSetId) === 0) return false

		// Ensure old set exists
		if (!this.actions.action_sets[oldSetId]) return false

		// Ensure new set doesnt already exist
		if (this.actions.action_sets[newSetId]) return false

		this.actions.action_sets[newSetId] = this.actions.action_sets[oldSetId]
		delete this.actions.action_sets[oldSetId]

		this.commitChange(false)

		return true
	}

	/**
	 * Update an option field of this control
	 * @access public
	 */
	optionsSetField(key, value) {
		// Check if rotary_actions should be added/remove
		if (key === 'rotaryActions') {
			if (value) {
				// ensure they exist
				this.actions.action_sets.rotate_left = this.actions.action_sets.rotate_left || []
				this.actions.action_sets.rotate_right = this.actions.action_sets.rotate_right || []
			} else {
				// remove the sets
				this.actions.actionClearSet('rotate_left', true)
				this.actions.actionClearSet('rotate_right', true)
				delete this.actions.action_sets.rotate_left
				delete this.actions.action_sets.rotate_right
			}
		}

		return super.optionsSetField(key, value)
	}

	/**
	 * Execute a press of this control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} deviceId The surface that intiated this press
	 * @access public
	 */
	pressControl(pressed, deviceId) {
		let pressedDuration = 0
		if (deviceId) {
			// Calculate the press duration, or track when the press started
			if (pressed) {
				this.#lastDownForDevices[deviceId] = Date.now()
			} else {
				const lastDown = this.#lastDownForDevices[deviceId]
				delete this.#lastDownForDevices[deviceId]
				if (lastDown) {
					pressedDuration = Date.now() - lastDown
				}
			}
		}

		const changed = this.setPushed(pressed, deviceId)

		// if the state has changed, the choose the set to execute
		if (changed) {
			let action_set_id = pressed ? 'down' : 0

			if (!pressed && pressedDuration) {
				// find the correct set to execute on up

				const setIds = Object.keys(this.actions.action_sets)
					.map((id) => Number(id))
					.filter((id) => !isNaN(id) && id < pressedDuration)
				if (setIds.length) {
					action_set_id = Math.max(...setIds)
				}
			}

			const actions = this.actions.action_sets[action_set_id]
			if (actions) {
				this.logger.silly('found actions')

				this.controls.actions.runMultipleActions(actions, this.controlId, this.options.relativeDelay, {
					deviceid: deviceId,
				})
			}
		}
	}

	/**
	 * Execute a rotate of this control
	 * @param {boolean} direction Whether the control was rotated to the right
	 * @param {string | undefined} deviceId The surface that intiated this rotate
	 * @access public
	 * @abstract
	 */
	rotateControl(direction, deviceId) {
		const action_set_id = direction ? 'rotate_right' : 'rotate_left'

		const actions = this.actions.action_sets[action_set_id]
		if (actions) {
			this.logger.silly('found actions')

			const enabledActions = actions.filter((act) => !act.disabled)

			this.controls.actions.runMultipleActions(enabledActions, this.controlId, this.options.relativeDelay, {
				deviceid: deviceId,
			})
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param {boolean} clone - Whether to return a cloned object
	 * @access public
	 */
	toJSON(clone = true) {
		const obj = {
			type: this.type,
			style: this.style,
			options: this.options,
			feedbacks: this.feedbacks.feedbacks,
			action_sets: this.actions.action_sets,
		}
		return clone ? cloneDeep(obj) : obj
	}
}
