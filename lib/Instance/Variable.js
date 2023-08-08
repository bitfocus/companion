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
import { ResolveExpression } from '../Shared/Expression/ExpressionResolve.js'
import { ParseExpression } from '../Shared/Expression/ExpressionParse.js'
import { ExpressionFunctions } from '../Shared/Expression/ExpressionFunctions.js'

const logger = LogController.createLogger('Instance/Variable')

const VariableDefinitionsRoom = 'variable-definitions'

// Export for unit tests
export function parseVariablesInString(string, rawVariableValues, cachedVariableValues) {
	if (string === undefined || string === null || string === '') {
		return {
			text: string,
			variableIds: [],
		}
	}
	if (typeof string !== 'string') string = `${string}`
	if (!cachedVariableValues) cachedVariableValues = {}

	const referencedVariableIds = []

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
		referencedVariableIds.push(`${instanceId}:${variableId}`)

		let cachedValue = cachedVariableValues[fullId]
		if (cachedVariableValues[fullId] === undefined) {
			// Set a temporary value, to stop the recursion going deep
			cachedVariableValues[fullId] = '$RE'

			// Fetch the raw value, and parse variables inside of it
			if (rawVariableValues[instanceId] && rawVariableValues[instanceId][variableId] !== undefined) {
				const rawValue = rawVariableValues[instanceId][variableId]

				const result = parseVariablesInString(rawValue, rawVariableValues, cachedVariableValues)
				cachedValue = result.text
				referencedVariableIds.push(...result.variableIds)
				if (cachedValue === undefined) cachedValue = ''
			} else {
				// Variable has no value
				cachedValue = '$NA'
			}

			cachedVariableValues[fullId] = cachedValue
		}

		string = string.replace(fullId, cachedValue)
	}

	return {
		text: string,
		variableIds: referencedVariableIds,
	}
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
	 * @param {Record<string, string | undefined>} injectedVariableValues - Inject some variable values
	 * @returns str with variables replaced with values
	 */
	parseVariables(str, injectedVariableValues) {
		return parseVariablesInString(str, this.variable_values, injectedVariableValues)
	}

	/**
	 * Parse and execute an expression in a string
	 * @param {string} str - String containing the expression to parse
	 * @param {string | undefined} requiredType - Fail if the result is not of specified type
	 * @param {Record<string, string | undefined>} injectedVariableValues - Inject some variable values
	 * @returns boolean/number/string result of the expression
	 */
	parseExpression(str, requiredType, injectedVariableValues) {
		const referencedVariableIds = new Set()

		const getVariableValue = (variableId) => {
			const result = this.parseVariables(`$(${variableId})`, injectedVariableValues)

			for (const id of result.variableIds) {
				referencedVariableIds.add(id)
			}

			return result.text
		}

		const functions = {
			...ExpressionFunctions,
			parseVariables: (str) => {
				const result = this.parseVariables(str, injectedVariableValues)

				// Track referenced variables
				for (const varId of result.variableIds) {
					referencedVariableIds.add(varId)
				}

				return result.text
			},
		}

		let value = ResolveExpression(ParseExpression(str), getVariableValue, functions)

		// Fix up the result for some types
		switch (requiredType) {
			case 'string':
				value = `${value}`
				break
			case 'number':
				value = Number(value)
				break
		}

		if (requiredType && typeof value !== requiredType) {
			throw new Error('Unexpected return type')
		}

		return {
			value,
			variableIds: referencedVariableIds,
		}
	}

	forgetInstance(id, label) {
		if (label !== undefined) {
			if (this.variable_values[label] !== undefined) {
				const removed_variables = new Set()
				for (let variable in this.variable_values[label]) {
					this.variable_values[label][variable] = undefined
					removed_variables.add(`${label}:${variable}`)
				}
				this.#emitVariablesChanged(removed_variables)
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
			const all_changed_variables_set = new Set()

			for (let variable in this.variable_values[labelFrom]) {
				this.variable_values[labelTo][variable] = this.variable_values[labelFrom][variable]
				delete this.variable_values[labelFrom][variable]

				all_changed_variables_set.add(`${labelFrom}:${variable}`)
				all_changed_variables_set.add(`${labelTo}:${variable}`)
			}

			delete this.variable_values[labelFrom]
			this.#emitVariablesChanged(all_changed_variables_set)
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

		if (!variablesBefore) {
			this.io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', instance_label, variablesObj)
		} else {
			const patch = jsonPatch.compare(variablesBefore, variablesObj || {})
			if (patch.length > 0) {
				this.logger.silly('got instance variable definitions for ' + instance_label)
				this.io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', instance_label, patch)
			}
		}
	}

	setVariableValues(label, variables) {
		if (this.variable_values[label] === undefined) {
			this.variable_values[label] = {}
		}

		const moduleValues = this.variable_values[label]

		const all_changed_variables_set = new Set()
		for (const variable in variables) {
			// Note: explicitly using for-in here, as Object.entries is slow
			const value = variables[variable]

			if (moduleValues[variable] !== value) {
				moduleValues[variable] = value

				all_changed_variables_set.add(`${label}:${variable}`)

				// Skip debug if it's just internal:time_* spamming.
				if (this.logger.isSillyEnabled() && !(label === 'internal' && variable.startsWith('time_'))) {
					this.logger.silly('Variable $(' + label + ':' + variable + ') is "' + value + '"')
				}
			}
		}

		this.#emitVariablesChanged(all_changed_variables_set)
	}

	#emitVariablesChanged(all_changed_variables_set) {
		if (all_changed_variables_set.size > 0) {
			this.internalModule.variablesChanged(all_changed_variables_set)
			this.controls.onVariablesChanged(all_changed_variables_set)
			this.instance.moduleHost.onVariablesChanged(all_changed_variables_set)
		}
	}
}

export default InstanceVariable
