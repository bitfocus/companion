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
import { assertNever, type CompanionVariableValue, type CompanionVariableValues } from '@companion-module/base'
import { ReadonlyDeep } from 'type-fest'
import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { LocalVariableEntityDefinitionType } from '../Resources/LocalVariableEntityDefinitions.js'

export const VARIABLE_UNKNOWN_VALUE = '$NA'

// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
const VARIABLE_REGEX = /\$\(([^:$)]+):([^)$]+)\)/

const logger = LogController.createLogger('Variables/Util')

export type VariableValueData = Record<string, Record<string, CompanionVariableValue | undefined> | undefined>
export type VariablesCache = Map<
	string,
	CompanionVariableValue | (() => CompanionVariableValue | undefined) | undefined
>
export interface ParseVariablesResult {
	text: string
	variableIds: Set<string>
}
export type ExecuteExpressionResult = ExecuteExpressionResultOk | ExecuteExpressionResultError
interface ExecuteExpressionResultOk {
	ok: true
	value: boolean | number | string | undefined
	variableIds: Set<string>
}
interface ExecuteExpressionResultError {
	ok: false
	error: string
	variableIds: Set<string>
}

export function parseVariablesInString(
	string: CompanionVariableValue,
	rawVariableValues: VariableValueData,
	cachedVariableValues: VariableValueCache
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
				const result = parseVariablesInString(rawValue, rawVariableValues, cachedVariableValues)
				value = result.text

				for (const id of result.variableIds) {
					referencedVariableIds.add(id)
				}
			} else {
				// Variable has no value
				value = VARIABLE_UNKNOWN_VALUE
			}

			cachedVariableValues.set(fullId, value)
		}

		if (value === undefined) value = ''

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

export class VariablesAndExpressionParser {
	readonly #rawVariableValues: ReadonlyDeep<VariableValueData>
	readonly #thisValues: VariablesCache
	readonly #localValues: VariablesCache = new Map()
	readonly #localValuesReferences = new Map<string, string[]>()
	readonly #overrideVariableValues: CompanionVariableValues

	readonly #valueCacheAccessor: VariableValueCache = {
		has: (id: string): boolean => {
			return this.#thisValues.has(id) || this.#localValues.has(id) || this.#overrideVariableValues[id] !== undefined
		},
		get: (id: string): CompanionVariableValue | (() => CompanionVariableValue | undefined) | undefined => {
			if (this.#thisValues.has(id)) return this.#thisValues.get(id)
			if (this.#localValues.has(id)) return this.#localValues.get(id)
			return this.#overrideVariableValues[id]
		},
		set: (id: string, value: CompanionVariableValue | undefined): void => {
			this.#localValues.set(id, value)
		},
	}

	constructor(
		rawVariableValues: ReadonlyDeep<VariableValueData>,
		thisValues: VariablesCache,
		localValues: SomeEntityModel[] | null,
		overrideVariableValues: CompanionVariableValues | null
	) {
		this.#rawVariableValues = rawVariableValues
		this.#thisValues = thisValues
		this.#overrideVariableValues = overrideVariableValues || {}

		if (localValues) this.#bindLocalVariables(localValues)
	}

	#bindLocalVariables(variables: SomeEntityModel[]) {
		for (const variable of variables) {
			if (variable.type !== EntityModelType.LocalVariable || variable.connectionId !== 'internal') continue
			if (!variable.options.name) continue

			const fullId = `$(local:${variable.options.name})`

			const definitionId = variable.definitionId as LocalVariableEntityDefinitionType
			switch (definitionId) {
				case LocalVariableEntityDefinitionType.ConstantValue: {
					// Store the value directly
					this.#localValues.set(fullId, variable.options.value)
					break
				}
				case LocalVariableEntityDefinitionType.DynamicExpression: {
					let computedResult: CompanionVariableValue | undefined = undefined

					const expression = variable.options.expression
					this.#localValues.set(fullId, () => {
						if (computedResult !== undefined) return computedResult

						// make sure we don't get stuck in a loop
						computedResult = '$RE'

						const result = this.executeExpression(expression, undefined)
						this.#localValuesReferences.set(`local:${variable.options.name}`, Array.from(result.variableIds))
						if (result.ok) {
							computedResult = result.value
						} else {
							computedResult = undefined
							// TODO-localvariables better logging
						}

						this.#localValues.set(fullId, computedResult)
						return computedResult
					})

					break
				}
				default: {
					assertNever(definitionId)
					// TODO-localvariables better logging
					console.warn(`Unknown local variable type ${variable.definitionId}`)
				}
			}
		}
	}

	#trackDeepReferences(variableIds: Set<string>) {
		// Make sure all references are tracked
		for (const variableId of variableIds) {
			const referenced = this.#localValuesReferences.get(variableId)
			if (referenced) {
				for (const id of referenced) {
					variableIds.add(id)
				}
			}
		}
	}

	/**
	 * Parse and execute an expression in a string
	 * @param str - String containing the expression to parse
	 * @param requiredType - Fail if the result is not of specified type
	 * @returns result of the expression
	 */
	executeExpression(str: string, requiredType: string | undefined): ExecuteExpressionResult {
		const result = executeExpression(str, this.#rawVariableValues, requiredType, this.#valueCacheAccessor)

		this.#trackDeepReferences(result.variableIds)

		console.log('exec', str, result)

		return result
	}

	/**
	 * Parse the variables in a string
	 * @param str - String to parse variables in
	 * @returns with variables replaced with values
	 */
	parseVariables(str: string): ParseVariablesResult {
		const result = parseVariablesInString(str, this.#rawVariableValues, this.#valueCacheAccessor)

		this.#trackDeepReferences(result.variableIds)

		return result
	}
}

interface VariableValueCache {
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
		const getVariableValue = (variableId: string): CompanionVariableValue => {
			referencedVariableIds.add(variableId)

			const fullId = `$(${variableId})`
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
				const [connectionLabel, variableName] = SplitVariableId(variableId)
				if (connectionLabel == 'internal' && variableName.substring(0, 7) === 'custom_') {
					value = rawVariableValues['custom']?.[variableName.substring(7)]
				} else {
					value = rawVariableValues[connectionLabel]?.[variableName]
				}

				cachedVariableValues.set(fullId, value)
			}

			// If its a string, make sure any references to other variables are resolved
			if (typeof value === 'string') {
				// First check if it is a direct reference to another variable, so that the type can be preserved
				const valueMatch = value.match(VARIABLE_REGEX)
				if (valueMatch && valueMatch[0] === value) {
					return getVariableValue(`${valueMatch[1]}:${valueMatch[2]}`)
				} else {
					// Fallback to parsing the string
					const parsedValue = parseVariablesInString(value, rawVariableValues, cachedVariableValues)
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
				const result = parseVariablesInString(str, rawVariableValues, cachedVariableValues)

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
