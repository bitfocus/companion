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
import { VARIABLE_UNKNOWN_VALUE, VariableValueData, VariablesCache } from './Util.js'
import { VariablesAndExpressionParser } from './VariablesAndExpressionParser.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'
import type { ClientSocket } from '../UI/Handler.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'

interface VariablesValuesEvents {
	variables_changed: [changed: Map<string, VariableUpdateReason>]
	local_variables_changed: [changed: Map<string, VariableUpdateReason>, fromControlId: string]
}

export interface VariableUpdateReason {
	// The controlId that triggered the update
	controlId: string | null
	// Track the variables that have changed in this update, to ensure we don't trigger a loop
	changeSourceVariables: string[]
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

	createVariablesAndExpressionParser(
		controlLocation: ControlLocation | null | undefined,
		localValues: ControlEntityInstance[] | null,
		overrideVariableValues: CompanionVariableValues | null
	): VariablesAndExpressionParser {
		const thisValues: VariablesCache = new Map()
		this.addInjectedVariablesForLocation(thisValues, controlLocation)

		return new VariablesAndExpressionParser(this.#variableValues, thisValues, localValues, overrideVariableValues)
	}

	forgetConnection(_id: string, label: string): void {
		if (label !== undefined) {
			const updateReason: VariableUpdateReason = {
				controlId: null,
				changeSourceVariables: [],
			}

			const valuesForLabel = this.#variableValues[label]
			if (valuesForLabel !== undefined) {
				const removed_variables = new Map<string, VariableUpdateReason>()
				for (let variable in valuesForLabel) {
					valuesForLabel[variable] = undefined
					removed_variables.set(`${label}:${variable}`, updateReason)
				}
				this.#emitVariablesChanged(removed_variables)
			}

			delete this.#variableValues[label]
		}
	}

	connectionLabelRename(labelFrom: string, labelTo: string): void {
		const valuesTo = this.#variableValues[labelTo] || {}
		this.#variableValues[labelTo] = valuesTo

		const updateReason: VariableUpdateReason = {
			controlId: null,
			changeSourceVariables: [],
		}

		// Move variable values, and track the 'diff'
		const valuesFrom = this.#variableValues[labelFrom]
		if (valuesFrom !== undefined) {
			const all_changed_variables_set = new Map<string, VariableUpdateReason>()

			for (let variable in valuesFrom) {
				valuesTo[variable] = valuesFrom[variable]
				delete valuesFrom[variable]

				all_changed_variables_set.set(`${labelFrom}:${variable}`, updateReason)
				all_changed_variables_set.set(`${labelTo}:${variable}`, updateReason)
			}

			delete this.#variableValues[labelFrom]
			this.#emitVariablesChanged(all_changed_variables_set)
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

	setVariableValues(label: string, variables: Record<string, CompanionVariableValue | undefined>): void {
		const moduleValues = this.#variableValues[label] ?? {}
		this.#variableValues[label] = moduleValues

		const updateReason: VariableUpdateReason = {
			controlId: null,
			changeSourceVariables: [],
		}

		const all_changed_variables_set = new Map<string, VariableUpdateReason>()
		for (const variable in variables) {
			// Note: explicitly using for-in here, as Object.entries is slow
			const value = variables[variable]

			if (moduleValues[variable] !== value) {
				moduleValues[variable] = value

				all_changed_variables_set.set(`${label}:${variable}`, updateReason)
				// Also report the old custom variable names as having changed
				if (label === 'custom') all_changed_variables_set.set(`internal:custom_${variable}`, updateReason)

				// Skip debug if it's just internal:time_* spamming.
				if (this.#logger.isSillyEnabled() && !(label === 'internal' && variable.startsWith('time_'))) {
					this.#logger.silly('Variable $(' + label + ':' + variable + ') is "' + value + '"')
				}
			}
		}

		this.#emitVariablesChanged(all_changed_variables_set)
	}

	#emitVariablesChanged(all_changed_variables_set: Map<string, VariableUpdateReason>) {
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
	 */
	addInjectedVariablesForLocation(values: VariablesCache, location: ControlLocation | null | undefined): void {
		values.set('$(this:page)', location?.pageNumber)
		values.set('$(this:column)', location?.column)
		values.set('$(this:row)', location?.row)

		// Reactivity happens for these because of references to the inner variables
		values.set(
			'$(this:page_name)',
			location ? `$(internal:page_number_${location.pageNumber}_name)` : VARIABLE_UNKNOWN_VALUE
		)
		values.set(
			'$(this:step)',
			location ? `$(internal:b_step_${location.pageNumber}_${location.row}_${location.column})` : VARIABLE_UNKNOWN_VALUE
		)
	}
}
