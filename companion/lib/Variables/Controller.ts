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

import type { DataDatabase } from '../Data/Database.js'
import type { MetricsRegistry } from '../Data/Metrics.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import { router } from '../UI/TRPC.js'
import { VariablesCustomVariable } from './CustomVariable.js'
import { VariableDependencyRegistry } from './DependencyRegistry.js'
import { VariablesInstanceDefinitions } from './InstanceDefinitions.js'
import { VariablesValues } from './Values.js'

export class VariablesController {
	readonly custom: VariablesCustomVariable
	readonly values: VariablesValues
	readonly definitions: VariablesInstanceDefinitions
	/** What references which variables, so that a change only reaches what read a changed variable */
	readonly dependencies = new VariableDependencyRegistry()

	constructor(db: DataDatabase, userconfig: DataUserConfig, metrics: MetricsRegistry) {
		this.values = new VariablesValues(userconfig)
		this.custom = new VariablesCustomVariable(db, this.values)
		this.definitions = new VariablesInstanceDefinitions()

		this.values.registerMetrics(metrics)
		this.dependencies.registerMetrics(metrics)
	}

	createTrpcRouter() {
		return router({
			definitions: this.definitions.createTrpcRouter(),
			values: this.values.createTrpcRouter(),
		})
	}
}
