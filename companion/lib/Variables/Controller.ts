/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { VariablesInstanceDefinitions } from './InstanceDefinitions.js'
import { VariablesValues } from './Values.js'
import type { UIHandler } from '../UI/Handler.js'
import type { ClientSocket } from '../UI/Handler.js'

export class VariablesController {
	readonly values: VariablesValues
	readonly definitions: VariablesInstanceDefinitions

	constructor(io: UIHandler) {
		this.values = new VariablesValues()
		this.definitions = new VariablesInstanceDefinitions(io)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.values.clientConnect(client)
		this.definitions.clientConnect(client)
	}
}
