/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import { VariablesCustomVariable } from './CustomVariable.js'
import { VariablesInstanceDefinitions } from './InstanceDefinitions.js'
import { VariablesValues } from './Values.js'

export class VariablesController {
	/**
	 * @type {VariablesCustomVariable}
	 * @access public
	 * @readonly
	 */
	custom

	/**
	 * @type {VariablesValues}
	 * @access public
	 * @readonly
	 */
	values

	/**
	 * @type {VariablesInstanceDefinitions}
	 * @access public
	 * @readonly
	 */
	definitions

	/**
	 * @param {import ('../Data/Database.js').default} db
	 * @param {import('../UI/Handler.js').default} io
	 */
	constructor(db, io) {
		this.values = new VariablesValues()
		this.custom = new VariablesCustomVariable(db, io, this.values)
		this.definitions = new VariablesInstanceDefinitions(io)
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.values.clientConnect(client)
		this.custom.clientConnect(client)
		this.definitions.clientConnect(client)
	}
}
