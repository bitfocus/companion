import { describe, expect, it } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocationString } from '@companion-app/shared/Model/Common.js'
import { ReferencedLocationsIndex } from '../../lib/Controls/ReferencedLocationsIndex.js'

describe('ReferencedLocationsIndex', () => {
	it('returns undefined for a location nothing references', () => {
		const index = new ReferencedLocationsIndex()
		expect(index.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 0 }))).toBeUndefined()
	})

	it('indexes each control under every location it references', () => {
		const index = new ReferencedLocationsIndex()
		index.setControlReferences(
			'a',
			new Set([
				formatLocation({ pageNumber: 1, row: 0, column: 0 }),
				formatLocation({ pageNumber: 1, row: 0, column: 1 }),
			])
		)
		index.setControlReferences('b', new Set([formatLocation({ pageNumber: 1, row: 0, column: 1 })]))

		expect(index.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 0 }))).toEqual(new Set(['a']))
		expect(index.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 1 }))).toEqual(
			new Set(['a', 'b'])
		)
	})

	it('replaces the previous references of a control', () => {
		const index = new ReferencedLocationsIndex()
		index.setControlReferences(
			'a',
			new Set([
				formatLocation({ pageNumber: 1, row: 0, column: 0 }),
				formatLocation({ pageNumber: 1, row: 0, column: 1 }),
			])
		)
		index.setControlReferences(
			'a',
			new Set([
				formatLocation({ pageNumber: 1, row: 0, column: 1 }),
				formatLocation({ pageNumber: 2, row: 0, column: 0 }),
			])
		)

		expect(index.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 0 }))).toBeUndefined()
		expect(index.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 1 }))).toEqual(new Set(['a']))
		expect(index.getControlsReferencing(formatLocation({ pageNumber: 2, row: 0, column: 0 }))).toEqual(new Set(['a']))
	})

	it('clears a control given null or an empty set, keeping other controls', () => {
		const index = new ReferencedLocationsIndex()
		index.setControlReferences('a', new Set([formatLocation({ pageNumber: 1, row: 0, column: 0 })]))
		index.setControlReferences('b', new Set([formatLocation({ pageNumber: 1, row: 0, column: 0 })]))
		index.setControlReferences('c', new Set([formatLocation({ pageNumber: 2, row: 0, column: 0 })]))

		index.setControlReferences('a', null)
		index.setControlReferences('c', new Set())

		expect(index.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 0 }))).toEqual(new Set(['b']))
		expect(index.getControlsReferencing(formatLocation({ pageNumber: 2, row: 0, column: 0 }))).toBeUndefined()
	})

	it('forgets a deleted control', () => {
		const index = new ReferencedLocationsIndex()
		index.setControlReferences('a', new Set([formatLocation({ pageNumber: 1, row: 0, column: 0 })]))
		index.forgetControl('a')

		expect(index.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 0 }))).toBeUndefined()
	})

	it('is not affected by the caller later mutating the set it reported', () => {
		const index = new ReferencedLocationsIndex()
		const locations = new Set<ControlLocationString>([formatLocation({ pageNumber: 1, row: 0, column: 0 })])
		index.setControlReferences('a', locations)
		locations.add(formatLocation({ pageNumber: 2, row: 0, column: 0 }))
		locations.delete(formatLocation({ pageNumber: 1, row: 0, column: 0 }))

		expect(index.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 0 }))).toEqual(new Set(['a']))
		expect(index.getControlsReferencing(formatLocation({ pageNumber: 2, row: 0, column: 0 }))).toBeUndefined()

		index.forgetControl('a')
		expect(index.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 0 }))).toBeUndefined()
	})
})
