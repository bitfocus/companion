import { describe, expect, test } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { DisplayedLocations } from '../../lib/Graphics/DisplayedLocations.js'
import { EmbeddedLocations } from '../../lib/Graphics/EmbeddedLocations.js'

const a = { pageNumber: 1, row: 0, column: 0 }
const b = { pageNumber: 1, row: 0, column: 1 }
const c = { pageNumber: 1, row: 0, column: 2 }
const square = { width: 72, height: 72 }
const wide = { width: 200, height: 100 }

function create() {
	const displayed = new DisplayedLocations()
	/** What each location embeds, as its render would say */
	const embeds = new Map<string, Set<string>>()
	const embedded = new EmbeddedLocations(displayed, (location) => embeds.get(formatLocation(location)) ?? null)
	const setEmbeds = (location: ControlLocation, others: ControlLocation[]) => {
		embeds.set(formatLocation(location), new Set(others.map(formatLocation)))
		embedded.refresh(location)
	}
	return { displayed, setEmbeds }
}

describe('EmbeddedLocations', () => {
	test('what a shown location embeds is shown at the same sizes, until it is not shown', () => {
		const { displayed, setEmbeds } = create()
		setEmbeds(a, [b])
		expect(displayed.getSizes(b)).toEqual([])

		const releaseSquare = displayed.acquire(a, square)
		const releaseWide = displayed.acquire(a, wide)
		expect(displayed.getSizes(b)).toEqual([square, wide])

		releaseSquare()
		expect(displayed.getSizes(b)).toEqual([wide])
		releaseWide()
		expect(displayed.getSizes(b)).toEqual([])
	})

	test('follows what a location embeds as its render changes', () => {
		const { displayed, setEmbeds } = create()
		displayed.acquire(a, square)

		setEmbeds(a, [b, c])
		expect(displayed.getSizes(b)).toEqual([square])
		expect(displayed.getSizes(c)).toEqual([square])

		setEmbeds(a, [c])
		expect(displayed.getSizes(b)).toEqual([])
		expect(displayed.getSizes(c)).toEqual([square])
	})

	test('a location shown itself and through another keeps the sizes of both', () => {
		const { displayed, setEmbeds } = create()
		setEmbeds(a, [b])
		displayed.acquire(a, square)
		const releaseB = displayed.acquire(b, wide)
		expect(displayed.getSizes(b)).toEqual([square, wide])

		releaseB()
		expect(displayed.getSizes(b)).toEqual([square])
	})

	test('two that embed each other let go of each other once neither is shown', () => {
		const { displayed, setEmbeds } = create()
		setEmbeds(a, [b])
		setEmbeds(b, [a])

		const release = displayed.acquire(a, square)
		expect(displayed.getSizes(b)).toEqual([square])

		release()
		expect(displayed.getSizes(a)).toEqual([])
		expect(displayed.getSizes(b)).toEqual([])
	})
})
