import type { JsonValue, ReadonlyDeep } from 'type-fest'
import type { ExecuteExpressionResult } from '@companion-app/shared/ExpressionResult.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { ExpressionableOptionsObject, ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import {
	stringifyVariableValue,
	type VariableValue,
	type VariableValues,
} from '@companion-app/shared/Model/Variables.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { isInternalLogicFeedback, type ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import {
	computeHiddenEntityOptionFields,
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

	/**
	 * The resolved options for this parser.
	 */
	readonly #options: ExpressionParserOptions
	readonly #rawVariableValues: ReadonlyDeep<VariableValueData>
	readonly #thisValues: VariablesCache
	readonly #localValues: VariablesCache = new Map()
	/** The `page:x` variables of the control's page (see {@link #bindPageVariables}). */
	readonly #pageValues: VariablesCache = new Map()
	readonly #overrideVariableValues: VariableValues

	/** User configuration, used to read the configured timezone for date/time expression functions */
	readonly #userconfig: DataUserConfig

	readonly #valueCacheAccessor: VariableValueCache = {
		has: (id: string): boolean => {
			return (
				this.#thisValues.has(id) ||
				this.#localValues.has(id) ||
				this.#pageValues.has(id) ||
				this.#overrideVariableValues[id] !== undefined
			)
		},
		get: (id: string): VariableValue | undefined => {
			if (this.#thisValues.has(id)) return this.#thisValues.get(id)
			if (this.#localValues.has(id)) return this.#localValues.get(id)
			if (this.#pageValues.has(id)) return this.#pageValues.get(id)
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
		pageValues: ControlEntityInstance[] | null,
		options: ExpressionParserOptions | undefined
	) {
		this.#userconfig = userconfig
		this.#blinker = blinker
		this.#options = options ?? {}
		this.#rawVariableValues = rawVariableValues
		this.#thisValues = thisValues
		this.#overrideVariableValues = overrideVariableValues || {}

		if (localValues) this.#bindLocalVariables(localValues)
		if (pageValues) this.#bindPageVariables(pageValues)
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
			null,
			this.#options
		)

		// Manual clone the localValues
		for (const [key, value] of this.#localValues) {
			if (key.startsWith('local:')) childParser.#localValues.set(key, value)
		}

		// Manual clone the pageValues
		for (const [key, value] of this.#pageValues) {
			childParser.#pageValues.set(key, value)
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
			overrideVariableValues,
			null,
			this.#options
		)
	}

	#bindLocalVariables(entities: ControlEntityInstance[]) {
		for (const entity of entities) {
			const variableName = entity.localVariableName
			if (!variableName) continue

			// Push the cached values to the store
			this.#localValues.set(
				variableName,
				isInternalLogicFeedback(entity) ? entity.getBooleanFeedbackValue(null) : entity.feedbackValue
			)
		}
	}

	/**
	 * Bind a page's local-variable entities so they resolve as `$(page:x)` for controls on that page.
	 * Like {@link #bindLocalVariables}, but under the `page:` namespace.
	 */
	#bindPageVariables(entities: ControlEntityInstance[]) {
		for (const entity of entities) {
			const rawName = entity.rawLocalVariableName
			if (!rawName) continue

			this.#pageValues.set(
				`page:${rawName}`,
				isInternalLogicFeedback(entity) ? entity.getBooleanFeedbackValue(null) : entity.feedbackValue
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
			this.#options.allowClockSensitive ?? true
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

		// Fields hidden by their isVisible logic must not be parsed/validated - the user can't see
		// them, so their (possibly stale/invalid) value would only produce confusing errors. Emit
		// the field default instead.
		const hiddenFields = computeHiddenEntityOptionFields(entityDefinition, options)

		const parsedOptions = visitEntityOptionsForVariables(entityDefinition, options, (field, optionValue, fieldType) => {
			// For passthrough fields, skip all processing and just extract the raw value
			if (fieldType === null) {
				return optionValue?.value
			}

			// Hidden fields are not parsed/validated; use the field default so the value stays type-safe
			if (hiddenFields.has(field.id)) {
				return 'default' in field ? structuredClone(field.default) : undefined
			}

			const parsedValue = this.parseEntityOption(optionValue, fieldType)

			// Track the variables referenced in this field. This happens even when the expression failed,
			// as it may have read variables before erroring - we want to re-evaluate (and recover) when
			// they change. #4427
			if (
				!entityDefinition.optionsToMonitorForInvalidations ||
				entityDefinition.optionsToMonitorForInvalidations.includes(field.id)
			) {
				for (const variable of parsedValue.variableIds) {
					referencedVariableIds.add(variable)
				}
			}

			// Track clock sensitivity
			if (parsedValue.clockSensitive) clockSensitive = true

			if (!parsedValue.ok) {
				// The expression failed to evaluate; record the error and fall back to the field default
				parseErrors[field.id] = parsedValue.error
				return 'default' in field ? structuredClone(field.default) : undefined
			}

			const { sanitisedValue, validationError } = validateInputValue(field, parsedValue.value, {
				skipValidateExpression: true,
			})

			// Ensure values are valid, or report the error
			if (!field.allowInvalidValues && validationError) {
				parseErrors[field.id] = validationError
			}

			return sanitisedValue
		})

		if (Object.keys(parseErrors).length > 0) {
			return { ok: false, optionErrors: parseErrors, referencedVariableIds, clockSensitive }
		} else {
			return { ok: true, parsedOptions, referencedVariableIds, clockSensitive }
		}
	}

	/**
	 * Parse a single option value for an entity.
	 *
	 * This never throws: a failed expression is reported as `{ ok: false, error, variableIds }`, with
	 * `variableIds` holding the variables referenced up until the failure. Callers can then still
	 * register a dependency on those variables and re-evaluate (and potentially recover) when they
	 * change - e.g. an expression that errors at startup before the variables it uses have a value. #4427
	 *
	 * @param rawValue The raw option value, either a plain value or an ExpressionOrValue
	 * @param options The type of field being parsed. This controls how the bare non-expression value is interpreted
	 * @returns The value (on success) and the variables it references
	 */
	parseEntityOption(
		rawValue: ExpressionOrValue<JsonValue | undefined> | undefined,
		options: VisitEntityOptionValueOptions
	): ExecuteExpressionResult {
		try {
			// No object, so just return undefined
			if (!rawValue) {
				return { ok: true, value: undefined, variableIds: new Set(), clockSensitive: false }
			}

			if ((rawValue.isExpression && options.allowExpression) || options.forceExpression) {
				// Parse the expression. executeExpression already reports failures as a result (never throws)
				// and carries the variables referenced up until any failure, so return it directly.
				return this.executeExpression(stringifyVariableValue(rawValue.value) ?? '', undefined)
			} else if ((!rawValue.isExpression || !options.allowExpression) && options.parseVariables) {
				// Field needs parsing
				// Note - we don't need to care about the granularity given in `useVariables`,
				const parseResult = this.parseVariables(stringifyVariableValue(rawValue.value) ?? '')

				return { ok: true, value: parseResult.text, variableIds: parseResult.variableIds, clockSensitive: false }
			} else {
				// 'expression-or-variables' with isExpression=false - just use the value as-is
				return { ok: true, value: rawValue.value, variableIds: new Set(), clockSensitive: false }
			}
		} catch (e) {
			// Backstop: parseEntityOption must never throw, so callers can always rely on the result shape
			return {
				ok: false,
				error: stringifyError(e, true) || 'Unknown error',
				variableIds: new Set(),
				clockSensitive: false,
			}
		}
	}
}
