import { describe, expect, it } from 'vitest'
import { ReferencedLocationsIndex } from '../../lib/Controls/ReferencedLocationsIndex.js'

describe('ReferencedLocationsIndex', () => {
	it('returns undefined for a location nothing references', () => {
		const index = new ReferencedLocationsIndex()
		expect(index.getControlsReferencing('1/0/0')).toBeUndefined()
	})

	it('indexes each control under every location it references', () => {
		const index = new ReferencedLocationsIndex()
		index.setControlReferences('a', new Set(['1/0/0', '1/0/1']))
		index.setControlReferences('b', new Set(['1/0/1']))

		expect(index.getControlsReferencing('1/0/0')).toEqual(new Set(['a']))
		expect(index.getControlsReferencing('1/0/1')).toEqual(new Set(['a', 'b']))
	})

	it('replaces the previous references of a control', () => {
		const index = new ReferencedLocationsIndex()
		index.setControlReferences('a', new Set(['1/0/0', '1/0/1']))
		index.setControlReferences('a', new Set(['1/0/1', '2/0/0']))

		expect(index.getControlsReferencing('1/0/0')).toBeUndefined()
		expect(index.getControlsReferencing('1/0/1')).toEqual(new Set(['a']))
		expect(index.getControlsReferencing('2/0/0')).toEqual(new Set(['a']))
	})

	it('clears a control given null or an empty set, keeping other controls', () => {
		const index = new ReferencedLocationsIndex()
		index.setControlReferences('a', new Set(['1/0/0']))
		index.setControlReferences('b', new Set(['1/0/0']))
		index.setControlReferences('c', new Set(['2/0/0']))

		index.setControlReferences('a', null)
		index.setControlReferences('c', new Set())

		expect(index.getControlsReferencing('1/0/0')).toEqual(new Set(['b']))
		expect(index.getControlsReferencing('2/0/0')).toBeUndefined()
	})

	it('forgets a deleted control', () => {
		const index = new ReferencedLocationsIndex()
		index.setControlReferences('a', new Set(['1/0/0']))
		index.forgetControl('a')

		expect(index.getControlsReferencing('1/0/0')).toBeUndefined()
	})

	it('is not affected by the caller later mutating the set it reported', () => {
		const index = new ReferencedLocationsIndex()
		const locations = new Set(['1/0/0'])
		index.setControlReferences('a', locations)
		locations.add('2/0/0')
		locations.delete('1/0/0')

		expect(index.getControlsReferencing('1/0/0')).toEqual(new Set(['a']))
		expect(index.getControlsReferencing('2/0/0')).toBeUndefined()

		index.forgetControl('a')
		expect(index.getControlsReferencing('1/0/0')).toBeUndefined()
	})
})
