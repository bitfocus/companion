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
			expect(result).toEqual({ type: 'customVariable', nameValue: exprVal('myVar') })
		})

		it('returns undefined nameValue when the field is absent', () => {
			const result = buildContextResolutionForPreview({ type: 'customVariable', nameFieldId: 'name' }, {})
			expect(result).toEqual({ type: 'customVariable', nameValue: undefined })
		})

		it('passes expression-mode values through unchanged for the server to evaluate', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'name' },
				{ name: exprExpr('$(custom:dynamicName)') }
			)
			expect(result).toEqual({ type: 'customVariable', nameValue: exprExpr('$(custom:dynamicName)') })
		})

		it('passes numeric raw values through unchanged', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'name' },
				{ name: exprVal(42) }
			)
			expect(result).toEqual({ type: 'customVariable', nameValue: exprVal(42) })
		})

		it('respects a non-default nameFieldId', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'variableName' },
				{ variableName: exprVal('myCustomVar'), name: exprVal('shouldBeIgnored') }
			)
			expect(result).toEqual({ type: 'customVariable', nameValue: exprVal('myCustomVar') })
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
			expect(result).toEqual({ type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('counter') })
		})

		it('returns undefined locationValue when the field is absent', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{ name: exprVal('counter') }
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: undefined, nameValue: exprVal('counter') })
		})

		it('returns undefined nameValue when the field is absent', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{ location: exprVal('this') }
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: exprVal('this'), nameValue: undefined })
		})

		it('supports a page/row/col location string', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{
					location: exprVal('1/2/3'),
					name: exprVal('myVar'),
				}
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: exprVal('1/2/3'), nameValue: exprVal('myVar') })
		})

		it('returns undefined for both fields when both are absent', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{}
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: undefined, nameValue: undefined })
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
			expect(result).toEqual({ type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('counter') })
		})
	})
})
