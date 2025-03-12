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
import type { DataDatabase } from '../Data/Database.js'
import type { UIHandler } from '../UI/Handler.js'
import { ClientSocket } from '../UI/Handler.js'
import { VariablesExpressionStream } from './ExpressionStream.js'
import type { PageController } from '../Page/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'

export class VariablesController {
	readonly custom: VariablesCustomVariable
	readonly values: VariablesValues
	readonly definitions: VariablesInstanceDefinitions

	readonly #expressionsStream: VariablesExpressionStream

	constructor(db: DataDatabase, io: UIHandler, page: PageController, controls: ControlsController) {
		this.values = new VariablesValues()
		this.custom = new VariablesCustomVariable(db, io, this.values)
		this.definitions = new VariablesInstanceDefinitions(io)
		this.#expressionsStream = new VariablesExpressionStream(io, page, this.values, controls)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket) {
		this.values.clientConnect(client)
		this.custom.clientConnect(client)
		this.definitions.clientConnect(client)
		this.#expressionsStream.clientConnect(client)
	}
}
