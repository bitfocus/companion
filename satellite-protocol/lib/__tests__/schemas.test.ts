import { describe, expect, test } from 'vitest'
import { SatelliteConfigFieldsSchema } from '../SatelliteConfigFieldsSchema.js'
import { SatelliteSurfaceLayoutSchema } from '../SatelliteSurfaceManifestSchema.js'

function layout(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		stylePresets: { default: { bitmap: { w: 72, h: 72 } } },
		controls: { '0/0': { row: 0, column: 0 } },
		...overrides,
	}
}

describe('SatelliteSurfaceLayoutSchema', () => {
	test('accepts a minimal layout', () => {
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout()).success).toBe(true)
	})

	test('requires the default style preset', () => {
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout({ stylePresets: {} })).success).toBe(false)
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout({ stylePresets: undefined })).success).toBe(false)
	})

	test('accepts named style presets alongside the default, and controls referencing them', () => {
		const result = SatelliteSurfaceLayoutSchema.safeParse(
			layout({
				stylePresets: { default: {}, knob: { leds: { segments: 24, mode: 'full-ring' } } },
				controls: { knob1: { row: 0, column: 1, stylePreset: 'knob' } },
			})
		)
		expect(result.success).toBe(true)
	})

	test('validates named style presets like the default', () => {
		const result = SatelliteSurfaceLayoutSchema.safeParse(
			layout({ stylePresets: { default: {}, other: { colors: 'cmyk' } } })
		)
		expect(result.success).toBe(false)
	})

	test.each(['1/0', 'knob-1', 'ABC', '12/3/4'])('accepts the control id %j', (id) => {
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout({ controls: { [id]: { row: 0, column: 0 } } })).success).toBe(
			true
		)
	})

	test.each(['', 'a b', 'a_b', 'a.b', 'a"b'])('rejects the control id %j', (id) => {
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout({ controls: { [id]: { row: 0, column: 0 } } })).success).toBe(
			false
		)
	})

	test('rejects a negative row or column, and a missing one', () => {
		for (const control of [{ row: -1, column: 0 }, { row: 0, column: -1 }, { row: 0 }]) {
			expect(SatelliteSurfaceLayoutSchema.safeParse(layout({ controls: { a: control } })).success).toBe(false)
		}
	})

	test('rejects an empty stylePreset name', () => {
		const result = SatelliteSurfaceLayoutSchema.safeParse(
			layout({ controls: { a: { row: 0, column: 0, stylePreset: '' } } })
		)
		expect(result.success).toBe(false)
	})

	test.each([
		[{ segments: 1, mode: 'simple' }, true],
		[{ segments: 200, mode: 'full-ring' }, true],
		[{ segments: 0, mode: 'simple' }, false],
		[{ segments: 201, mode: 'simple' }, false],
		[{ segments: 2.5, mode: 'simple' }, false],
		[{ segments: 12, mode: 'circle' }, false],
		[{ segments: 12 }, false],
	])('leds %j valid=%s', (leds, valid) => {
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout({ stylePresets: { default: { leds } } })).success).toBe(valid)
	})

	test.each([
		['hex', true],
		['rgb', true],
		['HEX', false],
	])('colors %j valid=%s', (colors, valid) => {
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout({ stylePresets: { default: { colors } } })).success).toBe(
			valid
		)
	})

	test('rejects a negative bitmap size', () => {
		const result = SatelliteSurfaceLayoutSchema.safeParse(
			layout({ stylePresets: { default: { bitmap: { w: -1, h: 1 } } } })
		)
		expect(result.success).toBe(false)
	})

	test('accepts unknown properties, so newer clients can talk to older Companion', () => {
		const result = SatelliteSurfaceLayoutSchema.safeParse(
			layout({
				futureTopLevel: 1,
				stylePresets: { default: { futureStyle: true } },
				controls: { a: { row: 0, column: 0, futureControl: 'x' } },
			})
		)
		expect(result.success).toBe(true)
	})
})

describe('SatelliteConfigFieldsSchema', () => {
	const common = { id: 'f', label: 'Field' }

	test('accepts an empty list', () => {
		expect(SatelliteConfigFieldsSchema.safeParse([]).success).toBe(true)
	})

	test('accepts each field type', () => {
		const result = SatelliteConfigFieldsSchema.safeParse([
			{ ...common, type: 'static-text', value: 'Hello' },
			{ ...common, type: 'textinput', default: 'x', regex: '^x$', multiline: true },
			{
				...common,
				type: 'dropdown',
				choices: [
					{ id: 'a', label: 'A' },
					{ id: 2, label: 'Two' },
				],
				default: 2,
			},
			{ ...common, type: 'number', min: 0, max: 10, step: 1, default: 5 },
			{ ...common, type: 'checkbox', default: true },
			{
				...common,
				type: 'checkbox',
				description: 'desc',
				tooltip: 'tip',
				isVisibleExpression: '$(this:x) == 1',
			},
		])
		expect(result.success).toBe(true)
	})

	test('rejects an unknown field type', () => {
		expect(SatelliteConfigFieldsSchema.safeParse([{ ...common, type: 'colour' }]).success).toBe(false)
	})

	test('requires id and label', () => {
		expect(SatelliteConfigFieldsSchema.safeParse([{ label: 'x', type: 'checkbox' }]).success).toBe(false)
		expect(SatelliteConfigFieldsSchema.safeParse([{ id: 'x', type: 'checkbox' }]).success).toBe(false)
	})

	test('requires the type specific properties', () => {
		expect(SatelliteConfigFieldsSchema.safeParse([{ ...common, type: 'static-text' }]).success).toBe(false)
		expect(SatelliteConfigFieldsSchema.safeParse([{ ...common, type: 'number', min: 0 }]).success).toBe(false)
		expect(SatelliteConfigFieldsSchema.safeParse([{ ...common, type: 'dropdown' }]).success).toBe(false)
	})

	test('a dropdown needs at least one choice', () => {
		expect(SatelliteConfigFieldsSchema.safeParse([{ ...common, type: 'dropdown', choices: [] }]).success).toBe(false)
	})

	test('rejects a default of the wrong type', () => {
		expect(SatelliteConfigFieldsSchema.safeParse([{ ...common, type: 'checkbox', default: 'yes' }]).success).toBe(false)
		expect(
			SatelliteConfigFieldsSchema.safeParse([{ ...common, type: 'number', min: 0, max: 1, default: '1' }]).success
		).toBe(false)
	})
})
