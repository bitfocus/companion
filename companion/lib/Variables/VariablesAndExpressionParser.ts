import type { JsonValue, ReadonlyDeep } from 'type-fest'
import type { ExecuteExpressionResult } from '@companion-app/shared/ExpressionResult.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { ExpressionableOptionsObject, ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import {
	stringifyVariableValue,
	type VariableValue,
	type VariableValues,
} from '@companion-app/shared/Model/Variables.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { isInternalLogicFeedback, type ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import {
	executeExpression,
	parseVariablesInString,
	visitEntityOptionsForVariables,
	type ParseVariablesResult,
	type VariablesCache,
	type VariableValueCache,
	type VariableValueData,
	type VisitEntityOptionValueOptions,
} from './Util.js'
import type { VariablesBlinker } from './VariablesBlinker.js'

/**
 * Options controlling how an expression parser behaves in its evaluation context.
 */
export interface ExpressionParserOptions {
	/**
	 * Whether clock-sensitive expression functions (e.g. `oscillate()`) are permitted.
	 * Defaults to `true`. Set `false` in contexts that have no render clock to drive re-evaluation
	 * (e.g. when parsing action options), so such expressions are rejected rather than silently frozen.
	 */
	allowClockSensitive?: boolean
}

/**
 * A class to parse and execute expressions with variables
 * This allows for preparing any injected/lazy variables before executing multiple expressions
 */
export class VariablesAndExpressionParser {
	// readonly #logger = LogController.createLogger('Variables/VariablesAndExpressionParser')

	readonly #blinker: VariablesBlinker

	readonly #allowClockSensitive: boolean
	readonly #rawVariableValues: ReadonlyDeep<VariableValueData>
	readonly #thisValues: VariablesCache
	readonly #localValues: VariablesCache = new Map()
	readonly #overrideVariableValues: VariableValues

	/** User configuration, used to read the configured timezone for date/time expression functions */
	readonly #userconfig: DataUserConfig

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
		userconfig: DataUserConfig,
		blinker: VariablesBlinker,
		rawVariableValues: ReadonlyDeep<VariableValueData>,
		thisValues: VariablesCache,
		localValues: ControlEntityInstance[] | null,
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	) {
		this.#userconfig = userconfig
		this.#blinker = blinker
		this.#allowClockSensitive = options?.allowClockSensitive ?? true
		this.#rawVariableValues = rawVariableValues
		this.#thisValues = thisValues
		this.#overrideVariableValues = overrideVariableValues || {}

		if (localValues) this.#bindLocalVariables(localValues)
	}

	createChildParser(overrideVariableValues: VariableValues): VariablesAndExpressionParser {
		const childParser = new VariablesAndExpressionParser(
			this.#userconfig,
			this.#blinker,
			this.#rawVariableValues,
			this.#thisValues,
			null,
			{
				...this.#overrideVariableValues,
				...overrideVariableValues,
			},
			{ allowClockSensitive: this.#allowClockSensitive }
		)

		// Manual clone the localValues
		for (const [key, value] of this.#localValues) {
			if (key.startsWith('local:')) childParser.#localValues.set(key, value)
		}

		return childParser
	}

	/**
	 * Create an isolated child parser that can ONLY resolve the provided override variables.
	 * Unlike `createChildParser`, this does not inherit the global variable values, `this:` values,
	 * inherited overrides, or `local:` values - any reference outside the given overrides resolves
	 * to "unknown".
	 *
	 * Used for composite element children: a composite is authored by a module and must behave as a
	 * self-contained component whose children can only reference its `options:*` variables, not any
	 * global state. The values wired into the composite's options are resolved by the caller (with
	 * full access) before being passed in here.
	 */
	createIsolatedChildParser(overrideVariableValues: VariableValues): VariablesAndExpressionParser {
		return new VariablesAndExpressionParser(
			this.#userconfig,
			this.#blinker,
			{},
			new Map(),
			null,
			overrideVariableValues
		)
	}

	#bindLocalVariables(entities: ControlEntityInstance[]) {
		for (const entity of entities) {
			const variableName = entity.localVariableName
			if (!variableName) continue

			// Push the cached values to the store
			this.#localValues.set(
				variableName,
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
		return executeExpression(
			this.#blinker,
			str,
			this.#rawVariableValues,
			requiredType,
			this.#valueCacheAccessor,
			this.#userconfig.getKey('timezone') || undefined,
			undefined,
			this.#allowClockSensitive
		)
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
				clockSensitive: boolean
		  }
		| {
				ok: false
				optionErrors: Record<string, string | undefined>
				referencedVariableIds: Set<string>
				clockSensitive: boolean
		  } {
		const referencedVariableIds = new Set<string>()
		const parseErrors: Record<string, string | undefined> = {}
		let clockSensitive = false

		const parsedOptions = visitEntityOptionsForVariables(entityDefinition, options, (field, optionValue, fieldType) => {
			// For passthrough fields, skip all processing and just extract the raw value
			if (fieldType === null) {
				return optionValue?.value
			}

			const parsedValue = this.parseEntityOption(optionValue, fieldType)
			const { sanitisedValue, validationError } = validateInputValue(field, parsedValue.value, {
				skipValidateExpression: true,
			})

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

			// Track clock sensitivity
			if (parsedValue.clockSensitive) clockSensitive = true

			return sanitisedValue
		})

		if (Object.keys(parseErrors).length > 0) {
			return { ok: false, optionErrors: parseErrors, referencedVariableIds, clockSensitive }
		} else {
			return { ok: true, parsedOptions, referencedVariableIds, clockSensitive }
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
		clockSensitive: boolean
	} {
		// No object, so just return undefined
		if (!rawValue) {
			return {
				value: undefined,
				referencedVariableIds: new Set(),
				clockSensitive: false,
			}
		}

		if ((rawValue.isExpression && options.allowExpression) || options.forceExpression) {
			// Parse the expression
			const parseResult = this.executeExpression(stringifyVariableValue(rawValue.value) ?? '', undefined)
			if (!parseResult.ok) throw new Error(parseResult.error)

			return {
				value: parseResult.value,
				referencedVariableIds: parseResult.variableIds,
				clockSensitive: parseResult.clockSensitive,
			}
		} else if ((!rawValue.isExpression || !options.allowExpression) && options.parseVariables) {
			// Field needs parsing
			// Note - we don't need to care about the granularity given in `useVariables`,
			const parseResult = this.parseVariables(stringifyVariableValue(rawValue.value) ?? '')

			return {
				value: parseResult.text,
				referencedVariableIds: parseResult.variableIds,
				clockSensitive: false,
			}
		} else {
			// 'expression-or-variables' with isExpression=false - just use the value as-is
			return {
				value: rawValue.value,
				referencedVariableIds: new Set(),
				clockSensitive: false,
			}
		}
	}
}
