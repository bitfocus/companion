import { describe, expect, test } from 'vitest'
import { elementDefaultPinnedProperties, getDefaultPinnedProperties } from '../ElementPropertiesSchemas.js'

describe('getDefaultPinnedProperties', () => {
	test('returns the documented defaults for each element type', () => {
		expect(getDefaultPinnedProperties('text')).toEqual([
			'text',
			'fontsize',
			'fontsizeAllowShrink',
			'color',
			'halign',
			'valign',
		])
		expect(getDefaultPinnedProperties('image')).toEqual(['base64Image', 'halign', 'valign'])
		expect(getDefaultPinnedProperties('box')).toEqual(['color'])
		expect(getDefaultPinnedProperties('circle')).toEqual(['color'])
		expect(getDefaultPinnedProperties('line')).toEqual(['borderColor', 'borderWidth'])
		expect(getDefaultPinnedProperties('gauge')).toEqual(['value'])
		expect(getDefaultPinnedProperties('reference')).toEqual(['location'])
	})

	test('pins nothing for types with no sensible default', () => {
		expect(getDefaultPinnedProperties('group')).toEqual([])
		expect(getDefaultPinnedProperties('composite')).toEqual([])
	})

	test('falls back to nothing for the canvas and unknown types', () => {
		expect(getDefaultPinnedProperties('canvas')).toEqual([])
		expect(getDefaultPinnedProperties('not-a-real-type')).toEqual([])
	})

	test('returns a fresh, independent array each call', () => {
		const a = getDefaultPinnedProperties('text')
		const b = getDefaultPinnedProperties('text')
		expect(a).not.toBe(b)

		a.push('extra')
		expect(getDefaultPinnedProperties('text')).not.toContain('extra')
		expect(elementDefaultPinnedProperties.text).not.toContain('extra')
	})
})
