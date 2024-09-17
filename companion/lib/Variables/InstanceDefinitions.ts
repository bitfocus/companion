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

import LogController from '../Log/Controller.js'
import jsonPatch from 'fast-json-patch'
import type { UIHandler } from '../UI/Handler.js'
import type {
	AllVariableDefinitions,
	ModuleVariableDefinitions,
	VariableDefinition,
} from '@companion-app/shared/Model/Variables.js'
import type { ClientSocket } from '../UI/Handler.js'
import type { VariableDefinitionTmp } from '../Instance/Wrapper.js'

const VariableDefinitionsRoom = 'variable-definitions'

/**
 * Variable definitions as defined by the instances/connections
 */
export class VariablesInstanceDefinitions {
	readonly #logger = LogController.createLogger('Variables/Definitions')
	readonly #io: UIHandler

	readonly #variableDefinitions: AllVariableDefinitions = {}

	constructor(io: UIHandler) {
		this.#io = io
	}

	forgetConnection(_id: string, label: string): void {
		if (label !== undefined) {
			delete this.#variableDefinitions[label]

			if (this.#io.countRoomMembers(VariableDefinitionsRoom) > 0) {
				this.#io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', label, null)
			}
		}
	}

	connectionLabelRename(labelFrom: string, labelTo: string): void {
		// Update the instance definitions
		const oldDefinitions = this.#variableDefinitions[labelFrom]
		if (oldDefinitions) {
			const definitions = (this.#variableDefinitions[labelTo] = oldDefinitions)
			delete this.#variableDefinitions[labelFrom]

			if (this.#io.countRoomMembers(VariableDefinitionsRoom) > 0) {
				this.#io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', labelTo, {
					type: 'set',
					variables: definitions,
				})
				this.#io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', labelFrom, null)
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('variable-definitions:subscribe', () => {
			client.join(VariableDefinitionsRoom)

			return this.#variableDefinitions
		})

		client.onPromise('variable-definitions:unsubscribe', () => {
			client.leave(VariableDefinitionsRoom)
		})
	}

	/**
	 * Set the variable definitions for an instance
	 */
	setVariableDefinitions(instance_label: string, variables: VariableDefinitionTmp[]): void {
		this.#logger.silly('got instance variable definitions for ' + instance_label)

		const variablesObj: ModuleVariableDefinitions = {}
		for (const variable of variables || []) {
			// Prune out the name
			const newVarObj: VariableDefinition = {
				label: variable.label,
			}

			variablesObj[variable.name] = newVarObj
		}

		const variablesBefore = this.#variableDefinitions[instance_label]
		this.#variableDefinitions[instance_label] = variablesObj

		if (this.#io.countRoomMembers(VariableDefinitionsRoom) > 0) {
			if (!variablesBefore) {
				this.#io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', instance_label, {
					type: 'set',
					variables: variablesObj,
				})
			} else {
				const patch = jsonPatch.compare(variablesBefore, variablesObj || {})

				if (patch.length > 0) {
					this.#io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', instance_label, {
						type: 'patch',
						patch: patch,
					})
				}
			}
		}
	}
}
