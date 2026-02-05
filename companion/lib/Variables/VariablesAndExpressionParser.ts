import {
	stringifyVariableValue,
	type VariableValue,
	type VariableValues,
} from '@companion-app/shared/Model/Variables.js'
import type { JsonValue, ReadonlyDeep } from 'type-fest'
import {
	executeExpression,
	parseVariablesInString,
	type VariableValueData,
	type VariablesCache,
	type ParseVariablesResult,
	type VariableValueCache,
} from './Util.js'
import { isInternalLogicFeedback, type ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { VariablesBlinker } from './VariablesBlinker.js'
import {
	isExpressionOrValue,
	type ExpressionableOptionsObject,
	type ExpressionOrValue,
} from '@companion-app/shared/Model/Options.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'

/**
 * A class to parse and execute expressions with variables
 * This allows for preparing any injected/lazy variables before executing multiple expressions
 */
export class VariablesAndExpressionParser {
	// readonly #logger = LogController.createLogger('Variables/VariablesAndExpressionParser')

	readonly #blinker: VariablesBlinker

	readonly #rawVariableValues: ReadonlyDeep<VariableValueData>
	readonly #thisValues: VariablesCache
	readonly #localValues: VariablesCache = new Map()
	readonly #overrideVariableValues: VariableValues

	readonly #valueCacheAccessor: VariableValueCache = {
		has: (id: string): boolean => {
			return this.#thisValues.has(id) || this.#localValues.has(id) || this.#overrideVariableValues[id] !== undefined
		},
		get: (id: string): VariableValue | undefined => {
			if (this.#thisValues.has(id)) return this.#thisValues.get(id)
			if (this.#localValues.has(id)) return this.#localValues.get(id)
			return this.#overrideVariableValues[id]
		},
		set: (id: string, value: VariableValue | undefined): void => {
			this.#localValues.set(id, value)
		},
	}

	constructor(
		blinker: VariablesBlinker,
		rawVariableValues: ReadonlyDeep<VariableValueData>,
		thisValues: VariablesCache,
		localValues: ControlEntityInstance[] | null,
		overrideVariableValues: VariableValues | null
	) {
		this.#blinker = blinker
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
		return executeExpression(this.#blinker, str, this.#rawVariableValues, requiredType, this.#valueCacheAccessor)
	}

	/**
	 * Parse the variables in a string
	 * @param str - String to parse variables in
	 * @returns with variables replaced with values
	 */
	parseVariables(str: string): ParseVariablesResult {
		return parseVariablesInString(str, this.#rawVariableValues, this.#valueCacheAccessor, VARIABLE_UNKNOWN_VALUE)
	}

	/**
	 * Parse any variables in the options object for an entity.
	 * Note: this will drop any options that are not defined in the entity definition.
	 */
	parseEntityOptions(
		entityDefinition: ClientEntityDefinition,
		options: ExpressionableOptionsObject
	): {
		parsedOptions: CompanionOptionValues
		referencedVariableIds: Set<string>
	} {
		const parsedOptions: CompanionOptionValues = {}
		const referencedVariableIds = new Set<string>()

		if (entityDefinition.optionsSupportExpressions) {
			// If the entity uses the auto parser, we can just parse all

			for (const field of entityDefinition.options) {
				let fieldType: 'expression' | 'variables' | 'generic' = 'generic'
				if (field.type === 'textinput' && field.useVariables) {
					fieldType = 'variables'
				} else if (field.type === 'expression') {
					fieldType = 'expression'
				}

				const parsedValue = this.parseEntityOption(options[field.id], fieldType)
				parsedOptions[field.id] = parsedValue.value

				// Ensure values are valid, or populate with default
				if (!field.allowInvalidValues && validateInputValue(field, parsedValue.value)) {
					parsedOptions[field.id] = 'default' in field ? field.default : undefined
				}

				// Track the variables referenced in this field
				if (
					!entityDefinition.optionsToMonitorForInvalidations ||
					entityDefinition.optionsToMonitorForInvalidations.includes(field.id)
				) {
					for (const variable of parsedValue.referencedVariableIds) {
						referencedVariableIds.add(variable)
					}
				}
			}
		} else {
			// The old approach for only text inputs

			for (const field of entityDefinition.options) {
				if (field.type !== 'textinput' || !field.useVariables) {
					// Field doesn't support variables, pass unchanged
					parsedOptions[field.id] = options[field.id]?.value
					continue
				}

				// Field needs parsing
				// Note - we don't need to care about the granularity given in `useVariables`,
				const parseResult = this.parseVariables(stringifyVariableValue(options[field.id]?.value) ?? '')
				parsedOptions[field.id] = parseResult.text

				// Track the variables referenced in this field
				if (
					!entityDefinition.optionsToMonitorForInvalidations ||
					entityDefinition.optionsToMonitorForInvalidations.includes(field.id)
				) {
					for (const variable of parseResult.variableIds) {
						referencedVariableIds.add(variable)
					}
				}
			}
		}

		return { parsedOptions, referencedVariableIds }
	}

	/**
	 * Parse a single option value for an entity
	 * @param optionsValue The raw option value, either a plan value or an ExpressionOrValue
	 * @param fieldType The type of field being parsed. This controls how the bare non-expression value is interpreted
	 * @returns The value and the variables it references
	 */
	parseEntityOption(
		optionsValue: JsonValue | ExpressionOrValue<JsonValue | undefined> | undefined,
		fieldType: 'expression' | 'variables' | 'generic'
	): {
		value: JsonValue | undefined
		referencedVariableIds: ReadonlySet<string>
	} {
		// Get the value as an ExpressionOrValue
		const rawValue: ExpressionOrValue<JsonValue | undefined> = isExpressionOrValue(optionsValue)
			? optionsValue
			: { value: optionsValue as any, isExpression: fieldType === 'expression' }

		if (rawValue.isExpression || fieldType === 'expression') {
			// Parse the expression
			const parseResult = this.executeExpression(stringifyVariableValue(rawValue.value) ?? '', undefined)
			if (!parseResult.ok) throw new Error(parseResult.error)

			return {
				value: parseResult.value,
				referencedVariableIds: parseResult.variableIds,
			}
		} else if (fieldType === 'variables') {
			// Field needs parsing
			// Note - we don't need to care about the granularity given in `useVariables`,
			const parseResult = this.parseVariables(stringifyVariableValue(rawValue.value) ?? '')

			return {
				value: parseResult.text,
				referencedVariableIds: parseResult.variableIds,
			}
		} else {
			// Just use the value as-is
			return {
				value: rawValue.value,
				referencedVariableIds: new Set(),
			}
		}
	}
}
