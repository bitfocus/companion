import { VariablesCustomVariable } from './CustomVariable.js'
import InstanceVariable from './Variable.js'

export class VariablesController {
	/**
	 * @type {VariablesCustomVariable}
	 * @access public
	 * @readonly
	 */
	custom

	/**
	 * @type {InstanceVariable}
	 * @access public
	 * @readonly
	 */
	values

	// definitions

	/**
	 * @param {import ('../Data/Database.js').default} db
	 * @param {import('../UI/Handler.js').default} io
	 * @param {import('../Controls/Controller.js').default} controls
	 */
	constructor(db, io, controls) {
		this.values = new InstanceVariable(io, controls)
		this.custom = new VariablesCustomVariable(db, io, this.values)
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.values.clientConnect(client)
		this.custom.clientConnect(client)
	}
}
