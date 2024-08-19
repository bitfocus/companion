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

export const VARIABLE_UNKNOWN_VALUE = '$NA'

// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
const VARIABLE_REGEX = /\$\(([^:$)]+):([^)$]+)\)/

const logger = LogController.createLogger('Variables/Util')

/**
 * @typedef {Record<string, Record<string, import('@companion-module/base').CompanionVariableValue | undefined> | undefined>} VariableValueData
 * @typedef {Record<string, import('@companion-module/base').CompanionVariableValue | undefined>} VariablesCache
 * @typedef {{ text: string, variableIds: string[] }} ParseVariablesResult
 */

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

	let matchCount = 0
	let matches
	while ((matches = VARIABLE_REGEX.exec(string))) {
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
				cachedValue = VARIABLE_UNKNOWN_VALUE
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

/**
 * Replace all the variables in a string, to reference a new label
 * @param {string} string
 * @param {string} newLabel
 * @returns {string}
 */
export function replaceAllVariables(string, newLabel) {
	if (string && string.includes('$(')) {
		let matchCount = 0
		let matches
		let fromIndex = 0
		while ((matches = VARIABLE_REGEX.exec(string.slice(fromIndex))) !== null) {
			if (matchCount++ > 100) {
				// nocommit was 100
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
 * @param {string} str - String containing the expression to parse
 * @param {VariableValueData} rawVariableValues
 * @param {string=} requiredType - Fail if the result is not of specified type
 * @param {import('@companion-module/base').CompanionVariableValues=} injectedVariableValues - Inject some variable values
 * @returns {{ value: boolean|number|string|undefined, variableIds: Set<string> }} result of the expression
 */
export function executeExpression(str, rawVariableValues, requiredType, injectedVariableValues) {
	/** @type {Set<string>} */
	const referencedVariableIds = new Set()

	/**
	 * @param {string} variableId
	 * @returns {string}
	 */
	const getVariableValue = (variableId) => {
		const result = parseVariablesInString(`$(${variableId})`, rawVariableValues, injectedVariableValues)

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
