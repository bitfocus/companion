import { beforeEach, describe, expect, test, vi } from 'vitest'
import { FONTSIZE_SHRINK_DEFAULT } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import {
	EntityModelType,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { ButtonGraphicsDecorationType, ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import {
	ConvertBooleanFeedbackStyleToOverrides,
	ConvertLegacyStyleToElements,
	CreateAdvancedFeedbackStyleOverrides,
	GetLegacyStyleProperty,
	ParseLegacyStyle,
} from '../../lib/Resources/ConvertLegacyStyleToElements.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

let nanoidCounter = 0
vi.mock('nanoid', () => ({
	nanoid: vi.fn(() => `mock-id-${++nanoidCounter}`),
}))

beforeEach(() => {
	nanoidCounter = 0
})

// ── Helpers ───────────────────────────────────────────────────────────────────

// selectedElementIds matching what ConvertLegacyStyleToElements creates
const defaultSelectedIds: { [usage in ButtonGraphicsElementUsage]: string | undefined } = {
	[ButtonGraphicsElementUsage.Automatic]: undefined,
	[ButtonGraphicsElementUsage.Text]: 'text0',
	[ButtonGraphicsElementUsage.Image]: 'image0',
	[ButtonGraphicsElementUsage.Color]: 'box0',
	[ButtonGraphicsElementUsage.Leds]: undefined,
}

const minimalStyle = {
	text: '',
	textExpression: undefined as boolean | undefined,
	size: 'auto' as const,
	alignment: 'center:center' as const,
	pngalignment: 'center:center' as const,
	color: 0xffffff,
	bgcolor: 0x000000,
	show_topbar: 'default' as const,
	png64: null as string | null,
}

function makeBooleanFeedback(style: Record<string, unknown> = { bgcolor: 0xff0000 }): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: 'fb1',
		connectionId: 'some-connection',
		definitionId: 'some-feedback',
		options: {},
		upgradeIndex: undefined,
		style,
	} as unknown as FeedbackEntityModel
}

function makeAdvancedFeedback(): FeedbackEntityModel {
	// internal + empty style → advanced path
	return {
		type: EntityModelType.Feedback,
		id: 'fb2',
		connectionId: 'internal',
		definitionId: 'advanced-feedback',
		options: {},
		upgradeIndex: undefined,
		style: {},
	} as unknown as FeedbackEntityModel
}

function makeAction(): SomeEntityModel {
	return {
		type: EntityModelType.Action,
		id: 'act1',
		connectionId: 'some-connection',
		definitionId: 'some-action',
		options: {},
		upgradeIndex: undefined,
	}
}

// ── ParseLegacyStyle ──────────────────────────────────────────────────────────

describe('ParseLegacyStyle', () => {
	test('empty style returns all undefined fields', () => {
		const result = ParseLegacyStyle({})
		expect(result.text.text).toBeUndefined()
		expect(result.text.size).toBeUndefined()
		expect(result.text.sizeAllowShrink).toBeUndefined()
		expect(result.text.color).toBeUndefined()
		expect(result.text.halign).toBeUndefined()
		expect(result.text.valign).toBeUndefined()
		expect(result.image.image).toBeUndefined()
		expect(result.image.halign).toBeUndefined()
		expect(result.image.valign).toBeUndefined()
		expect(result.background.color).toBeUndefined()
		expect(result.canvas.decoration).toBeUndefined()
		expect(result.imageBuffers).toBeUndefined()
	})

	test('size: "auto" sets size to FONTSIZE_SHRINK_DEFAULT and sizeAllowShrink to true', () => {
		const result = ParseLegacyStyle({ size: 'auto' })
		expect(result.text.size).toBe(FONTSIZE_SHRINK_DEFAULT)
		expect(result.text.sizeAllowShrink).toBe(true)
	})

	test('numeric size with show_topbar:true scales by TEXT_SIZE_SCALE (2.1)', () => {
		const result = ParseLegacyStyle({ size: 10, show_topbar: true }, false)
		expect(result.text.size).toBe(21) // 10 * 2.1 = 21.0
		expect(result.text.sizeAllowShrink).toBe(false)
	})

	test('numeric size with show_topbar:false scales by TEXT_SIZE_SCALE_NO_TOPBAR (1/0.6)', () => {
		const result = ParseLegacyStyle({ size: 10, show_topbar: false }, false)
		expect(result.text.size).toBe(16.7) // 10 * (1/0.6) ≈ 16.7
		expect(result.text.sizeAllowShrink).toBe(false)
	})

	test('numeric size without show_topbar uses !defaultNoTopBar', () => {
		// defaultNoTopBar=false → !false=true → topbar → TEXT_SIZE_SCALE
		const r1 = ParseLegacyStyle({ size: 10 }, false)
		expect(r1.text.size).toBe(21)
		expect(r1.text.sizeAllowShrink).toBe(false)
		// defaultNoTopBar=true → !true=false → no topbar → TEXT_SIZE_SCALE_NO_TOPBAR
		const r2 = ParseLegacyStyle({ size: 10 }, true)
		expect(r2.text.size).toBe(16.7)
		expect(r2.text.sizeAllowShrink).toBe(false)
	})

	test('alignment string is parsed into halign and valign', () => {
		const result = ParseLegacyStyle({ alignment: 'left:top' })
		expect(result.text.halign).toBe('left')
		expect(result.text.valign).toBe('top')
	})

	test('pngalignment string is parsed into image halign and valign', () => {
		const result = ParseLegacyStyle({ pngalignment: 'right:bottom' })
		expect(result.image.halign).toBe('right')
		expect(result.image.valign).toBe('bottom')
	})

	test('show_topbar:true → decoration TopBar', () => {
		expect(ParseLegacyStyle({ show_topbar: true }).canvas.decoration).toBe(ButtonGraphicsDecorationType.TopBar)
	})

	test('show_topbar:false → decoration Border', () => {
		expect(ParseLegacyStyle({ show_topbar: false }).canvas.decoration).toBe(ButtonGraphicsDecorationType.Border)
	})

	test('show_topbar:"default" → decoration FollowDefault', () => {
		expect(ParseLegacyStyle({ show_topbar: 'default' }).canvas.decoration).toBe(
			ButtonGraphicsDecorationType.FollowDefault
		)
	})

	test('png64 without data: prefix gets the prefix added', () => {
		expect(ParseLegacyStyle({ png64: 'abc123' }).image.image).toBe('data:image/png;base64,abc123')
	})

	test('png64 with data: prefix is left unchanged', () => {
		const url = 'data:image/png;base64,xyz'
		expect(ParseLegacyStyle({ png64: url }).image.image).toBe(url)
	})

	test('png64: null returns image.image = null', () => {
		expect(ParseLegacyStyle({ png64: null }).image.image).toBeNull()
	})

	test('text with textExpression:false', () => {
		const result = ParseLegacyStyle({ text: 'hello', textExpression: false })
		expect(result.text.text).toEqual({ isExpression: false, value: 'hello' })
	})

	test('text with textExpression:true', () => {
		const result = ParseLegacyStyle({ text: '$(var:x)', textExpression: true })
		expect(result.text.text).toEqual({ isExpression: true, value: '$(var:x)' })
	})

	test('color and bgcolor are passed through directly', () => {
		const result = ParseLegacyStyle({ color: 0xffffff, bgcolor: 0x112233 })
		expect(result.text.color).toBe(0xffffff)
		expect(result.background.color).toBe(0x112233)
	})
})

// ── GetLegacyStyleProperty ────────────────────────────────────────────────────

describe('GetLegacyStyleProperty', () => {
	test('text property returns the text value', () => {
		const parsed = ParseLegacyStyle({ text: 'hello' })
		expect(GetLegacyStyleProperty(parsed, {}, 'text', '')).toEqual({ isExpression: false, value: 'hello' })
	})

	test('size property (elementProperty=fontsize) returns numeric value', () => {
		const parsed = ParseLegacyStyle({ size: 10, show_topbar: true }, false)
		const result = GetLegacyStyleProperty(parsed, {}, 'size', 'fontsize')
		expect(result).toEqual({ isExpression: false, value: 21 })
	})

	test('size property (elementProperty=fontsizeAllowShrink) returns false for numeric size', () => {
		const parsed = ParseLegacyStyle({ size: 10, show_topbar: true }, false)
		const result = GetLegacyStyleProperty(parsed, {}, 'size', 'fontsizeAllowShrink')
		expect(result).toEqual({ isExpression: false, value: false })
	})

	test('size="auto" (elementProperty=fontsize) returns FONTSIZE_SHRINK_DEFAULT', () => {
		const parsed = ParseLegacyStyle({ size: 'auto' })
		const result = GetLegacyStyleProperty(parsed, {}, 'size', 'fontsize')
		expect(result).toEqual({ isExpression: false, value: 100 })
	})

	test('size="auto" (elementProperty=fontsizeAllowShrink) returns true', () => {
		const parsed = ParseLegacyStyle({ size: 'auto' })
		const result = GetLegacyStyleProperty(parsed, {}, 'size', 'fontsizeAllowShrink')
		expect(result).toEqual({ isExpression: false, value: true })
	})

	test('color property', () => {
		const parsed = ParseLegacyStyle({ color: 0x123456 })
		expect(GetLegacyStyleProperty(parsed, {}, 'color', '')).toEqual({ isExpression: false, value: 0x123456 })
	})

	test('bgcolor property', () => {
		const parsed = ParseLegacyStyle({ bgcolor: 0xabcdef })
		expect(GetLegacyStyleProperty(parsed, {}, 'bgcolor', '')).toEqual({ isExpression: false, value: 0xabcdef })
	})

	test('alignment → halign with elementProperty=halign', () => {
		const parsed = ParseLegacyStyle({ alignment: 'left:top' })
		expect(GetLegacyStyleProperty(parsed, {}, 'alignment', 'halign')).toEqual({ isExpression: false, value: 'left' })
	})

	test('alignment → valign with elementProperty=valign', () => {
		const parsed = ParseLegacyStyle({ alignment: 'left:top' })
		expect(GetLegacyStyleProperty(parsed, {}, 'alignment', 'valign')).toEqual({ isExpression: false, value: 'top' })
	})

	test('png64 property returns image.image value', () => {
		const parsed = ParseLegacyStyle({ png64: 'data:image/png;base64,abc' })
		expect(GetLegacyStyleProperty(parsed, {}, 'png64', '')).toEqual({
			isExpression: false,
			value: 'data:image/png;base64,abc',
		})
	})

	test('returns undefined when property value is absent', () => {
		const parsed = ParseLegacyStyle({})
		expect(GetLegacyStyleProperty(parsed, {}, 'text', '')).toBeUndefined()
		expect(GetLegacyStyleProperty(parsed, {}, 'size', '')).toBeUndefined()
	})

	test('returns undefined for an unknown property', () => {
		const parsed = ParseLegacyStyle({ text: 'x' })
		expect(GetLegacyStyleProperty(parsed, {}, 'unknown_prop', '')).toBeUndefined()
	})
})

// ── ConvertLegacyStyleToElements ──────────────────────────────────────────────

describe('ConvertLegacyStyleToElements', () => {
	test('always produces 4 base layers', () => {
		const { layers } = ConvertLegacyStyleToElements(minimalStyle, [], null)
		expect(layers).toHaveLength(4)
		expect(layers.map((l) => l.id)).toEqual(['canvas', 'box0', 'image0', 'text0'])
	})

	test('image element defaults to fit_or_shrink so small icons are not enlarged', () => {
		const { layers } = ConvertLegacyStyleToElements(minimalStyle, [], null)
		const imageLayer = layers.find((l) => l.id === 'image0') as any
		expect(imageLayer.fillMode).toEqual({ value: 'fit_or_shrink', isExpression: false })
	})

	test('advanced feedback adds a 5th bufferElement layer', () => {
		const { layers } = ConvertLegacyStyleToElements(minimalStyle, [makeAdvancedFeedback()], null)
		expect(layers).toHaveLength(5)
		expect(layers[4].id).toBe('imageBuffers')
	})

	test('boolean feedback with style sets styleOverrides and removes style', () => {
		const { feedbacks } = ConvertLegacyStyleToElements(minimalStyle, [makeBooleanFeedback()], null)
		expect(feedbacks[0]).toHaveProperty('styleOverrides')
		expect((feedbacks[0] as any).style).toBeUndefined()
	})

	test('boolean feedback styleOverrides include a color override', () => {
		const { feedbacks } = ConvertLegacyStyleToElements(minimalStyle, [makeBooleanFeedback({ bgcolor: 0xff0000 })], null)
		const overrides = (feedbacks[0] as FeedbackEntityModel).styleOverrides!
		const colorOverride = overrides.find((o) => o.elementProperty === 'color' && o.elementId === 'box0')
		expect(colorOverride?.override).toEqual({ isExpression: false, value: 0xff0000 })
	})

	test('feedback that already has styleOverrides is passed through unchanged', () => {
		const feedback: FeedbackEntityModel = {
			type: EntityModelType.Feedback,
			id: 'fb-existing',
			connectionId: 'test',
			definitionId: 'test',
			options: {},
			upgradeIndex: undefined,
			styleOverrides: [
				{ overrideId: 'existing', elementId: 'x', elementProperty: 'y', override: { isExpression: false, value: 'z' } },
			],
		}
		const { feedbacks } = ConvertLegacyStyleToElements(minimalStyle, [feedback], null)
		expect((feedbacks[0] as FeedbackEntityModel).styleOverrides).toHaveLength(1)
		expect((feedbacks[0] as FeedbackEntityModel).styleOverrides![0].overrideId).toBe('existing')
	})

	test('non-feedback entity is passed through unchanged', () => {
		const action = makeAction()
		const { feedbacks } = ConvertLegacyStyleToElements(minimalStyle, [action], null)
		expect(feedbacks[0]).toEqual(action)
	})

	test('previewStyle null results in empty previewStyleFeedbacks', () => {
		const { previewStyleFeedbacks } = ConvertLegacyStyleToElements(minimalStyle, [], null)
		expect(previewStyleFeedbacks).toEqual([])
	})

	test('previewStyle with a property creates a previewStyleFeedback entry', () => {
		const { previewStyleFeedbacks } = ConvertLegacyStyleToElements(minimalStyle, [], { bgcolor: 0x0000ff })
		expect(previewStyleFeedbacks).toHaveLength(1)
		expect(previewStyleFeedbacks[0].type).toBe(EntityModelType.Feedback)
		expect((previewStyleFeedbacks[0] as FeedbackEntityModel).styleOverrides).toBeDefined()
	})

	test('previewStyle with no overridable properties gives empty previewStyleFeedbacks', () => {
		// Empty partial style → parsedStyle has nothing set → overrides.length === 0
		const { previewStyleFeedbacks } = ConvertLegacyStyleToElements(minimalStyle, [], {})
		expect(previewStyleFeedbacks).toHaveLength(0)
	})

	test('style properties are applied to the canvas decoration layer', () => {
		const { layers } = ConvertLegacyStyleToElements({ ...minimalStyle, show_topbar: true }, [], null)
		const canvas = layers[0] as any
		expect(canvas.decoration.value).toBe(ButtonGraphicsDecorationType.TopBar)
	})

	test('style text is applied to the text element', () => {
		const { layers } = ConvertLegacyStyleToElements({ ...minimalStyle, text: 'hi', textExpression: false }, [], null)
		const textEl = layers.find((l) => l.id === 'text0') as any
		expect(textEl.text).toEqual({ isExpression: false, value: 'hi' })
	})

	test('style bgcolor is applied to the background element', () => {
		const { layers } = ConvertLegacyStyleToElements({ ...minimalStyle, bgcolor: 0xaabbcc }, [], null)
		const boxEl = layers.find((l) => l.id === 'box0') as any
		expect(boxEl.color.value).toBe(0xaabbcc)
	})

	test('logic_conditionalise_advanced feedback recursively processes children', () => {
		const childFeedback = makeBooleanFeedback({ bgcolor: 0x00ff00 })
		const conditionalFeedback: SomeEntityModel = {
			type: EntityModelType.Feedback,
			id: 'cond-fb',
			connectionId: 'internal',
			definitionId: 'logic_conditionalise_advanced',
			options: {},
			upgradeIndex: undefined,
			children: { feedbacks: [childFeedback] },
		}

		const { feedbacks } = ConvertLegacyStyleToElements(minimalStyle, [conditionalFeedback], null)
		const updatedCond = feedbacks[0] as FeedbackEntityModel
		const children = updatedCond.children!['feedbacks']!
		expect((children[0] as FeedbackEntityModel).styleOverrides).toBeDefined()
	})
})

// ── ConvertBooleanFeedbackStyleToOverrides ────────────────────────────────────

describe('ConvertBooleanFeedbackStyleToOverrides', () => {
	test('returns empty array when no properties are set', () => {
		const parsed = ParseLegacyStyle({})
		expect(ConvertBooleanFeedbackStyleToOverrides(parsed, defaultSelectedIds)).toHaveLength(0)
	})

	test('text property creates a text override on the text element', () => {
		const parsed = ParseLegacyStyle({ text: 'hello', textExpression: false })
		const overrides = ConvertBooleanFeedbackStyleToOverrides(parsed, defaultSelectedIds)
		const textOverride = overrides.find((o) => o.elementProperty === 'text')
		expect(textOverride?.elementId).toBe('text0')
		expect(textOverride?.override).toEqual({ isExpression: false, value: 'hello' })
	})

	test('text color creates a color override', () => {
		const parsed = ParseLegacyStyle({ color: 0xaabbcc })
		const overrides = ConvertBooleanFeedbackStyleToOverrides(parsed, defaultSelectedIds)
		const colorOverride = overrides.find((o) => o.elementProperty === 'color')
		expect(colorOverride?.elementId).toBe('text0')
		expect(colorOverride?.override.value).toBe(0xaabbcc)
	})

	test('text alignment creates halign and valign overrides', () => {
		const parsed = ParseLegacyStyle({ alignment: 'left:top' })
		const overrides = ConvertBooleanFeedbackStyleToOverrides(parsed, defaultSelectedIds)
		const halign = overrides.find((o) => o.elementProperty === 'halign' && o.elementId === 'text0')
		const valign = overrides.find((o) => o.elementProperty === 'valign' && o.elementId === 'text0')
		expect(halign?.override.value).toBe('left')
		expect(valign?.override.value).toBe('top')
	})

	test('bgcolor creates a background color override', () => {
		const parsed = ParseLegacyStyle({ bgcolor: 0x112233 })
		const overrides = ConvertBooleanFeedbackStyleToOverrides(parsed, defaultSelectedIds)
		const colorOverride = overrides.find((o) => o.elementId === 'box0')
		expect(colorOverride?.override.value).toBe(0x112233)
	})

	test('png64 creates a base64Image override on the image element', () => {
		const parsed = ParseLegacyStyle({ png64: 'data:image/png;base64,abc' })
		const overrides = ConvertBooleanFeedbackStyleToOverrides(parsed, defaultSelectedIds)
		const imgOverride = overrides.find((o) => o.elementProperty === 'base64Image')
		expect(imgOverride?.elementId).toBe('image0')
	})

	test('each override has a unique overrideId', () => {
		const parsed = ParseLegacyStyle({ text: 'x', color: 0xffffff, bgcolor: 0, alignment: 'left:top' })
		const overrides = ConvertBooleanFeedbackStyleToOverrides(parsed, defaultSelectedIds)
		const ids = overrides.map((o) => o.overrideId)
		expect(new Set(ids).size).toBe(ids.length)
	})

	test('numeric size creates fontsize and fontsizeAllowShrink overrides', () => {
		const parsed = ParseLegacyStyle({ size: 10, show_topbar: true }, false)
		const overrides = ConvertBooleanFeedbackStyleToOverrides(parsed, defaultSelectedIds)
		const fontsizeOverride = overrides.find((o) => o.elementProperty === 'fontsize')
		const allowShrinkOverride = overrides.find((o) => o.elementProperty === 'fontsizeAllowShrink')
		expect(fontsizeOverride?.override).toEqual({ isExpression: false, value: 21 })
		expect(allowShrinkOverride?.override).toEqual({ isExpression: false, value: false })
	})

	test('auto size creates fontsize=FONTSIZE_SHRINK_DEFAULT and fontsizeAllowShrink=true overrides', () => {
		const parsed = ParseLegacyStyle({ size: 'auto' })
		const overrides = ConvertBooleanFeedbackStyleToOverrides(parsed, defaultSelectedIds)
		const fontsizeOverride = overrides.find((o) => o.elementProperty === 'fontsize')
		const allowShrinkOverride = overrides.find((o) => o.elementProperty === 'fontsizeAllowShrink')
		expect(fontsizeOverride?.override).toEqual({ isExpression: false, value: 100 })
		expect(allowShrinkOverride?.override).toEqual({ isExpression: false, value: true })
	})

	test('when textElementId is undefined its text overrides are skipped', () => {
		const ids: { [usage in ButtonGraphicsElementUsage]: string | undefined } = {
			...defaultSelectedIds,
			[ButtonGraphicsElementUsage.Text]: undefined,
		}
		const parsed = ParseLegacyStyle({ text: 'hi', color: 0xffffff })
		const overrides = ConvertBooleanFeedbackStyleToOverrides(parsed, ids)
		expect(overrides.find((o) => o.elementProperty === 'text')).toBeUndefined()
	})
})

// ── CreateAdvancedFeedbackStyleOverrides ──────────────────────────────────────

describe('CreateAdvancedFeedbackStyleOverrides', () => {
	test('with no affectedProperties filter produces overrides for all properties', () => {
		const overrides = CreateAdvancedFeedbackStyleOverrides(defaultSelectedIds, 'imageBuffers', undefined)
		const props = overrides.map((o) => o.elementProperty)
		expect(props).toContain('text')
		expect(props).toContain('fontsize')
		expect(props).toContain('fontsizeAllowShrink')
		expect(props).toContain('halign')
		expect(props).toContain('valign')
		expect(props).toContain('color')
		expect(props).toContain('base64Image')
	})

	test('filtering to ["text"] produces only the text override', () => {
		const overrides = CreateAdvancedFeedbackStyleOverrides(defaultSelectedIds, undefined, ['text'])
		expect(overrides).toHaveLength(1)
		expect(overrides[0].elementProperty).toBe('text')
		expect(overrides[0].elementId).toBe('text0')
	})

	test('filtering to ["alignment"] produces halign and valign overrides', () => {
		const overrides = CreateAdvancedFeedbackStyleOverrides(defaultSelectedIds, undefined, ['alignment'])
		expect(overrides).toHaveLength(2)
		expect(overrides.every((o) => o.elementId === 'text0')).toBe(true)
		const props = overrides.map((o) => o.elementProperty)
		expect(props).toContain('halign')
		expect(props).toContain('valign')
	})

	test('bufferElementId present and not filtered → buffer override included', () => {
		const overrides = CreateAdvancedFeedbackStyleOverrides(defaultSelectedIds, 'bufId', undefined)
		const buf = overrides.find((o) => o.elementId === 'bufId')
		expect(buf).toBeDefined()
		expect(buf?.override.value).toBe('imageBuffers')
	})

	test('bufferElementId undefined → no buffer override', () => {
		const overrides = CreateAdvancedFeedbackStyleOverrides(defaultSelectedIds, undefined, undefined)
		expect(overrides.find((o) => o.elementProperty === 'base64Image' && o.elementId === undefined)).toBeUndefined()
		// More precisely: no override for a buffer element that doesn't exist
		expect(overrides.filter((o) => o.override.value === 'imageBuffers')).toHaveLength(0)
	})

	test('bgcolor filter produces only the background color override', () => {
		const overrides = CreateAdvancedFeedbackStyleOverrides(defaultSelectedIds, undefined, ['bgcolor'])
		expect(overrides).toHaveLength(1)
		expect(overrides[0].elementId).toBe('box0')
		expect(overrides[0].override.value).toBe('bgcolor')
	})
})
