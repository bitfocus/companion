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
import CoreBase from '../Core/Base.js'
import InstanceCustomVariable from './CustomVariable.js'
import jsonPatch from 'fast-json-patch'

const logger = LogController.createLogger('Instance/Variable')

const VariableDefinitionsRoom = 'variable-definitions'

const expressionFunctions = {
	round: (v, accuracy) => Math.round(v / accuracy) * accuracy,
	floor: (v, accuracy) => Math.floor(v / accuracy) * accuracy,
	ceil: (v, accuracy) => Math.ceil(v / accuracy) * accuracy,
}

// Export for unit tests
export function parseVariablesInString(string, rawVariableValues, cachedVariableValues) {
	if (string === undefined || string === null || string === '') {
		return string
	}
	if (typeof string !== 'string') string = `${string}`
	if (!cachedVariableValues) cachedVariableValues = {}

	// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
	const reg = /\$\(([^:$)]+):([^)$]+)\)/

	let matchCount = 0
	let matches
	while ((matches = reg.exec(string))) {
		if (matchCount++ > 100) {
			// Crudely avoid infinite loops with an iteration limit
			logger.info(`Reached iteration limit for variable parsing`)
			break
		}

		const fullId = matches[0]
		const instanceId = matches[1]
		const variableId = matches[2]

		let cachedValue = cachedVariableValues[fullId]
		if (cachedVariableValues[fullId] === undefined) {
			// Set a temporary value, to stop the recursion going deep
			cachedVariableValues[fullId] = '$RE'

			// Fetch the raw value, and parse variables inside of it
			if (rawVariableValues[instanceId] && rawVariableValues[instanceId][variableId] !== undefined) {
				const rawValue = rawVariableValues[instanceId][variableId]

				cachedValue = parseVariablesInString(rawValue, rawVariableValues, cachedVariableValues)
				if (cachedValue === undefined) cachedValue = ''
			} else {
				// Variable has no value
				cachedValue = '$NA'
			}

			cachedVariableValues[fullId] = cachedValue
		}

		string = string.replace(fullId, cachedValue)
	}

	return string
}

class InstanceVariable extends CoreBase {
	constructor(registry) {
		super(registry, 'variable', 'Instance/Variable')

		this.variable_definitions = {}
		this.variable_values = {}

		this.custom = new InstanceCustomVariable(registry, this)
	}

	getVariableValue(label, name) {
		return this.variable_values[label]?.[name]
	}

	getCustomVariableValue(name) {
		return this.getVariableValue('internal', `custom_${name}`)
	}

	/**
	 * Parse the variables in a string
	 * @param {string} str - String to parse variables in
	 * @returns str with variables replaced with values
	 */
	parseVariables(str) {
		return parseVariablesInString(str, this.variable_values)
	}

	parseNumericExpression(str) {
		return ResolveExpression(ParseExpression(str), this.variable_values, expressionFunctions)
	}

	forgetInstance(id, label) {
		if (label !== undefined) {
			if (this.variable_values[label] !== undefined) {
				const removed_variables = []
				for (let variable in this.variable_values[label]) {
					this.variable_values[label][variable] = undefined
					removed_variables.push(`${label}:${variable}`)
				}
				this.#emitVariablesChanged({}, removed_variables)
			}

			delete this.variable_definitions[label]
			delete this.variable_values[label]

			this.io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', label, null)
		}
	}

	/**
	 * Update all the variables for an instance
	 * @param {string} instance_id
	 * @param {string} label
	 * @param {object} presets
	 */
	instanceLabelRename(labelFrom, labelTo) {
		if (this.variable_values[labelTo] === undefined) {
			this.variable_values[labelTo] = {}
		}

		// Trigger any renames inside of the banks
		this.controls.renameVariables(labelFrom, labelTo)

		// Move variable values, and track the 'diff'
		if (this.variable_values[labelFrom] !== undefined) {
			const changed_variables = {}
			const removed_variables = []

			for (let variable in this.variable_values[labelFrom]) {
				this.variable_values[labelTo][variable] = this.variable_values[labelFrom][variable]
				delete this.variable_values[labelFrom][variable]

				removed_variables.push(`${labelFrom}:${variable}`)
				changed_variables[`${labelTo}:${variable}`] = this.variable_values[labelTo][variable]
			}

			delete this.variable_values[labelFrom]
			this.#emitVariablesChanged(changed_variables, removed_variables)
		}

		// Update the instance definitions
		if (this.variable_definitions[labelFrom] !== undefined) {
			this.variable_definitions[labelTo] = this.variable_definitions[labelFrom]
			delete this.variable_definitions[labelFrom]

			this.io.emitToRoom(
				VariableDefinitionsRoom,
				'variable-definitions:update',
				labelTo,
				this.variable_definitions[labelTo]
			)
			this.io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', labelFrom, null)
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.custom.clientConnect(client)

		client.onPromise('variable-definitions:subscribe', () => {
			client.join(VariableDefinitionsRoom)

			return this.variable_definitions
		})

		client.onPromise('variable-definitions:unsubscribe', () => {
			client.leave(VariableDefinitionsRoom)
		})

		client.onPromise('variables:instance-values', (label) => {
			return this.variable_values[label]
		})
	}

	/**
	 * Set the variable definitions for an instance
	 * @access public
	 * @param {string} instance_label
	 * @param {object} variables
	 */
	setVariableDefinitions(instance_label, variables) {
		const variablesObj = {}
		for (const variable of variables || []) {
			// Prune out the name
			const newVarObj = { ...variable }
			delete newVarObj.name

			variablesObj[variable.name] = newVarObj
		}

		const variablesBefore = this.variable_definitions[instance_label]
		this.variable_definitions[instance_label] = variablesObj

		const patch = jsonPatch.compare(variablesBefore || {}, variablesObj || {})
		if (patch.length > 0) {
			this.logger.silly('got instance variable definitions for ' + instance_label)
			this.io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', instance_label, patch)
		}
	}

	setVariableValues(label, variables) {
		if (this.variable_values[label] === undefined) {
			this.variable_values[label] = {}
		}

		const changed_variables = {}
		const removed_variables = []
		for (const variable in variables) {
			const value = variables[variable]

			if (this.variable_values[label][variable] != value) {
				this.variable_values[label][variable] = value

				if (value === undefined) {
					removed_variables.push(`${label}:${variable}`)
				} else {
					changed_variables[`${label}:${variable}`] = value
				}

				// Skip debug if it's just internal:time_* spamming.
				if (!(label === 'internal' && variable.startsWith('time_'))) {
					this.logger.silly('Variable $(' + label + ':' + variable + ') is "' + value + '"')
				}
			}
		}

		this.#emitVariablesChanged(changed_variables, removed_variables)
	}

	#emitVariablesChanged(changed_variables, removed_variables) {
		if (Object.keys(changed_variables).length > 0 || removed_variables.length > 0) {
			this.controls.onVariablesChanged(changed_variables, removed_variables)
			this.internalModule.variablesChanged(changed_variables, removed_variables)
		}
	}

	/**
	 * Update the 'label' component of variables in a given string, if they match fromlabel
	 * @param {string} text
	 * @param {string} fromlabel
	 * @param {string} tolabel
	 */
	renameVariablesInString(text, fromlabel, tolabel) {
		let fixtext = text

		if (fixtext && fixtext.includes('$(') && fromlabel && tolabel) {
			const reg = /\$\(([^:)]+):([^)]+)\)/g

			let matches
			while ((matches = reg.exec(fixtext)) !== null) {
				if (matches[1] == fromlabel) {
					if (matches[2] !== undefined) {
						fixtext = fixtext.replace(matches[0], '$(' + tolabel + ':' + matches[2] + ')')
					}
				}
			}
		}

		return fixtext
	}
}

export default InstanceVariable
