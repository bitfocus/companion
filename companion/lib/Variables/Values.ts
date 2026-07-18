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
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ThisLocationVariable, ThisPageVariable } from '@companion-app/shared/ControlLocation.js'
import { BANNED_PROPS } from '@companion-app/shared/Expressions.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	stringifyVariableValue,
	type VariableValue,
	type VariableValues,
} from '@companion-app/shared/Model/Variables.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { VariablesCache, VariableValueData } from './Util.js'
import { VariablesAndExpressionParser } from './VariablesAndExpressionParser.js'
import { VariablesBlinker } from './VariablesBlinker.js'

export interface VariablesValuesEvents {
	/**
	 * A set of variables changed.
	 * `targetControlId` is null for a normal (global) change, or the id of the control whose local
	 * variables changed - in which case only that control need react.
	 */
	variablesChanged: [
		changed: ReadonlySet<string>,
		connectionLabels: ReadonlySet<string>,
		targetControlId: string | null,
	]
}

/** Shared empty set of connection labels, for local variable changes which have no connection */
export const NO_CONNECTION_LABELS: ReadonlySet<string> = new Set()

const ThisLocationVariables: Record<
	ThisLocationVariable,
	(location: ControlLocation | null | undefined) => VariableValue
> = {
	'this:page': (location) => location?.pageNumber,
	'this:column': (location) => location?.column,
	'this:row': (location) => location?.row,
	'this:location': (location) => (location ? formatLocation(location) : undefined),

	// The remaining variables simply delegate to internally-defined variables.
	'this:page_name': (location) =>
		location ? `$(internal:page_number_${location.pageNumber}_name)` : VARIABLE_UNKNOWN_VALUE,
	'this:active': (location) =>
		location
			? `$(internal:b_active_${location.pageNumber}_${location.row}_${location.column})`
			: VARIABLE_UNKNOWN_VALUE,

	'this:step': (location) =>
		location ? `$(internal:b_step_${location.pageNumber}_${location.row}_${location.column})` : VARIABLE_UNKNOWN_VALUE,
	'this:step_count': (location) =>
		location
			? `$(internal:b_step_count_${location.pageNumber}_${location.row}_${location.column})`
			: VARIABLE_UNKNOWN_VALUE,

	'this:actions_running': (location) =>
		location
			? `$(internal:b_actions_running_${location.pageNumber}_${location.row}_${location.column})`
			: VARIABLE_UNKNOWN_VALUE,

	'this:button_status': (location) =>
		location
			? `$(internal:b_status_${location.pageNumber}_${location.row}_${location.column})`
			: VARIABLE_UNKNOWN_VALUE,
}

const ThisLocationVariablesSet: ReadonlySet<string> = new Set(Object.keys(ThisLocationVariables))

export function InjectedVariablesForLocation(controlLocation: ControlLocation | null | undefined): VariablesCache {
	return new Map(
		Object.entries(ThisLocationVariables).map(([variableId, computeVariable]) => [
			variableId,
			computeVariable(controlLocation),
		])
	)
}

/**
 * The `this:*` variables for a page control (a page has no row/column). Keyed by {@link ThisPageVariable}
 * so it stays in lockstep with the shared type - and thus with the UI dropdown that is checked against it.
 */
const ThisPageVariables: Record<ThisPageVariable, (pageNumber: number) => VariableValue> = {
	'this:page': (pageNumber) => pageNumber,
	'this:page_name': (pageNumber) => `$(internal:page_number_${pageNumber}_name)`,
}

export const ThisPageVariablesSet: ReadonlySet<string> = new Set(Object.keys(ThisPageVariables))

export function InjectedVariablesForPage(pageNumber: number | null | undefined): VariablesCache {
	const values: VariablesCache = new Map()
	if (pageNumber != null) {
		for (const [variableId, computeVariable] of Object.entries(ThisPageVariables)) {
			values.set(variableId, computeVariable(pageNumber))
		}
	}
	return values
}

export class VariablesValues extends EventEmitter<VariablesValuesEvents> {
	readonly #logger = LogController.createLogger('Variables/Values')

	readonly #blinker: VariablesBlinker
	#variableValues: VariableValueData = Object.create(null)

	readonly #userconfig: DataUserConfig

	constructor(userconfig: DataUserConfig) {
		super()

		this.#userconfig = userconfig

		this.#blinker = new VariablesBlinker((values) => {
			this.setVariableValues('internal', values)
		})
	}

	/**
	 * Count how many variables a connection (identified by its label) currently exposes values for.
	 */
	getVariableCountForLabel(label: string): number {
		return Object.keys(this.#variableValues[label] ?? {}).length
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
		overrideVariableValues: VariableValues | null,
		pageValues: ControlEntityInstance[] | null = null
	): VariablesAndExpressionParser {
		return new VariablesAndExpressionParser(
			this.#userconfig,
			this.#blinker,
			this.#variableValues,
			InjectedVariablesForLocation(controlLocation),
			localValues,
			overrideVariableValues,
			pageValues
		)
	}

	/** Build a parser for a page control's variables - no grid location, so only `this:page`/`this:page_name` are injected. */
	createVariablesAndExpressionParserForPage(
		pageNumber: number | null | undefined,
		localValues: ControlEntityInstance[] | null,
		overrideVariableValues: VariableValues | null
	): VariablesAndExpressionParser {
		return new VariablesAndExpressionParser(
			this.#userconfig,
			this.#blinker,
			this.#variableValues,
			InjectedVariablesForPage(pageNumber),
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
				this.emit('variablesChanged', all_changed_variables_set, connection_labels, null)
			}
		} catch (e) {
			this.#logger.error(`Failed to process variables update: ${e}`)
		}
	}

	triggerLocationVariablesChange(controlId: string): void {
		this.emit('variablesChanged', ThisLocationVariablesSet, NO_CONNECTION_LABELS, controlId)
	}
}

export interface VariableValueEntry {
	id: string
	value: VariableValue | undefined
}
