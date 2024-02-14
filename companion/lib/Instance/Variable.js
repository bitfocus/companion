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

/**
 * @typedef {Record<string, Record<string, import('@companion-module/base').CompanionVariableValue | undefined> | undefined>} VariableValueData
 * @typedef {Record<string, import('@companion-module/base').CompanionVariableValue | undefined>} VariablesCache
 * @typedef {{ text: string, variableIds: string[] }} ParseVariablesResult
 */

// Export for unit tests
/**
 *
 * @param {import('@companion-module/base').CompanionVariableValue} string
 * @param {VariableValueData} rawVariableValues
 * @param {VariablesCache=} cachedVariableValues
 * @returns {ParseVariablesResult}
 */
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
		const connectionLabel = matches[1]
		const variableId = matches[2]
		referencedVariableIds.push(`${connectionLabel}:${variableId}`)

		let cachedValue = cachedVariableValues[fullId]
		if (cachedValue === undefined) {
			// Set a temporary value, to stop the recursion going deep
			cachedVariableValues[fullId] = '$RE'

			// Fetch the raw value, and parse variables inside of it
			const rawValue = rawVariableValues[connectionLabel]?.[variableId]
			if (rawValue !== undefined) {
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

		// Pass a function, to avoid special interpreting of `$$` and other sequences
		// @ts-ignore `cachedValue` gets populated by this point
		string = string.replace(fullId, () => cachedValue)
	}

	return {
		text: string,
		variableIds: referencedVariableIds,
	}
}

class InstanceVariable extends CoreBase {
	/**
	 * @type {VariableValueData}
	 */
	#variableValues = {}

	/**
	 * @type {import('../Shared/Model/Variables.js').AllVariableDefinitions}
	 */
	#variableDefinitions = {}

	/**
	 * @param {import('../Registry.js').default} registry
	 */
	constructor(registry) {
		super(registry, 'variable', 'Instance/Variable')

		this.custom = new InstanceCustomVariable(registry.db, registry.io, this)
	}

	/**
	 *
	 * @param {string} label
	 * @param {string} name
	 * @returns {import('@companion-module/base').CompanionVariableValue | undefined}
	 */
	getVariableValue(label, name) {
		return this.#variableValues[label]?.[name]
	}

	/**
	 *
	 * @param {string} name
	 * @returns {import('@companion-module/base').CompanionVariableValue | undefined}
	 */
	getCustomVariableValue(name) {
		return this.getVariableValue('internal', `custom_${name}`)
	}

	/**
	 * Parse the variables in a string
	 * @param {string} str - String to parse variables in
	 * @param {VariablesCache=} injectedVariableValues - Inject some variable values
	 * @returns {ParseVariablesResult} with variables replaced with values
	 */
	parseVariables(str, injectedVariableValues) {
		return parseVariablesInString(str, this.#variableValues, injectedVariableValues)
	}

	/**
	 * Parse and execute an expression in a string
	 * @param {string} str - String containing the expression to parse
	 * @param {string=} requiredType - Fail if the result is not of specified type
	 * @param {import('@companion-module/base').CompanionVariableValues=} injectedVariableValues - Inject some variable values
	 * @returns {{ value: boolean|number|string|undefined, variableIds: Set<string> }} result of the expression
	 */
	parseExpression(str, requiredType, injectedVariableValues) {
		/** @type {Set<string>} */
		const referencedVariableIds = new Set()

		/**
		 * @param {string} variableId
		 * @returns {string}
		 */
		const getVariableValue = (variableId) => {
			const result = this.parseVariables(`$(${variableId})`, injectedVariableValues)

			for (const id of result.variableIds) {
				referencedVariableIds.add(id)
			}

			return result.text
		}

		const functions = {
			...ExpressionFunctions,
			/**
			 * @param {string} str
			 * @returns {string}
			 */
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

	/**
	 * @param {string} _id
	 * @param {string} label
	 * @returns {void}
	 */
	forgetConnection(_id, label) {
		if (label !== undefined) {
			const valuesForLabel = this.#variableValues[label]
			if (valuesForLabel !== undefined) {
				const removed_variables = new Set()
				for (let variable in valuesForLabel) {
					valuesForLabel[variable] = undefined
					removed_variables.add(`${label}:${variable}`)
				}
				this.#emitVariablesChanged(removed_variables)
			}

			delete this.#variableDefinitions[label]
			delete this.#variableValues[label]

			if (this.io.countRoomMembers(VariableDefinitionsRoom) > 0) {
				this.io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', label, null)
			}
		}
	}

	/**
	 * @param {string} labelFrom
	 * @param {string} labelTo
	 * @returns {void}
	 */
	connectionLabelRename(labelFrom, labelTo) {
		const valuesTo = this.#variableValues[labelTo] || {}
		this.#variableValues[labelTo] = valuesTo

		// Trigger any renames inside of the controls
		this.controls.renameVariables(labelFrom, labelTo)

		// Move variable values, and track the 'diff'
		const valuesFrom = this.#variableValues[labelFrom]
		if (valuesFrom !== undefined) {
			const all_changed_variables_set = new Set()

			for (let variable in valuesFrom) {
				valuesTo[variable] = valuesFrom[variable]
				delete valuesFrom[variable]

				all_changed_variables_set.add(`${labelFrom}:${variable}`)
				all_changed_variables_set.add(`${labelTo}:${variable}`)
			}

			delete this.#variableValues[labelFrom]
			this.#emitVariablesChanged(all_changed_variables_set)
		}

		// Update the instance definitions
		if (this.#variableDefinitions[labelFrom] !== undefined) {
			this.#variableDefinitions[labelTo] = this.#variableDefinitions[labelFrom]
			delete this.#variableDefinitions[labelFrom]

			if (this.io.countRoomMembers(VariableDefinitionsRoom) > 0) {
				this.io.emitToRoom(
					VariableDefinitionsRoom,
					'variable-definitions:update',
					labelTo,
					this.#variableDefinitions[labelTo]
				)
				this.io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', labelFrom, null)
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 * @returns {void}
	 */
	clientConnect(client) {
		this.custom.clientConnect(client)

		client.onPromise('variable-definitions:subscribe', () => {
			client.join(VariableDefinitionsRoom)

			return this.#variableDefinitions
		})

		client.onPromise('variable-definitions:unsubscribe', () => {
			client.leave(VariableDefinitionsRoom)
		})

		client.onPromise('variables:instance-values', (/** @type {string} */ label) => {
			return this.#variableValues[label]
		})
	}

	/**
	 * Set the variable definitions for an instance
	 * @access public
	 * @param {string} instance_label
	 * @param {import('./Wrapper.js').VariableDefinitionTmp[]} variables
	 * @returns {void}
	 */
	setVariableDefinitions(instance_label, variables) {
		this.logger.silly('got instance variable definitions for ' + instance_label)

		/** @type {import('../Shared/Model/Variables.js').ModuleVariableDefinitions} */
		const variablesObj = {}
		for (const variable of variables || []) {
			// Prune out the name
			/** @type {import('../Shared/Model/Variables.js').VariableDefinition} */
			const newVarObj = {
				label: variable.label,
			}

			variablesObj[variable.name] = newVarObj
		}

		const variablesBefore = this.#variableDefinitions[instance_label]
		this.#variableDefinitions[instance_label] = variablesObj

		if (this.io.countRoomMembers(VariableDefinitionsRoom) > 0) {
			if (!variablesBefore) {
				this.io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', instance_label, variablesObj)
			} else {
				const patch = jsonPatch.compare(variablesBefore, variablesObj || {})
				if (patch.length > 0) {
					this.io.emitToRoom(VariableDefinitionsRoom, 'variable-definitions:update', instance_label, patch)
				}
			}
		}
	}

	/**
	 * @param {string} label
	 * @param {Record<string, import('@companion-module/base').CompanionVariableValue | undefined>} variables
	 * @returns {void}
	 */
	setVariableValues(label, variables) {
		const moduleValues = this.#variableValues[label] ?? {}
		this.#variableValues[label] = moduleValues

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

	/**
	 * @param {Set<string>} all_changed_variables_set
	 * @returns {void}
	 */
	#emitVariablesChanged(all_changed_variables_set) {
		try {
			if (all_changed_variables_set.size > 0) {
				this.internalModule.variablesChanged(all_changed_variables_set)
				this.controls.onVariablesChanged(all_changed_variables_set)
				this.instance.moduleHost.onVariablesChanged(all_changed_variables_set)
				this.preview.onVariablesChanged(all_changed_variables_set)
			}
		} catch (e) {
			this.logger.error(`Failed to process variables update: ${e}`)
		}
	}
}

export default InstanceVariable
