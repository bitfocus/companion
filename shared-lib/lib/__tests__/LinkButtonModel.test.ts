import { describe, expect, test } from 'vitest'
import { LinkButtonOptionsSchema, parseLinkButtonOptions } from '../Model/ButtonModel.js'

describe('parseLinkButtonOptions', () => {
	test('keeps valid options, and drops unknown ones', () => {
		const options = {
			peerId: 'peer',
			location: { value: '1/2/3', isExpression: false },
			notes: 'note',
		}
		expect(parseLinkButtonOptions({ ...options, other: 1 })).toEqual({ options, invalidKeys: [] })
	})

	test('replaces each invalid option by its default, keeping the rest', () => {
		expect(
			parseLinkButtonOptions({
				peerId: 5,
				location: { value: 5, isExpression: false },
				notes: 'kept',
			})
		).toEqual({
			options: { peerId: '', location: { value: '', isExpression: false }, notes: 'kept' },
			invalidKeys: ['peerId', 'location'],
		})
	})

	test('gives the defaults for no options at all', () => {
		const defaults = { peerId: '', location: { value: '', isExpression: false } }
		expect(parseLinkButtonOptions(undefined)).toEqual({ options: defaults, invalidKeys: [] })
		expect(parseLinkButtonOptions('nonsense')).toEqual({ options: defaults, invalidKeys: [] })
		expect(LinkButtonOptionsSchema.safeParse(defaults).success).toBe(true)
	})
})
