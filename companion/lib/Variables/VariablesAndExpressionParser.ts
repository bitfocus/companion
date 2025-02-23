import { SomeEntityModel, EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { type CompanionVariableValues, type CompanionVariableValue, assertNever } from '@companion-module/base'
import { LocalVariableEntityDefinitionType } from '../Resources/LocalVariableEntityDefinitions.js'
import type { ReadonlyDeep } from 'type-fest'
import {
	VariableValueData,
	VariablesCache,
	ExecuteExpressionResult,
	executeExpression,
	ParseVariablesResult,
	parseVariablesInString,
	VariableValueCache,
} from './Util.js'

/**
 * A class to parse and execute expressions with variables
 * This allows for preparing any injected/lazy variables before executing multiple expressions
 */
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
