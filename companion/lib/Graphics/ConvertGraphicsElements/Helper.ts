import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Expression.js'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { DrawImageBuffer } from '@companion-app/shared/Model/StyleModel.js'
import {
	stringifyVariableValue,
	type VariableValues,
	type VariableValue,
} from '@companion-app/shared/Model/Variables.js'
import type {
	InstanceDefinitions,
	CompositeElementDefinition,
	CompositeElementIdString,
} from '../../Instance/Definitions.js'
import type { ElementConversionCache } from '../ElementConversionCache.js'

export interface ExpressionReferences {
	readonly variables: Set<string>
	readonly compositeElements: Set<CompositeElementIdString>
}

export class ElementExpressionHelper<T> {
	readonly #parser: VariablesAndExpressionParser

	/** Per-element references tracked during conversion */
	readonly #usedVariables: Set<string>

	readonly #element: T
	readonly #elementOverrides: ReadonlyMap<string, ExpressionOrValue<any>> | undefined

	constructor(
		parser: VariablesAndExpressionParser,
		usedVariables: Set<string>,
		element: T,
		elementOverrides: ReadonlyMap<string, ExpressionOrValue<any>> | undefined
	) {
		this.#parser = parser
		this.#usedVariables = usedVariables

		this.#element = element
		this.#elementOverrides = elementOverrides
	}

	executeExpressionAndTrackVariables(str: string, requiredType: string | undefined): ExecuteExpressionResult {
		const result = this.#parser.executeExpression(str, requiredType)

		// Track the variables used in the expression, even when it failed
		for (const variable of result.variableIds) {
			this.#usedVariables.add(variable)
		}

		return result
	}

	parseVariablesInString(str: string, defaultValue: string): string {
		try {
			const result = this.#parser.parseVariables(str)

			// Track the variables used
			for (const variable of result.variableIds) {
				this.#usedVariables.add(variable)
			}

			return String(result.text)
		} catch (_e) {
			// Ignore errors
			return defaultValue
		}
	}

	#getValue(propertyName: keyof T): ExpressionOrValue<any> {
		const override = this.#elementOverrides?.get(String(propertyName))
		return override ? override : (this.#element as any)[propertyName]
	}

	getUnknown(propertyName: keyof T, defaultValue: VariableValue): VariableValue | undefined {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = this.executeExpressionAndTrackVariables(value.value, undefined)
		if (!result.ok) {
			return defaultValue
		}

		return result.value
	}

	getDrawText(propertyName: keyof T): string {
		const value = this.#getValue(propertyName)
		if (value.isExpression) {
			return stringifyVariableValue(this.getUnknown(propertyName, 'ERR')) ?? ''
		} else {
			return this.parseVariablesInString(value.value, 'ERR')
		}
	}

	getNumber(propertyName: keyof T, defaultValue: number, scale = 1): number {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value * scale

		const result = this.executeExpressionAndTrackVariables(value.value, 'number')
		if (!result.ok) {
			return defaultValue
		}

		return Number(result.value) * scale
	}

	getString<TVal extends string | null | undefined>(propertyName: keyof T, defaultValue: TVal): TVal {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = this.executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) {
			return defaultValue
		}

		if (typeof result.value !== 'string') {
			return defaultValue
		}

		return result.value as TVal
	}

	getEnum<TVal extends string | number>(propertyName: keyof T, values: TVal[], defaultValue: TVal): TVal {
		const value = this.#getValue(propertyName)

		let actualValue: TVal = value.value
		if (value.isExpression) {
			const result = this.executeExpressionAndTrackVariables(
				value.value,
				typeof defaultValue === 'number' ? 'number' : 'string'
			)
			if (!result.ok) {
				return defaultValue
			}
			actualValue = result.value as TVal
		}

		if (!values.includes(actualValue)) {
			return defaultValue
		}

		return actualValue
	}

	getBoolean(propertyName: keyof T, defaultValue: boolean): boolean {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = this.executeExpressionAndTrackVariables(value.value, 'boolean')
		if (!result.ok) {
			return defaultValue
		}

		return result.value as boolean
	}

	getHorizontalAlignment(propertyName: keyof T): HorizontalAlignment {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) {
			return this.getEnum<HorizontalAlignment>(propertyName, ['left', 'center', 'right'], 'center')
		}

		const result = this.executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) return 'center'

		const firstChar = (stringifyVariableValue(result.value) ?? '').trim().toLowerCase()[0]
		switch (firstChar) {
			case 'l':
			case 's':
				return 'left'

			case 'r':
			case 'e':
				return 'right'

			default:
				return 'center'
		}
	}
	getVerticalAlignment(propertyName: keyof T): VerticalAlignment {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) {
			return this.getEnum<VerticalAlignment>(propertyName, ['top', 'center', 'bottom'], 'center')
		}

		const result = this.executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) return 'center'

		const firstChar = (stringifyVariableValue(result.value) ?? '').trim().toLowerCase()[0]
		switch (firstChar) {
			case 't':
			case 's':
				return 'top'

			case 'b':
			case 'e':
				return 'bottom'

			default:
				return 'center'
		}
	}
}
export type DrawPixelBuffers = (imageBuffers: DrawImageBuffer[]) => Promise<string | undefined>

/**
 * Factory for creating per-element expression helpers.
 * Also carries shared state for the conversion pass including cache and reference tracking.
 */
export interface ParseElementsContext {
	/**
	 * Create a helper for converting a specific element
	 */
	createHelper<T extends { readonly id: string }>(
		element: T
	): { helper: ElementExpressionHelper<T>; usedVariables: ReadonlySet<string> }

	/** The cache for storing/retrieving converted elements */
	readonly cache: ElementConversionCache | null

	/** Global references accumulated during conversion */
	readonly globalReferences: ExpressionReferences

	/** Set of element IDs that have been processed (with prefixes applied) */
	readonly processedElementIds: Set<string>

	/** Whether to only process enabled elements */
	readonly onlyEnabled: boolean

	/**  Function to prepare pixel buffers for image elements */
	readonly drawPixelBuffers: DrawPixelBuffers

	/**
	 * Create a child factory for recursive conversion (e.g., inside composite elements)
	 * with prop overrides injected into the parser
	 */
	withPropOverrides(propOverrides: VariableValues): ParseElementsContext

	resolveCompositeElement(connectionId: string, elementId: string): CompositeElementDefinition | null
}

/**
 * Create a helper context for element conversion
 */
export function createParseElementsContext(
	compositeElementStore: InstanceDefinitions,
	parser: VariablesAndExpressionParser,
	drawPixelBuffers: DrawPixelBuffers,
	feedbackOverrides: ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<any>>>,
	onlyEnabled: boolean,
	cache: ElementConversionCache | null,
	globalReferences: ExpressionReferences,
	processedElementIds: Set<string>
): ParseElementsContext {
	return {
		cache,
		globalReferences,
		processedElementIds,
		onlyEnabled,
		drawPixelBuffers,

		createHelper<T extends { readonly id: string }>(
			element: T
		): { helper: ElementExpressionHelper<T>; usedVariables: ReadonlySet<string> } {
			// Create per-element references that will be merged into global references
			const usedVariables = new Set<string>()

			const helper = new ElementExpressionHelper(parser, usedVariables, element, feedbackOverrides.get(element.id))

			return { helper, usedVariables }
		},

		withPropOverrides(propOverrides: VariableValues): ParseElementsContext {
			return createParseElementsContext(
				compositeElementStore,
				parser.createChildParser(propOverrides),
				drawPixelBuffers,
				feedbackOverrides,
				onlyEnabled,
				cache,
				globalReferences,
				processedElementIds
			)
		},

		resolveCompositeElement(connectionId: string, elementId: string): CompositeElementDefinition | null {
			const definition = compositeElementStore.getCompositeElementDefinition(connectionId, elementId)
			return definition ?? null
		},
	}
}
