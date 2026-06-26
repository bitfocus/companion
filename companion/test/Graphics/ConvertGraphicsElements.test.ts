import { JsonValue } from 'type-fest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import { CompanionFieldVariablesSupport, type ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsBoxElement,
	ButtonGraphicsCanvasDrawElement,
	ButtonGraphicsGaugeDrawElement,
	ButtonGraphicsGaugeElement,
	ButtonGraphicsGroupDrawElement,
	ButtonGraphicsGroupElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsReferenceDrawElement,
	ButtonGraphicsReferenceElement,
	ButtonGraphicsTextDrawElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
} from '@companion-app/shared/Model/StyleModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../../lib/Graphics/ConvertGraphicsElements.js'
import { collectContentHashes } from '../../lib/Graphics/ConvertGraphicsElements/Util.js'
import { ElementConversionCache } from '../../lib/Graphics/ElementConversionCache.js'
import { ImageResult } from '../../lib/Graphics/ImageResult.js'
import type { CompositeElementDefinition, InstanceDefinitions } from '../../lib/Instance/Definitions.js'
import {
	executeExpression,
	parseVariablesInString,
	type VariableValueCache,
	type VariableValueData,
} from '../../lib/Variables/Util.js'
import type { VariablesAndExpressionParser } from '../../lib/Variables/VariablesAndExpressionParser.js'

// Shorthand for usage enum
const USAGE = ButtonGraphicsElementUsage.Automatic

// Helper to create ExpressionOrValue
function val<T>(value: T): ExpressionOrValue<T> {
	return { isExpression: false, value }
}

function expr<T>(value: string): ExpressionOrValue<T> {
	return { isExpression: true, value } as ExpressionOrValue<T>
}

// Element factories — provide sensible defaults so each test only specifies what matters.

function makeTextDrawEl(overrides: Partial<ButtonGraphicsTextDrawElement> = {}): ButtonGraphicsTextDrawElement {
	return {
		id: 'elem',
		type: 'text',
		usage: USAGE,
		enabled: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		rotation: 0,
		text: 'Hello',
		fontsize: 100,
		fontsizeAllowShrink: true,
		font: 'companion-sans',
		color: 0xffffff,
		halign: 'center',
		valign: 'center',
		outlineColor: 0,
		contentHash: 'hash',
		...overrides,
	}
}

function makeBoxDrawEl(overrides: Partial<ButtonGraphicsBoxDrawElement> = {}): ButtonGraphicsBoxDrawElement {
	return {
		id: 'elem',
		type: 'box',
		usage: USAGE,
		enabled: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		rotation: 0,
		color: 0,
		borderWidth: 0,
		borderColor: 0,
		borderPosition: 'inside',
		contentHash: 'hash',
		...overrides,
	}
}

function makeTextEl(overrides: Partial<ButtonGraphicsTextElement> = {}): ButtonGraphicsTextElement {
	return {
		id: 'text1',
		name: '',
		type: 'text',
		usage: USAGE,
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(100),
		height: val(100),
		rotation: val(0),
		text: val('Test'),
		fontsize: val(100),
		fontsizeAllowShrink: val(true),
		font: val('companion-sans'),
		color: val(0xffffff),
		halign: val('center'),
		valign: val('center'),
		outlineColor: val(0),
		...overrides,
	}
}

function makeBoxEl(overrides: Partial<ButtonGraphicsBoxElement> = {}): ButtonGraphicsBoxElement {
	return {
		id: 'box1',
		name: '',
		type: 'box',
		usage: USAGE,
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(100),
		height: val(100),
		rotation: val(0),
		color: val(0),
		borderWidth: val(0),
		borderColor: val(0),
		borderPosition: val('inside'),
		...overrides,
	}
}

function makeImageEl(overrides: Partial<ButtonGraphicsImageElement> = {}): ButtonGraphicsImageElement {
	return {
		id: 'image1',
		name: '',
		type: 'image',
		usage: USAGE,
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(72),
		height: val(72),
		rotation: val(0),
		base64Image: val(null),
		halign: val('center'),
		valign: val('center'),
		fillMode: val('fit'),
		...overrides,
	}
}

function makeGroupEl(
	children: SomeButtonGraphicsElement[],
	overrides: Partial<ButtonGraphicsGroupElement> = {}
): ButtonGraphicsGroupElement {
	return {
		id: 'group1',
		name: '',
		type: 'group',
		usage: USAGE,
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(100),
		height: val(100),
		rotation: val(0),
		squareCoords: val(false),
		...overrides,
		children,
	}
}

function makeGaugeEl(overrides: Partial<ButtonGraphicsGaugeElement> = {}): ButtonGraphicsGaugeElement {
	return {
		id: 'gauge1',
		name: '',
		type: 'gauge',
		usage: USAGE,
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(100),
		height: val(100),
		rotation: val(0),
		value: val(50),
		min: val(0),
		max: val(100),
		origin: val(0),
		symmetric: val(false),
		orientation: val('horizontal'),
		reverse: val(false),
		trackWidth: val(100),
		startAngle: val(0),
		endAngle: val(360),
		ringWidth: val(20),
		roundedEnds: val(true),
		fillEnabled: val(true),
		multiColour: val(true),
		stops: val([
			{ value: 0, color: 0x00ff00, gradient: false },
			{ value: 66, color: 0xffff00, gradient: false },
			{ value: 85, color: 0xff0000, gradient: false },
		]),
		markerEnabled: val(false),
		markerColor: val(0xffffff),
		markerWidth: val(15),
		trackStyle: val('transparent'),
		trackAmount: val(70),
		...overrides,
	}
}

function makeReferenceEl(overrides: Partial<ButtonGraphicsReferenceElement> = {}): ButtonGraphicsReferenceElement {
	return {
		id: 'ref1',
		name: '',
		type: 'reference',
		usage: USAGE,
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(100),
		height: val(100),
		rotation: val(0),
		location: val(''),
		...overrides,
	}
}

/**
 * Creates a minimal mock ImageResult for use in reference element tests.
 */
function createMockImageResult(
	drawElements: SomeButtonGraphicsDrawElement[] = [],
	referencedLocations: ReadonlySet<string> = new Set()
): ImageResult {
	return new ImageResult(
		null,
		async () => Buffer.alloc(0),
		async () => '',
		drawElements,
		referencedLocations
	)
}

/**
 * Creates a mock parser that uses the real parsing functions internally.
 * This ensures the test behavior matches production behavior.
 */
function createMockParser(
	variableValues: Record<string, Record<string, string | number | boolean>> = {}
): VariablesAndExpressionParser {
	// Convert the simple variableValues to the nested structure expected by the real functions
	const rawVariableValues: VariableValueData = variableValues

	// Create a cache that will be used across all calls
	const createCache = (): VariableValueCache => new Map()

	const blinker = null as any

	const createParserWithOverrides = (overrides: VariableValues): VariablesAndExpressionParser => {
		const parser = {
			executeExpression: (str: string, requiredType: string | undefined) => {
				const cache = createCache()
				// Inject overrides into the cache
				for (const [key, value] of Object.entries(overrides)) {
					cache.set(key, value)
				}
				return executeExpression(blinker, str, rawVariableValues, requiredType, cache, undefined)
			},
			parseVariables: (str: string) => {
				const cache = createCache()
				// Inject overrides into the cache
				for (const [key, value] of Object.entries(overrides)) {
					cache.set(key, value)
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

// Create mock InstanceDefinitions
function createMockInstanceDefinitions(
	compositeElements: Record<string, Record<string, CompositeElementDefinition>> = {}
): InstanceDefinitions {
	return {
		getCompositeElementDefinition: vi.fn((connectionId: string, elementId: string) => {
			return compositeElements[connectionId]?.[elementId]
		}),
	} as unknown as InstanceDefinitions
}

// Mock for drawPixelBuffers
const mockDrawPixelBuffers = vi.fn(async () => undefined)

describe('collectContentHashes', () => {
	test('returns empty array for empty elements', () => {
		const result = collectContentHashes([])
		expect(result).toEqual([])
	})

	test('collects hash from single element', () => {
		const elements: SomeButtonGraphicsDrawElement[] = [makeTextDrawEl({ id: 'elem1', contentHash: 'hash123' })]

		const result = collectContentHashes(elements)
		expect(result).toEqual(['hash123'])
	})

	test('collects hashes from multiple elements', () => {
		const elements: SomeButtonGraphicsDrawElement[] = [
			makeTextDrawEl({ id: 'elem1', contentHash: 'hash1' }),
			makeBoxDrawEl({ id: 'elem2', x: 10, y: 10, width: 50, height: 50, color: 0xff0000, contentHash: 'hash2' }),
		]

		const result = collectContentHashes(elements)
		expect(result).toEqual(['hash1', 'hash2'])
	})

	test('collects hashes from nested group elements with structural markers', () => {
		const elements: SomeButtonGraphicsDrawElement[] = [
			{
				id: 'group1',
				type: 'group',
				usage: USAGE,
				enabled: true,
				opacity: 1,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 0,
				squareCoords: false,
				contentHash: 'groupHash',
				children: [makeTextDrawEl({ id: 'child1', width: 50, height: 50, contentHash: 'childHash' })],
			},
		]

		const result = collectContentHashes(elements)
		expect(result).toEqual(['groupHash', '[', 'childHash', ']'])
	})

	test('handles deeply nested groups', () => {
		const elements: SomeButtonGraphicsDrawElement[] = [
			{
				id: 'outer',
				type: 'group',
				usage: USAGE,
				enabled: true,
				opacity: 1,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 0,
				squareCoords: false,
				contentHash: 'outerHash',
				children: [
					{
						id: 'inner',
						type: 'group',
						usage: USAGE,
						enabled: true,
						opacity: 1,
						x: 0,
						y: 0,
						width: 50,
						height: 50,
						rotation: 0,
						squareCoords: false,
						contentHash: 'innerHash',
						children: [makeBoxDrawEl({ id: 'leaf', width: 25, height: 25, contentHash: 'leafHash' })],
					},
				],
			},
		]

		const result = collectContentHashes(elements)
		expect(result).toEqual(['outerHash', '[', 'innerHash', '[', 'leafHash', ']', ']'])
	})

	test('handles group without children', () => {
		const elements: SomeButtonGraphicsDrawElement[] = [
			{
				id: 'emptyGroup',
				type: 'group',
				usage: USAGE,
				enabled: true,
				opacity: 1,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 0,
				squareCoords: false,
				contentHash: 'emptyGroupHash',
				children: [],
			},
		]

		const result = collectContentHashes(elements)
		expect(result).toEqual(['emptyGroupHash', '[', ']'])
	})
})

describe('ConvertSomeButtonGraphicsElementForDrawing', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('canvas element conversion', () => {
		test('converts canvas element with default decoration', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'canvas1',
					name: '',
					type: 'canvas',
					usage: USAGE,
					decoration: val(ButtonGraphicsDecorationType.FollowDefault),
					showStatusIcons: val(ButtonGraphicsShowStatusIcons.FollowDefault),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0]).toMatchObject({
				id: 'canvas1',
				type: 'canvas',
				decoration: ButtonGraphicsDecorationType.FollowDefault,
			})
			expect(result.elements[0].contentHash).toBeTruthy()
		})
	})

	describe('text element conversion', () => {
		test('converts basic text element', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Hello World') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0]).toMatchObject({
				id: 'text1',
				type: 'text',
				text: 'Hello World',
				fontsize: 100,
				fontsizeAllowShrink: true,
				font: 'companion-sans',
				color: 0xffffff,
			})
		})

		test('filters disabled text element when onlyEnabled is true', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Hello'), enabled: val(false) })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(0)
		})

		test('keeps disabled element when onlyEnabled is false', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Hello'), enabled: val(false) })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				false,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect((result.elements[0] as { enabled: boolean }).enabled).toBe(false)
		})

		test('parses variables in text', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Value: $(test:myvar)') })]

			const mockParser = createMockParser({ test: { myvar: 'HELLO' } })

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				mockParser,
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements[0]).toMatchObject({
				type: 'text',
				text: 'Value: HELLO',
			})
		})

		test('respects font property', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeTextEl({ id: 'text-sans', text: val('Sans') }),
				makeTextEl({ id: 'text-mono', text: val('Mono'), font: val('companion-mono') }),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(2)
			expect(result.elements[0]).toMatchObject({ type: 'text', font: 'companion-sans' })
			expect(result.elements[1]).toMatchObject({ type: 'text', font: 'companion-mono' })
		})
	})

	describe('box element conversion', () => {
		test('converts box element', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeBoxEl({
					x: val(10),
					y: val(20),
					width: val(50),
					height: val(60),
					color: val(0xff0000),
					borderWidth: val(2),
					borderColor: val(0x00ff00),
				}),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0]).toMatchObject({
				id: 'box1',
				type: 'box',
				x: 0.1, // 10 * 0.01
				y: 0.2, // 20 * 0.01
				width: 0.5, // 50 * 0.01
				height: 0.6, // 60 * 0.01
				color: 0xff0000,
				borderWidth: 0.02, // 2 * 0.01
				borderColor: 0x00ff00,
			})
		})
	})

	describe('image element conversion', () => {
		test('converts image element', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeImageEl({ base64Image: val('data:image/png;base64,abc123') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0]).toMatchObject({
				id: 'image1',
				type: 'image',
				base64Image: 'data:image/png;base64,abc123',
				fillMode: 'fit',
			})
		})
	})

	describe('line element conversion', () => {
		test('converts line element', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'line1',
					name: '',
					type: 'line',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					fromX: val(0),
					fromY: val(0),
					toX: val(100),
					toY: val(100),
					borderWidth: val(3),
					borderColor: val(0xffff00),
					borderPosition: val('center'),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0]).toMatchObject({
				id: 'line1',
				type: 'line',
				fromX: 0,
				fromY: 0,
				toX: 1, // line coords not scaled
				toY: 1,
				borderWidth: 0.03, // 3 * 0.01
			})
		})
	})

	describe('circle element conversion', () => {
		test('converts circle element', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'circle1',
					name: '',
					type: 'circle',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(10),
					y: val(10),
					width: val(50),
					height: val(50),
					color: val(0x00ff00),
					borderWidth: val(1),
					borderColor: val(0xff0000),
					borderPosition: val('inside'),
					startAngle: val(0),
					endAngle: val(360),
					drawSlice: val(false),
					borderOnlyArc: val(false),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0]).toMatchObject({
				id: 'circle1',
				type: 'circle',
				x: 0.1, // 10 * 0.01
				y: 0.1,
				width: 0.5, // 50 * 0.01
				height: 0.5,
				color: 0x00ff00,
			})
		})
	})

	describe('group element conversion', () => {
		test('converts group element with children', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeGroupEl([makeTextEl({ id: 'child1', width: val(50), height: val(50), text: val('Child') })]),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0].type).toBe('group')
			const groupElement = result.elements[0] as ButtonGraphicsGroupDrawElement
			expect(groupElement.children).toHaveLength(1)
			expect(groupElement.children[0]).toMatchObject({
				id: 'child1',
				type: 'text',
				text: 'Child',
			})
		})

		test('filters disabled children in group when onlyEnabled is true', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeGroupEl([
					makeTextEl({ id: 'child1', width: val(50), height: val(50), text: val('Disabled'), enabled: val(false) }),
					makeTextEl({ id: 'child2', width: val(50), height: val(50), text: val('Enabled') }),
				]),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			const groupElement = result.elements[0] as ButtonGraphicsGroupDrawElement
			expect(groupElement.children).toHaveLength(1)
			expect(groupElement.children[0].id).toBe('child2')
		})
	})

	describe('expression evaluation', () => {
		test('evaluates expressions in element properties', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ x: expr<number>('10 + 5') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			// Note: x position is divided by 100 during conversion (0.01 scale), so 15 -> 0.15
			expect(result.elements[0]).toMatchObject({
				x: 0.15,
			})
		})
	})

	describe('variable tracking', () => {
		test('tracks referenced variables', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('$(test:var1) and $(test:var2)') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser({ test: { var1: 'A', var2: 'B' } }),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.usedVariables.has('test:var1')).toBe(true)
			expect(result.usedVariables.has('test:var2')).toBe(true)
		})

		test('tracks referenced variables in expression', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeTextEl({ text: val('abc'), height: expr<number>('$(test:var3)') }),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser({ test: { var3: 10 } }),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.usedVariables.has('test:var3')).toBe(true)
		})
	})

	describe('caching', () => {
		test('uses cache when available', async () => {
			const cache = new ElementConversionCache()

			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Cached text') })]

			// First conversion
			await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Cache should now contain the element
			const cachedEntry = cache.get('text1')
			expect(cachedEntry).toBeDefined()
			expect(cachedEntry?.drawElement).toBeDefined()

			// Second conversion with same elements should use cache
			const getSpy = vi.spyOn(cache, 'get')
			await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Verify cache was queried
			expect(getSpy).toHaveBeenCalledWith('text1')
			// Verify cache entry was returned (not undefined)
			expect(getSpy.mock.results[0].value).toBe(cachedEntry)
		})

		test('invalidates cache when variables change', async () => {
			const cache = new ElementConversionCache()

			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('$(test:myvar)') })]

			// First conversion
			const result1 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser({ test: { myvar: 'A' } }),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Queue invalidation for the variable and apply it
			cache.queueInvalidateVariables(new Set(['test:myvar']))
			cache.applyQueuedInvalidations()

			// Second conversion with different variable value
			const result2 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser({ test: { myvar: 'B' } }),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Content should be different
			expect((result2.elements[0] as { text: string }).text).toBe('B')
			expect((result1.elements[0] as { text: string }).text).toBe('A')
		})

		test('purges stale cache entries', async () => {
			const cache = new ElementConversionCache()

			const elements: SomeButtonGraphicsElement[] = [
				makeTextEl({ text: val('Test') }),
				makeTextEl({ id: 'text2', text: val('Test2') }),
			]

			// First conversion with both elements
			await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			expect(cache.get('text1')).toBeDefined()
			expect(cache.get('text2')).toBeDefined()

			// Second conversion with only one element
			await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				[elements[0]],
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Cache should now only have text1
			expect(cache.get('text1')).toBeDefined()
			expect(cache.get('text2')).toBeUndefined()
		})

		test('preserves child cache entries when parent group is disabled', async () => {
			const cache = new ElementConversionCache()

			const elements: SomeButtonGraphicsElement[] = [
				makeGroupEl([makeTextEl({ id: 'child1', width: val(50), height: val(50), text: val('Child text') })]),
			]

			// First conversion with enabled group - populates cache for group and child
			await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Verify both are cached
			expect(cache.get('group1')).toBeDefined()
			expect(cache.get('child1')).toBeDefined()

			// Spy on cache.set to track new cache entries
			const setSpy = vi.spyOn(cache, 'set')

			// Disable the group
			const disabledElements: SomeButtonGraphicsElement[] = [
				{
					...elements[0],
					enabled: val(false),
				} as SomeButtonGraphicsElement,
			]

			// Invalidate the group cache entry since enabled changed
			cache.queueInvalidate('group1')

			// Second conversion with disabled group
			let result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				disabledElements,
				new Map(),
				true,
				cache,
				null,
				null
			)
			expect(result.elements).toHaveLength(0)

			// Child should still be cached (not purged) even though group is disabled
			expect(cache.get('child1')).toBeDefined()

			// Re-enable the group
			cache.queueInvalidate('group1')
			setSpy.mockClear()

			// Third conversion with re-enabled group
			result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Should have the group with its child
			expect(result.elements).toHaveLength(1)
			expect(result.elements[0].type).toBe('group')
			expect((result.elements[0] as ButtonGraphicsGroupDrawElement).children).toHaveLength(1)

			// Child should NOT have been re-added to cache (it was already cached)
			const childSetCalls = setSpy.mock.calls.filter((call) => call[0] === 'child1')
			expect(childSetCalls).toHaveLength(0)
		})

		test('preserves nested child cache entries when parent composite is disabled', async () => {
			const cache = new ElementConversionCache()

			const compositeElements: SomeButtonGraphicsElement[] = [
				makeTextEl({ id: 'inner-text', text: val('Composite inner') }),
			]

			const mockDefinitions = createMockInstanceDefinitions({
				test: {
					myComposite: {
						id: 'myComposite',
						name: 'My Composite',
						description: undefined,
						elements: compositeElements,
						options: [],
					},
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'composite1',
					name: '',
					type: 'composite',
					usage: USAGE,
					connectionId: 'test',
					elementId: 'myComposite',
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
				},
			]

			// Spy on cache.set to track what gets cached
			const setSpy = vi.spyOn(cache, 'set')
			const getSpy = vi.spyOn(cache, 'get')

			// First conversion with enabled composite
			await ConvertSomeButtonGraphicsElementForDrawing(
				mockDefinitions,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Find the child cache key from the spy calls (includes the propOverridesHash prefix)
			const childSetCall = setSpy.mock.calls.find((call) => call[0].includes('inner-text'))
			expect(childSetCall).toBeDefined()
			const childKey = childSetCall![0]

			// Reset spies for the next phase
			setSpy.mockClear()
			getSpy.mockClear()

			// Disable the composite
			const disabledElements: SomeButtonGraphicsElement[] = [
				{
					...elements[0],
					enabled: val(false),
				} as SomeButtonGraphicsElement,
			]

			cache.queueInvalidate('composite1')

			// Second conversion with disabled composite
			await ConvertSomeButtonGraphicsElementForDrawing(
				mockDefinitions,
				createMockParser(),
				mockDrawPixelBuffers,
				disabledElements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Child should still be in cache (verify by checking cache.get returns a value)
			expect(cache.get(childKey)).toBeDefined()

			// Re-enable and convert again
			cache.queueInvalidate('composite1')
			setSpy.mockClear()

			await ConvertSomeButtonGraphicsElementForDrawing(
				mockDefinitions,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				null,
				null
			)

			// Child should NOT have been re-cached (cache hit)
			const childSetCalls = setSpy.mock.calls.filter((call) => call[0] === childKey)
			expect(childSetCalls).toHaveLength(0)
		})

		test('cache hit still propagates referencedLocation into global referencedLocations', async () => {
			const cache = new ElementConversionCache()
			const referencedDrawElements: SomeButtonGraphicsDrawElement[] = [makeTextDrawEl({ id: 'ref-text', text: 'Hi' })]
			const mockRender = createMockImageResult(referencedDrawElements)
			const getRenderAtLocation = vi.fn(() => mockRender)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('2/0/0') })]

			// First call — populates cache
			const result1 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				'1/0/0',
				getRenderAtLocation
			)
			expect(result1.referencedLocations.has('2/0/0')).toBe(true)

			// Second call — cache hit path
			const result2 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache,
				'1/0/0',
				getRenderAtLocation
			)
			// Must still report '2/0/0' even though element was served from cache
			expect(result2.referencedLocations.has('2/0/0')).toBe(true)
		})
	})

	describe('feedback overrides', () => {
		test('applies feedback overrides to element', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Original') })]

			// feedbackOverrides is Map<elementId, Map<propertyName, ExpressionOrValue>>
			const text1Overrides = new Map<string, ExpressionOrValue<JsonValue | undefined>>([['text', val('Overridden')]])
			const globalReferences = new Map<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>>([
				['text1', text1Overrides],
			])

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				globalReferences,
				true,
				null,
				null,
				null
			)

			expect((result.elements[0] as { text: string }).text).toBe('Overridden')
		})
	})

	describe('content hash stability', () => {
		test('produces same content hash for same input', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Stable text') })]

			const result1 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			const result2 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result1.elements[0].contentHash).toBe(result2.elements[0].contentHash)
		})

		test('produces different content hash for different input', async () => {
			const elements1: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Text A') })]

			const elements2: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Text B') })]

			const result1 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements1,
				new Map(),
				true,
				null,
				null,
				null
			)

			const result2 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements2,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result1.elements[0].contentHash).not.toBe(result2.elements[0].contentHash)
		})
	})

	describe('composite element conversion', () => {
		test('converts composite element to group', async () => {
			const compositeDefinition: CompositeElementDefinition = {
				id: 'composite1',
				name: 'Test Composite',
				description: '',
				options: [],
				elements: [makeTextEl({ id: 'child1', text: val('Inside Composite') })],
			}

			const instanceDefs = createMockInstanceDefinitions({
				'test-connection': {
					composite1: compositeDefinition,
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'comp1',
					name: '',
					type: 'composite',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					connectionId: 'test-connection',
					elementId: 'composite1',
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				instanceDefs,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0].type).toBe('group')
			const groupElement = result.elements[0] as ButtonGraphicsGroupDrawElement
			expect(groupElement.children).toHaveLength(1)
			expect(groupElement.children[0]).toMatchObject({
				type: 'text',
				text: 'Inside Composite',
			})
		})

		test('returns nothing for missing composite definition', async () => {
			const compositeDefinition: CompositeElementDefinition = {
				id: 'composite1',
				name: 'Test Composite',
				description: '',
				options: [],
				elements: [],
			}

			const instanceDefs = createMockInstanceDefinitions({
				'test-connection': {
					composite1: compositeDefinition,
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'comp1',
					name: '',
					type: 'composite',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					connectionId: 'test-connection',
					elementId: 'nonexistent',
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				instanceDefs,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(0)
		})
	})

	describe('id prefixing', () => {
		test('children within groups share same prefix', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeGroupEl([makeTextEl({ id: 'child1', width: val(50), height: val(50), text: val('Child') })]),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			const groupElement = result.elements[0] as ButtonGraphicsGroupDrawElement
			expect(groupElement.id).toBe('group1')
			// Children within groups use the same prefix (not nested)
			expect(groupElement.children[0].id).toBe('child1')
		})

		test('composite element children get prefixed with composite id', async () => {
			const compositeDefinition: CompositeElementDefinition = {
				id: 'composite1',
				name: 'Test Composite',
				description: '',
				options: [],
				elements: [makeTextEl({ id: 'inner1', text: val('Inside Composite') })],
			}

			const instanceDefs = createMockInstanceDefinitions({
				'test-connection': {
					composite1: compositeDefinition,
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'comp1',
					name: '',
					type: 'composite',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					connectionId: 'test-connection',
					elementId: 'composite1',
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				instanceDefs,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			const groupElement = result.elements[0] as ButtonGraphicsGroupDrawElement
			expect(groupElement.id).toBe('comp1')
			// Composite children get prefixed with composite ID - variableshash + '/'
			expect(groupElement.children[0].id).toBe(
				`comp1-44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a/inner1`
			)
		})
	})

	describe('expression error handling', () => {
		test('handles failed expression with default value', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ x: expr<number>('invalid_syntax((') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			// Should use default value (0) when expression fails
			expect(result.elements).toHaveLength(1)
			expect((result.elements[0] as { x: number }).x).toBe(0)
		})

		test('handles missing variable reference gracefully', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeTextEl({ text: val('Value: $(nonexistent:var)') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			// Missing variables should show $NA
			expect((result.elements[0] as { text: string }).text).toBe('Value: $NA')
			expect(result.usedVariables.has('nonexistent:var')).toBe(true)
		})
	})

	describe('composite element with options', () => {
		test('injects textinput option value into composite child', async () => {
			const compositeDefinition: CompositeElementDefinition = {
				id: 'labelComposite',
				name: 'Label Composite',
				description: '',
				options: [
					{
						id: 'labelText',
						type: 'textinput',
						label: 'Label',
						default: 'Default',
						useVariables: CompanionFieldVariablesSupport.InternalParser,
					},
				],
				elements: [makeTextEl({ id: 'label', text: val('$(options:labelText)') })],
			}

			const instanceDefs = createMockInstanceDefinitions({
				'test-connection': {
					labelComposite: compositeDefinition,
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'comp1',
					name: '',
					type: 'composite',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					connectionId: 'test-connection',
					elementId: 'labelComposite',
					'opt:labelText': val('Custom Label'),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				instanceDefs,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			const groupElement = result.elements[0] as ButtonGraphicsGroupDrawElement
			expect((groupElement.children[0] as { text: string }).text).toBe('Custom Label')
		})

		test('uses default option value when not provided', async () => {
			const compositeDefinition: CompositeElementDefinition = {
				id: 'labelComposite',
				name: 'Label Composite',
				description: '',
				options: [
					{
						id: 'labelText',
						type: 'textinput',
						label: 'Label',
						default: 'Default Label',
					},
				],
				elements: [makeTextEl({ id: 'label', text: val('$(options:labelText)') })],
			}

			const instanceDefs = createMockInstanceDefinitions({
				'test-connection': {
					labelComposite: compositeDefinition,
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'comp1',
					name: '',
					type: 'composite',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					connectionId: 'test-connection',
					elementId: 'labelComposite',
					// No opt:labelText provided
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				instanceDefs,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			const groupElement = result.elements[0] as ButtonGraphicsGroupDrawElement
			expect((groupElement.children[0] as { text: string }).text).toBe('Default Label')
		})
	})

	describe('composite element reference tracking', () => {
		test('tracks composite element references', async () => {
			const compositeDefinition: CompositeElementDefinition = {
				id: 'simpleComposite',
				name: 'Simple',
				description: '',
				options: [],
				elements: [makeBoxEl({ id: 'child', color: val(0xff0000) })],
			}

			const instanceDefs = createMockInstanceDefinitions({
				myconn: {
					simpleComposite: compositeDefinition,
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'comp1',
					name: '',
					type: 'composite',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					connectionId: 'myconn',
					elementId: 'simpleComposite',
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				instanceDefs,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.usedCompositeElements.has('myconn:simpleComposite')).toBe(true)
		})
	})

	describe('alignment expression aliases', () => {
		test('converts "s" prefix to left/top (start alias)', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeTextEl({
					halign: { isExpression: true, value: '"start"' } as ExpressionOrValue<HorizontalAlignment>,
					valign: { isExpression: true, value: '"start"' } as ExpressionOrValue<VerticalAlignment>,
				}),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements[0]).toMatchObject({
				halign: 'left',
				valign: 'top',
			})
		})

		test('converts "e" prefix to right/bottom (end alias)', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeTextEl({
					halign: { isExpression: true, value: '"end"' } as ExpressionOrValue<HorizontalAlignment>,
					valign: { isExpression: true, value: '"end"' } as ExpressionOrValue<VerticalAlignment>,
				}),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements[0]).toMatchObject({
				halign: 'right',
				valign: 'bottom',
			})
		})

		test('defaults to center for invalid alignment expression', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeTextEl({
					halign: { isExpression: true, value: '"xyz"' } as ExpressionOrValue<HorizontalAlignment>,
					valign: { isExpression: true, value: '"abc"' } as ExpressionOrValue<VerticalAlignment>,
				}),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements[0]).toMatchObject({
				halign: 'center',
				valign: 'center',
			})
		})
	})

	describe('image element edge cases', () => {
		test('handles null base64Image', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeImageEl()]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect((result.elements[0] as { base64Image: string | null }).base64Image).toBeNull()
		})

		test('converts all fillMode options', async () => {
			const fillModes = ['crop', 'fill', 'fit'] as const

			for (const fillMode of fillModes) {
				const elements: SomeButtonGraphicsElement[] = [
					makeImageEl({ base64Image: val('data:image/png;base64,abc'), fillMode: val(fillMode) }),
				]

				const result = await ConvertSomeButtonGraphicsElementForDrawing(
					createMockInstanceDefinitions(),
					createMockParser(),
					mockDrawPixelBuffers,
					elements,
					new Map(),
					true,
					null,
					null,
					null
				)

				expect((result.elements[0] as { fillMode: string }).fillMode).toBe(fillMode)
			}
		})
	})

	describe('composite option types', () => {
		test('injects checkbox option value', async () => {
			const compositeDefinition: CompositeElementDefinition = {
				id: 'checkboxComposite',
				name: 'Checkbox Composite',
				description: '',
				options: [
					{
						id: 'showBorder',
						type: 'checkbox',
						label: 'Show Border',
						default: false,
					},
				],
				elements: [makeBoxEl({ id: 'box', color: val(0xff0000) })],
			}

			const instanceDefs = createMockInstanceDefinitions({
				'test-connection': {
					checkboxComposite: compositeDefinition,
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'comp1',
					name: '',
					type: 'composite',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					connectionId: 'test-connection',
					elementId: 'checkboxComposite',
					'opt:showBorder': val(true),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				instanceDefs,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0].type).toBe('group')
		})

		test('injects number option value', async () => {
			const compositeDefinition: CompositeElementDefinition = {
				id: 'numberComposite',
				name: 'Number Composite',
				description: '',
				options: [
					{
						id: 'size',
						type: 'number',
						label: 'Size',
						default: 50,
						min: 0,
						max: 100,
					},
				],
				elements: [makeBoxEl({ id: 'box', color: val(0xff0000) })],
			}

			const instanceDefs = createMockInstanceDefinitions({
				'test-connection': {
					numberComposite: compositeDefinition,
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'comp1',
					name: '',
					type: 'composite',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					connectionId: 'test-connection',
					elementId: 'numberComposite',
					'opt:size': val(75),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				instanceDefs,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
		})

		test('injects dropdown option value', async () => {
			const compositeDefinition: CompositeElementDefinition = {
				id: 'dropdownComposite',
				name: 'Dropdown Composite',
				description: '',
				options: [
					{
						id: 'color',
						type: 'dropdown',
						label: 'Color',
						default: 'red',
						choices: [
							{ id: 'red', label: 'Red' },
							{ id: 'green', label: 'Green' },
							{ id: 'blue', label: 'Blue' },
						],
					},
				],
				elements: [makeBoxEl({ id: 'box', color: val(0xff0000) })],
			}

			const instanceDefs = createMockInstanceDefinitions({
				'test-connection': {
					dropdownComposite: compositeDefinition,
				},
			})

			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'comp1',
					name: '',
					type: 'composite',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					connectionId: 'test-connection',
					elementId: 'dropdownComposite',
					'opt:color': val('green'),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				instanceDefs,
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
		})
	})

	describe('enum fallback handling', () => {
		test('falls back to default for invalid enum value', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				makeBoxEl({
					id: 'box1',
					width: val(50),
					height: val(50),
					color: val(0xff0000),
					borderWidth: val(2),
					borderColor: val(0x00ff00),
					borderPosition: expr<'inside' | 'center' | 'outside'>('"invalid"'),
				}),
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			// Should fall back to 'inside' as default
			expect((result.elements[0] as { borderPosition: string }).borderPosition).toBe('inside')
		})
	})

	describe('reference element conversion', () => {
		test('shows placeholder when no getRenderAtLocation is provided (references disabled)', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/0') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				null,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0].type).toBe('reference')
			const refEl = result.elements[0] as ButtonGraphicsReferenceDrawElement
			expect(refEl.children).toHaveLength(2)
			expect(refEl.children[0].type).toBe('box')
			expect(refEl.children[1].type).toBe('text')
		})

		test('produces an empty reference element when location is empty', async () => {
			const getRenderAtLocation = vi.fn(() => null)
			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			expect(result.elements).toHaveLength(1)
			const refEl = result.elements[0] as ButtonGraphicsReferenceDrawElement
			expect(refEl.children).toHaveLength(0)
			expect(getRenderAtLocation).not.toHaveBeenCalled()
		})

		test('produces an empty reference element when location is invalid', async () => {
			const getRenderAtLocation = vi.fn(() => null)
			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('not-valid') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			const refEl = result.elements[0] as ButtonGraphicsReferenceDrawElement
			expect(refEl.children).toHaveLength(0)
		})

		test('produces an empty reference element when no render exists at the location', async () => {
			const getRenderAtLocation = vi.fn(() => null)
			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/1') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			const refEl = result.elements[0] as ButtonGraphicsReferenceDrawElement
			expect(refEl.children).toHaveLength(0)
		})

		test('embeds draw elements from the referenced location', async () => {
			const referencedDrawElements: SomeButtonGraphicsDrawElement[] = [
				makeTextDrawEl({ id: 'ref-text', text: 'Hello from ref' }),
			]
			const mockRender = createMockImageResult(referencedDrawElements)
			const getRenderAtLocation = vi.fn(() => mockRender)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/1') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			expect(result.elements).toHaveLength(1)
			const refEl = result.elements[0] as ButtonGraphicsReferenceDrawElement
			expect(refEl.type).toBe('reference')
			expect(refEl.children).toHaveLength(1)
			expect(refEl.children[0]).toMatchObject({ type: 'text', text: 'Hello from ref' })
		})

		test('excludes canvas elements from the referenced location', async () => {
			const canvasDrawEl: ButtonGraphicsCanvasDrawElement = {
				id: 'canvas1',
				type: 'canvas',
				usage: ButtonGraphicsElementUsage.Automatic,
				contentHash: 'hash-canvas',
				decoration: ButtonGraphicsDecorationType.FollowDefault,
				showStatusIcons: ButtonGraphicsShowStatusIcons.FollowDefault,
			}
			const referencedDrawElements: SomeButtonGraphicsDrawElement[] = [
				canvasDrawEl,
				makeTextDrawEl({ id: 'ref-text', text: 'Visible' }),
			]
			const mockRender = createMockImageResult(referencedDrawElements)
			const getRenderAtLocation = vi.fn(() => mockRender)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/1') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			const refEl = result.elements[0] as ButtonGraphicsReferenceDrawElement
			// Canvas should be excluded; only the text should appear
			expect(refEl.children).toHaveLength(1)
			expect(refEl.children[0].type).toBe('text')
		})

		test('records the referenced location in referencedLocations', async () => {
			const referencedDrawElements: SomeButtonGraphicsDrawElement[] = [makeTextDrawEl({ id: 'ref-text', text: 'Hi' })]
			const mockRender = createMockImageResult(referencedDrawElements)
			const getRenderAtLocation = vi.fn(() => mockRender)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/1') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			expect(result.referencedLocations.has('1/0/1')).toBe(true)
		})

		test('shows placeholder when reference target is the current location (self-loop)', async () => {
			const getRenderAtLocation = vi.fn(() => null)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/0') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0', // same location as target → self-reference loop
				getRenderAtLocation
			)

			const refEl = result.elements[0] as ButtonGraphicsReferenceDrawElement
			expect(refEl.children).toHaveLength(2)
			expect(refEl.children[0].type).toBe('box')
			expect(refEl.children[1].type).toBe('text')
		})

		test('shows placeholder when reference target transitively references the current location (indirect loop)', async () => {
			// Target '1/0/1' has already been rendered, and its render references back to '1/0/0'
			const targetRender = createMockImageResult(
				[makeTextDrawEl({ id: 'ref-text', text: 'Unreachable' })],
				new Set(['1/0/0']) // back-reference to current button
			)
			const getRenderAtLocation = vi.fn(() => targetRender)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/1') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			const refEl = result.elements[0] as ButtonGraphicsReferenceDrawElement
			expect(refEl.children).toHaveLength(2)
			expect(refEl.children[0].type).toBe('box')
			expect(refEl.children[1].type).toBe('text')
		})

		test('propagates transitive referencedLocations from the target render', async () => {
			const targetRender = createMockImageResult(
				[makeTextDrawEl({ id: 'ref-text', text: 'Hi' })],
				new Set(['1/0/2', '1/0/3'])
			)
			const getRenderAtLocation = vi.fn(() => targetRender)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/1') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			expect(result.referencedLocations.has('1/0/1')).toBe(true)
			expect(result.referencedLocations.has('1/0/2')).toBe(true)
			expect(result.referencedLocations.has('1/0/3')).toBe(true)
		})

		test('reference element is omitted when disabled and onlyEnabled=true', async () => {
			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ enabled: val(false), location: val('1/0/1') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				vi.fn(() => null)
			)

			expect(result.elements).toHaveLength(0)
		})

		test('resolves variable in location string when not an expression', async () => {
			const referencedDrawElements: SomeButtonGraphicsDrawElement[] = [makeTextDrawEl({ id: 'ref-text', text: 'Hi' })]
			const mockRender = createMockImageResult(referencedDrawElements)
			const getRenderAtLocation = vi.fn(() => mockRender)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('$(test:loc)') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser({ test: { loc: '1/0/1' } }),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			expect(getRenderAtLocation).toHaveBeenCalledWith({ pageNumber: 1, row: 0, column: 1 })
			expect(result.referencedLocations.has('1/0/1')).toBe(true)
		})

		test('tracks variables used in the location string', async () => {
			const getRenderAtLocation = vi.fn(() => null)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('$(test:loc)') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser({ test: { loc: '1/0/1' } }),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			expect(result.usedVariables.has('test:loc')).toBe(true)
		})

		test('cyclicLocations is empty when no cycle exists', async () => {
			const mockRender = createMockImageResult([makeTextDrawEl({ id: 'ref-text', text: 'Hi' })])
			const getRenderAtLocation = vi.fn(() => mockRender)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/1') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			expect(result.cyclicLocations.size).toBe(0)
		})

		test('cyclicLocations contains the location on a self-reference loop', async () => {
			const getRenderAtLocation = vi.fn(() => null)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/0') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0', // self-reference
				getRenderAtLocation
			)

			expect(result.cyclicLocations.has('1/0/0')).toBe(true)
			// Also tracked in referencedLocations
			expect(result.referencedLocations.has('1/0/0')).toBe(true)
		})

		test('cyclicLocations contains the location on an indirect loop', async () => {
			// Target '1/0/1' has a render that references back to '1/0/0'
			const targetRender = createMockImageResult([makeTextDrawEl({ id: 'ref-text', text: 'Loop' })], new Set(['1/0/0']))
			const getRenderAtLocation = vi.fn(() => targetRender)

			const elements: SomeButtonGraphicsElement[] = [makeReferenceEl({ location: val('1/0/1') })]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null,
				'1/0/0',
				getRenderAtLocation
			)

			expect(result.cyclicLocations.has('1/0/1')).toBe(true)
			// The direct location is still in referencedLocations
			expect(result.referencedLocations.has('1/0/1')).toBe(true)
			// Only the cyclic entry, not an unrelated location
			expect(result.cyclicLocations.size).toBe(1)
		})
	})

	describe('gauge element conversion', () => {
		async function convertGauge(
			element: ButtonGraphicsGaugeElement,
			variableValues: Record<string, Record<string, string | number | boolean>> = {},
			onlyEnabled = true
		) {
			return ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(variableValues),
				mockDrawPixelBuffers,
				[element],
				new Map(),
				onlyEnabled,
				null,
				null,
				null
			)
		}

		function gaugeDrawEl(result: Awaited<ReturnType<typeof convertGauge>>): ButtonGraphicsGaugeDrawElement {
			return result.elements[0] as ButtonGraphicsGaugeDrawElement
		}

		test('converts gauge element with all defaults', async () => {
			const result = await convertGauge(makeGaugeEl())
			const el = gaugeDrawEl(result)
			expect(el.type).toBe('gauge')
			expect(el.id).toBe('gauge1')
			expect(el.value).toBe(50)
			expect(el.min).toBe(0)
			expect(el.max).toBe(100)
			expect(el.origin).toBe(0)
			expect(el.symmetric).toBe(false)
			expect(el.orientation).toBe('horizontal')
			expect(el.reverse).toBe(false)
			expect(el.trackWidth).toBe(100)
			expect(el.startAngle).toBe(0)
			expect(el.endAngle).toBe(360)
			expect(el.ringWidth).toBe(20)
			expect(el.roundedEnds).toBe(true)
			expect(el.fillEnabled).toBe(true)
			expect(el.multiColour).toBe(true)
			expect(el.markerEnabled).toBe(false)
			expect(el.markerColor).toBe(0xffffff)
			expect(el.markerWidth).toBe(15)
			expect(el.trackStyle).toBe('transparent')
			expect(el.trackAmount).toBe(70)
			expect(el.opacity).toBe(1)
		})

		test('value, min, max, origin pass through in the authored domain (no clamp/round)', async () => {
			// Values are now mapped by the renderer; the converter keeps them raw.
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ value: val(150) }))).value).toBe(150)
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ value: val(-10) }))).value).toBe(-10)
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ value: val(33.333) }))).value).toBe(33.333)
			const el = gaugeDrawEl(await convertGauge(makeGaugeEl({ min: val(-232), max: val(24), origin: val(-100) })))
			expect(el.min).toBe(-232)
			expect(el.max).toBe(24)
			expect(el.origin).toBe(-100)
		})

		test('value resolved from expression', async () => {
			const el = gaugeDrawEl(
				await convertGauge(makeGaugeEl({ value: expr('$(counter:level)') }), { counter: { level: 75 } })
			)
			expect(el.value).toBe(75)
		})

		test('symmetric / fillEnabled / multiColour booleans pass through', async () => {
			const el = gaugeDrawEl(
				await convertGauge(makeGaugeEl({ symmetric: val(true), fillEnabled: val(false), multiColour: val(false) }))
			)
			expect(el.symmetric).toBe(true)
			expect(el.fillEnabled).toBe(false)
			expect(el.multiColour).toBe(false)
		})

		test('missing boolean field falls back to its schema default', async () => {
			// Regression: a boolean added to the schema after an element was saved must use the default,
			// not coerce undefined to false (which previously disabled the fill on existing gauges).
			const el = makeGaugeEl()
			delete (el as Partial<ButtonGraphicsGaugeElement>).fillEnabled
			expect(gaugeDrawEl(await convertGauge(el)).fillEnabled).toBe(true)
		})

		test('orientation tolerant matching: leading whitespace and prefix', async () => {
			// Deliberately out-of-spec raw strings exercising the tolerant parser — cast to bypass union check
			expect(
				gaugeDrawEl(await convertGauge(makeGaugeEl({ orientation: val('  horizontal') as any }))).orientation
			).toBe('horizontal')
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ orientation: val('v') as any }))).orientation).toBe(
				'vertical'
			)
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ orientation: val('r') as any }))).orientation).toBe('ring')
		})

		test('orientation: unknown value falls back to default', async () => {
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ orientation: val('diagonal') as any }))).orientation).toBe(
				'horizontal'
			)
		})

		test('orientation: empty string falls back to default', async () => {
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ orientation: val('   ') as any }))).orientation).toBe(
				'horizontal'
			)
		})

		test('all three orientations pass through', async () => {
			for (const o of ['horizontal', 'vertical', 'ring'] as const) {
				expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ orientation: val(o) }))).orientation).toBe(o)
			}
		})

		test('trackStyle tolerant matching', async () => {
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ trackStyle: val('  transparent') as any }))).trackStyle).toBe(
				'transparent'
			)
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ trackStyle: val('d') as any }))).trackStyle).toBe('dimmed')
		})

		test('ringWidth clamped to 1–50', async () => {
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ ringWidth: val(80) }))).ringWidth).toBe(50)
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ ringWidth: val(0) }))).ringWidth).toBe(1)
		})

		test('trackWidth clamped to 0–100', async () => {
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ trackWidth: val(150) }))).trackWidth).toBe(100)
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ trackWidth: val(-5) }))).trackWidth).toBe(0)
		})

		test('trackAmount clamped to 0–100', async () => {
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ trackAmount: val(200) }))).trackAmount).toBe(100)
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ trackAmount: val(-5) }))).trackAmount).toBe(0)
		})

		test('markerWidth clamped to 1–100, marker fields pass through', async () => {
			const el = gaugeDrawEl(
				await convertGauge(makeGaugeEl({ markerEnabled: val(true), markerColor: val(0x123456), markerWidth: val(200) }))
			)
			expect(el.markerEnabled).toBe(true)
			expect(el.markerColor).toBe(0x123456)
			expect(el.markerWidth).toBe(100)
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ markerWidth: val(0) }))).markerWidth).toBe(1)
		})

		test('startAngle / endAngle pass through', async () => {
			const el = gaugeDrawEl(await convertGauge(makeGaugeEl({ startAngle: val(45), endAngle: val(315) })))
			expect(el.startAngle).toBe(45)
			expect(el.endAngle).toBe(315)
		})

		test('stops parsed from table rows including gradient flag', async () => {
			const el = gaugeDrawEl(await convertGauge(makeGaugeEl()))
			expect(el.stops).toEqual([
				{ value: 0, color: 0x00ff00, gradient: false },
				{ value: 66, color: 0xffff00, gradient: false },
				{ value: 85, color: 0xff0000, gradient: false },
			])
		})

		test('stop gradient flag passes through', async () => {
			const el = gaugeDrawEl(
				await convertGauge(
					makeGaugeEl({
						stops: val([
							{ value: 0, color: 0x00ff00, gradient: true },
							{ value: 100, color: 0xff0000, gradient: false },
						]),
					})
				)
			)
			expect(el.stops[0]!.gradient).toBe(true)
			expect(el.stops[1]!.gradient).toBe(false)
		})

		test('stop values are NOT clamped (authored domain, mapped by renderer)', async () => {
			const el = gaugeDrawEl(
				await convertGauge(
					makeGaugeEl({
						min: val(-100),
						max: val(100),
						stops: val([
							{ value: -100, color: 0xff0000, gradient: false },
							{ value: 100, color: 0x00ff00, gradient: false },
						]),
					})
				)
			)
			expect(el.stops[0]!.value).toBe(-100)
			expect(el.stops[1]!.value).toBe(100)
		})

		test('partial stop rows fall back to defaults without throwing', async () => {
			const el = gaugeDrawEl(
				await convertGauge(
					makeGaugeEl({
						// Rows missing some properties must not throw a TypeError
						stops: val([{ value: 50 }, { color: 0x0000ff }] as any),
					})
				)
			)
			expect(el.stops).toHaveLength(2)
			expect(el.stops[0]).toEqual({ value: 50, color: 0, gradient: false })
			expect(el.stops[1]).toEqual({ value: 0, color: 0x0000ff, gradient: false })
		})

		test('empty stops produce empty array', async () => {
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ stops: val([]) }))).stops).toEqual([])
		})

		test('enabled=false with onlyEnabled=true filters element out', async () => {
			const result = await convertGauge(makeGaugeEl({ enabled: val(false) }), {}, true)
			expect(result.elements).toHaveLength(0)
		})

		test('enabled=false with onlyEnabled=false produces disabled draw element', async () => {
			const result = await convertGauge(makeGaugeEl({ enabled: val(false) }), {}, false)
			expect(gaugeDrawEl(result).enabled).toBe(false)
		})

		test('opacity scaled from percentage to 0–1', async () => {
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ opacity: val(50) }))).opacity).toBeCloseTo(0.5)
		})

		test('roundedEnds=false passes through', async () => {
			expect(gaugeDrawEl(await convertGauge(makeGaugeEl({ roundedEnds: val(false) }))).roundedEnds).toBe(false)
		})

		test('contentHash changes when value changes', async () => {
			const hash50 = gaugeDrawEl(await convertGauge(makeGaugeEl({ value: val(50) }))).contentHash
			const hash75 = gaugeDrawEl(await convertGauge(makeGaugeEl({ value: val(75) }))).contentHash
			expect(hash50).not.toBe(hash75)
		})

		test('contentHash is stable for identical inputs', async () => {
			const a = gaugeDrawEl(await convertGauge(makeGaugeEl())).contentHash
			const b = gaugeDrawEl(await convertGauge(makeGaugeEl())).contentHash
			expect(a).toBe(b)
		})
	})
})
