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

import { VariablesCustomVariable } from './CustomVariable.js'
import { VariablesInstanceDefinitions } from './InstanceDefinitions.js'
import { VariablesValues } from './Values.js'
import type { DataDatabase } from '../Data/Database.js'
import { router } from '../UI/TRPC.js'

export class VariablesController {
	readonly custom: VariablesCustomVariable
	readonly values: VariablesValues
	readonly definitions: VariablesInstanceDefinitions

	constructor(db: DataDatabase) {
		this.values = new VariablesValues()
		this.custom = new VariablesCustomVariable(db, this.values)
		this.definitions = new VariablesInstanceDefinitions()
	}

	createTrpcRouter() {
		return router({
			definitions: this.definitions.createTrpcRouter(),
			values: this.values.createTrpcRouter(),
		})
	}
}
