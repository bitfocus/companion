import type { JsonValue } from 'type-fest'
import type { ExecuteExpressionResult } from '@companion-app/shared/ExpressionResult.js'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { isExpressionOrValue, type ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { DrawImageBuffer } from '@companion-app/shared/Model/StyleModel.js'
import {
	stringifyVariableValue,
	type VariableValue,
	type VariableValues,
} from '@companion-app/shared/Model/Variables.js'
import type {
	CompositeElementDefinition,
	CompositeElementIdString,
	InstanceDefinitions,
} from '../../Instance/Definitions.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { ElementConversionCache } from '../ElementConversionCache.js'
import type { ImageResult } from '../ImageResult.js'

export interface ExpressionReferences {
	readonly variables: Set<string>
	readonly compositeElements: Set<CompositeElementIdString>
	readonly referencedLocations: Set<string>
	/** Locations where a cycle was detected during this conversion (subset of referencedLocations) */
	readonly cyclicLocations: Set<string>
	/** Whether any expression evaluated during this conversion depends on the render clock */
	clockSensitive: boolean
}

/**
 * References accumulated while converting a single element, merged into the shared
 * {@link ExpressionReferences} afterward via {@link mergeElementReferences}. Kept
 * per-element so siblings converted concurrently via `Promise.all` don't clobber
 * each other (e.g. one oscillating sibling marking another as clock-insensitive).
 */
export interface ElementReferences {
	/** Variables referenced during expression evaluation for this element */
	readonly usedVariables: Set<string>
	/** Whether any expression evaluated for this element depends on the render clock */
	clockSensitive: boolean
}

/** Create a fresh, empty per-element references accumulator. */
export function createElementReferences(): ElementReferences {
	return { usedVariables: new Set(), clockSensitive: false }
}

/** Merge a single element's accumulated references into the global references. */
export function mergeElementReferences(global: ExpressionReferences, element: ElementReferences): void {
	for (const variable of element.usedVariables) global.variables.add(variable)
	if (element.clockSensitive) global.clockSensitive = true
}

export class ElementExpressionHelper<T> {
	readonly #parser: VariablesAndExpressionParser

	/** Per-element references, merged into the global references after conversion */
	readonly #references: ElementReferences

	readonly #element: T
	readonly #elementOverrides: ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>> | undefined

	constructor(
		parser: VariablesAndExpressionParser,
		references: ElementReferences,
		element: T,
		elementOverrides: ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>> | undefined
	) {
		this.#parser = parser
		this.#references = references

		this.#element = element
		this.#elementOverrides = elementOverrides
	}

	executeExpressionAndTrackVariables(str: string, requiredType: string | undefined): ExecuteExpressionResult {
		const result = this.#parser.executeExpression(str, requiredType)

		// Track the variables used in the expression, even when it failed
		for (const variable of result.variableIds) {
			this.#references.usedVariables.add(variable)
		}

		// Track clock sensitivity, even when the expression failed
		if (result.clockSensitive) this.#references.clockSensitive = true

		return result
	}

	parseVariablesInString(str: string, defaultValue: string): string {
		try {
			const result = this.#parser.parseVariables(str)

			// Track the variables used
			for (const variable of result.variableIds) {
				this.#references.usedVariables.add(variable)
			}

			return String(result.text)
		} catch (_e) {
			// Ignore errors
			return defaultValue
		}
	}

	#getValue(propertyName: keyof T): ExpressionOrValue<JsonValue | undefined> {
		const override = this.#elementOverrides?.get(String(propertyName))
		return override ?? (this.#element as any)[propertyName] ?? { isExpression: false, value: undefined }
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

	getParsedString(propertyName: keyof T, defaultValue: string): string {
		const value = this.#getValue(propertyName)
		if (value.isExpression) {
			return stringifyVariableValue(this.getUnknown(propertyName, defaultValue)) ?? defaultValue
		} else {
			return this.parseVariablesInString(stringifyVariableValue(value.value) ?? '', defaultValue)
		}
	}

	getNumber(propertyName: keyof T, defaultValue: number, scale = 1): number {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) {
			const num = Number(value.value)
			return isNaN(num) ? defaultValue : num * scale
		}

		const result = this.executeExpressionAndTrackVariables(value.value, 'number')
		if (!result.ok) {
			return defaultValue
		}

		// Number(undefined) = NaN and typeof NaN === 'number', so ok:true can still yield NaN
		// (e.g. when a referenced variable doesn't exist). Treat NaN as a missing value.
		const num = Number(result.value)
		return isNaN(num) ? defaultValue : num * scale
	}

	getString<TVal extends string | null | undefined>(propertyName: keyof T, defaultValue: TVal): TVal {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) {
			if (value.value === null || value.value === undefined) return value.value as TVal
			return stringifyVariableValue(value.value) as TVal
		}

		const result = this.executeExpressionAndTrackVariables(value.value, undefined)
		if (!result.ok) {
			return defaultValue
		}

		// stringifyVariableValue returns undefined only when result.value is undefined
		// (e.g. the referenced variable doesn't exist). Treat that as a missing value.
		const stringified = stringifyVariableValue(result.value)
		return (stringified ?? defaultValue) as TVal
	}

	getEnum<TVal extends string | number>(propertyName: keyof T, values: TVal[], defaultValue: TVal): TVal {
		const value = this.#getValue(propertyName)

		let actualValue: TVal = value.value as TVal
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

	/**
	 * Like getEnum, but compares the string value to the enum values in a tolerant way:
	 * Matches only the first non-whitespace character, case-insensitively.
	 */
	getTolerantEnum<TVal extends string>(propertyName: keyof T, values: readonly TVal[], defaultValue: TVal): TVal {
		const raw = this.getString(propertyName, defaultValue)
		const trimmed = String(raw ?? '')
			.trim()
			.toLowerCase()
		// An empty/whitespace-only input has no first character to match against, so
		// `startsWith(undefined)` would coerce to `startsWith('undefined')` and never match.
		// Fall back to the default explicitly instead.
		if (trimmed.length === 0) return defaultValue
		return values.find((v) => v.toLowerCase().startsWith(trimmed[0])) ?? defaultValue
	}

	getBoolean(propertyName: keyof T, defaultValue: boolean): boolean {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) {
			// A missing property (added to the schema after an element was saved) surfaces as
			// `undefined` and must fall back to the default rather than coercing to `false`.
			// An explicit `null`/`0`/`''` is still treated as falsy.
			if (value.value === undefined) return defaultValue
			return Boolean(value.value)
		}

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

	/**
	 * Create a helper for a row of an internal:list or internal:table (or other child object)
	 */
	forRow(row: unknown): ElementExpressionHelper<Record<string, ExpressionOrValue<JsonValue | undefined>>> {
		const normalised: Record<string, ExpressionOrValue<JsonValue | undefined>> = {}
		if (row && typeof row === 'object' && !Array.isArray(row)) {
			for (const key of Object.keys(row)) {
				const val = (row as Record<string, unknown>)[key]
				normalised[key] = isExpressionOrValue(val) ? val : { isExpression: false, value: val as JsonValue | undefined }
			}
		}
		return new ElementExpressionHelper(this.#parser, this.#references, normalised, undefined)
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
	): { helper: ElementExpressionHelper<T>; references: ElementReferences }

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

	/** Location string of the button being drawn (e.g. '1/0/0'), used for loop detection */
	readonly currentLocationStr: string | null

	/** Callback to fetch the last-rendered ImageResult for a given location */
	readonly getRenderAtLocation: ((location: ControlLocation) => ImageResult | null) | null

	/**
	 * Create a child factory for recursive conversion (e.g., inside composite elements)
	 * with prop overrides injected into the parser
	 */
	withPropOverrides(propOverrides: VariableValues): ParseElementsContext

	/**
	 * Resolve a composite element definition by connection and element ID
	 * @param connectionId The connection ID
	 * @param elementId The element ID
	 * @return The definition or null if not found
	 */
	resolveCompositeElement(connectionId: string, elementId: string): CompositeElementDefinition | null
}

/**
 * Create a helper context for element conversion
 */
export function createParseElementsContext(
	compositeElementStore: InstanceDefinitions,
	parser: VariablesAndExpressionParser,
	drawPixelBuffers: DrawPixelBuffers,
	feedbackOverrides: ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>>,
	onlyEnabled: boolean,
	cache: ElementConversionCache | null,
	globalReferences: ExpressionReferences,
	processedElementIds: Set<string>,
	currentLocationStr: string | null,
	getRenderAtLocation: ((location: ControlLocation) => ImageResult | null) | null
): ParseElementsContext {
	return {
		cache,
		globalReferences,
		processedElementIds,
		onlyEnabled,
		drawPixelBuffers,
		currentLocationStr,
		getRenderAtLocation,

		createHelper<T extends { readonly id: string }>(
			element: T
		): { helper: ElementExpressionHelper<T>; references: ElementReferences } {
			const references = createElementReferences()
			const helper = new ElementExpressionHelper(parser, references, element, feedbackOverrides.get(element.id))

			return { helper, references }
		},

		withPropOverrides(propOverrides: VariableValues): ParseElementsContext {
			return createParseElementsContext(
				compositeElementStore,
				parser.createIsolatedChildParser(propOverrides),
				drawPixelBuffers,
				feedbackOverrides,
				onlyEnabled,
				cache,
				globalReferences,
				processedElementIds,
				currentLocationStr,
				getRenderAtLocation
			)
		},

		resolveCompositeElement(connectionId: string, elementId: string): CompositeElementDefinition | null {
			const definition = compositeElementStore.getCompositeElementDefinition(connectionId, elementId)
			return definition ?? null
		},
	}
}
