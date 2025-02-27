import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { type CompanionVariableValues, type CompanionVariableValue, assertNever } from '@companion-module/base'
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
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import { booleanAnd } from '../Resources/Util.js'
import LogController from '../Log/Controller.js'

/**
 * A class to parse and execute expressions with variables
 * This allows for preparing any injected/lazy variables before executing multiple expressions
 */
export class VariablesAndExpressionParser {
	readonly #logger = LogController.createLogger('Variables/VariablesAndExpressionParser')

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
		localValues: ControlEntityInstance[] | null,
		overrideVariableValues: CompanionVariableValues | null
	) {
		this.#rawVariableValues = rawVariableValues
		this.#thisValues = thisValues
		this.#overrideVariableValues = overrideVariableValues || {}

		if (localValues) this.#bindLocalVariables(localValues)
	}

	#bindLocalVariables(variables: ControlEntityInstance[]) {
		// const idCheckRegex = /^([a-zA-Z0-9-_\.]+)$/
		// for (const variable of variables) {
		// 	if (variable.type !== EntityModelType.LocalVariable || variable.connectionId !== 'internal') continue
		// 	if (!variable.rawOptions.name) continue
		// 	// Make sure the variable name is valid
		// 	if (!variable.id.match(idCheckRegex)) continue
		// 	const fullId = `$(local:${variable.rawOptions.name})`
		// 	const definitionId = variable.definitionId as LocalVariableEntityDefinitionType
		// 	switch (definitionId) {
		// 		case LocalVariableEntityDefinitionType.ConstantValue: {
		// 			// Store the value directly
		// 			this.#localValues.set(fullId, variable.rawOptions.value)
		// 			break
		// 		}
		// 		case LocalVariableEntityDefinitionType.DynamicExpression: {
		// 			let computedResult: CompanionVariableValue | undefined = undefined
		// 			const expression = variable.rawOptions.expression
		// 			this.#localValues.set(fullId, () => {
		// 				if (computedResult !== undefined) return computedResult
		// 				// make sure we don't get stuck in a loop
		// 				computedResult = '$RE'
		// 				const result = this.executeExpression(expression, undefined)
		// 				this.#localValuesReferences.set(`local:${variable.rawOptions.name}`, Array.from(result.variableIds))
		// 				if (result.ok) {
		// 					computedResult = result.value
		// 				} else {
		// 					computedResult = undefined
		// 					this.#logger.warn(`${result.error}, in expression: "${expression}"`)
		// 				}
		// 				this.#localValues.set(fullId, computedResult)
		// 				return computedResult
		// 			})
		// 			break
		// 		}
		// 		case LocalVariableEntityDefinitionType.Feedbacks: {
		// 			let computedResult: boolean | undefined = undefined
		// 			this.#localValues.set(fullId, () => {
		// 				if (computedResult !== undefined) return computedResult
		// 				// make sure we don't get stuck in a loop
		// 				computedResult = false
		// 				const childValues = variable.getChildren('feedbacks')?.getChildBooleanFeedbackValues()
		// 				computedResult = booleanAnd(false, childValues ?? []) ?? false
		// 				this.#localValues.set(fullId, computedResult)
		// 				return computedResult
		// 			})
		// 			break
		// 		}
		// 		default: {
		// 			assertNever(definitionId)
		// 			this.#logger.warn(`Unknown local variable type ${variable.definitionId}`)
		// 			break
		// 		}
		// 	}
		// }
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
