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

import EventEmitter from 'node:events'
import z from 'zod'
import { BANNED_PROPS } from '@companion-app/shared/Expression/ExpressionResolve.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { stringifyVariableValue, type VariableValue } from '@companion-app/shared/Model/Variables.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { VariableValueData } from './Util.js'
import { ThisLocationVariablesSet, VariablesAndExpressionParser } from './VariablesAndExpressionParser.js'
import { VariablesBlinker } from './VariablesBlinker.js'

export interface VariablesValuesEvents {
	variables_changed: [changed: ReadonlySet<string>, connection_labels: ReadonlySet<string>]
	local_variables_changed: [changed: ReadonlySet<string>, fromControlId: string]
}

export class VariablesValues extends EventEmitter<VariablesValuesEvents> {
	readonly #logger = LogController.createLogger('Variables/Values')

	readonly #blinker: VariablesBlinker
	#variableValues: VariableValueData = Object.create(null)

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

	createStandaloneParser(
		surfaceId: string | undefined,
		localValues: ControlEntityInstance[] | null
	): VariablesAndExpressionParser {
		return VariablesAndExpressionParser.forControl(this.#blinker, this.#variableValues, null, surfaceId, localValues)
	}

	createParserForControl(
		controlLocation: ControlLocation | null | undefined,
		surfaceId: string | undefined,
		localValues: ControlEntityInstance[] | null
	): VariablesAndExpressionParser {
		return VariablesAndExpressionParser.forControl(
			this.#blinker,
			this.#variableValues,
			controlLocation,
			surfaceId,
			localValues
		)
	}

	createParserForSurface(surfaceId: string, surfacePageNumber: string | undefined): VariablesAndExpressionParser {
		return VariablesAndExpressionParser.forSurface(
			this.#blinker,
			this.#variableValues,
			surfaceId,
			surfacePageNumber,
			null
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
		if (labelFrom === labelTo) return

		const valuesTo = this.#variableValues[labelTo] || Object.create(null)
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
		if (variables.length === 0) return

		const moduleValues = this.#variableValues[label] ?? Object.create(null)
		this.#variableValues[label] = moduleValues

		const all_changed_variables_set = new Set<string>()
		const connection_labels = new Set<string>()
		for (const variable of variables) {
			if (BANNED_PROPS.has(variable.id)) continue
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

	triggerLocationVariablesChange(controlId: string): void {
		this.emit('local_variables_changed', ThisLocationVariablesSet, controlId)
	}
}

export interface VariableValueEntry {
	id: string
	value: VariableValue | undefined
}
