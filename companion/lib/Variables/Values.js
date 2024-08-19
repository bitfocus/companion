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
import EventEmitter from 'events'
import { VARIABLE_UNKNOWN_VALUE, executeExpression, parseVariablesInString } from './Util.js'

export class VariablesValues extends EventEmitter {
	/**
	 * @access private
	 * @readonly
	 */
	#logger = LogController.createLogger('Variables/Values')

	/**
	 * @type {import('./Util.js').VariableValueData}
	 */
	#variableValues = {}

	/**
	 */
	constructor() {
		super()
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
	 * @param {import('@companion-app/shared/Model/Common.js').ControlLocation | null | undefined} controlLocation - Location of the control
	 * @param {import('./Util.js').VariablesCache=} injectedVariableValues - Inject some variable values
	 * @returns {import('./Util.js').ParseVariablesResult} with variables replaced with values
	 */
	parseVariables(str, controlLocation, injectedVariableValues) {
		const injectedVariableValuesComplete = {
			...this.#getInjectedVariablesForLocation(controlLocation),
			...injectedVariableValues,
		}
		return parseVariablesInString(str, this.#variableValues, injectedVariableValuesComplete)
	}

	/**
	 * Parse and execute an expression in a string
	 * @param {string} str - String containing the expression to parse
	 * @param {import('@companion-app/shared/Model/Common.js').ControlLocation | null | undefined} controlLocation - Location of the control
	 * @param {string=} requiredType - Fail if the result is not of specified type
	 * @param {import('@companion-module/base').CompanionVariableValues=} injectedVariableValues - Inject some variable values
	 * @returns {{ value: boolean|number|string|undefined, variableIds: Set<string> }} result of the expression
	 */
	executeExpression(str, controlLocation, requiredType, injectedVariableValues) {
		const injectedVariableValuesComplete = {
			...this.#getInjectedVariablesForLocation(controlLocation),
			...injectedVariableValues,
		}

		return executeExpression(str, this.#variableValues, requiredType, injectedVariableValuesComplete)
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

			delete this.#variableValues[label]
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
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 * @returns {void}
	 */
	clientConnect(client) {
		client.onPromise('variables:instance-values', (label) => {
			return this.#variableValues[label]
		})
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
				if (this.#logger.isSillyEnabled() && !(label === 'internal' && variable.startsWith('time_'))) {
					this.#logger.silly('Variable $(' + label + ':' + variable + ') is "' + value + '"')
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
				this.emit('variables_changed', all_changed_variables_set)
			}
		} catch (e) {
			this.#logger.error(`Failed to process variables update: ${e}`)
		}
	}

	/**
	 * Variables to inject based on location
	 * @param {import('@companion-app/shared/Model/Common.js').ControlLocation | null | undefined} location
	 * @returns {import('@companion-module/base').CompanionVariableValues}
	 */
	#getInjectedVariablesForLocation(location) {
		return {
			'$(this:page)': location?.pageNumber,
			'$(this:column)': location?.column,
			'$(this:row)': location?.row,
			// Reactivity happens for these because of references to the inner variables
			'$(this:page_name)': location ? `$(internal:page_number_${location.pageNumber}_name)` : VARIABLE_UNKNOWN_VALUE,
			'$(this:step)': location
				? `$(internal:b_step_${location.pageNumber}_${location.row}_${location.column})`
				: VARIABLE_UNKNOWN_VALUE,
		}
	}
}
