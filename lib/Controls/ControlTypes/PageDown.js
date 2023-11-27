import ControlBase from '../ControlBase.js'
import {
	ControlWithoutActionSets,
	ControlWithoutActions,
	ControlWithoutEvents,
	ControlWithoutFeedbacks,
	ControlWithoutOptions,
	ControlWithoutPushed,
	ControlWithoutSteps,
	ControlWithoutStyle,
} from '../IControlFragments.js'

/**
 * Class for a pagedown button control.
 *
 * @extends ControlBase
 * @implements {ControlWithoutActions}
 * @implements {ControlWithoutFeedbacks}
 * @implements {ControlWithoutSteps}
 * @implements {ControlWithoutStyle}
 * @implements {ControlWithoutEvents}
 * @implements {ControlWithoutActionSets}
 * @implements {ControlWithoutOptions}
 * @implements {ControlWithoutPushed}
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
export default class ControlButtonPageDown extends ControlBase {
	/**
	 * @readonly
	 */
	type = 'pagedown'

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
	 * @readonly
	 * @type {false}
	 */
	supportsOptions = false
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsPushed = false

	/**
	 * @param {import('../../Registry.js').default} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {import('../../Shared/Model/ButtonModel.js').PageDownButtonModel|null} storage - persisted storage object
	 * @param {boolean} isImport - if this is importing a button, not creating at startup
	 */
	constructor(registry, controlId, storage, isImport) {
		super(registry, controlId, 'page-button', 'Controls/Button/Pagedown')

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'pagedown') throw new Error(`Invalid type given to ControlButtonPageDown: "${storage.type}"`)

			if (isImport) this.commitChange()
		}
	}

	/**
	 * Get the complete style object of a button
	 * @returns {import('../../Shared/Model/StyleModel.js').DrawStyleModel} the processed style of the button
	 * @access public
	 */
	getDrawStyle() {
		return {
			style: 'pagedown',
		}
	}

	/**
	 * Collect the connection ids and labels referenced by this control
	 * @param {Set<string>} _foundConnectionIds - connection ids being referenced
	 * @param {Set<string>} _foundConnectionLabels - connection labels being referenced
	 * @access public
	 */
	collectReferencedConnections(_foundConnectionIds, _foundConnectionLabels) {
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
	 * @param {string | undefined} surfaceId The surface that intiated this press
	 * @access public
	 */
	pressControl(pressed, surfaceId) {
		if (pressed && surfaceId) {
			this.surfaces.devicePageDown(surfaceId)
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param {boolean} _clone - Whether to return a cloned object
	 * @returns {import('../../Shared/Model/ButtonModel.js').PageDownButtonModel}
	 * @access public
	 */
	toJSON(_clone = true) {
		return {
			type: this.type,
		}
	}
}
