import ButtonControlBase from './Base.js'
import Registry from '../../Registry.js'
import { cloneDeep } from 'lodash-es'
import { ParseControlId } from '../../Resources/Util.js'

/**
 * Class for the press button control.
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
export default class ControlButtonPress extends ButtonControlBase {
	type = 'press'

	/**
	 * @param {Registry} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {object} storage - persisted storage object
	 * @param {boolean} isImport - if this is importing a button, not creating at startup
	 */
	constructor(registry, controlId, storage, isImport) {
		super(registry, controlId, 'press-button', 'Controls/Button/Press')

		this.style = cloneDeep(ButtonControlBase.DefaultStyle)
		this.options = cloneDeep(ButtonControlBase.DefaultOptions)
		this.feedbacks = []
		this.action_sets = {
			down: [],
			up: [],
		}

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
			this.sendRuntimePropsChange()
		} else {
			if (storage.type !== 'press') throw new Error(`Invalid type given to ControlButtonPress: "${storage.type}"`)

			this.style = storage.style || this.style
			this.options = storage.options || this.options
			this.feedbacks = storage.feedbacks || this.feedbacks
			this.action_sets = storage.action_sets || this.action_sets

			if (isImport) this.postProcessImport()
		}
	}

	/**
	 * Execute a press of this control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} deviceId The surface that intiated this press
	 * @access public
	 */
	pressControl(pressed, deviceId) {
		const changed = this.setPushed(pressed, deviceId)

		// if the state has changed, the choose the set to execute
		// if (changed) { // TODO - this would be good but 'breaks' old behaviour
		const action_set_id = pressed ? 'down' : 'up'

		const actions = this.action_sets[action_set_id]
		if (actions) {
			this.logger.silly('found actions')

			this.controls.actions.runMultipleActions(actions, this.controlId, this.options.relativeDelay, {
				deviceid: deviceId,
			})
		}
		// }
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
			feedbacks: this.feedbacks,
			action_sets: this.action_sets,
		}
		return clone ? cloneDeep(obj) : obj
	}
}
