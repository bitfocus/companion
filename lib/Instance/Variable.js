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
import { ResolveExpression } from '../Shared/Expression/ExpressionResolve.js'
import { ParseExpression } from '../Shared/Expression/ExpressionParse.js'
import { ExpressionFunctions } from '../Shared/Expression/ExpressionFunctions.js'
import { cloneDeep } from 'lodash-es'

const logger = LogController.createLogger('Instance/Variable')

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
	const reg = /\$\(([^)$]+)\)/

	let matchCount = 0
	let matches
	while ((matches = reg.exec(string))) {
		if (matchCount++ > 100) {
			// Crudely avoid infinite loops with an iteration limit
			logger.info(`Reached iteration limit for variable parsing`)
			break
		}

		const wrappedId = matches[0]
		const fullId = matches[1]
		referencedVariableIds.push(fullId)

		let cachedValue = cachedVariableValues[wrappedId]
		if (cachedVariableValues[wrappedId] === undefined) {
			// Set a temporary value, to stop the recursion going deep
			cachedVariableValues[wrappedId] = '$RE'

			// Fetch the raw value, and parse variables inside of it
			const rawValue = getVariableValueById(rawVariableValues, fullId)
			if (rawValue !== undefined) {
				const result = parseVariablesInString(rawValue, rawVariableValues, cachedVariableValues)
				cachedValue = result.text
				referencedVariableIds.push(...result.variableIds)
				if (cachedValue === undefined) cachedValue = ''
			} else {
				// Variable has no value
				cachedValue = '$NA'
			}

			cachedVariableValues[wrappedId] = cachedValue
		}

		string = string.replace(wrappedId, cachedValue)
	}

	return {
		text: string,
		variableIds: referencedVariableIds,
	}
}

function getVariableValueById(variableValues, fullId) {
	return getVariableValue(variableValues, ...fullId.split(':'))
}
function getVariableValue(variableValues, label, name, subId) {
	const entry = variableValues[label]?.[name]
	if (entry) {
		if (entry.isSingleValue) {
			return entry.value
		} else {
			return entry.values?.[subId]
		}
	} else {
		return undefined
	}
}

class InstanceVariable extends CoreBase {
	constructor(registry) {
		super(registry, 'variable', 'Instance/Variable')

		this.variable_definitions = {}
		this.variable_values = {}

		this.custom = new InstanceCustomVariable(registry, this)
	}

	getVariableValueById(variableId) {
		return getVariableValueById(this.variable_values, variableId)
	}

	getCustomVariableValue(name) {
		return getVariableValue(this.variable_values, 'internal', `custom_${name}`)
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

	#findAllVariableNamesForInstanceLabel(label) {
		const variableNames = []
		for (const [name, entry] of Object.entries(this.variable_values[label] || {})) {
			if (entry.isSingleValue) {
				variableNames.push(`${label}:${name}`)
			} else {
				for (const subId of Object.keys(entry.values)) {
					variableNames.push(`${label}:${name}:${subId}`)
				}
			}
		}
		return variableNames
	}

	forgetInstance(id, label) {
		if (!label) return

		const removed_variables = this.#findAllVariableNamesForInstanceLabel(label)
		delete this.variable_values[label]

		if (removed_variables.length > 0) this.#emitVariablesChanged({}, removed_variables)
	}

	/**
	 * Update all the variables for an instance
	 * @param {string} instance_id
	 * @param {string} label
	 * @param {object} presets
	 */
	instanceLabelRename(labelFrom, labelTo) {
		// Just in case there were some stuck values
		const overwritten = this.#findAllVariableNamesForInstanceLabel(labelTo)

		const oldNames = this.#findAllVariableNamesForInstanceLabel(labelFrom)
		const newNames = this.#findAllVariableNamesForInstanceLabel(labelTo)

		// Copy all the values across
		this.variable_values[labelTo] = cloneDeep(this.variable_values[labelFrom] || {})

		// Trigger any renames inside of the banks
		this.controls.renameVariables(labelFrom, labelTo)

		// Report the changes
		const changedVariables = {}
		for (const fullName of newNames) {
			changedVariables[fullName] = this.getVariableValueById(fullName)
		}

		this.#emitVariablesChanged(changedVariables, [...oldNames, ...overwritten])
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.custom.clientConnect(client)

		client.onPromise('variables:instance-values', (label) => {
			// TODO - update usages
			return this.variable_values[label]
		})
	}

	setVariableValues(label, variableValues) {
		if (!this.variable_values[label]) this.variable_values[label] = {}

		const changedVariables = {}
		const removedVariables = []
		const compareValues = (fullId, oldValue, newValue) => {
			if (oldValue !== newValue) {
				if (newValue === undefined) {
					removedVariables.push(fullId)
				} else {
					changedVariables[fullId] = newValue
				}

				// Skip debug if it's just internal:time_* spamming.
				if (!fullId.startsWith(`internal:time_`)) {
					this.logger.silly(`Variable $(${fullId}) is "${newValue}"`)
				}
			}
		}

		for (const [name, newEntry] of Object.entries(variableValues || {})) {
			// We require all values of a property to be provided at once
			const oldEntry = this.variable_values[label][name]
			this.variable_values[label][name] = newEntry

			const fullSingleId = `${label}:${name}`

			// If either of them is a single value
			if (newEntry?.isSingleValue || oldEntry?.isSingleValue) {
				compareValues(fullSingleId, oldEntry?.value, newEntry?.value)
			}

			// If either of them is a multi value
			if (!oldEntry?.isSingleValue || !newEntry?.isSingleValue) {
				const allKeys = new Set([...Object.keys(oldEntry?.values || {}), ...Object.keys(newEntry?.values || {})])

				for (const subId of allKeys) {
					const oldValue = oldEntry?.values?.[subId]
					const newValue = newEntry?.values?.[subId]

					compareValues(`${fullSingleId}:${subId}`, oldValue, newValue)
				}
			}
		}

		this.#emitVariablesChanged(changedVariables, removedVariables)
	}

	#emitVariablesChanged(changed_variables, removed_variables) {
		if (Object.keys(changed_variables).length > 0 || removed_variables.length > 0) {
			this.controls.onVariablesChanged(changed_variables, removed_variables)
			this.internalModule.variablesChanged(changed_variables, removed_variables)
			this.instance.moduleHost.onVariablesChanged(changed_variables, removed_variables)
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
