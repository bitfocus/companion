import { colord } from 'colord'
import type { JsonValue } from 'type-fest'
import type { ExecuteExpressionResult } from '@companion-app/shared/ExpressionResult.js'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ResolvedFeedbackStyleOverride } from '@companion-app/shared/Model/EntityModel.js'
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

/**
 * One kind of draw dependency, split into what was actually **drawn** and what belongs to elements only
 * **preserved while hidden** - children of a disabled group/composite, whose cache entries survive but
 * aren't rendered. A change to either must evict the affected cache entries, but only a change to something
 * drawn warrants a redraw. The drawer consumes each pair into a `DrawDependency` tracker.
 */
export interface DrawnAndHidden<T> {
	readonly drawn: Set<T>
	readonly hidden: Set<T>
}

export interface ExpressionReferences {
	readonly variables: DrawnAndHidden<string>
	readonly compositeElements: DrawnAndHidden<CompositeElementIdString>
	readonly referencedLocations: DrawnAndHidden<string>
	/** Locations where a cycle was detected during this conversion (a subset of referencedLocations.drawn). */
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
	for (const variable of element.usedVariables) global.variables.drawn.add(variable)
	if (element.clockSensitive) global.clockSensitive = true
}

/** Shared empty override map, so the common (no-override) path allocates nothing. */
const NO_VARIABLE_OVERRIDES: VariableValues = Object.freeze({})
const EMPTY_VARIABLE_IDS: ReadonlySet<string> = new Set()

/**
 * The raw (unparsed) value for an element property, plus the context needed to parse it. Callers parse
 * `value` themselves - injecting `variableOverrides` (e.g. `$(this:value)` for value feedbacks) - so the
 * expression is parsed in exactly one place, with the getter's own required type.
 */
interface ResolvedElementValue {
	/** The value/expression to use: the feedback override if one is present, otherwise the element's own value. */
	value: ExpressionOrValue<JsonValue | undefined>
	/** Variables to inject while parsing `value` as an expression (e.g. `this:value`); empty for the common case. */
	variableOverrides: VariableValues
	/**
	 * For value-feedback overrides only: the element's own value, applied when the override expression
	 * resolves to `undefined` ("no override"). `null` for every other case.
	 */
	undefinedFallback: ExpressionOrValue<JsonValue | undefined> | null
}

export class ElementExpressionHelper<T> {
	readonly #parser: VariablesAndExpressionParser

	/** Per-element references, merged into the global references after conversion */
	readonly #references: ElementReferences

	readonly #element: T
	readonly #elementOverrides: ReadonlyMap<string, ResolvedFeedbackStyleOverride> | undefined

	constructor(
		parser: VariablesAndExpressionParser,
		references: ElementReferences,
		element: T,
		elementOverrides: ReadonlyMap<string, ResolvedFeedbackStyleOverride> | undefined
	) {
		this.#parser = parser
		this.#references = references

		this.#element = element
		this.#elementOverrides = elementOverrides
	}

	executeExpressionAndTrackVariables(str: string, requiredType: string | undefined): ExecuteExpressionResult {
		return this.#trackExpression(this.#parser, str, requiredType)
	}

	/** Execute an expression with the given parser, recording its variable/clock dependencies. */
	#trackExpression(
		parser: VariablesAndExpressionParser,
		str: string,
		requiredType: string | undefined
	): ExecuteExpressionResult {
		const result = parser.executeExpression(str, requiredType)

		// Track the variables used in the expression, even when it failed
		for (const variable of result.variableIds) {
			this.#references.usedVariables.add(variable)
		}

		// Track clock sensitivity, even when the expression failed
		if (result.clockSensitive) this.#references.clockSensitive = true

		return result
	}

	/**
	 * Parse a property's override expression: evaluate `str` (with `variableOverrides` injected, e.g.
	 * `$(this:value)`), and for value-feedback overrides fall back to the element's own value when the
	 * expression fails or resolves to `undefined` ("no override"). This is the single place override
	 * expressions are parsed - the getters route their expression branch through here.
	 */
	#resolveOverrideExpression(
		str: string,
		requiredType: string | undefined,
		variableOverrides: VariableValues,
		undefinedFallback: ExpressionOrValue<JsonValue | undefined> | null
	): ExecuteExpressionResult {
		const parser =
			Object.keys(variableOverrides).length > 0 ? this.#parser.createChildParser(variableOverrides) : this.#parser
		const result = this.#trackExpression(parser, str, requiredType)

		if (undefinedFallback && (!result.ok || result.value === undefined)) {
			if (!undefinedFallback.isExpression) {
				return { ok: true, value: undefinedFallback.value, variableIds: EMPTY_VARIABLE_IDS, clockSensitive: false }
			}
			return this.#trackExpression(this.#parser, undefinedFallback.value, requiredType)
		}

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

	/**
	 * Resolve which raw value a property should use - the feedback override if present, otherwise the
	 * element's own value - WITHOUT parsing any expression. The caller parses `value`, injecting the
	 * returned `variableOverrides`, so nothing is evaluated for a property that is never read.
	 */
	#getValue(propertyName: keyof T): ResolvedElementValue {
		const base = ((this.#element as any)[propertyName] as ExpressionOrValue<JsonValue | undefined>) ?? {
			isExpression: false,
			value: undefined,
		}

		const override = this.#elementOverrides?.get(String(propertyName))
		if (!override) return { value: base, variableOverrides: NO_VARIABLE_OVERRIDES, undefinedFallback: null }

		// Boolean/advanced overrides apply directly, parsed like any element value
		if (override.thisContext === null) {
			return { value: override.value, variableOverrides: NO_VARIABLE_OVERRIDES, undefinedFallback: null }
		}

		// Value-feedback override: an expression transform of the feedback value. Expose the value as
		// `$(this:value)` while parsing, and fall back to the element's own value if it resolves to undefined.
		return {
			value: override.value,
			variableOverrides: { 'this:value': override.thisContext.value },
			undefinedFallback: base,
		}
	}

	getUnknown(propertyName: keyof T, defaultValue: VariableValue): VariableValue | undefined {
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = this.#resolveOverrideExpression(value.value, undefined, variableOverrides, undefinedFallback)
		if (!result.ok) {
			return defaultValue
		}

		return result.value
	}

	getParsedString(propertyName: keyof T, defaultValue: string): string {
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		// A plain string (the element's own value, or a boolean/advanced override) is a template: interpolate
		// its variables.
		if (!value.isExpression) {
			return this.parseVariablesInString(stringifyVariableValue(value.value) ?? '', defaultValue)
		}

		// An expression (an expression element value, or a value-feedback transform). Evaluate it - but pass
		// `null` for the fallback: a value-feedback override that resolves to `undefined` means "no override",
		// and the element's own value is a template that must be variable-interpolated, not stringified raw.
		const result = this.#resolveOverrideExpression(value.value, undefined, variableOverrides, null)
		if (result.ok && result.value !== undefined) {
			return stringifyVariableValue(result.value) ?? defaultValue
		}

		if (undefinedFallback) {
			if (!undefinedFallback.isExpression) {
				return this.parseVariablesInString(stringifyVariableValue(undefinedFallback.value) ?? '', defaultValue)
			}
			const fallback = this.executeExpressionAndTrackVariables(undefinedFallback.value, undefined)
			return fallback.ok ? (stringifyVariableValue(fallback.value) ?? defaultValue) : defaultValue
		}

		return defaultValue
	}

	getNumber(propertyName: keyof T, defaultValue: number, scale = 1): number {
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		if (!value.isExpression) {
			const num = Number(value.value)
			return isNaN(num) ? defaultValue : num * scale
		}

		const result = this.#resolveOverrideExpression(value.value, 'number', variableOverrides, undefinedFallback)
		if (!result.ok) {
			return defaultValue
		}

		// Number(undefined) = NaN and typeof NaN === 'number', so ok:true can still yield NaN
		// (e.g. when a referenced variable doesn't exist). Treat NaN as a missing value.
		const num = Number(result.value)
		return isNaN(num) ? defaultValue : num * scale
	}

	/**
	 * Like {@link getNumber}, but for a nullable ("auto") number field: an explicitly empty value (`null`,
	 * `undefined` or an empty string, or an expression resolving to one) yields `null` rather than the
	 * default. A non-empty but unparsable value falls back to `defaultValue`.
	 */
	getNumberOrNull(propertyName: keyof T, defaultValue: number | null): number | null {
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		if (!value.isExpression) {
			if (value.value === null || value.value === undefined || value.value === '') return null
			const num = Number(value.value)
			return isNaN(num) ? defaultValue : num
		}

		// Deliberately do NOT request the 'number' type, as we need to receive null too
		const result = this.#resolveOverrideExpression(value.value, undefined, variableOverrides, undefinedFallback)
		if (!result.ok) return defaultValue

		if (result.value === null || result.value === undefined || result.value === '') return null
		const num = Number(result.value)
		return isNaN(num) ? defaultValue : num
	}

	/**
	 * Resolve a color property, preserving css color strings. A numeric (or numeric-string) value becomes a number;
	 * a valid css color string is kept as-is; anything else falls back to the default. Mirrors the number/string
	 * semantics of parseColor so the value renders correctly downstream.
	 *
	 * When allowAlpha is false (the field disables alpha) any transparency is discarded, so a translucent value is
	 * forced fully opaque.
	 */
	getColor(propertyName: keyof T, defaultValue: number | string, allowAlpha = true): number | string {
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		let raw: unknown
		if (!value.isExpression) {
			raw = value.value
		} else {
			// Do not force a 'number' result type, otherwise a css color string would be rejected
			const result = this.#resolveOverrideExpression(value.value, undefined, variableOverrides, undefinedFallback)
			raw = result.ok ? result.value : undefined
		}

		let color: number | string
		if (typeof raw === 'number' && !isNaN(raw)) {
			color = raw
		} else if (typeof raw === 'string' && raw.trim() !== '' && !isNaN(Number(raw))) {
			color = Number(raw)
		} else if (typeof raw === 'string' && colord(raw).isValid()) {
			color = raw
		} else {
			color = defaultValue
		}

		if (!allowAlpha) {
			// Discard any transparency: clear the alpha byte on a number, or force a css string fully opaque
			if (typeof color === 'number') return color & 0xffffff
			if (colord(color).alpha() < 1) return colord(color).alpha(1).toRgbString()
		}
		return color
	}

	getString<TVal extends string | null | undefined>(propertyName: keyof T, defaultValue: TVal): TVal {
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		if (!value.isExpression) {
			if (value.value === null || value.value === undefined) return value.value as TVal
			return stringifyVariableValue(value.value) as TVal
		}

		const result = this.#resolveOverrideExpression(value.value, undefined, variableOverrides, undefinedFallback)
		if (!result.ok) {
			return defaultValue
		}

		// stringifyVariableValue returns undefined only when result.value is undefined
		// (e.g. the referenced variable doesn't exist). Treat that as a missing value.
		const stringified = stringifyVariableValue(result.value)
		return (stringified ?? defaultValue) as TVal
	}

	getEnum<TVal extends string | number>(propertyName: keyof T, values: TVal[], defaultValue: TVal): TVal {
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		let actualValue: TVal = value.value as TVal
		if (value.isExpression) {
			const result = this.#resolveOverrideExpression(
				value.value,
				typeof defaultValue === 'number' ? 'number' : 'string',
				variableOverrides,
				undefinedFallback
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
	 * Like getEnum, but for a field whose value is an array of enum values (e.g. a multi-toggle).
	 * Resolves an expression if present, requires an array result, and filters to the allowed values.
	 */
	getEnumArray<TVal extends string>(propertyName: keyof T, values: readonly TVal[], defaultValue: TVal[]): TVal[] {
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		let actualValue: unknown = value.value
		if (value.isExpression) {
			const result = this.#resolveOverrideExpression(value.value, undefined, variableOverrides, undefinedFallback)
			if (!result.ok) {
				return defaultValue
			}
			actualValue = result.value
		}

		if (!Array.isArray(actualValue)) return defaultValue
		return actualValue.filter((v): v is TVal => (values as readonly string[]).includes(v))
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
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		if (!value.isExpression) {
			// A missing property (added to the schema after an element was saved) surfaces as
			// `undefined` and must fall back to the default rather than coercing to `false`.
			// An explicit `null`/`0`/`''` is still treated as falsy.
			if (value.value === undefined) return defaultValue
			return Boolean(value.value)
		}

		const result = this.#resolveOverrideExpression(value.value, 'boolean', variableOverrides, undefinedFallback)
		if (!result.ok) {
			return defaultValue
		}

		return result.value as boolean
	}

	getHorizontalAlignment(propertyName: keyof T): HorizontalAlignment {
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		if (!value.isExpression) {
			return this.getEnum<HorizontalAlignment>(propertyName, ['left', 'center', 'right'], 'center')
		}

		const result = this.#resolveOverrideExpression(value.value, 'string', variableOverrides, undefinedFallback)
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
		const { value, variableOverrides, undefinedFallback } = this.#getValue(propertyName)

		if (!value.isExpression) {
			return this.getEnum<VerticalAlignment>(propertyName, ['top', 'center', 'bottom'], 'center')
		}

		const result = this.#resolveOverrideExpression(value.value, 'string', variableOverrides, undefinedFallback)
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
	feedbackOverrides: ReadonlyMap<string, ReadonlyMap<string, ResolvedFeedbackStyleOverride>>,
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
