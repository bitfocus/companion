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

import LogController from '../Log/Controller.js'
import type {
	AllVariableDefinitions,
	ModuleVariableDefinitions,
	VariableDefinition,
	VariableDefinitionUpdate,
	VariableDefinitionUpdateInitOp,
} from '@companion-app/shared/Model/Variables.js'
import type { VariableDefinitionTmp } from '../Instance/Connection/ChildHandler.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import EventEmitter from 'node:events'
import { diffObjects } from '@companion-app/shared/Diff.js'

/**
 * Variable definitions as defined by the instances/connections
 */
export class VariablesInstanceDefinitions {
	readonly #logger = LogController.createLogger('Variables/Definitions')

	readonly #variableDefinitions: AllVariableDefinitions = {}

	readonly #events = new EventEmitter<{ update: [VariableDefinitionUpdate] }>()

	constructor() {
		this.#events.setMaxListeners(0)
	}

	forgetConnection(_id: string, label: string): void {
		if (label !== undefined) {
			delete this.#variableDefinitions[label]

			this.#events.emit('update', { type: 'remove', label: label })
		}
	}

	connectionLabelRename(labelFrom: string, labelTo: string): void {
		// Update the connection variable definitions
		const oldDefinitions = this.#variableDefinitions[labelFrom]
		if (oldDefinitions) {
			const definitions = (this.#variableDefinitions[labelTo] = oldDefinitions)
			delete this.#variableDefinitions[labelFrom]

			this.#events.emit('update', { type: 'set', label: labelTo, variables: definitions })
			this.#events.emit('update', { type: 'remove', label: labelFrom })
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'update', signal)

				yield {
					type: 'init',
					variables: self.#variableDefinitions,
				} satisfies VariableDefinitionUpdateInitOp

				for await (const [change] of changes) {
					yield change
				}
			}),
		})
	}

	/**
	 * Set the variable definitions for a connection
	 */
	setVariableDefinitions(connectionLabel: string, variables: VariableDefinitionTmp[]): void {
		this.#logger.silly('got connection variable definitions for ' + connectionLabel)

		const variablesObj: ModuleVariableDefinitions = {}
		for (const variable of variables || []) {
			// Prune out the name
			const newVarObj: VariableDefinition = {
				label: variable.label,
			}

			variablesObj[variable.name] = newVarObj
		}

		const variablesBefore = this.#variableDefinitions[connectionLabel]
		this.#variableDefinitions[connectionLabel] = variablesObj

		if (this.#events.listenerCount('update') > 0) {
			if (!variablesBefore) {
				this.#events.emit('update', { type: 'set', label: connectionLabel, variables: variablesObj })
			} else {
				const diff = diffObjects(variablesBefore, variablesObj)

				if (diff) {
					this.#events.emit('update', { type: 'patch', label: connectionLabel, ...diff })
				}
			}
		}
	}

	/**
	 * Get the variable definitions for a connection
	 */

	getVariableDefinitions(connectionLabel: string): ModuleVariableDefinitions {
		return this.#variableDefinitions[connectionLabel] ?? {}
	}

	getVariableLabel(connectionLabel: string, variableId: string): string | undefined {
		return this.#variableDefinitions[connectionLabel]?.[variableId]?.label
	}
}
