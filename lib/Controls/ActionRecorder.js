import CoreBase from '../Core/Base.js'
import { ParseControlId } from '../Resources/Util.js'

/**
 * Class to handle recording of actions onto a control.
 *
 * @extends CoreBase
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
export default class ActionRecorder extends CoreBase {
	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'action-recorder', 'Control/ActionRecorder')
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		// TODO
	}

	/**
	 * Abort all pending delayed actions
	 * @access public
	 */
	abortAllDelayed() {
		// this.logger.silly('Aborting delayed actions')
		// const affectedControlIds = new Set()
		// // Clear the timers
		// for (const [timer, controlId] of this.#timers_running.entries()) {
		// 	clearTimeout(timer)
		// 	affectedControlIds.add(controlId)
		// }
		// this.#timers_running.clear()
		// // Redraw any controls
		// for (const controlId of affectedControlIds.values()) {
		// 	this.#setControlIsRunning(controlId, false)
		// }
	}
}
