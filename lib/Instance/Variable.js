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

import debug0 from 'debug'
import CoreBase from '../Core/Base.js'
import InstanceCustomVariable from './CustomVariable.js'

const debug = debug0('lib/Instance/Variable')

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
			debug(`Reached iteration limit for variable parsing`)
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
		super(registry, 'variable', 'lib/Instance/Variable')

		this.variable_definitions = {}
		this.variables = {}

		this.custom = new InstanceCustomVariable(registry, this)

		this.system.on('variable_get_definitions', (cb) => {
			cb(this.variable_definitions)
		})

		this.system.on('variable_instance_set', (instance, variable, value) => {
			this.set_variables(instance.label, { [variable]: value })
		})

		this.system.on('variable_get', (label, variable, cb) => {
			if (this.variables[label] !== undefined) {
				cb(this.variables[label][variable])
			} else {
				cb(undefined)
			}
		})
	}

	/**
	 * Parse the variables in a string
	 * @param {string} str - String to parse variables in
	 * @returns str with variables replaced with values
	 */
	parseVariables(str) {
		return parseVariablesInString(str, this.variables)
	}

	forgetInstance(id, label) {
		if (label !== undefined) {
			if (this.variables[label] !== undefined) {
				const removed_variables = []
				for (let variable in this.variables[label]) {
					this.variables[label][variable] = undefined
					removed_variables.push(`${label}:${variable}`)
				}
				this.variables_changed({}, removed_variables)
			}

			delete this.variable_definitions[label]
			delete this.variables[label]

			this.io.emit('variable_instance_definitions_set', label, [])
		}
	}

	/**
	 * Update all the variables for an instance
	 * @param {string} instance_id
	 * @param {string} label
	 * @param {object} presets
	 */
	instanceLabelRename(labelFrom, labelTo) {
		if (this.variables[labelTo] === undefined) {
			this.variables[labelTo] = {}
		}

		// Trigger any renames inside of the banks
		this.bank.renameVariables(labelFrom, labelTo)

		// Move variable values, and track the 'diff'
		if (this.variables[labelFrom] !== undefined) {
			const changed_variables = {}
			const removed_variables = []

			for (let variable in this.variables[labelFrom]) {
				this.variables[labelTo][variable] = this.variables[labelFrom][variable]
				delete this.variables[labelFrom][variable]

				removed_variables.push(`${labelFrom}:${variable}`)
				changed_variables[`${labelTo}:${variable}`] = this.variables[labelTo][variable]
			}

			delete this.variables[labelFrom]
			this.variables_changed(changed_variables, removed_variables)
		}

		// Update the instance definitions
		if (this.variable_definitions[labelFrom] !== undefined) {
			this.variable_definitions[labelTo] = this.variable_definitions[labelFrom]
			delete this.variable_definitions[labelFrom]

			this.io.emit('variable_instance_definitions_set', labelTo, this.variable_definitions[labelTo])
			this.io.emit('variable_instance_definitions_set', labelFrom, [])
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.custom.clientConnect(client)

		client.on('variable_instance_definitions_get', (answer) => {
			answer(this.variable_definitions)
		})

		client.on('variable_values_for_instance', (label, answer) => {
			answer(this.variables[label])
		})
	}

	/**
	 * Set the variable definitions for an instance
	 * @access public
	 * @param {string} instance_label
	 * @param {object} variables
	 */
	setVariableDefinitions(instance_label, variables) {
		this.variable_definitions[instance_label] = variables

		this.debug('got instance variable definitions for ' + instance_label)
		this.io.emit('variable_instance_definitions_set', instance_label, variables)
	}

	set_variables(label, variables) {
		if (this.variables[label] === undefined) {
			this.variables[label] = {}
		}

		const changed_variables = {}
		const removed_variables = []
		for (const variable in variables) {
			const value = variables[variable]

			if (this.variables[label][variable] != value) {
				this.variables[label][variable] = value

				if (value === undefined) {
					removed_variables.push(`${label}:${variable}`)
				} else {
					changed_variables[`${label}:${variable}`] = value
				}

				// Skip debug if it's just internal:time_* spamming.
				if (!(label === 'internal' && variable.startsWith('time_'))) {
					this.debug('Variable $(' + label + ':' + variable + ') is "' + value + '"')
				}
			}
		}

		this.variables_changed(changed_variables, removed_variables)
	}

	variables_changed(changed_variables, removed_variables) {
		if (Object.keys(changed_variables).length > 0 || removed_variables.length > 0) {
			this.bank.onVariablesChanged(changed_variables, removed_variables)
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

		return str
	}
}

export default InstanceVariable
