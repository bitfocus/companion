import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FONTSIZE_SHRINK_DEFAULT } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsCanvasElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
} from '@companion-app/shared/Model/StyleModel.js'
import type { ModuleLogger, SomeButtonGraphicsElement as SomeButtonGraphicsElementModule } from '@companion-module/host'
import type { PresetEntryConversionContext } from '../../../../lib/Instance/Connection/Thread/PresetInternalEntities.js'
import {
	ConvertLayeredPresetFeedbacksToEntities,
	ConvertLayerPresetElements,
} from '../../../../lib/Instance/Connection/Thread/PresetsLayered.js'
import { createStableIdGenerator } from '../../../../lib/Resources/IdGenerator.js'

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies ModuleLogger

beforeEach(() => {
	for (const fn of Object.values(logger)) fn.mockClear()
})

describe('ConvertLayeredPresetFeedbacksToEntities', () => {
	let ctx: PresetEntryConversionContext
	beforeEach(() => {
		ctx = {
			logger,
			connectionId: 'conn01',
			connectionUpgradeIndex: 5,
			allowInternalEntities: true,
			generateId: createStableIdGenerator('id'),
		}
	})

	/** A layered feedback entry, as a module would report it over the wire */
	function makeFeedback(props: Record<string, unknown>): any {
		return { feedbackId: 'mod_fb', options: {}, styleOverrides: [], ...props }
	}

	describe('input handling', () => {
		it('returns nothing for undefined feedbacks', () => {
			expect(ConvertLayeredPresetFeedbacksToEntities(undefined, ctx)).toEqual([])
		})

		it('returns nothing for an empty list', () => {
			expect(ConvertLayeredPresetFeedbacksToEntities([], ctx)).toEqual([])
		})
	})

	describe('style overrides', () => {
		it('keeps an override given as a plain value', () => {
			// #4477: modules may give a bare value instead of an ExpressionOrValue wrapper. Rejecting those
			// emptied styleOverrides, which dropped the whole feedback.
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[makeFeedback({ styleOverrides: [{ elementId: 'el1', elementProperty: 'color', override: 0xff0000 }] })],
				ctx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0].styleOverrides).toEqual([
				{ overrideId: 'id_0', elementId: 'el1', elementProperty: 'color', override: exprVal(0xff0000) },
			])
		})

		it.each([
			['zero', 0],
			['false', false],
			['an empty string', ''],
			['null', null],
		])('keeps an override given as the plain value %s', (_name, value) => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[makeFeedback({ styleOverrides: [{ elementId: 'el1', elementProperty: 'text', override: value }] })],
				ctx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0].styleOverrides?.[0].override).toEqual(exprVal(value))
		})

		it('keeps an override given as a plain object or array', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[
					makeFeedback({
						styleOverrides: [
							{ elementId: 'el1', elementProperty: 'styles', override: ['italic'] },
							{ elementId: 'el1', elementProperty: 'misc', override: { a: 1 } },
						],
					}),
				],
				ctx
			)

			expect(entities[0].styleOverrides?.map((o) => o.override)).toEqual([exprVal(['italic']), exprVal({ a: 1 })])
		})

		it('keeps an override given as a value wrapper', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[
					makeFeedback({
						styleOverrides: [{ elementId: 'el1', elementProperty: 'color', override: exprVal(255) }],
					}),
				],
				ctx
			)

			expect(entities[0].styleOverrides?.[0].override).toEqual(exprVal(255))
		})

		it('keeps an override given as an expression wrapper', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[
					makeFeedback({
						styleOverrides: [{ elementId: 'el1', elementProperty: 'text', override: exprExpr('`v=${$(this:value)}`') }],
					}),
				],
				ctx
			)

			expect(entities[0].styleOverrides?.[0].override).toEqual(exprExpr('`v=${$(this:value)}`'))
		})

		it('drops an override with no value, keeping its siblings', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[
					makeFeedback({
						styleOverrides: [
							{ elementId: 'el1', elementProperty: 'color', override: undefined },
							{ elementId: 'el2', elementProperty: 'text', override: 'hello' },
						],
					}),
				],
				ctx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0].styleOverrides).toEqual([
				{ overrideId: 'id_0', elementId: 'el2', elementProperty: 'text', override: exprVal('hello') },
			])
		})

		it('gives each override a fresh id', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[
					makeFeedback({
						styleOverrides: [
							{ elementId: 'el1', elementProperty: 'color', override: 1 },
							{ elementId: 'el1', elementProperty: 'text', override: 'a' },
						],
					}),
					makeFeedback({ styleOverrides: [{ elementId: 'el2', elementProperty: 'color', override: 2 }] }),
				],
				ctx
			)

			const overrideIds = entities.flatMap((entity) => entity.styleOverrides?.map((o) => o.overrideId) ?? [])
			expect(new Set(overrideIds).size).toBe(3)
		})

		it('clones the overrides, so the module keeps no handle on them', () => {
			const override = { elementId: 'el1', elementProperty: 'styles', override: exprVal(['italic']) }
			const entities = ConvertLayeredPresetFeedbacksToEntities([makeFeedback({ styleOverrides: [override] })], ctx)

			expect(entities[0].styleOverrides?.[0].override).not.toBe(override.override)
			expect(entities[0].styleOverrides?.[0].override.value).not.toBe(override.override.value)
		})

		it.each([
			['an empty list', []],
			['no list at all', undefined],
			['only overrides with no value', [{ elementId: 'el1', elementProperty: 'color', override: undefined }]],
		])('skips a feedback with %s', (_name, styleOverrides) => {
			const entities = ConvertLayeredPresetFeedbacksToEntities([makeFeedback({ styleOverrides })], ctx)

			expect(entities).toEqual([])
		})
	})

	describe('module feedbacks', () => {
		const override = { elementId: 'el1', elementProperty: 'color', override: 0xff0000 }

		it('converts a module feedback', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[
					makeFeedback({
						options: { x: 1, y: 'two' },
						isInverted: true,
						headline: 'Some feedback',
						styleOverrides: [override],
					}),
				],
				ctx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0]).toMatchObject({
				type: EntityModelType.Feedback,
				connectionId: 'conn01',
				definitionId: 'mod_fb',
				options: { x: exprVal(1), y: exprVal('two') },
				isInverted: exprVal(true),
				headline: 'Some feedback',
				upgradeIndex: 5,
			})
		})

		it('defaults isInverted and headline when absent', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities([makeFeedback({ styleOverrides: [override] })], ctx)

			expect(entities[0].isInverted).toEqual(exprVal(false))
			expect(entities[0].headline).toBeUndefined()
		})

		it('keeps expression wrappers in options', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[makeFeedback({ options: { x: exprExpr('$(foo) + 1') }, styleOverrides: [override] })],
				ctx
			)

			expect(entities[0].options).toEqual({ x: exprExpr('$(foo) + 1') })
		})

		it('clones the options, so the module keeps no handle on them', () => {
			const options = { x: { nested: ['a'] } }
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[makeFeedback({ options, styleOverrides: [override] })],
				ctx
			)

			expect(entities[0].options.x?.value).toEqual({ nested: ['a'] })
			expect(entities[0].options.x?.value).not.toBe(options.x)
		})

		it('carries an undefined upgradeIndex through', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities([makeFeedback({ styleOverrides: [override] })], {
				...ctx,
				connectionUpgradeIndex: undefined,
			})

			expect(entities[0].upgradeIndex).toBeUndefined()
		})

		it('gives each feedback a fresh id', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[makeFeedback({ styleOverrides: [override] }), makeFeedback({ styleOverrides: [override] })],
				ctx
			)

			expect(entities).toHaveLength(2)
			expect(entities[0].id).not.toBe(entities[1].id)
		})
	})

	describe('internal feedbacks', () => {
		const override = { elementId: 'el1', elementProperty: 'color', override: 0xff0000 }

		it('translates an internal feedback, attaching the overrides', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[
					{
						feedbackId: 'internal:logicOperator',
						options: { operation: 'and' },
						children: { default: [{ feedbackId: 'internal:checkExpression', options: { expression: '1 > 0' } }] },
						styleOverrides: [override],
					} as any,
				],
				ctx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0]).toMatchObject({
				connectionId: 'internal',
				definitionId: 'logic_operator',
				options: { operation: exprVal('and') },
			})
			expect(entities[0].styleOverrides?.[0]).toMatchObject({ elementId: 'el1', override: exprVal(0xff0000) })
		})

		it('skips an unknown internal feedback', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[{ feedbackId: 'internal:notAThing', options: {}, styleOverrides: [override] }],
				ctx
			)

			expect(entities).toEqual([])
			expect(logger.warn).toHaveBeenCalledTimes(1)
		})

		it('leaves internal ids as module feedbacks for legacy modules', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[{ feedbackId: 'internal:logicOperator', options: {}, styleOverrides: [override] }],
				{ ...ctx, allowInternalEntities: false }
			)

			expect(entities[0]).toMatchObject({
				connectionId: 'conn01',
				definitionId: 'internal:logicOperator',
				upgradeIndex: 5,
			})
		})
	})
})

describe('ConvertLayerPresetElements', () => {
	let generateId: () => string
	beforeEach(() => {
		generateId = createStableIdGenerator('el')
	})

	function convert(elements: SomeButtonGraphicsElementModule[], forceNewIds = false) {
		return ConvertLayerPresetElements(logger, 'conn01', undefined, elements, generateId, forceNewIds)
	}

	/** The converted elements, without the canvas that is always prepended */
	function convertWithoutCanvas(
		elements: SomeButtonGraphicsElementModule[],
		forceNewIds = false
	): Exclude<SomeButtonGraphicsElement, ButtonGraphicsCanvasElement>[] {
		return convert(elements, forceNewIds).slice(1) as Exclude<SomeButtonGraphicsElement, ButtonGraphicsCanvasElement>[]
	}

	describe('canvas', () => {
		it('prepends a default canvas when the preset gives none', () => {
			const elements = ConvertLayerPresetElements(logger, 'conn01', undefined, [], generateId)

			expect(elements).toEqual([
				{
					id: 'el_0',
					type: 'canvas',
					name: 'Canvas',
					usage: ButtonGraphicsElementUsage.Automatic,
					decoration: exprVal(ButtonGraphicsDecorationType.FollowDefault),
					showStatusIcons: exprVal(ButtonGraphicsShowStatusIcons.FollowDefault),
				},
			])
		})

		it('prepends a default canvas when the preset gives an empty one', () => {
			const elements = ConvertLayerPresetElements(logger, 'conn01', {}, [], generateId)

			expect(elements[0]).toMatchObject({
				decoration: exprVal(ButtonGraphicsDecorationType.FollowDefault),
				showStatusIcons: exprVal(ButtonGraphicsShowStatusIcons.FollowDefault),
			})
		})

		it('takes plain canvas values', () => {
			const elements = ConvertLayerPresetElements(
				logger,
				'conn01',
				{
					decoration: ButtonGraphicsDecorationType.TopBar,
					showStatusIcons: ButtonGraphicsShowStatusIcons.None,
				},
				[],
				generateId
			)

			expect(elements[0]).toMatchObject({
				decoration: exprVal(ButtonGraphicsDecorationType.TopBar),
				showStatusIcons: exprVal(ButtonGraphicsShowStatusIcons.None),
			})
		})

		it('takes expression canvas values', () => {
			const elements = ConvertLayerPresetElements(
				logger,
				'conn01',
				{ decoration: exprExpr('$(foo)'), showStatusIcons: exprExpr('$(bar)') },
				[],
				generateId
			)

			expect(elements[0]).toMatchObject({
				decoration: exprExpr('$(foo)'),
				showStatusIcons: exprExpr('$(bar)'),
			})
		})

		it('is always first, ahead of the preset elements', () => {
			const elements = convert([{ type: 'box' }])

			expect(elements.map((el) => el.type)).toEqual(['canvas', 'box'])
		})
	})

	describe('element identity', () => {
		it('keeps an id the module named', () => {
			expect(convertWithoutCanvas([{ type: 'box', id: 'named-box' }])[0].id).toBe('named-box')
		})

		it.each([
			['no id', undefined],
			['an empty id', ''],
		])('generates an id for an element with %s', (_name, id) => {
			expect(convertWithoutCanvas([{ type: 'box', id }])[0].id).toBe('el_1')
		})

		it('replaces named ids when forceNewIds is set', () => {
			const elements = convertWithoutCanvas([{ type: 'box', id: 'named-box' }], true)

			expect(elements[0].id).toBe('el_1')
		})

		it('replaces named ids of nested children when forceNewIds is set', () => {
			const elements = convertWithoutCanvas(
				[{ type: 'group', id: 'named-group', children: [{ type: 'box', id: 'named-box' }] }],
				true
			)

			const group = elements[0] as any
			expect(group.id).not.toBe('named-group')
			expect(group.children[0].id).not.toBe('named-box')
		})

		it('gives every element a unique id', () => {
			const elements = convert([{ type: 'box' }, { type: 'box' }, { type: 'circle' }])

			expect(new Set(elements.map((el) => el.id)).size).toBe(4)
		})

		it.each([
			['box', 'Box'],
			['circle', 'Circle'],
			['line', 'Line'],
			['image', 'Image'],
			['text', 'Text'],
			['gauge', 'Gauge'],
			['group', 'Group'],
		])('names an unnamed %s element "%s"', (type, expectedName) => {
			const elements = convertWithoutCanvas([{ type, text: '', base64Image: null, children: [] } as any])

			expect(elements[0].name).toBe(expectedName)
		})

		it('keeps a name the module gave', () => {
			expect(convertWithoutCanvas([{ type: 'box', name: 'My box' }])[0].name).toBe('My box')
		})

		it('keeps an empty name the module gave', () => {
			expect(convertWithoutCanvas([{ type: 'box', name: '' }])[0].name).toBe('')
		})
	})

	describe('pinned properties', () => {
		it('gives an element the defaults for its type', () => {
			const elements = convertWithoutCanvas([
				{ type: 'box' },
				{ type: 'text', text: 'hi' },
				{ type: 'group', children: [] },
			])

			expect(elements[0].pinnedProperties).toEqual(['color'])
			expect(elements[1].pinnedProperties).toEqual([
				'text',
				'fontsize',
				'fontsizeAllowShrink',
				'color',
				'halign',
				'valign',
			])
			expect(elements[2].pinnedProperties).toEqual([])
		})

		it('keeps exactly the set the module gave', () => {
			const elements = convertWithoutCanvas([{ type: 'box', pinnedProperties: ['borderWidth'] } as any])

			expect(elements[0].pinnedProperties).toEqual(['borderWidth'])
		})

		it('keeps an empty set the module gave', () => {
			const elements = convertWithoutCanvas([{ type: 'box', pinnedProperties: [] } as any])

			expect(elements[0].pinnedProperties).toEqual([])
		})

		it('drops non-string entries from the set', () => {
			const elements = convertWithoutCanvas([{ type: 'box', pinnedProperties: ['color', 5, null, { a: 1 }] } as any])

			expect(elements[0].pinnedProperties).toEqual(['color'])
		})

		it('falls back to the defaults when the set is not an array', () => {
			const elements = convertWithoutCanvas([{ type: 'box', pinnedProperties: 'color' } as any])

			expect(elements[0].pinnedProperties).toEqual(['color'])
		})
	})

	describe('value conversion', () => {
		it('wraps a plain value', () => {
			expect(convertWithoutCanvas([{ type: 'box', opacity: 50 }])[0].opacity).toEqual(exprVal(50))
		})

		it('keeps a value wrapper', () => {
			expect(convertWithoutCanvas([{ type: 'box', opacity: exprVal(50) }])[0].opacity).toEqual(exprVal(50))
		})

		it('keeps an expression wrapper', () => {
			expect(convertWithoutCanvas([{ type: 'box', opacity: exprExpr('$(foo)') }])[0].opacity).toEqual(
				exprExpr('$(foo)')
			)
		})

		it('uses the default for an omitted value', () => {
			expect(convertWithoutCanvas([{ type: 'box' }])[0].opacity).toEqual(exprVal(100))
		})

		it.each([
			['false', false],
			['zero', 0],
			['an empty string', ''],
		])('wraps the plain value %s rather than falling back to the default', (_name, value) => {
			const elements = convertWithoutCanvas([{ type: 'box', enabled: value } as any])

			expect(elements[0].enabled).toEqual(exprVal(value))
		})
	})

	describe('element types', () => {
		it('converts a box with defaults', () => {
			expect(convertWithoutCanvas([{ type: 'box', id: 'b1' }])).toEqual([
				{
					type: 'box',
					id: 'b1',
					name: 'Box',
					usage: ButtonGraphicsElementUsage.Automatic,
					pinnedProperties: ['color'],
					enabled: exprVal(true),
					opacity: exprVal(100),
					x: exprVal(0),
					y: exprVal(0),
					width: exprVal(100),
					height: exprVal(100),
					rotation: exprVal(0),
					color: exprVal(0xffffff),
					cornerRadius: exprVal(0),
					borderColor: exprVal(0x000000),
					borderWidth: exprVal(0),
					borderPosition: exprVal('inside'),
				},
			])
		})

		it('converts a box with every property given', () => {
			const elements = convertWithoutCanvas([
				{
					type: 'box',
					id: 'b1',
					name: 'Backdrop',
					enabled: false,
					opacity: 80,
					x: 1,
					y: 2,
					width: 3,
					height: 4,
					rotation: 45,
					color: '#ff0000',
					cornerRadius: 8,
					borderColor: 0x00ff00,
					borderWidth: 2,
					borderPosition: 'outside',
				},
			])

			expect(elements[0]).toMatchObject({
				enabled: exprVal(false),
				opacity: exprVal(80),
				x: exprVal(1),
				y: exprVal(2),
				width: exprVal(3),
				height: exprVal(4),
				rotation: exprVal(45),
				color: exprVal('#ff0000'),
				cornerRadius: exprVal(8),
				borderColor: exprVal(0x00ff00),
				borderWidth: exprVal(2),
				borderPosition: exprVal('outside'),
			})
		})

		it('converts a text element with defaults', () => {
			expect(convertWithoutCanvas([{ type: 'text', id: 't1', text: 'hello' }])).toEqual([
				{
					type: 'text',
					id: 't1',
					name: 'Text',
					usage: ButtonGraphicsElementUsage.Automatic,
					pinnedProperties: ['text', 'fontsize', 'fontsizeAllowShrink', 'color', 'halign', 'valign'],
					enabled: exprVal(true),
					opacity: exprVal(100),
					x: exprVal(0),
					y: exprVal(0),
					width: exprVal(100),
					height: exprVal(100),
					rotation: exprVal(0),
					text: exprVal('hello'),
					fontsize: exprVal(FONTSIZE_SHRINK_DEFAULT),
					fontsizeAllowShrink: exprVal(true),
					font: exprVal('companion-sans'),
					weight: exprVal('normal'),
					styles: exprVal([]),
					color: exprVal(0xffffff),
					halign: exprVal('center'),
					valign: exprVal('center'),
					outlineColor: exprVal(0xff000000),
				},
			])
		})

		it('converts a text element with every property given', () => {
			const elements = convertWithoutCanvas([
				{
					type: 'text',
					text: exprExpr('`${$(foo)}`'),
					fontsize: 14,
					fontsizeAllowShrink: false,
					font: 'companion-mono',
					weight: 'bold',
					styles: ['italic', 'underline'],
					color: 0x123456,
					halign: 'left',
					valign: 'top',
					outlineColor: 0x000000,
				},
			])

			expect(elements[0]).toMatchObject({
				text: exprExpr('`${$(foo)}`'),
				fontsize: exprVal(14),
				fontsizeAllowShrink: exprVal(false),
				font: exprVal('companion-mono'),
				weight: exprVal('bold'),
				styles: exprVal(['italic', 'underline']),
				color: exprVal(0x123456),
				halign: exprVal('left'),
				valign: exprVal('top'),
				outlineColor: exprVal(0x000000),
			})
		})

		it('converts an image element with defaults', () => {
			expect(convertWithoutCanvas([{ type: 'image', id: 'i1', base64Image: null }])).toEqual([
				{
					type: 'image',
					id: 'i1',
					name: 'Image',
					usage: ButtonGraphicsElementUsage.Automatic,
					pinnedProperties: ['base64Image', 'halign', 'valign'],
					enabled: exprVal(true),
					opacity: exprVal(100),
					x: exprVal(0),
					y: exprVal(0),
					width: exprVal(100),
					height: exprVal(100),
					rotation: exprVal(0),
					base64Image: exprVal(null),
					halign: exprVal('center'),
					valign: exprVal('center'),
					fillMode: exprVal('fit'),
				},
			])
		})

		it('converts an image element with every property given', () => {
			const elements = convertWithoutCanvas([
				{ type: 'image', base64Image: 'AAAA', halign: 'right', valign: 'bottom', fillMode: 'crop' },
			])

			expect(elements[0]).toMatchObject({
				base64Image: exprVal('AAAA'),
				halign: exprVal('right'),
				valign: exprVal('bottom'),
				fillMode: exprVal('crop'),
			})
		})

		it('converts a line with defaults', () => {
			expect(convertWithoutCanvas([{ type: 'line', id: 'l1' }])).toEqual([
				{
					type: 'line',
					id: 'l1',
					name: 'Line',
					usage: ButtonGraphicsElementUsage.Automatic,
					pinnedProperties: ['borderColor', 'borderWidth'],
					enabled: exprVal(true),
					opacity: exprVal(100),
					fromX: exprVal(0),
					fromY: exprVal(0),
					toX: exprVal(100),
					toY: exprVal(100),
					borderColor: exprVal(0xffffff),
					borderWidth: exprVal(2),
					borderPosition: exprVal('center'),
				},
			])
		})

		it('converts a line with every property given', () => {
			const elements = convertWithoutCanvas([
				{
					type: 'line',
					fromX: 10,
					fromY: 20,
					toX: 30,
					toY: 40,
					borderColor: 0x00ff00,
					borderWidth: 5,
					borderPosition: 'inside',
				},
			])

			expect(elements[0]).toMatchObject({
				fromX: exprVal(10),
				fromY: exprVal(20),
				toX: exprVal(30),
				toY: exprVal(40),
				borderColor: exprVal(0x00ff00),
				borderWidth: exprVal(5),
				borderPosition: exprVal('inside'),
			})
		})

		it('converts a circle with defaults', () => {
			expect(convertWithoutCanvas([{ type: 'circle', id: 'c1' }])).toEqual([
				{
					type: 'circle',
					id: 'c1',
					name: 'Circle',
					usage: ButtonGraphicsElementUsage.Automatic,
					pinnedProperties: ['color'],
					enabled: exprVal(true),
					opacity: exprVal(100),
					x: exprVal(0),
					y: exprVal(0),
					width: exprVal(100),
					height: exprVal(100),
					color: exprVal(0xffffff),
					startAngle: exprVal(0),
					endAngle: exprVal(360),
					drawSlice: exprVal(false),
					borderColor: exprVal(0x000000),
					borderWidth: exprVal(0),
					borderPosition: exprVal('inside'),
					borderOnlyArc: exprVal(false),
				},
			])
		})

		it('converts a circle with every property given', () => {
			const elements = convertWithoutCanvas([
				{
					type: 'circle',
					color: 0x111111,
					startAngle: 90,
					endAngle: 270,
					drawSlice: true,
					borderColor: 0x222222,
					borderWidth: 3,
					borderPosition: 'outside',
					borderOnlyArc: true,
				},
			])

			expect(elements[0]).toMatchObject({
				color: exprVal(0x111111),
				startAngle: exprVal(90),
				endAngle: exprVal(270),
				drawSlice: exprVal(true),
				borderColor: exprVal(0x222222),
				borderWidth: exprVal(3),
				borderPosition: exprVal('outside'),
				borderOnlyArc: exprVal(true),
			})
		})

		it('converts a gauge with defaults', () => {
			expect(convertWithoutCanvas([{ type: 'gauge', id: 'g1' }])).toEqual([
				{
					type: 'gauge',
					id: 'g1',
					name: 'Gauge',
					usage: ButtonGraphicsElementUsage.Automatic,
					pinnedProperties: ['value'],
					enabled: exprVal(true),
					opacity: exprVal(100),
					x: exprVal(0),
					y: exprVal(0),
					width: exprVal(100),
					height: exprVal(100),
					rotation: exprVal(0),
					value: exprVal(0),
					min: exprVal(0),
					max: exprVal(100),
					origin: exprVal(null),
					symmetric: exprVal(false),
					orientation: exprVal('horizontal'),
					reverse: exprVal(false),
					startAngle: exprVal(0),
					endAngle: exprVal(360),
					ringWidth: exprVal(20),
					roundedEnds: exprVal(true),
					fillEnabled: exprVal(true),
					multiColour: exprVal(true),
					fillWidth: exprVal(100),
					stops: exprVal([
						{ _id: exprVal('el_1'), value: exprVal(0), color: exprVal(0x00ff00), gradient: exprVal(false) },
					]),
					markerEnabled: exprVal(false),
					markerColor: exprVal(0xffffff),
					markerWidth: exprVal(15),
					trackStyle: exprVal('transparent'),
					trackAmount: exprVal(70),
					trackWidth: exprVal(100),
				},
			])
		})

		it('converts a gauge with every property given', () => {
			const elements = convertWithoutCanvas([
				{
					type: 'gauge',
					value: exprExpr('$(foo)'),
					min: -10,
					max: 10,
					origin: 0,
					symmetric: true,
					orientation: 'ring',
					reverse: true,
					startAngle: 30,
					endAngle: 330,
					ringWidth: 10,
					roundedEnds: false,
					fillEnabled: false,
					multiColour: false,
					fillWidth: 50,
					markerEnabled: true,
					markerColor: 0x123456,
					markerWidth: 4,
					trackStyle: 'dimmed',
					trackAmount: 20,
					trackWidth: 30,
				},
			])

			expect(elements[0]).toMatchObject({
				value: exprExpr('$(foo)'),
				min: exprVal(-10),
				max: exprVal(10),
				origin: exprVal(0),
				symmetric: exprVal(true),
				orientation: exprVal('ring'),
				reverse: exprVal(true),
				startAngle: exprVal(30),
				endAngle: exprVal(330),
				ringWidth: exprVal(10),
				roundedEnds: exprVal(false),
				fillEnabled: exprVal(false),
				multiColour: exprVal(false),
				fillWidth: exprVal(50),
				markerEnabled: exprVal(true),
				markerColor: exprVal(0x123456),
				markerWidth: exprVal(4),
				trackStyle: exprVal('dimmed'),
				trackAmount: exprVal(20),
				trackWidth: exprVal(30),
			})
		})

		it('converts the gauge stops the module gave, giving each an id', () => {
			const elements = convertWithoutCanvas([
				{
					type: 'gauge',
					stops: [
						{ value: 0, color: 0x00ff00, gradient: false },
						{ value: exprExpr('$(foo)'), color: '#ff0000', gradient: true },
					],
				},
			])

			const stops = (elements[0] as any).stops.value
			expect(stops).toHaveLength(2)
			expect(stops[0]).toMatchObject({ value: exprVal(0), color: exprVal(0x00ff00), gradient: exprVal(false) })
			expect(stops[1]).toMatchObject({
				value: exprExpr('$(foo)'),
				color: exprVal('#ff0000'),
				gradient: exprVal(true),
			})
			expect(stops[0]._id.value).not.toBe(stops[1]._id.value)
		})

		it.each([
			['an empty list', []],
			['no list at all', undefined],
		])('gives a gauge with %s of stops one default stop', (_name, stops) => {
			const elements = convertWithoutCanvas([{ type: 'gauge', stops } as any])

			expect((elements[0] as any).stops.value).toEqual([
				{ _id: exprVal('el_1'), value: exprVal(0), color: exprVal(0x00ff00), gradient: exprVal(false) },
			])
		})

		it('converts a group with defaults', () => {
			expect(convertWithoutCanvas([{ type: 'group', id: 'g1', children: [] }])).toEqual([
				{
					type: 'group',
					id: 'g1',
					name: 'Group',
					usage: ButtonGraphicsElementUsage.Automatic,
					pinnedProperties: [],
					enabled: exprVal(true),
					opacity: exprVal(100),
					x: exprVal(0),
					y: exprVal(0),
					width: exprVal(100),
					height: exprVal(100),
					rotation: exprVal(0),
					squareCoords: exprVal(false),
					children: [],
				},
			])
		})

		it('converts the children of a group', () => {
			const elements = convertWithoutCanvas([
				{
					type: 'group',
					id: 'g1',
					squareCoords: true,
					children: [
						{ type: 'box', id: 'b1' },
						{ type: 'text', id: 't1', text: 'hi' },
					],
				},
			])

			const group = elements[0] as any
			expect(group.squareCoords).toEqual(exprVal(true))
			expect(group.children.map((child: any) => [child.type, child.id])).toEqual([
				['box', 'b1'],
				['text', 't1'],
			])
		})

		it('converts nested groups recursively', () => {
			const elements = convertWithoutCanvas([
				{
					type: 'group',
					id: 'outer',
					children: [{ type: 'group', id: 'inner', children: [{ type: 'circle', id: 'c1' }] }],
				},
			])

			const inner = (elements[0] as any).children[0]
			expect(inner.id).toBe('inner')
			expect(inner.children[0]).toMatchObject({ type: 'circle', id: 'c1' })
		})

		it('converts a composite element, tagging it with the connection', () => {
			const elements = convertWithoutCanvas([
				{ type: 'composite', id: 'comp1', elementId: 'my-element', options: {} } as any,
			])

			expect(elements[0]).toEqual({
				type: 'composite',
				id: 'comp1',
				name: 'Composite',
				usage: ButtonGraphicsElementUsage.Automatic,
				pinnedProperties: [],
				enabled: exprVal(true),
				opacity: exprVal(100),
				x: exprVal(0),
				y: exprVal(0),
				width: exprVal(100),
				height: exprVal(100),
				rotation: exprVal(0),
				connectionId: 'conn01',
				elementId: 'my-element',
			})
		})

		it('converts composite rotation', () => {
			const elements = convertWithoutCanvas([
				{ type: 'composite', elementId: 'my-element', rotation: exprExpr('$(foo)') } as any,
			])

			expect(elements[0]).toMatchObject({ rotation: exprExpr('$(foo)') })
		})

		it('prefixes composite options and converts their values', () => {
			const elements = convertWithoutCanvas([
				{
					type: 'composite',
					elementId: 'my-element',
					options: { size: 5, label: exprExpr('$(foo)'), enabled: exprVal(false) },
				} as any,
			])

			expect(elements[0]).toMatchObject({
				'opt:size': exprVal(5),
				'opt:label': exprExpr('$(foo)'),
				'opt:enabled': exprVal(false),
			})
		})

		it('drops composite options with no value', () => {
			const elements = convertWithoutCanvas([
				{ type: 'composite', elementId: 'my-element', options: { size: undefined, label: 'a' } } as any,
			])

			expect((elements[0] as any)['opt:size']).toBeUndefined()
			expect((elements[0] as any)['opt:label']).toEqual(exprVal('a'))
		})

		it('tolerates a composite element with no options', () => {
			const elements = convertWithoutCanvas([{ type: 'composite', elementId: 'my-element' } as any])

			expect(elements[0]).toMatchObject({ type: 'composite', elementId: 'my-element' })
		})
	})

	describe('unsupported elements', () => {
		it('drops an element of an unknown type, logging it', () => {
			const elements = convert([{ type: 'box' }, { type: 'hologram' } as any, { type: 'circle' }])

			expect(elements.map((el) => el.type)).toEqual(['canvas', 'box', 'circle'])
			expect(logger.info).toHaveBeenCalledWith('Unsupported element type in layered preset: hologram')
		})

		it('drops an unknown child of a group', () => {
			const elements = convertWithoutCanvas([
				{ type: 'group', children: [{ type: 'hologram' } as any, { type: 'box', id: 'b1' }] },
			])

			expect((elements[0] as any).children.map((child: any) => child.id)).toEqual(['b1'])
		})
	})
})
