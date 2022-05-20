import fs from 'fs-extra'
import path from 'path'
import { cloneDeep } from 'lodash-es'
import Registry from '../Registry.js'
import CoreBase from '../Core/Base.js'

import PressButtonControl from './PressButton.js'
import SteppedButtonControl from './SteppedButton.js'
import PageButtonControl from './PageButton.js'
import { CreateBankControlId } from '../Resources/Util.js'
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
				const inst = this.#createClassForControl(controlId, controlObj)
				if (inst) this.controls[controlId] = inst
			}
		}
	}

	#createClassForControl(controlId, controlObj) {
		switch (controlObj.type) {
			case 'press':
				return new PressButtonControl(this.registry, controlId, controlObj)
			case 'step':
				return new SteppedButtonControl(this.registry, controlId, controlObj)
			case 'pagenum':
			case 'pageup':
			case 'pagedown':
				return new PageButtonControl(this.registry, controlId, controlObj)
			default:
				// Unknown type
				this.logger.warn(`Cannot create control "${controlId}" of unknown type "${controlObj.type}"`)
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
			return control?.toJSON()
		})

		client.onPromise('controls:unsubscribe', (page, bank) => {
			const controlId = CreateBankControlId(page, bank)
			client.leave(ControlConfigRoom(controlId))
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

		client.on('bank_get_feedbacks', (page, bank, answer) => {
			// HACK
			answer([])
		})
		//
	}

	resetControl(controlId) {
		// TODO
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
		// TODO
	}

	forgetInstance(instanceId) {
		// TODO
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
		// TODO
	}
}

export default ControlsController
