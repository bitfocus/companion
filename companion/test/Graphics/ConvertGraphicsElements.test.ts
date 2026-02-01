import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../../lib/Graphics/ConvertGraphicsElements.js'
import type {
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
	ButtonGraphicsGroupDrawElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { CompanionFieldVariablesSupport, type ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { ButtonGraphicsDecorationType, ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import type { InstanceDefinitions, CompositeElementDefinition } from '../../lib/Instance/Definitions.js'
import type { VariablesAndExpressionParser } from '../../lib/Variables/VariablesAndExpressionParser.js'
import { ElementConversionCache } from '../../lib/Graphics/ElementConversionCache.js'
import {
	executeExpression,
	parseVariablesInString,
	type VariableValueData,
	type VariableValueCache,
} from '../../lib/Variables/Util.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import { collectContentHashes } from '../../lib/Graphics/ConvertGraphicsElements/Util.js'

// Shorthand for usage enum
const USAGE = ButtonGraphicsElementUsage.Automatic

// Helper to create ExpressionOrValue
function val<T>(value: T): ExpressionOrValue<T> {
	return { isExpression: false, value }
}

function expr<T>(value: string): ExpressionOrValue<T> {
	return { isExpression: true, value } as ExpressionOrValue<T>
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
				return executeExpression(blinker, str, rawVariableValues, requiredType, cache)
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
		const elements: SomeButtonGraphicsDrawElement[] = [
			{
				id: 'elem1',
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
				fontsize: 'auto',
				color: 0xffffff,
				halign: 'center',
				valign: 'center',
				outlineColor: 0,
				contentHash: 'hash123',
			},
		]

		const result = collectContentHashes(elements)
		expect(result).toEqual(['hash123'])
	})

	test('collects hashes from multiple elements', () => {
		const elements: SomeButtonGraphicsDrawElement[] = [
			{
				id: 'elem1',
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
				fontsize: 'auto',
				color: 0xffffff,
				halign: 'center',
				valign: 'center',
				outlineColor: 0,
				contentHash: 'hash1',
			},
			{
				id: 'elem2',
				type: 'box',
				usage: USAGE,
				enabled: true,
				opacity: 1,
				x: 10,
				y: 10,
				width: 50,
				height: 50,
				rotation: 0,
				color: 0xff0000,
				borderWidth: 0,
				borderColor: 0,
				borderPosition: 'inside',
				contentHash: 'hash2',
			},
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
				contentHash: 'groupHash',
				children: [
					{
						id: 'child1',
						type: 'text',
						usage: USAGE,
						enabled: true,
						opacity: 1,
						x: 0,
						y: 0,
						width: 50,
						height: 50,
						rotation: 0,
						text: 'Child',
						fontsize: 'auto',
						color: 0xffffff,
						halign: 'center',
						valign: 'center',
						outlineColor: 0,
						contentHash: 'childHash',
					},
				],
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
						contentHash: 'innerHash',
						children: [
							{
								id: 'leaf',
								type: 'box',
								usage: USAGE,
								enabled: true,
								opacity: 1,
								x: 0,
								y: 0,
								width: 25,
								height: 25,
								rotation: 0,
								color: 0,
								borderWidth: 0,
								borderColor: 0,
								borderPosition: 'inside',
								contentHash: 'leafHash',
							},
						],
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
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
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
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					text: val('Hello World'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect(result.elements[0]).toMatchObject({
				id: 'text1',
				type: 'text',
				text: 'Hello World',
				fontsize: 'auto',
				color: 0xffffff,
			})
		})

		test('filters disabled text element when onlyEnabled is true', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'text1',
					name: '',
					type: 'text',
					usage: USAGE,
					enabled: val(false),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					rotation: val(0),
					text: val('Hello'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			expect(result.elements).toHaveLength(0)
		})

		test('keeps disabled element when onlyEnabled is false', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'text1',
					name: '',
					type: 'text',
					usage: USAGE,
					enabled: val(false),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: val(100),
					rotation: val(0),
					text: val('Hello'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				false,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect((result.elements[0] as { enabled: boolean }).enabled).toBe(false)
		})

		test('parses variables in text', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					text: val('Value: $(test:myvar)'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const mockParser = createMockParser({ test: { myvar: 'HELLO' } })

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				mockParser,
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			expect(result.elements[0]).toMatchObject({
				type: 'text',
				text: 'Value: HELLO',
			})
		})
	})

	describe('box element conversion', () => {
		test('converts box element', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'box1',
					name: '',
					type: 'box',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(10),
					y: val(20),
					width: val(50),
					height: val(60),
					rotation: val(0),
					color: val(0xff0000),
					borderWidth: val(2),
					borderColor: val(0x00ff00),
					borderPosition: val('inside'),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
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
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					base64Image: val('data:image/png;base64,abc123'),
					halign: val('center'),
					valign: val('center'),
					fillMode: val('fit'),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
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
				{
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
					children: [
						{
							id: 'child1',
							name: '',
							type: 'text',
							usage: USAGE,
							enabled: val(true),
							opacity: val(100),
							x: val(0),
							y: val(0),
							width: val(50),
							height: val(50),
							rotation: val(0),
							text: val('Child'),
							fontsize: val('auto'),
							color: val(0xffffff),
							halign: val('center'),
							valign: val('center'),
							outlineColor: val(0),
						},
					],
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
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
				{
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
					children: [
						{
							id: 'child1',
							name: '',
							type: 'text',
							usage: USAGE,
							enabled: val(false),
							opacity: val(100),
							x: val(0),
							y: val(0),
							width: val(50),
							height: val(50),
							rotation: val(0),
							text: val('Disabled'),
							fontsize: val('auto'),
							color: val(0xffffff),
							halign: val('center'),
							valign: val('center'),
							outlineColor: val(0),
						},
						{
							id: 'child2',
							name: '',
							type: 'text',
							usage: USAGE,
							enabled: val(true),
							opacity: val(100),
							x: val(0),
							y: val(0),
							width: val(50),
							height: val(50),
							rotation: val(0),
							text: val('Enabled'),
							fontsize: val('auto'),
							color: val(0xffffff),
							halign: val('center'),
							valign: val('center'),
							outlineColor: val(0),
						},
					],
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			const groupElement = result.elements[0] as ButtonGraphicsGroupDrawElement
			expect(groupElement.children).toHaveLength(1)
			expect(groupElement.children[0].id).toBe('child2')
		})
	})

	describe('expression evaluation', () => {
		test('evaluates expressions in element properties', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'text1',
					name: '',
					type: 'text',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: expr<number>('10 + 5'),
					y: val(0),
					width: val(100),
					height: val(100),
					rotation: val(0),
					text: val('Test'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
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
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					text: val('$(test:var1) and $(test:var2)'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser({ test: { var1: 'A', var2: 'B' } }),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			expect(result.usedVariables.has('test:var1')).toBe(true)
			expect(result.usedVariables.has('test:var2')).toBe(true)
		})

		test('tracks referenced variables in expression', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'text1',
					name: '',
					type: 'text',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(100),
					height: expr<number>('$(test:var3)'),
					rotation: val(0),
					text: val('abc'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser({ test: { var3: 10 } }),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			expect(result.usedVariables.has('test:var3')).toBe(true)
		})
	})

	describe('caching', () => {
		test('uses cache when available', async () => {
			const cache = new ElementConversionCache()

			const elements: SomeButtonGraphicsElement[] = [
				{
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
					text: val('Cached text'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			// First conversion
			await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache
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
				cache
			)

			// Verify cache was queried
			expect(getSpy).toHaveBeenCalledWith('text1')
			// Verify cache entry was returned (not undefined)
			expect(getSpy.mock.results[0].value).toBe(cachedEntry)
		})

		test('invalidates cache when variables change', async () => {
			const cache = new ElementConversionCache()

			const elements: SomeButtonGraphicsElement[] = [
				{
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
					text: val('$(test:myvar)'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			// First conversion
			const result1 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser({ test: { myvar: 'A' } }),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache
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
				cache
			)

			// Content should be different
			expect((result2.elements[0] as { text: string }).text).toBe('B')
			expect((result1.elements[0] as { text: string }).text).toBe('A')
		})

		test('purges stale cache entries', async () => {
			const cache = new ElementConversionCache()

			const elements: SomeButtonGraphicsElement[] = [
				{
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
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
				{
					id: 'text2',
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
					text: val('Test2'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			// First conversion with both elements
			await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache
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
				cache
			)

			// Cache should now only have text1
			expect(cache.get('text1')).toBeDefined()
			expect(cache.get('text2')).toBeUndefined()
		})

		test('preserves child cache entries when parent group is disabled', async () => {
			const cache = new ElementConversionCache()

			const elements: SomeButtonGraphicsElement[] = [
				{
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
					children: [
						{
							id: 'child1',
							name: '',
							type: 'text',
							usage: USAGE,
							enabled: val(true),
							opacity: val(100),
							x: val(0),
							y: val(0),
							width: val(50),
							height: val(50),
							rotation: val(0),
							text: val('Child text'),
							fontsize: val('auto'),
							color: val(0xffffff),
							halign: val('center'),
							valign: val('center'),
							outlineColor: val(0),
						},
					],
				},
			]

			// First conversion with enabled group - populates cache for group and child
			await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				cache
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
				cache
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
				cache
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
				{
					id: 'inner-text',
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
					text: val('Composite inner'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
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
				cache
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
				cache
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
				cache
			)

			// Child should NOT have been re-cached (cache hit)
			const childSetCalls = setSpy.mock.calls.filter((call) => call[0] === childKey)
			expect(childSetCalls).toHaveLength(0)
		})
	})

	describe('feedback overrides', () => {
		test('applies feedback overrides to element', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					text: val('Original'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			// feedbackOverrides is Map<elementId, Map<propertyName, ExpressionOrValue>>
			const text1Overrides = new Map<string, ExpressionOrValue<unknown>>([['text', val('Overridden')]])
			const globalReferences = new Map<string, ReadonlyMap<string, ExpressionOrValue<unknown>>>([
				['text1', text1Overrides],
			])

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				globalReferences,
				true,
				null
			)

			expect((result.elements[0] as { text: string }).text).toBe('Overridden')
		})
	})

	describe('content hash stability', () => {
		test('produces same content hash for same input', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					text: val('Stable text'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result1 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			const result2 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			expect(result1.elements[0].contentHash).toBe(result2.elements[0].contentHash)
		})

		test('produces different content hash for different input', async () => {
			const elements1: SomeButtonGraphicsElement[] = [
				{
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
					text: val('Text A'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const elements2: SomeButtonGraphicsElement[] = [
				{
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
					text: val('Text B'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result1 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements1,
				new Map(),
				true,
				null
			)

			const result2 = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements2,
				new Map(),
				true,
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
				elements: [
					{
						id: 'child1',
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
						text: val('Inside Composite'),
						fontsize: val('auto'),
						color: val(0xffffff),
						halign: val('center'),
						valign: val('center'),
						outlineColor: val(0),
					},
				],
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
				null
			)

			expect(result.elements).toHaveLength(0)
		})
	})

	describe('id prefixing', () => {
		test('children within groups share same prefix', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					children: [
						{
							id: 'child1',
							name: '',
							type: 'text',
							usage: USAGE,
							enabled: val(true),
							opacity: val(100),
							x: val(0),
							y: val(0),
							width: val(50),
							height: val(50),
							rotation: val(0),
							text: val('Child'),
							fontsize: val('auto'),
							color: val(0xffffff),
							halign: val('center'),
							valign: val('center'),
							outlineColor: val(0),
						},
					],
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
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
				elements: [
					{
						id: 'inner1',
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
						text: val('Inside Composite'),
						fontsize: val('auto'),
						color: val(0xffffff),
						halign: val('center'),
						valign: val('center'),
						outlineColor: val(0),
					},
				],
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
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'text1',
					name: '',
					type: 'text',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: expr<number>('invalid_syntax(('),
					y: val(0),
					width: val(100),
					height: val(100),
					rotation: val(0),
					text: val('Test'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			// Should use default value (0) when expression fails
			expect(result.elements).toHaveLength(1)
			expect((result.elements[0] as { x: number }).x).toBe(0)
		})

		test('handles missing variable reference gracefully', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					text: val('Value: $(nonexistent:var)'),
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: val('center'),
					valign: val('center'),
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
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
				elements: [
					{
						id: 'label',
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
						text: val('$(options:labelText)'),
						fontsize: val('auto'),
						color: val(0xffffff),
						halign: val('center'),
						valign: val('center'),
						outlineColor: val(0),
					},
				],
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
				elements: [
					{
						id: 'label',
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
						text: val('$(options:labelText)'),
						fontsize: val('auto'),
						color: val(0xffffff),
						halign: val('center'),
						valign: val('center'),
						outlineColor: val(0),
					},
				],
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
				elements: [
					{
						id: 'child',
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
						color: val(0xff0000),
						borderWidth: val(0),
						borderColor: val(0),
						borderPosition: val('inside'),
					},
				],
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
				null
			)

			expect(result.usedCompositeElements.has('myconn:simpleComposite')).toBe(true)
		})
	})

	describe('alignment expression aliases', () => {
		test('converts "s" prefix to left/top (start alias)', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: { isExpression: true, value: '"start"' } as ExpressionOrValue<HorizontalAlignment>,
					valign: { isExpression: true, value: '"start"' } as ExpressionOrValue<VerticalAlignment>,
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			expect(result.elements[0]).toMatchObject({
				halign: 'left',
				valign: 'top',
			})
		})

		test('converts "e" prefix to right/bottom (end alias)', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: { isExpression: true, value: '"end"' } as ExpressionOrValue<HorizontalAlignment>,
					valign: { isExpression: true, value: '"end"' } as ExpressionOrValue<VerticalAlignment>,
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			expect(result.elements[0]).toMatchObject({
				halign: 'right',
				valign: 'bottom',
			})
		})

		test('defaults to center for invalid alignment expression', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
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
					fontsize: val('auto'),
					color: val(0xffffff),
					halign: { isExpression: true, value: '"xyz"' } as ExpressionOrValue<HorizontalAlignment>,
					valign: { isExpression: true, value: '"abc"' } as ExpressionOrValue<VerticalAlignment>,
					outlineColor: val(0),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
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
			const elements: SomeButtonGraphicsElement[] = [
				{
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
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			expect(result.elements).toHaveLength(1)
			expect((result.elements[0] as { base64Image: string | null }).base64Image).toBeNull()
		})

		test('converts all fillMode options', async () => {
			const fillModes = ['crop', 'fill', 'fit', 'fit_or_shrink'] as const

			for (const fillMode of fillModes) {
				const elements: SomeButtonGraphicsElement[] = [
					{
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
						base64Image: val('data:image/png;base64,abc'),
						halign: val('center'),
						valign: val('center'),
						fillMode: val(fillMode),
					},
				]

				const result = await ConvertSomeButtonGraphicsElementForDrawing(
					createMockInstanceDefinitions(),
					createMockParser(),
					mockDrawPixelBuffers,
					elements,
					new Map(),
					true,
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
				elements: [
					{
						id: 'box',
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
						color: val(0xff0000),
						borderWidth: val(0),
						borderColor: val(0),
						borderPosition: val('inside'),
					},
				],
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
				elements: [
					{
						id: 'box',
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
						color: val(0xff0000),
						borderWidth: val(0),
						borderColor: val(0),
						borderPosition: val('inside'),
					},
				],
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
				elements: [
					{
						id: 'box',
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
						color: val(0xff0000),
						borderWidth: val(0),
						borderColor: val(0),
						borderPosition: val('inside'),
					},
				],
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
				null
			)

			expect(result.elements).toHaveLength(1)
		})
	})

	describe('enum fallback handling', () => {
		test('falls back to default for invalid enum value', async () => {
			const elements: SomeButtonGraphicsElement[] = [
				{
					id: 'box1',
					name: '',
					type: 'box',
					usage: USAGE,
					enabled: val(true),
					opacity: val(100),
					x: val(0),
					y: val(0),
					width: val(50),
					height: val(50),
					rotation: val(0),
					color: val(0xff0000),
					borderWidth: val(2),
					borderColor: val(0x00ff00),
					borderPosition: expr<'inside' | 'center' | 'outside'>('"invalid"'),
				},
			]

			const result = await ConvertSomeButtonGraphicsElementForDrawing(
				createMockInstanceDefinitions(),
				createMockParser(),
				mockDrawPixelBuffers,
				elements,
				new Map(),
				true,
				null
			)

			// Should fall back to 'inside' as default
			expect((result.elements[0] as { borderPosition: string }).borderPosition).toBe('inside')
		})
	})
})
