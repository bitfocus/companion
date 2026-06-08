import type { JsonValue, ReadonlyDeep } from 'type-fest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ThisLocationVariable } from '@companion-app/shared/ControlLocation.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
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

type VariablesRecord<Variables extends string, Data extends object> = Record<
	Variables,
	(contextData: ReadonlyDeep<Data>) => VariableValue
>

type ThisLocationVariablesData = {
	location: ControlLocation | null | undefined
}

const ThisLocationVariables: VariablesRecord<ThisLocationVariable, ThisLocationVariablesData> = {
	'this:page': ({ location }) => location?.pageNumber,
	'this:column': ({ location }) => location?.column,
	'this:row': ({ location }) => location?.row,
	'this:location': ({ location }) => (location ? formatLocation(location) : undefined),

	// The remaining variables simply delegate to internally-defined variables.
	'this:page_name': ({ location }) =>
		location ? `$(internal:page_number_${location.pageNumber}_name)` : VARIABLE_UNKNOWN_VALUE,
	'this:active': ({ location }) =>
		location
			? `$(internal:b_active_${location.pageNumber}_${location.row}_${location.column})`
			: VARIABLE_UNKNOWN_VALUE,

	'this:step': ({ location }) =>
		location ? `$(internal:b_step_${location.pageNumber}_${location.row}_${location.column})` : VARIABLE_UNKNOWN_VALUE,
	'this:step_count': ({ location }) =>
		location
			? `$(internal:b_step_count_${location.pageNumber}_${location.row}_${location.column})`
			: VARIABLE_UNKNOWN_VALUE,

	'this:actions_running': ({ location }) =>
		location
			? `$(internal:b_actions_running_${location.pageNumber}_${location.row}_${location.column})`
			: VARIABLE_UNKNOWN_VALUE,

	'this:button_status': ({ location }) =>
		location
			? `$(internal:b_status_${location.pageNumber}_${location.row}_${location.column})`
			: VARIABLE_UNKNOWN_VALUE,
}

export const ThisLocationVariablesSet: ReadonlySet<string> = new Set(Object.keys(ThisLocationVariables))

type SurfaceVariablesData = {
	surfaceId: string | undefined
	pageNumber: string | undefined
}

export type SurfaceVariable = 'this:surface_id' | 'this:page' | 'this:page_name'

const SurfaceVariables: VariablesRecord<SurfaceVariable, SurfaceVariablesData> = {
	'this:surface_id': ({ surfaceId }) => surfaceId,

	// Reactivity is triggered manually
	'this:page': ({ pageNumber }) => pageNumber,

	// Reactivity happens for these because of references to the inner variables
	'this:page_name': ({ pageNumber }) =>
		pageNumber ? `$(internal:page_number_${pageNumber}_name)` : VARIABLE_UNKNOWN_VALUE,
}

type ThisLocationThroughSurfaceVariablesData = ThisLocationVariablesData & {
	surfaceId: string | undefined
}

export type ThisLocationThroughSurfaceVariable = ThisLocationVariable | 'this:surface_id'

const ThisLocationThroughSurfaceVariables: VariablesRecord<
	ThisLocationThroughSurfaceVariable,
	ThisLocationThroughSurfaceVariablesData
> = {
	...ThisLocationVariables,
	'this:surface_id': ({ surfaceId }) => surfaceId,
}

/**
 * A class to parse strings and execute expressions with variables.
 * This allows for preparing any injected/lazy variables before executing multiple expressions
 */
export class VariablesAndExpressionParser {
	// readonly #logger = LogController.createLogger('Variables/VariablesAndExpressionParser')

	readonly #blinker: VariablesBlinker

	readonly #rawVariableValues: ReadonlyDeep<VariableValueData>
	readonly #contextVariables: Record<string, undefined | ((data: unknown) => VariableValue)>
	readonly #contextData: unknown
	readonly #localValues: VariablesCache = new Map()
	readonly #overrideVariableValues: VariableValues

	private readonly valueCacheAccessor: VariableValueCache = {
		has: (id: string): boolean => {
			return !!this.#contextVariables[id] || this.#localValues.has(id) || this.#overrideVariableValues[id] !== undefined
		},
		get: (id: string): VariableValue | undefined => {
			if (this.#contextVariables[id]) return this.#contextVariables[id](this.#contextData)
			if (this.#localValues.has(id)) return this.#localValues.get(id)
			return this.#overrideVariableValues[id]
		},
		set: (id: string, value: VariableValue | undefined): void => {
			this.#localValues.set(id, value)
		},
	}

	private constructor(
		blinker: VariablesBlinker,
		rawVariableValues: ReadonlyDeep<VariableValueData>,
		contextVariables: Record<string, undefined | ((data: ReadonlyDeep<any>) => VariableValue)>,
		contextData: any,
		localValues: ControlEntityInstance[] | null,
		overrideVariableValues: VariableValues
	) {
		this.#blinker = blinker
		this.#rawVariableValues = rawVariableValues
		this.#contextVariables = contextVariables
		this.#contextData = contextData
		this.#overrideVariableValues = overrideVariableValues

		if (localValues) this.#bindLocalVariables(localValues)
	}

	// Template arguments aren't allowed on constructors, so use a helper function
	// to add them.
	private static new_<ContextData extends object>(
		blinker: VariablesBlinker,
		rawVariableValues: ReadonlyDeep<VariableValueData>,
		contextVariables: Record<string, undefined | ((data: ReadonlyDeep<NoInfer<ContextData>>) => VariableValue)>,
		contextData: ReadonlyDeep<ContextData>,
		localValues: ControlEntityInstance[] | null
	): VariablesAndExpressionParser {
		return new VariablesAndExpressionParser(blinker, rawVariableValues, contextVariables, contextData, localValues, {})
	}

	static forControl(
		blinker: VariablesBlinker,
		rawVariableValues: ReadonlyDeep<VariableValueData>,
		controlLocation: ControlLocation | null | undefined,
		surfaceId: string | undefined,
		localValues: ControlEntityInstance[] | null
	): VariablesAndExpressionParser {
		if (surfaceId) {
			return VariablesAndExpressionParser.new_(
				blinker,
				rawVariableValues,
				ThisLocationThroughSurfaceVariables,
				{
					location: controlLocation,
					surfaceId,
				},
				localValues
			)
		}

		return VariablesAndExpressionParser.new_(
			blinker,
			rawVariableValues,
			ThisLocationVariables,
			{
				location: controlLocation,
			},
			localValues
		)
	}

	static forSurface(
		blinker: VariablesBlinker,
		rawVariableValues: ReadonlyDeep<VariableValueData>,
		surfaceId: string,
		surfacePageNumber: string | undefined,
		localValues: ControlEntityInstance[] | null
	): VariablesAndExpressionParser {
		return VariablesAndExpressionParser.new_(
			blinker,
			rawVariableValues,
			SurfaceVariables,
			{
				surfaceId,
				pageNumber: surfacePageNumber,
			},
			localValues
		)
	}

	createChildParser(overrideVariableValues: VariableValues): VariablesAndExpressionParser {
		const childParser = new VariablesAndExpressionParser(
			this.#blinker,
			this.#rawVariableValues,
			this.#contextVariables,
			this.#contextData,
			null,
			{
				...this.#overrideVariableValues,
				...overrideVariableValues,
			}
		)

		// Manual clone the localValues
		for (const [key, value] of this.#localValues) {
			if (key.startsWith('local:')) childParser.#localValues.set(key, value)
		}

		return childParser
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
		return executeExpression(this.#blinker, str, this.#rawVariableValues, requiredType, this.valueCacheAccessor)
	}

	/**
	 * Parse the variables in a string
	 * @param str - String to parse variables in
	 * @returns with variables replaced with values
	 */
	parseVariables(str: string): ParseVariablesResult {
		return parseVariablesInString(str, this.#rawVariableValues, this.valueCacheAccessor, VARIABLE_UNKNOWN_VALUE)
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
