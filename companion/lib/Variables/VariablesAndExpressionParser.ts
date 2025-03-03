import { type CompanionVariableValues, type CompanionVariableValue } from '@companion-module/base'
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
import { isInternalLogicFeedback, type ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'

/**
 * A class to parse and execute expressions with variables
 * This allows for preparing any injected/lazy variables before executing multiple expressions
 */
export class VariablesAndExpressionParser {
	// readonly #logger = LogController.createLogger('Variables/VariablesAndExpressionParser')

	readonly #rawVariableValues: ReadonlyDeep<VariableValueData>
	readonly #thisValues: VariablesCache
	readonly #localValues: VariablesCache = new Map()
	readonly #overrideVariableValues: CompanionVariableValues

	readonly #valueCacheAccessor: VariableValueCache = {
		has: (id: string): boolean => {
			return this.#thisValues.has(id) || this.#localValues.has(id) || this.#overrideVariableValues[id] !== undefined
		},
		get: (id: string): CompanionVariableValue | undefined => {
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

	#bindLocalVariables(entities: ControlEntityInstance[]) {
		for (const entity of entities) {
			const variableName = entity.localVariableName
			if (!variableName) continue

			// Push the cached values to the store
			this.#localValues.set(
				`$(${variableName})`,
				isInternalLogicFeedback(entity) ? entity.getBooleanFeedbackValue() : entity.feedbackValue
			)
		}
	}

	/**
	 * Parse and execute an expression in a string
	 * @param str - String containing the expression to parse
	 * @param requiredType - Fail if the result is not of specified type
	 * @returns result of the expression
	 */
	executeExpression(str: string, requiredType: string | undefined): ExecuteExpressionResult {
		return executeExpression(str, this.#rawVariableValues, requiredType, this.#valueCacheAccessor)
	}

	/**
	 * Parse the variables in a string
	 * @param str - String to parse variables in
	 * @returns with variables replaced with values
	 */
	parseVariables(str: string): ParseVariablesResult {
		return parseVariablesInString(str, this.#rawVariableValues, this.#valueCacheAccessor)
	}
}
