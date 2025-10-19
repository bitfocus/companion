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
import { ExpressionFunctions } from '@companion-app/shared/Expression/ExpressionFunctions.js'
import { GetVariableValueProps, ResolveExpression } from '@companion-app/shared/Expression/ExpressionResolve.js'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type { CompanionVariableValue } from '@companion-module/base'
import type { ReadonlyDeep } from 'type-fest'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'

// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
const VARIABLE_REGEX = /\$\(([^:$)]+):([^)$]+)\)/

const logger = LogController.createLogger('Variables/Util')

export type VariableValueData = Record<string, Record<string, CompanionVariableValue | undefined> | undefined>
export type VariablesCache = Map<string, CompanionVariableValue | undefined>
export interface ParseVariablesResult {
	text: string
	variableIds: Set<string>
}

export function parseVariablesInString(
	string: CompanionVariableValue,
	rawVariableValues: VariableValueData,
	cachedVariableValues: VariableValueCache,
	undefinedValue: string
): ParseVariablesResult {
	if (string === undefined || string === null || string === '') {
		return {
			text: string,
			variableIds: new Set(),
		}
	}
	if (typeof string !== 'string') string = `${string}`

	const referencedVariableIds = new Set<string>()

	let matchCount = 0
	let matches: RegExpExecArray | null
	while ((matches = VARIABLE_REGEX.exec(string))) {
		if (matchCount++ > 100) {
			// Crudely avoid infinite loops with an iteration limit
			logger.info(`Reached iteration limit for variable parsing`)
			break
		}

		const fullId = matches[0]
		let connectionLabel = matches[1]
		let variableId = matches[2]

		if (connectionLabel === 'internal' && variableId.substring(0, 7) === 'custom_') {
			connectionLabel = 'custom'
			variableId = variableId.substring(7)
		}

		referencedVariableIds.add(`${connectionLabel}:${variableId}`)

		let value: CompanionVariableValue | undefined
		if (cachedVariableValues.has(fullId)) {
			const cachedValue = cachedVariableValues.get(fullId)

			if (typeof cachedValue === 'function') {
				// Value is being lazy evaluated
				value = cachedValue()
				cachedVariableValues.set(fullId, value)
			} else {
				value = cachedValue
			}
		} else {
			// Set a temporary value, to stop the recursion going deep
			cachedVariableValues.set(fullId, '$RE')

			// Fetch the raw value, and parse variables inside of it
			const rawValue = rawVariableValues[connectionLabel]?.[variableId]
			if (rawValue !== undefined) {
				const result = parseVariablesInString(rawValue, rawVariableValues, cachedVariableValues, undefinedValue)
				value = result.text

				for (const id of result.variableIds) {
					referencedVariableIds.add(id)
				}
			} else {
				// Variable has no value
				value = undefinedValue
			}

			cachedVariableValues.set(fullId, value)
		}

		if (value === undefined) value = undefinedValue

		// Pass a function, to avoid special interpreting of `$$` and other sequences
		const cachedValueConst = value?.toString()
		string = string.replace(fullId, () => cachedValueConst)
	}

	return {
		text: string,
		variableIds: referencedVariableIds,
	}
}

/**
 * Replace all the variables in a string, to reference a new label
 */
export function replaceAllVariables(string: string, newLabel: string): string {
	if (string && string.includes('$(')) {
		let matchCount = 0
		let matches: RegExpExecArray | null
		let fromIndex = 0
		while ((matches = VARIABLE_REGEX.exec(string.slice(fromIndex))) !== null) {
			if (matchCount++ > 100) {
				// Crudely avoid infinite loops with an iteration limit
				// logger.info(`Reached iteration limit for variable parsing`)
				break
			}

			// ensure we don't try and match the same thing again
			fromIndex = matches.index + fromIndex + 1

			if (matches[2] !== undefined) {
				string = string.replace(matches[0], `$(${newLabel}:${matches[2]})`)
			}
		}
	}

	return string
}

/**
 * A view of a simple cache for variable values, allowing for lazy evaluation and writing back of lazily computed values
 */
export interface VariableValueCache {
	has(id: string): boolean
	get(id: string): CompanionVariableValue | (() => CompanionVariableValue | undefined) | undefined
	set(id: string, value: CompanionVariableValue | undefined): void
}

/**
 * Parse and execute an expression in a string
 * @param str - String containing the expression to parse
 * @param rawVariableValues
 * @param requiredType - Fail if the result is not of specified type
 * @param cachedVariableValues - Inject some variable values
 */
export function executeExpression(
	str: string,
	rawVariableValues: ReadonlyDeep<VariableValueData>,
	requiredType: string | undefined,
	cachedVariableValues: VariableValueCache
): ExecuteExpressionResult {
	const referencedVariableIds = new Set<string>()

	try {
		const getVariableValue = (props: GetVariableValueProps): CompanionVariableValue | undefined => {
			referencedVariableIds.add(props.variableId)

			const fullId = `$(${props.variableId})`
			// First check for an injected value
			let value: CompanionVariableValue | undefined
			if (cachedVariableValues.has(fullId)) {
				const rawValue = cachedVariableValues.get(fullId)!

				if (typeof rawValue === 'function') {
					// Value is being lazy evaluated
					value = rawValue()
					cachedVariableValues.set(fullId, value)
				} else {
					value = rawValue
				}
			} else {
				// No value, lookup the raw value
				if (props.label == 'internal' && props.name.substring(0, 7) === 'custom_') {
					value = rawVariableValues['custom']?.[props.name.substring(7)]
				} else {
					value = rawVariableValues[props.label]?.[props.name]
				}

				cachedVariableValues.set(fullId, value)
			}

			// If its a string, make sure any references to other variables are resolved
			if (typeof value === 'string') {
				// First check if it is a direct reference to another variable, so that the type can be preserved
				const valueMatch = value.match(VARIABLE_REGEX)
				if (valueMatch && valueMatch[0] === value) {
					return getVariableValue({
						variableId: `${valueMatch[1]}:${valueMatch[2]}`,
						label: valueMatch[1],
						name: valueMatch[2],
					})
				} else {
					// Wrap the cache, to inject $RE for this variable to avoid unbound recursion
					const wrappedCache: VariableValueCache = {
						has: (id: string) => id === fullId || cachedVariableValues.has(id),
						get: (id: string) => (id === fullId ? '$RE' : cachedVariableValues.get(id)),
						set: (id: string, val: CompanionVariableValue | undefined) => {
							if (id === fullId) return

							cachedVariableValues.set(id, val)
						},
					}

					// Fallback to parsing the string
					const parsedValue = parseVariablesInString(value, rawVariableValues, wrappedCache, VARIABLE_UNKNOWN_VALUE)
					value = parsedValue.text

					for (const id of parsedValue.variableIds) {
						referencedVariableIds.add(id)
					}
				}
			}

			return value
		}

		const functions = {
			...ExpressionFunctions,
			parseVariables: (str: string, undefinedValue?: string): string => {
				const result = parseVariablesInString(
					str,
					rawVariableValues,
					cachedVariableValues,
					typeof undefinedValue === 'string' ? undefinedValue : VARIABLE_UNKNOWN_VALUE
				)

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
			return {
				ok: false,
				error: 'Unexpected return type',
				variableIds: referencedVariableIds,
			}
		}

		return {
			ok: true,
			value,
			variableIds: referencedVariableIds,
		}
	} catch (e: any) {
		return {
			ok: false,
			error: e?.message ?? 'Unknown error',
			variableIds: referencedVariableIds,
		}
	}
}
