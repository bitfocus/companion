import {
	stringifyVariableValue,
	type VariableValue,
	type VariableValues,
} from '@companion-app/shared/Model/Variables.js'
import type { JsonValue, ReadonlyDeep } from 'type-fest'
import {
	executeExpression,
	parseVariablesInString,
	visitEntityOptionsForVariables,
	type VariableValueData,
	type VariablesCache,
	type ParseVariablesResult,
	type VariableValueCache,
	type VisitEntityOptionValueOptions,
} from './Util.js'
import { isInternalLogicFeedback, type ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { VariablesBlinker } from './VariablesBlinker.js'
import type { ExpressionableOptionsObject, ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
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
	):
		| {
				ok: true
				parsedOptions: CompanionOptionValues
				referencedVariableIds: Set<string>
		  }
		| {
				ok: false
				optionErrors: Record<string, string | undefined>
				referencedVariableIds: Set<string>
		  } {
		const referencedVariableIds = new Set<string>()
		const parseErrors: Record<string, string | undefined> = {}

		const parsedOptions = visitEntityOptionsForVariables(entityDefinition, options, (field, optionValue, fieldType) => {
			// For passthrough fields, skip all processing and just extract the raw value
			if (fieldType === null) {
				return optionValue?.value
			}

			const parsedValue = this.parseEntityOption(optionValue, fieldType)
			const { sanitisedValue, validationError } = validateInputValue(field, parsedValue.value, true)

			// Ensure values are valid, or report the error
			if (!field.allowInvalidValues && validationError) {
				parseErrors[field.id] = validationError
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

			return sanitisedValue
		})

		if (Object.keys(parseErrors).length > 0) {
			return { ok: false, optionErrors: parseErrors, referencedVariableIds }
		} else {
			return { ok: true, parsedOptions, referencedVariableIds }
		}
	}

	/**
	 * Parse a single option value for an entity
	 * @param optionsValue The raw option value, either a plan value or an ExpressionOrValue
	 * @param fieldType The type of field being parsed. This controls how the bare non-expression value is interpreted
	 * @returns The value and the variables it references
	 */
	parseEntityOption(
		rawValue: ExpressionOrValue<JsonValue | undefined> | undefined,
		options: VisitEntityOptionValueOptions
	): {
		value: JsonValue | undefined
		referencedVariableIds: ReadonlySet<string>
	} {
		// No object, so just return undefined
		if (!rawValue) {
			return {
				value: undefined,
				referencedVariableIds: new Set(),
			}
		}

		if ((rawValue.isExpression && options.allowExpression) || options.forceExpression) {
			// Parse the expression
			const parseResult = this.executeExpression(stringifyVariableValue(rawValue.value) ?? '', undefined)
			if (!parseResult.ok) throw new Error(parseResult.error)

			return {
				value: parseResult.value,
				referencedVariableIds: parseResult.variableIds,
			}
		} else if ((!rawValue.isExpression || !options.allowExpression) && options.parseVariables) {
			// Field needs parsing
			// Note - we don't need to care about the granularity given in `useVariables`,
			const parseResult = this.parseVariables(stringifyVariableValue(rawValue.value) ?? '')

			return {
				value: parseResult.text,
				referencedVariableIds: parseResult.variableIds,
			}
		} else {
			// 'expression-or-variables' with isExpression=false - just use the value as-is
			return {
				value: rawValue.value,
				referencedVariableIds: new Set(),
			}
		}
	}
}
