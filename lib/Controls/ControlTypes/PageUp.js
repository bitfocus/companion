// @ts-check
import Registry from '../../Registry.js'
import ControlBase from '../ControlBase.js'
import {
	ControlWithoutActionSets,
	ControlWithoutActions,
	ControlWithoutEvents,
	ControlWithoutFeedbacks,
	ControlWithoutSteps,
	ControlWithoutStyle,
} from '../IControlFragments.js'

/**
 * Class for a pageup button control.
 *
 * @extends ControlBase
 * @implements {ControlWithoutActions}
 * @implements {ControlWithoutFeedbacks}
 * @implements {ControlWithoutSteps}
 * @implements {ControlWithoutStyle}
 * @implements {ControlWithoutEvents}
 * @implements {ControlWithoutActionSets}
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
export default class ControlButtonPageUp extends ControlBase {
	type = 'pageup'

	/**
	 * @readonly
	 * @type {false}
	 */
	supportsActions = false
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsSteps = false
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsFeedbacks = false
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsStyle = false
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsEvents = false
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsActionSets = false

	/**
	 * @param {Registry} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {Record<string, any> | undefined} storage - persisted storage object
	 * @param {boolean} isImport - if this is importing a button, not creating at startup
	 */
	constructor(registry, controlId, storage, isImport) {
		super(registry, controlId, 'page-button', 'Controls/Button/PageUp')

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'pageup') throw new Error(`Invalid type given to ControlButtonPageUp: "${storage.type}"`)

			if (isImport) this.commitChange()
		}
	}

	/**
	 * Get all the actions on this control
	 * @returns {never[]}
	 */
	getAllActions() {
		return []
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 * @access public
	 */
	getDrawStyle() {
		return {
			style: 'pageup',
		}
	}

	/**
	 * Collect the instance ids and labels referenced by this control
	 * @param {Set<string>} _foundInstanceIds - instance ids being referenced
	 * @param {Set<string>} _foundInstanceLabels - instance labels being referenced
	 * @access public
	 */
	collectReferencedInstances(_foundInstanceIds, _foundInstanceLabels) {
		// Nothing being referenced
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged() {
		// Nothing to do
	}

	/**
	 * Execute a press of this control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} deviceId The surface that intiated this press
	 * @access public
	 */
	pressControl(pressed, deviceId) {
		if (pressed && deviceId) {
			this.surfaces.devicePageUp(deviceId)
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param {boolean} _clone - Whether to return a cloned object
	 * @access public
	 */
	toJSON(_clone = true) {
		return {
			type: this.type,
		}
	}
}
