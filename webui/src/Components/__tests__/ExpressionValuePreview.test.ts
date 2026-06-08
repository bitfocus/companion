import { describe, expect, it } from 'vitest'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import { buildContextResolutionForPreview } from '../ExpressionValuePreview.js'

describe('buildContextResolutionForPreview', () => {
	it('returns undefined when res is undefined', () => {
		expect(buildContextResolutionForPreview(undefined, {})).toBeUndefined()
	})

	it('returns undefined when allRawOptions is undefined', () => {
		expect(buildContextResolutionForPreview({ type: 'customVariable', nameFieldId: 'name' }, undefined)).toBeUndefined()
	})

	describe('customVariable', () => {
		it('extracts name from the options', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'name' },
				{ name: exprVal('myVar') }
			)
			expect(result).toEqual({ type: 'customVariable', name: 'myVar' })
		})

		it('returns null for name when the field is absent', () => {
			const result = buildContextResolutionForPreview({ type: 'customVariable', nameFieldId: 'name' }, {})
			expect(result).toEqual({ type: 'customVariable', name: null })
		})

		it('stringifies the raw value when field is in expression mode', () => {
			// Expression mode: .value holds the expression string, not the evaluated result.
			// buildContextResolutionForPreview forwards it as-is; the server handles it.
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'name' },
				{ name: exprExpr('$(custom:dynamicName)') }
			)
			expect(result).toEqual({ type: 'customVariable', name: '$(custom:dynamicName)' })
		})

		it('converts a numeric raw value to a string', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'name' },
				{ name: exprVal(42) }
			)
			expect(result).toEqual({ type: 'customVariable', name: '42' })
		})

		it('respects a non-default nameFieldId', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'variableName' },
				{ variableName: exprVal('myCustomVar'), name: exprVal('shouldBeIgnored') }
			)
			expect(result).toEqual({ type: 'customVariable', name: 'myCustomVar' })
		})
	})

	describe('localVariable', () => {
		it('extracts both location and name from the options', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{
					location: exprVal('this'),
					name: exprVal('counter'),
				}
			)
			expect(result).toEqual({ type: 'localVariable', location: 'this', name: 'counter' })
		})

		it('returns null for location when the field is absent', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{ name: exprVal('counter') }
			)
			expect(result).toEqual({ type: 'localVariable', location: null, name: 'counter' })
		})

		it('returns null for name when the field is absent', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{ location: exprVal('this') }
			)
			expect(result).toEqual({ type: 'localVariable', location: 'this', name: null })
		})

		it('supports a page/row/col location string', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{
					location: exprVal('1/2/3'),
					name: exprVal('myVar'),
				}
			)
			expect(result).toEqual({ type: 'localVariable', location: '1/2/3', name: 'myVar' })
		})

		it('returns null for both fields when both are absent', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{}
			)
			expect(result).toEqual({ type: 'localVariable', location: null, name: null })
		})

		it('respects non-default locationFieldId and nameFieldId', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'loc', nameFieldId: 'varName' },
				{
					loc: exprVal('this'),
					varName: exprVal('counter'),
					location: exprVal('shouldBeIgnored'),
					name: exprVal('shouldBeIgnored'),
				}
			)
			expect(result).toEqual({ type: 'localVariable', location: 'this', name: 'counter' })
		})
	})
})
