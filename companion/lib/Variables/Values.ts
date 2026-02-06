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
import type { VariableValueData, VariablesCache } from './Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	stringifyVariableValue,
	type VariableValue,
	type VariableValues,
} from '@companion-app/shared/Model/Variables.js'
import { router, publicProcedure } from '../UI/TRPC.js'
import z from 'zod'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import { VariablesAndExpressionParser } from './VariablesAndExpressionParser.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { VariablesBlinker } from './VariablesBlinker.js'

export interface VariablesValuesEvents {
	variables_changed: [changed: ReadonlySet<string>, connection_labels: ReadonlySet<string>]
	local_variables_changed: [changed: ReadonlySet<string>, fromControlId: string]
}

export class VariablesValues extends EventEmitter<VariablesValuesEvents> {
	readonly #logger = LogController.createLogger('Variables/Values')

	readonly #blinker: VariablesBlinker
	#variableValues: VariableValueData = {}

	constructor() {
		super()

		this.#blinker = new VariablesBlinker((values) => {
			this.setVariableValues('internal', values)
		})
	}

	getVariableValue(label: string, name: string): VariableValue | undefined {
		if (label === 'internal' && name.substring(0, 7) == 'custom_') {
			label = 'custom'
			name = name.substring(7)
		}

		return this.#variableValues[label]?.[name]
	}

	getCustomVariableValue(name: string): VariableValue | undefined {
		return this.getVariableValue('custom', name)
	}

	createVariablesAndExpressionParser(
		controlLocation: ControlLocation | null | undefined,
		localValues: ControlEntityInstance[] | null,
		overrideVariableValues: VariableValues | null
	): VariablesAndExpressionParser {
		const thisValues: VariablesCache = new Map()
		this.addInjectedVariablesForLocation(thisValues, controlLocation)

		return new VariablesAndExpressionParser(
			this.#blinker,
			this.#variableValues,
			thisValues,
			localValues,
			overrideVariableValues
		)
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

	createTrpcRouter() {
		return router({
			connection: publicProcedure
				.input(
					z.object({
						label: z.string(),
					})
				)
				.query(({ input }) => {
					return this.#variableValues[input.label]
				}),
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
					this.#logger.silly(`Variable $(${label}:${variable.id}) is "${stringifyVariableValue(variable.value)}"`)
				}
			}
		}
		connection_labels.add(label)

		this.#emitVariablesChanged(all_changed_variables_set, connection_labels)
	}

	#emitVariablesChanged(all_changed_variables_set: ReadonlySet<string>, connection_labels: ReadonlySet<string>) {
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
	addInjectedVariablesForLocation(values: VariablesCache, location: ControlLocation | null | undefined): void {
		values.set('$(this:page)', location?.pageNumber)
		values.set('$(this:column)', location?.column)
		values.set('$(this:row)', location?.row)
		values.set('$(this:location)', location ? formatLocation(location) : undefined)

		// Reactivity happens for these because of references to the inner variables
		values.set(
			'$(this:page_name)',
			location ? `$(internal:page_number_${location.pageNumber}_name)` : VARIABLE_UNKNOWN_VALUE
		)
		// values.set(
		// 	'$(this:pushed)',
		// 	location
		// 		? `$(internal:b_pushed_${location.pageNumber}_${location.row}_${location.column})`
		// 		: VARIABLE_UNKNOWN_VALUE
		// )
		values.set(
			'$(this:step)',
			location ? `$(internal:b_step_${location.pageNumber}_${location.row}_${location.column})` : VARIABLE_UNKNOWN_VALUE
		)
		values.set(
			'$(this:step_count)',
			location
				? `$(internal:b_step_count_${location.pageNumber}_${location.row}_${location.column})`
				: VARIABLE_UNKNOWN_VALUE
		)

		// values.set(
		// 	'$(this:actions_running)',
		// 	location
		// 		? `$(internal:b_actions_running_${location.pageNumber}_${location.row}_${location.column})`
		// 		: VARIABLE_UNKNOWN_VALUE
		// )
		// values.set(
		// 	'$(this:button_status)',
		// 	location
		// 		? `$(internal:b_status_${location.pageNumber}_${location.row}_${location.column})`
		// 		: VARIABLE_UNKNOWN_VALUE
		// )
	}
}

export interface VariableValueEntry {
	id: string
	value: VariableValue | undefined
}
