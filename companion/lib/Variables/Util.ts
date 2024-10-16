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
import { ExpressionFunctions } from '@companion-app/shared/Expression/ExpressionFunctions.js'
import { ResolveExpression } from '@companion-app/shared/Expression/ExpressionResolve.js'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import { SplitVariableId } from '../Resources/Util.js'
import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'

export const VARIABLE_UNKNOWN_VALUE = '$NA'

// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
const VARIABLE_REGEX = /\$\(([^:$)]+):([^)$]+)\)/

const logger = LogController.createLogger('Variables/Util')

export type VariableValueData = Record<string, Record<string, CompanionVariableValue | undefined> | undefined>
export type VariablesCache = Record<string, CompanionVariableValue | undefined>
export interface ParseVariablesResult {
	text: string
	variableIds: string[]
}
export interface ExecuteExpressionResult {
	value: boolean | number | string | undefined
	variableIds: Set<string>
}

export function parseVariablesInString(
	string: CompanionVariableValue,
	rawVariableValues: VariableValueData,
	cachedVariableValues: VariablesCache = {}
): ParseVariablesResult {
	if (string === undefined || string === null || string === '') {
		return {
			text: string,
			variableIds: [],
		}
	}
	if (typeof string !== 'string') string = `${string}`

	const referencedVariableIds: string[] = []

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
				cachedValue = VARIABLE_UNKNOWN_VALUE
			}

			cachedVariableValues[fullId] = cachedValue
		}

		// Pass a function, to avoid special interpreting of `$$` and other sequences
		const cachedValueConst = cachedValue?.toString()
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
 * Parse and execute an expression in a string
 * @param str - String containing the expression to parse
 * @param rawVariableValues
 * @param requiredType - Fail if the result is not of specified type
 * @param injectedVariableValues - Inject some variable values
 */
export function executeExpression(
	str: string,
	rawVariableValues: VariableValueData,
	requiredType?: string,
	injectedVariableValues?: CompanionVariableValues
): ExecuteExpressionResult {
	const referencedVariableIds = new Set<string>()

	const getVariableValue = (variableId: string): CompanionVariableValue => {
		referencedVariableIds.add(variableId)

		// First check for an injected value
		let value = injectedVariableValues?.[`$(${variableId})`]
		if (value === undefined) {
			// No value, lookup the raw value
			const [connectionLabel, variableName] = SplitVariableId(variableId)
			if (connectionLabel == 'internal' && variableName.substring(0, 7) === 'custom_') {
				value = rawVariableValues['custom']?.[variableName.substring(7)]
			} else {
				value = rawVariableValues[connectionLabel]?.[variableName]
			}
		}

		// If its a string, make sure any references to other variables are resolved
		if (typeof value === 'string') {
			// First check if it is a direct reference to another variable, so that the type can be preserved
			const valueMatch = value.match(VARIABLE_REGEX)
			if (valueMatch && valueMatch[0] === value) {
				return getVariableValue(`${valueMatch[1]}:${valueMatch[2]}`)
			} else {
				// Fallback to parsing the string
				const parsedValue = parseVariablesInString(value, rawVariableValues, injectedVariableValues)
				value = parsedValue.text

				for (const id of parsedValue.variableIds) {
					referencedVariableIds.add(id)
				}
			}
		}

		// Make sure to return a value, even if its undefined
		if (value === undefined) return VARIABLE_UNKNOWN_VALUE

		return value
	}

	const functions = {
		...ExpressionFunctions,
		parseVariables: (str: string): string => {
			const result = parseVariablesInString(str, rawVariableValues, injectedVariableValues)

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
