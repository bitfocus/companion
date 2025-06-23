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
import EventEmitter from 'events'
import {
	ExecuteExpressionResult,
	ParseVariablesResult,
	VARIABLE_UNKNOWN_VALUE,
	VariableValueData,
	VariablesCache,
	executeExpression,
	parseVariablesInString,
} from './Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'
import type { ClientSocket } from '../UI/Handler.js'

export interface VariablesValuesEvents {
	variables_changed: [changed: Set<string>, connection_labels: Set<string>]
}

export class VariablesValues extends EventEmitter<VariablesValuesEvents> {
	readonly #logger = LogController.createLogger('Variables/Values')

	#variableValues: VariableValueData = {}

	getVariableValue(label: string, name: string): CompanionVariableValue | undefined {
		if (label === 'internal' && name.substring(0, 7) == 'custom_') {
			label = 'custom'
			name = name.substring(7)
		}

		return this.#variableValues[label]?.[name]
	}

	getCustomVariableValue(name: string): CompanionVariableValue | undefined {
		return this.getVariableValue('custom', name)
	}

	getVariableDefinitions(label: string): string[] | undefined {
		if (this.#variableValues[label] == undefined) return undefined
		return Object.keys(this.#variableValues[label])
	}

	/**
	 * Parse the variables in a string
	 * @param str - String to parse variables in
	 * @param controlLocation - Location of the control
	 * @param injectedVariableValues - Inject some variable values
	 * @returns with variables replaced with values
	 */
	parseVariables(
		str: string,
		controlLocation: ControlLocation | null | undefined,
		injectedVariableValues?: VariablesCache
	): ParseVariablesResult {
		const injectedVariableValuesComplete = {
			...this.#getInjectedVariablesForLocation(controlLocation),
			...injectedVariableValues,
		}
		return parseVariablesInString(str, this.#variableValues, injectedVariableValuesComplete)
	}

	/**
	 * Parse and execute an expression in a string
	 * @param str - String containing the expression to parse
	 * @param controlLocation - Location of the control
	 * @param requiredType - Fail if the result is not of specified type
	 * @param injectedVariableValues - Inject some variable values
	 * @returns result of the expression
	 */
	executeExpression(
		str: string,
		controlLocation: ControlLocation | null | undefined,
		requiredType?: string,
		injectedVariableValues?: CompanionVariableValues
	): ExecuteExpressionResult {
		const injectedVariableValuesComplete = {
			...this.#getInjectedVariablesForLocation(controlLocation),
			...injectedVariableValues,
		}

		return executeExpression(str, this.#variableValues, requiredType, injectedVariableValuesComplete)
	}

	forgetConnection(_id: string, label: string): void {
		if (label !== undefined) {
			const valuesForLabel = this.#variableValues[label]
			if (valuesForLabel !== undefined) {
				const removed_variables = new Set<string>()
				const removed_variable_connection = new Set<string>()
				for (const variable in valuesForLabel) {
					valuesForLabel[variable] = undefined
					removed_variables.add(`${label}:${variable}`)
				}
				removed_variable_connection.add(label)
				this.#emitVariablesChanged(removed_variables, removed_variable_connection)
			}

			delete this.#variableValues[label]
		}
	}

	connectionLabelRename(labelFrom: string, labelTo: string): void {
		const valuesTo = this.#variableValues[labelTo] || {}
		this.#variableValues[labelTo] = valuesTo

		// Move variable values, and track the 'diff'
		const valuesFrom = this.#variableValues[labelFrom]
		if (valuesFrom !== undefined) {
			const all_changed_variables_set = new Set<string>()
			const connection_labels = new Set<string>()

			for (const variable in valuesFrom) {
				valuesTo[variable] = valuesFrom[variable]
				delete valuesFrom[variable]

				all_changed_variables_set.add(`${labelFrom}:${variable}`)
				all_changed_variables_set.add(`${labelTo}:${variable}`)
			}
			connection_labels.add(labelFrom)
			connection_labels.add(labelTo)
			delete this.#variableValues[labelFrom]
			this.#emitVariablesChanged(all_changed_variables_set, connection_labels)
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('variables:connection-values', (label) => {
			return this.#variableValues[label]
		})
	}

	setVariableValues(label: string, variables: VariableValueEntry[]): void {
		const moduleValues = this.#variableValues[label] ?? {}
		this.#variableValues[label] = moduleValues

		const all_changed_variables_set = new Set<string>()
		const connection_labels = new Set<string>()
		for (const variable of variables) {
			if (moduleValues[variable.id] !== variable.value) {
				moduleValues[variable.id] = variable.value

				all_changed_variables_set.add(`${label}:${variable.id}`)

				// Also report the old custom variable names as having changed
				if (label === 'custom') {
					all_changed_variables_set.add(`internal:custom_${variable.id}`)
				}

				// Skip debug if it's just internal:time_* spamming.
				if (this.#logger.isSillyEnabled() && !(label === 'internal' && variable.id.startsWith('time_'))) {
					this.#logger.silly('Variable $(' + label + ':' + variable.id + ') is "' + variable.value + '"')
				}
			}
		}
		connection_labels.add(label)

		this.#emitVariablesChanged(all_changed_variables_set, connection_labels)
	}

	#emitVariablesChanged(all_changed_variables_set: Set<string>, connection_labels: Set<string>) {
		try {
			if (all_changed_variables_set.size > 0) {
				this.emit('variables_changed', all_changed_variables_set, connection_labels)
			}
		} catch (e) {
			this.#logger.error(`Failed to process variables update: ${e}`)
		}
	}

	/**
	 * Variables to inject based on location
	 */
	#getInjectedVariablesForLocation(location: ControlLocation | null | undefined): CompanionVariableValues {
		return {
			'$(this:page)': location?.pageNumber,
			'$(this:column)': location?.column,
			'$(this:row)': location?.row,
			// Reactivity happens for these because of references to the inner variables
			'$(this:page_name)': location ? `$(internal:page_number_${location.pageNumber}_name)` : VARIABLE_UNKNOWN_VALUE,
			'$(this:step)': location
				? `$(internal:b_step_${location.pageNumber}_${location.row}_${location.column})`
				: VARIABLE_UNKNOWN_VALUE,
			'$(this:step_count)': location
				? `$(internal:b_step_count_${location.pageNumber}_${location.row}_${location.column})`
				: VARIABLE_UNKNOWN_VALUE,
		}
	}
}

export interface VariableValueEntry {
	id: string
	value: CompanionVariableValue | undefined
}
