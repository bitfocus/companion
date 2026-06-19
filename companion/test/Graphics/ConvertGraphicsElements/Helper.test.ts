import type { JsonValue } from 'type-fest'
import { describe, expect, test, vi } from 'vitest'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import {
	createParseElementsContext,
	ElementExpressionHelper,
	type ExpressionReferences,
} from '../../../lib/Graphics/ConvertGraphicsElements/Helper.js'
import type { CompositeElementDefinition, InstanceDefinitions } from '../../../lib/Instance/Definitions.js'
import {
	executeExpression,
	parseVariablesInString,
	type VariableValueCache,
	type VariableValueData,
} from '../../../lib/Variables/Util.js'
import type { VariablesAndExpressionParser } from '../../../lib/Variables/VariablesAndExpressionParser.js'

function val<T>(value: T): ExpressionOrValue<T> {
	return { isExpression: false, value }
}

function expr<T>(value: string): ExpressionOrValue<T> {
	return { isExpression: true, value } as ExpressionOrValue<T>
}

function createMockParser(
	variableValues: Record<string, Record<string, string | number | boolean>> = {}
): VariablesAndExpressionParser {
	const rawVariableValues: VariableValueData = variableValues
	const createCache = (): VariableValueCache => new Map() as unknown as VariableValueCache
	const blinker = null as any

	const createParserWithOverrides = (overrides: VariableValues): VariablesAndExpressionParser => {
		const parser = {
			executeExpression: (str: string, requiredType: string | undefined) => {
				const cache = createCache()
				for (const [key, value] of Object.entries(overrides)) {
					cache.set(key, value as any)
				}
				return executeExpression(blinker, str, rawVariableValues, requiredType, cache)
			},
			parseVariables: (str: string) => {
				const cache = createCache()
				for (const [key, value] of Object.entries(overrides)) {
					cache.set(key, value as any)
				}
				return parseVariablesInString(str, rawVariableValues, cache, VARIABLE_UNKNOWN_VALUE)
			},
			createChildParser: (childOverrides: VariableValues) => {
				return createParserWithOverrides({ ...overrides, ...childOverrides })
			},
		}
		return parser as unknown as VariablesAndExpressionParser
	}

	return createParserWithOverrides({})
}

type TestEl = {
	id: string
	strProp: ExpressionOrValue<string | null | undefined>
	numProp: ExpressionOrValue<number>
	boolProp: ExpressionOrValue<boolean>
	enumProp: ExpressionOrValue<string>
	anyProp: ExpressionOrValue<JsonValue | undefined>
}

function makeEl(overrides: Partial<TestEl> = {}): TestEl {
	return {
		id: 'el1',
		strProp: val('hello'),
		numProp: val(42),
		boolProp: val(true),
		enumProp: val('left'),
		anyProp: val(99 as JsonValue),
		...overrides,
	}
}

function makeHelper(
	element: TestEl,
	variableValues: Record<string, Record<string, string | number | boolean>> = {},
	overrides?: ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>
): { helper: ElementExpressionHelper<TestEl>; usedVariables: Set<string> } {
	const usedVariables = new Set<string>()
	const parser = createMockParser(variableValues)
	const helper = new ElementExpressionHelper(parser, usedVariables, element, overrides)
	return { helper, usedVariables }
}

function makeGlobalRefs(): ExpressionReferences {
	return {
		variables: new Set(),
		compositeElements: new Set(),
		referencedLocations: new Set(),
		cyclicLocations: new Set(),
	}
}

function createMockInstanceDefinitions(
	elements: Record<string, Record<string, CompositeElementDefinition>> = {}
): InstanceDefinitions {
	return {
		getCompositeElementDefinition: vi.fn((connectionId: string, elementId: string) => {
			return elements[connectionId]?.[elementId]
		}),
	} as unknown as InstanceDefinitions
}

const mockDrawPixelBuffers = vi.fn(async () => undefined)

function makeCtx(
	options: {
		compositeElements?: Record<string, Record<string, CompositeElementDefinition>>
		variableValues?: Record<string, Record<string, string | number | boolean>>
		feedbackOverrides?: ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>>
	} = {}
) {
	return createParseElementsContext(
		createMockInstanceDefinitions(options.compositeElements),
		createMockParser(options.variableValues),
		mockDrawPixelBuffers,
		options.feedbackOverrides ?? new Map(),
		true,
		null,
		makeGlobalRefs(),
		new Set(),
		null,
		null
	)
}

describe('ElementExpressionHelper', () => {
	describe('executeExpressionAndTrackVariables', () => {
		test('returns expression result and tracks referenced variable IDs', () => {
			const { helper, usedVariables } = makeHelper(makeEl(), { ns: { x: 10 } })
			const result = helper.executeExpressionAndTrackVariables('$(ns:x) + 1', 'number')
			expect(result.ok).toBe(true)
			if (result.ok) expect(result.value).toBe(11)
			expect(usedVariables.has('ns:x')).toBe(true)
		})

		test('tracks variable IDs even when expression type check fails', () => {
			// Numeric variable with requiredType:'object' forces ok:false (no coercion for object)
			const { helper, usedVariables } = makeHelper(makeEl(), { ns: { x: 10 } })
			const result = helper.executeExpressionAndTrackVariables('$(ns:x)', 'object')
			expect(result.ok).toBe(false)
			expect(usedVariables.has('ns:x')).toBe(true)
		})

		test('returns failed result and empty variable set for syntax error', () => {
			const { helper, usedVariables } = makeHelper(makeEl())
			const result = helper.executeExpressionAndTrackVariables(')', undefined)
			expect(result.ok).toBe(false)
			expect(usedVariables.size).toBe(0)
		})

		test('accumulates variables across multiple calls', () => {
			const { helper, usedVariables } = makeHelper(makeEl(), { ns: { a: 1, b: 2 } })
			helper.executeExpressionAndTrackVariables('$(ns:a)', undefined)
			helper.executeExpressionAndTrackVariables('$(ns:b)', undefined)
			expect(usedVariables.has('ns:a')).toBe(true)
			expect(usedVariables.has('ns:b')).toBe(true)
		})

		test('empty expression string evaluates to undefined (ok:true, not a syntax error)', () => {
			const { helper } = makeHelper(makeEl())
			const result = helper.executeExpressionAndTrackVariables('', undefined)
			expect(result.ok).toBe(true)
			if (result.ok) expect(result.value).toBeUndefined()
		})
	})

	describe('parseVariablesInString', () => {
		test('substitutes known variables and tracks their IDs', () => {
			const { helper, usedVariables } = makeHelper(makeEl(), { ns: { name: 'World' } })
			const result = helper.parseVariablesInString('Hello $(ns:name)!', '')
			expect(result).toBe('Hello World!')
			expect(usedVariables.has('ns:name')).toBe(true)
		})

		test('returns string unchanged when no variable references present', () => {
			const { helper, usedVariables } = makeHelper(makeEl())
			const result = helper.parseVariablesInString('plain text', 'default')
			expect(result).toBe('plain text')
			expect(usedVariables.size).toBe(0)
		})

		test('returns defaultValue and does not throw when parser throws', () => {
			const usedVariables = new Set<string>()
			const throwingParser = {
				parseVariables: (): never => {
					throw new Error('parse error')
				},
				executeExpression: (): never => {
					throw new Error('should not be called')
				},
				createChildParser: () => throwingParser,
			} as unknown as VariablesAndExpressionParser
			const helper = new ElementExpressionHelper(throwingParser, usedVariables, makeEl(), undefined)
			expect(helper.parseVariablesInString('$(ns:x)', 'fallback')).toBe('fallback')
		})

		test('substitutes multiple variables in one string', () => {
			const { helper } = makeHelper(makeEl(), { ns: { a: 'foo', b: 'bar' } })
			const result = helper.parseVariablesInString('$(ns:a) and $(ns:b)', '')
			expect(result).toBe('foo and bar')
		})

		test('replaces undefined variable reference with VARIABLE_UNKNOWN_VALUE', () => {
			const { helper } = makeHelper(makeEl())
			// ns:missing is not in the variable store
			const result = helper.parseVariablesInString('value: $(ns:missing)', '')
			expect(result).toBe(`value: ${VARIABLE_UNKNOWN_VALUE}`)
		})

		test('returns empty string for empty input', () => {
			const { helper } = makeHelper(makeEl())
			expect(helper.parseVariablesInString('', 'default')).toBe('')
		})
	})

	describe('getUnknown', () => {
		test('returns plain value directly without calling parser', () => {
			const { helper, usedVariables } = makeHelper(makeEl({ anyProp: val(42 as JsonValue) }))
			expect(helper.getUnknown('anyProp', 0)).toBe(42)
			expect(usedVariables.size).toBe(0)
		})

		test('evaluates expression and returns resolved value', () => {
			const { helper } = makeHelper(makeEl({ anyProp: expr('$(ns:x) + 1') }), { ns: { x: 5 } })
			expect(helper.getUnknown('anyProp', 0)).toBe(6)
		})

		test('returns defaultValue when expression has syntax error', () => {
			const { helper } = makeHelper(makeEl({ anyProp: expr(')') }))
			expect(helper.getUnknown('anyProp', 'fallback')).toBe('fallback')
		})

		test('returns null plain value as-is', () => {
			const { helper } = makeHelper(makeEl({ anyProp: val(null) }))
			expect(helper.getUnknown('anyProp', 'default')).toBeNull()
		})

		test('returns undefined plain value as-is (not the defaultValue)', () => {
			const { helper } = makeHelper(makeEl({ anyProp: val(undefined) }))
			expect(helper.getUnknown('anyProp', 'default')).toBeUndefined()
		})

		test('returns undefined when expression resolves undefined variable (ok:true but value is undefined)', () => {
			// Missing variable resolves to undefined — ok:true, so defaultValue is NOT used
			const { helper } = makeHelper(makeEl({ anyProp: expr('$(ns:missing)') }))
			expect(helper.getUnknown('anyProp', 'default')).toBeUndefined()
		})
	})

	describe('getParsedString', () => {
		test('parses variables in non-expression string value', () => {
			const { helper } = makeHelper(makeEl({ strProp: val('$(ns:name)') }), { ns: { name: 'World' } })
			expect(helper.getParsedString('strProp', '')).toBe('World')
		})

		test('evaluates expression and stringifies result', () => {
			const { helper } = makeHelper(makeEl({ strProp: expr('$(ns:count) + 1') }), { ns: { count: 5 } })
			expect(helper.getParsedString('strProp', '')).toBe('6')
		})

		test('expression resolving to undefined (missing variable) returns defaultValue', () => {
			const { helper } = makeHelper(makeEl({ strProp: expr('$(ns:missing)') }))
			expect(helper.getParsedString('strProp', 'default')).toBe('default')
		})

		test('null non-expression value stringifies to "null"', () => {
			// stringifyVariableValue(null) = JSON.stringify(null) = 'null'
			const { helper } = makeHelper(makeEl({ strProp: val(null as any) }))
			expect(helper.getParsedString('strProp', 'default')).toBe('null')
		})

		test('undefined non-expression value stringifies to empty string', () => {
			// stringifyVariableValue(undefined) = undefined, then ?? '' gives ''
			const { helper } = makeHelper(makeEl({ strProp: val(undefined as any) }))
			expect(helper.getParsedString('strProp', 'default')).toBe('')
		})
	})

	describe('getNumber', () => {
		test('returns Number() of plain value', () => {
			const { helper } = makeHelper(makeEl({ numProp: val(42) }))
			expect(helper.getNumber('numProp', 0)).toBe(42)
		})

		test('applies scale factor to plain value', () => {
			const { helper } = makeHelper(makeEl({ numProp: val(100) }))
			expect(helper.getNumber('numProp', 0, 0.01)).toBeCloseTo(1)
		})

		test('evaluates expression and applies scale', () => {
			const { helper } = makeHelper(makeEl({ numProp: expr('$(ns:x) * 2') }), { ns: { x: 5 } })
			expect(helper.getNumber('numProp', 0, 2)).toBe(20)
		})

		test('returns defaultValue when expression has syntax error', () => {
			const { helper } = makeHelper(makeEl({ numProp: expr(')') }))
			expect(helper.getNumber('numProp', 99)).toBe(99)
		})

		test('scale defaults to 1 when not provided', () => {
			const { helper } = makeHelper(makeEl({ numProp: val(7) }))
			expect(helper.getNumber('numProp', 0)).toBe(7)
		})

		test('null value coerces to 0 via Number()', () => {
			const { helper } = makeHelper(makeEl({ numProp: val(null) as any }))
			expect(helper.getNumber('numProp', 99)).toBe(0)
		})

		test('undefined value falls back to defaultValue (NaN is treated as missing)', () => {
			const { helper } = makeHelper(makeEl({ numProp: val(undefined) as any }))
			expect(helper.getNumber('numProp', 99)).toBe(99)
		})

		test('numeric string value coerces correctly', () => {
			const { helper } = makeHelper(makeEl({ numProp: val('3.14') as any }))
			expect(helper.getNumber('numProp', 0)).toBeCloseTo(3.14)
		})

		test('non-numeric string value falls back to defaultValue (NaN treated as missing)', () => {
			const { helper } = makeHelper(makeEl({ numProp: val('not-a-number') as any }))
			expect(helper.getNumber('numProp', 99)).toBe(99)
		})

		test('expression resolving to undefined (empty expression) returns defaultValue', () => {
			const { helper } = makeHelper(makeEl({ numProp: expr('') }))
			expect(helper.getNumber('numProp', 99)).toBe(99)
		})

		test('expression resolving to undefined (missing variable) returns defaultValue', () => {
			const { helper } = makeHelper(makeEl({ numProp: expr('$(ns:missing)') }))
			expect(helper.getNumber('numProp', 99)).toBe(99)
		})
	})

	describe('getString', () => {
		test('returns null for null plain value', () => {
			const { helper } = makeHelper(makeEl({ strProp: val(null) }))
			expect(helper.getString('strProp', '')).toBeNull()
		})

		test('returns undefined for undefined plain value', () => {
			const { helper } = makeHelper(makeEl({ strProp: val(undefined) }))
			expect(helper.getString('strProp', undefined)).toBeUndefined()
		})

		test('stringifies string plain value', () => {
			const { helper } = makeHelper(makeEl({ strProp: val('hello') }))
			expect(helper.getString('strProp', '')).toBe('hello')
		})

		test('evaluates expression returning a string', () => {
			const { helper } = makeHelper(makeEl({ strProp: expr('"computed"') }))
			expect(helper.getString('strProp', '')).toBe('computed')
		})

		test('returns defaultValue for syntax error expression', () => {
			const { helper } = makeHelper(makeEl({ strProp: expr(')') }))
			expect(helper.getString('strProp', 'fallback')).toBe('fallback')
		})

		test('stringifies boolean plain value', () => {
			const { helper } = makeHelper(makeEl({ strProp: val(true as any) }))
			expect(helper.getString('strProp', '')).toBe('true')
		})

		test('stringifies number plain value', () => {
			const { helper } = makeHelper(makeEl({ strProp: val(42 as any) }))
			expect(helper.getString('strProp', '')).toBe('42')
		})

		test('expression resolving to undefined (empty expression) returns defaultValue', () => {
			const { helper } = makeHelper(makeEl({ strProp: expr('') }))
			expect(helper.getString('strProp', 'fallback')).toBe('fallback')
		})

		test('expression resolving to undefined (missing variable) returns defaultValue', () => {
			const { helper } = makeHelper(makeEl({ strProp: expr('$(ns:missing)') }))
			expect(helper.getString('strProp', 'fallback')).toBe('fallback')
		})
	})

	describe('getEnum', () => {
		test('returns plain value when it is in the enum list', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('left') }))
			expect(helper.getEnum('enumProp', ['left', 'center', 'right'], 'center')).toBe('left')
		})

		test('returns defaultValue when plain value is not in the enum list', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('invalid') }))
			expect(helper.getEnum('enumProp', ['left', 'center', 'right'], 'center')).toBe('center')
		})

		test('evaluates expression and returns valid enum value', () => {
			const { helper } = makeHelper(makeEl({ enumProp: expr('"right"') }))
			expect(helper.getEnum('enumProp', ['left', 'center', 'right'], 'center')).toBe('right')
		})

		test('returns defaultValue when expression result is not in the enum list', () => {
			const { helper } = makeHelper(makeEl({ enumProp: expr('"unknown"') }))
			expect(helper.getEnum('enumProp', ['left', 'center', 'right'], 'center')).toBe('center')
		})

		test('works with numeric enum values', () => {
			const { helper } = makeHelper(makeEl({ numProp: val(2) }))
			expect(helper.getEnum('numProp', [1, 2, 3], 1)).toBe(2)
		})

		test('returns numeric defaultValue for out-of-range plain value', () => {
			const { helper } = makeHelper(makeEl({ numProp: val(99) }))
			expect(helper.getEnum('numProp', [1, 2, 3], 1)).toBe(1)
		})

		test('null plain value returns defaultValue', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val(null) as any }))
			expect(helper.getEnum('enumProp', ['left', 'center', 'right'], 'center')).toBe('center')
		})

		test('expression coerced to string but not in list returns defaultValue', () => {
			// 42 coerces to '42' via requiredType:'string', but '42' is not in the enum
			const { helper } = makeHelper(makeEl({ enumProp: expr('42') }))
			expect(helper.getEnum('enumProp', ['left', 'center', 'right'], 'center')).toBe('center')
		})

		test('returns defaultValue for empty expression string', () => {
			const { helper } = makeHelper(makeEl({ enumProp: expr('') }))
			expect(helper.getEnum('enumProp', ['left', 'center', 'right'], 'center')).toBe('center')
		})
	})

	describe('getTolerantEnum', () => {
		test('matches first character case-insensitively', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('Horizontal') }))
			expect(helper.getTolerantEnum('enumProp', ['horizontal', 'vertical'], 'horizontal')).toBe('horizontal')
		})

		test('matches vertical by first char v', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('vertical') }))
			expect(helper.getTolerantEnum('enumProp', ['horizontal', 'vertical'], 'horizontal')).toBe('vertical')
		})

		test('single character input matches correctly', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('v') }))
			expect(helper.getTolerantEnum('enumProp', ['horizontal', 'vertical'], 'horizontal')).toBe('vertical')
		})

		test('uppercase single character matches', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('H') }))
			expect(helper.getTolerantEnum('enumProp', ['horizontal', 'vertical'], 'vertical')).toBe('horizontal')
		})

		test('returns defaultValue when no match', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('x') }))
			expect(helper.getTolerantEnum('enumProp', ['horizontal', 'vertical'], 'horizontal')).toBe('horizontal')
		})

		test('empty string returns defaultValue (no first character to match)', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('') }))
			expect(helper.getTolerantEnum('enumProp', ['horizontal', 'vertical'], 'horizontal')).toBe('horizontal')
		})

		test('whitespace-only string returns defaultValue after trimming', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('   ') }))
			expect(helper.getTolerantEnum('enumProp', ['horizontal', 'vertical'], 'horizontal')).toBe('horizontal')
		})

		test('leading whitespace is trimmed before matching first character', () => {
			const { helper } = makeHelper(makeEl({ enumProp: val('  vertical') }))
			expect(helper.getTolerantEnum('enumProp', ['horizontal', 'vertical'], 'horizontal')).toBe('vertical')
		})
	})

	describe('getBoolean', () => {
		test('returns Boolean() of truthy plain value', () => {
			const { helper } = makeHelper(makeEl({ boolProp: val(true) }))
			expect(helper.getBoolean('boolProp', false)).toBe(true)
		})

		test('returns false for falsy plain value', () => {
			const { helper } = makeHelper(makeEl({ boolProp: val(false) }))
			expect(helper.getBoolean('boolProp', true)).toBe(false)
		})

		test('evaluates expression returning a boolean', () => {
			const { helper } = makeHelper(makeEl({ boolProp: expr('1 > 0') }))
			expect(helper.getBoolean('boolProp', false)).toBe(true)
		})

		test('coerces truthy non-boolean expression result to true', () => {
			// $(ns:x) is a number; requiredType:'boolean' coerces it via Boolean()
			const { helper } = makeHelper(makeEl({ boolProp: expr('$(ns:x)') }), { ns: { x: 1 } })
			expect(helper.getBoolean('boolProp', false)).toBe(true)
		})

		test('coerces falsy non-boolean expression result to false', () => {
			const { helper } = makeHelper(makeEl({ boolProp: expr('$(ns:x)') }), { ns: { x: 0 } })
			expect(helper.getBoolean('boolProp', true)).toBe(false)
		})

		test('returns defaultValue when expression has syntax error', () => {
			const { helper } = makeHelper(makeEl({ boolProp: expr(')') }))
			expect(helper.getBoolean('boolProp', true)).toBe(true)
		})

		test('numeric 0 is falsy', () => {
			const { helper } = makeHelper(makeEl({ boolProp: val(0 as any) }))
			expect(helper.getBoolean('boolProp', true)).toBe(false)
		})

		test('numeric 1 is truthy', () => {
			const { helper } = makeHelper(makeEl({ boolProp: val(1 as any) }))
			expect(helper.getBoolean('boolProp', false)).toBe(true)
		})

		test('null is falsy', () => {
			const { helper } = makeHelper(makeEl({ boolProp: val(null as any) }))
			expect(helper.getBoolean('boolProp', true)).toBe(false)
		})

		test('empty string is falsy', () => {
			const { helper } = makeHelper(makeEl({ boolProp: val('' as any) }))
			expect(helper.getBoolean('boolProp', true)).toBe(false)
		})

		test('non-empty string "false" is truthy (Boolean coercion, not parsing)', () => {
			const { helper } = makeHelper(makeEl({ boolProp: val('false' as any) }))
			expect(helper.getBoolean('boolProp', false)).toBe(true)
		})
	})

	describe('getHorizontalAlignment', () => {
		describe('non-expression (exact enum match)', () => {
			test('returns left', () => {
				const { helper } = makeHelper(makeEl({ enumProp: val('left') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('left')
			})

			test('returns center', () => {
				const { helper } = makeHelper(makeEl({ enumProp: val('center') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('center')
			})

			test('returns right', () => {
				const { helper } = makeHelper(makeEl({ enumProp: val('right') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('right')
			})

			test('returns center for invalid value (aliases only work for expressions)', () => {
				const { helper } = makeHelper(makeEl({ enumProp: val('start') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('center')
			})
		})

		describe('expression (first-character matching)', () => {
			test('l → left', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"left"') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('left')
			})

			test('s → left', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"start"') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('left')
			})

			test('r → right', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"right"') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('right')
			})

			test('e → right', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"end"') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('right')
			})

			test('c → center (default)', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"center"') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('center')
			})

			test('unrecognised first char → center', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"other"') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('center')
			})

			test('failed expression → center', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr(')') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('center')
			})

			test('empty string expression result → center (no first character)', () => {
				// $(ns:missing) with requiredType:'string' coerces undefined → ''
				const { helper } = makeHelper(makeEl({ enumProp: expr('$(ns:missing)') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('center')
			})

			test('expression with leading whitespace uses trimmed first char', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"  left"') }))
				expect(helper.getHorizontalAlignment('enumProp')).toBe('left')
			})
		})
	})

	describe('getVerticalAlignment', () => {
		describe('non-expression (exact enum match)', () => {
			test('returns top', () => {
				const { helper } = makeHelper(makeEl({ enumProp: val('top') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('top')
			})

			test('returns center', () => {
				const { helper } = makeHelper(makeEl({ enumProp: val('center') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('center')
			})

			test('returns bottom', () => {
				const { helper } = makeHelper(makeEl({ enumProp: val('bottom') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('bottom')
			})

			test('returns center for invalid value (aliases only work for expressions)', () => {
				const { helper } = makeHelper(makeEl({ enumProp: val('start') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('center')
			})
		})

		describe('expression (first-character matching)', () => {
			test('t → top', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"top"') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('top')
			})

			test('s → top', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"start"') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('top')
			})

			test('b → bottom', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"bottom"') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('bottom')
			})

			test('e → bottom', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"end"') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('bottom')
			})

			test('c → center (default)', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"center"') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('center')
			})

			test('unrecognised first char → center', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"other"') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('center')
			})

			test('failed expression → center', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr(')') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('center')
			})

			test('empty string expression result → center (no first character)', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('$(ns:missing)') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('center')
			})

			test('expression with leading whitespace uses trimmed first char', () => {
				const { helper } = makeHelper(makeEl({ enumProp: expr('"  top"') }))
				expect(helper.getVerticalAlignment('enumProp')).toBe('top')
			})
		})
	})

	describe('forRow', () => {
		test('wraps plain object values as non-expression ExpressionOrValue', () => {
			const { helper } = makeHelper(makeEl())
			const rowHelper = helper.forRow({ myStr: 'hello', myNum: 42 })
			expect(rowHelper.getString('myStr', '')).toBe('hello')
			expect(rowHelper.getNumber('myNum', 0)).toBe(42)
		})

		test('leaves already-wrapped ExpressionOrValue values as-is', () => {
			const { helper } = makeHelper(makeEl(), { ns: { x: 'world' } })
			const rowHelper = helper.forRow({ myProp: expr<string>('$(ns:x)') })
			expect(rowHelper.getString('myProp', '')).toBe('world')
		})

		test('shares usedVariables set with parent helper', () => {
			const { helper, usedVariables } = makeHelper(makeEl(), { ns: { x: 'world' } })
			const rowHelper = helper.forRow({ myProp: expr<string>('$(ns:x)') })
			rowHelper.getString('myProp', '')
			expect(usedVariables.has('ns:x')).toBe(true)
		})

		test('handles null row gracefully (returns helper with no properties)', () => {
			const { helper } = makeHelper(makeEl())
			expect(() => helper.forRow(null)).not.toThrow()
		})

		test('handles array row gracefully (treated as empty object)', () => {
			const { helper } = makeHelper(makeEl())
			expect(() => helper.forRow(['a', 'b'])).not.toThrow()
		})

		test('handles non-object primitive row gracefully', () => {
			const { helper } = makeHelper(makeEl())
			expect(() => helper.forRow('not an object')).not.toThrow()
		})

		test('row property with undefined value wraps it; getString returns undefined not the default', () => {
			const { helper } = makeHelper(makeEl())
			// undefined gets wrapped as val(undefined); getString returns undefined, not the defaultValue
			const rowHelper = helper.forRow({ myProp: undefined })
			expect(rowHelper.getString('myProp', 'should-not-appear')).toBeUndefined()
		})

		test('row property with null value wraps it; getString returns null', () => {
			const { helper } = makeHelper(makeEl())
			const rowHelper = helper.forRow({ myProp: null })
			expect(rowHelper.getString('myProp', 'should-not-appear')).toBeNull()
		})

		test('row with numeric-like string keys is accessible', () => {
			const { helper } = makeHelper(makeEl())
			const rowHelper = helper.forRow({ '0': 'zero', '1': 'one' })
			expect(rowHelper.getString('0', '')).toBe('zero')
		})

		test('accessing a property absent from the row returns defaultValue instead of throwing', () => {
			// Regression: #getValue returned undefined for missing keys, causing a TypeError on
			// value.isExpression. Gauge rows may omit cells that should default to 0.
			const { helper } = makeHelper(makeEl())
			const rowHelper = helper.forRow({ color: 0xff0000 })
			// getNumber: Number(undefined) = NaN → falls back to defaultValue
			expect(() => rowHelper.getNumber('value', 0)).not.toThrow()
			expect(rowHelper.getNumber('value', 0)).toBe(0)
			// getEnum: undefined not in list → defaultValue
			expect(rowHelper.getEnum('value', ['a', 'b'], 'a')).toBe('a')
			// getString: follows val(undefined) contract — returns undefined, not defaultValue
			expect(rowHelper.getString('value', 'fallback')).toBeUndefined()
		})
	})

	describe('missing element properties', () => {
		test('missing property on base element returns defaultValue instead of throwing', () => {
			// Same crash as the forRow case: elements from deserialised / external data may be
			// missing properties that TypeScript's type claims are present.
			const incompleteEl = { id: 'el1' } // no ExpressionOrValue properties at all
			const usedVariables = new Set<string>()
			const helper = new ElementExpressionHelper(createMockParser(), usedVariables, incompleteEl as any, undefined)

			expect(() => helper.getNumber('numProp' as any, 0)).not.toThrow()
			expect(helper.getNumber('numProp' as any, 0)).toBe(0)
			expect(helper.getEnum('enumProp' as any, ['a', 'b'], 'a')).toBe('a')
			// getString follows val(undefined) contract: returns undefined, not defaultValue
			expect(helper.getString('strProp' as any, 'fallback')).toBeUndefined()
		})
	})

	describe('elementOverrides', () => {
		test('override takes precedence over element property value', () => {
			const element = makeEl({ strProp: val('original') })
			const overrides = new Map<string, ExpressionOrValue<JsonValue | undefined>>([
				['strProp', val('overridden' as JsonValue)],
			])
			const { helper } = makeHelper(element, {}, overrides)
			expect(helper.getString('strProp', '')).toBe('overridden')
		})

		test('non-overridden properties use the element value', () => {
			const element = makeEl({ strProp: val('original'), numProp: val(42) })
			const overrides = new Map<string, ExpressionOrValue<JsonValue | undefined>>([
				['strProp', val('overridden' as JsonValue)],
			])
			const { helper } = makeHelper(element, {}, overrides)
			expect(helper.getNumber('numProp', 0)).toBe(42)
		})

		test('override can itself be an expression', () => {
			const element = makeEl({ strProp: val('original') })
			const overrides = new Map<string, ExpressionOrValue<JsonValue | undefined>>([
				['strProp', expr<JsonValue>('"computed"')],
			])
			const { helper } = makeHelper(element, {}, overrides)
			expect(helper.getString('strProp', '')).toBe('computed')
		})

		test('override expression tracks its variable IDs', () => {
			const element = makeEl({ strProp: val('original') })
			const overrides = new Map<string, ExpressionOrValue<JsonValue | undefined>>([
				['strProp', expr<JsonValue>('$(ns:x)')],
			])
			const { helper, usedVariables } = makeHelper(element, { ns: { x: 'value' } }, overrides)
			helper.getString('strProp', '')
			expect(usedVariables.has('ns:x')).toBe(true)
		})
	})
})

describe('createParseElementsContext', () => {
	describe('createHelper', () => {
		test('each call produces an independent usedVariables set', () => {
			const ctx = makeCtx({ variableValues: { ns: { x: 5 } } })
			const { usedVariables: uv1 } = ctx.createHelper({ id: 'el1', enumProp: expr<string>('$(ns:x)') })
			const { usedVariables: uv2 } = ctx.createHelper({ id: 'el2', enumProp: val('left') })
			expect(uv1).not.toBe(uv2)
		})

		test('applies feedback overrides to the matching element ID only', () => {
			const feedbackOverrides = new Map<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>>([
				['el1', new Map([['strProp', val('overridden' as JsonValue)]])],
			])
			const ctx = makeCtx({ feedbackOverrides })

			const { helper: h1 } = ctx.createHelper({ id: 'el1', strProp: val('original') })
			const { helper: h2 } = ctx.createHelper({ id: 'el2', strProp: val('original') })

			expect(h1.getString('strProp', '')).toBe('overridden')
			expect(h2.getString('strProp', '')).toBe('original')
		})

		test('element without matching feedback override uses its own property', () => {
			const feedbackOverrides = new Map<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>>([
				['other-id', new Map([['strProp', val('overridden' as JsonValue)]])],
			])
			const ctx = makeCtx({ feedbackOverrides })
			const { helper } = ctx.createHelper({ id: 'el1', strProp: val('original') })
			expect(helper.getString('strProp', '')).toBe('original')
		})
	})

	describe('withPropOverrides', () => {
		test('variables injected via propOverrides are resolved in the child context', () => {
			const ctx = makeCtx()
			const child = ctx.withPropOverrides({ 'ns:x': 'injected' })
			const { helper } = child.createHelper({ id: 'el1', strProp: expr<string>('$(ns:x)') })
			expect(helper.getString('strProp', '')).toBe('injected')
		})

		test('injected propOverrides do not affect the parent context', () => {
			const ctx = makeCtx()
			ctx.withPropOverrides({ 'ns:x': 'injected' })
			// Parent parser has no ns:x; missing variable resolves to undefined → defaultValue
			const { helper } = ctx.createHelper({ id: 'el1', strProp: expr<string>('$(ns:x)') })
			expect(helper.getString('strProp', 'default')).toBe('default')
		})

		test('child propOverrides are merged with parent variable values', () => {
			const ctx = makeCtx({ variableValues: { ns: { existing: 'base' } } })
			const child = ctx.withPropOverrides({ 'ns:injected': 'extra' })
			const { helper } = child.createHelper({ id: 'el1', strProp: expr<string>('$(ns:existing)') })
			expect(helper.getString('strProp', '')).toBe('base')
		})
	})

	describe('resolveCompositeElement', () => {
		test('returns the definition when found', () => {
			const definition: CompositeElementDefinition = {
				id: 'elem1',
				name: 'My Element',
				description: undefined,
				options: [],
				elements: [],
			}
			const ctx = makeCtx({ compositeElements: { conn1: { elem1: definition } } })
			expect(ctx.resolveCompositeElement('conn1', 'elem1')).toBe(definition)
		})

		test('returns null when connection not found', () => {
			const ctx = makeCtx()
			expect(ctx.resolveCompositeElement('unknown-conn', 'elem1')).toBeNull()
		})

		test('returns null when element ID not found within connection', () => {
			const definition: CompositeElementDefinition = {
				id: 'elem1',
				name: 'My Element',
				description: undefined,
				options: [],
				elements: [],
			}
			const ctx = makeCtx({ compositeElements: { conn1: { elem1: definition } } })
			expect(ctx.resolveCompositeElement('conn1', 'unknown-elem')).toBeNull()
		})
	})
})
