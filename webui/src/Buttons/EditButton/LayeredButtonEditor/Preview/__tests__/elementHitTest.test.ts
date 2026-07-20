import { describe, expect, test } from 'vitest'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { buildElementRects, hitTestElements, type PixelRect } from '../elementHitTest.js'

// The content area used by every test: 100x100 at an offset, so tests catch any missing origin handling
const CONTENT: PixelRect = { x: 10, y: 20, width: 100, height: 100 }
const NO_HIDDEN: ReadonlySet<string> = new Set()

// Ids the edited model knows about. Composite internals are deliberately absent from this set.
function selectable(...ids: string[]): ReadonlySet<string> {
	return new Set(ids)
}

function base(id: string) {
	return { id, usage: 'automatic', enabled: true, opacity: 1, contentHash: id } as const
}

function box(id: string, x: number, y: number, width: number, height: number): SomeButtonGraphicsDrawElement {
	return {
		...base(id),
		type: 'box',
		x,
		y,
		width,
		height,
		color: 0,
		borderWidth: 0,
		borderColor: 0,
		borderPosition: 'inside',
	} as unknown as SomeButtonGraphicsDrawElement
}

function group(
	id: string,
	x: number,
	y: number,
	width: number,
	height: number,
	children: SomeButtonGraphicsDrawElement[],
	squareCoords = false
): SomeButtonGraphicsDrawElement {
	return {
		...base(id),
		type: 'group',
		x,
		y,
		width,
		height,
		rotation: 0,
		squareCoords,
		children,
	} as unknown as SomeButtonGraphicsDrawElement
}

describe('buildElementRects', () => {
	test('resolves a top-level element against the content bounds', () => {
		const rects = buildElementRects([box('a', 0.25, 0.5, 0.5, 0.25)], CONTENT, NO_HIDDEN, selectable('a'))

		expect(rects).toHaveLength(1)
		expect(rects[0]).toMatchObject({
			id: 'a',
			isTopLevel: true,
			rect: { x: 10 + 25, y: 20 + 50, width: 50, height: 25 },
		})
	})

	test('composes a child rect against its group, not the content bounds', () => {
		// Group occupies the right half; the child fills the left half of that
		const rects = buildElementRects(
			[group('g', 0.5, 0, 0.5, 1, [box('child', 0, 0, 0.5, 1)])],
			CONTENT,
			NO_HIDDEN,
			selectable('g', 'child')
		)

		expect(rects.map((r) => r.id)).toEqual(['g', 'child'])
		expect(rects[1]).toMatchObject({
			id: 'child',
			isTopLevel: false,
			rect: { x: 10 + 50, y: 20, width: 25, height: 100 },
		})
	})

	test('squareCoords gives children a centred square coordinate space', () => {
		const content: PixelRect = { x: 0, y: 0, width: 100, height: 50 }
		const rects = buildElementRects(
			[group('g', 0, 0, 1, 1, [box('child', 0, 0, 1, 1)], true)],
			content,
			NO_HIDDEN,
			selectable('g', 'child')
		)

		// The square is 50x50, centred horizontally within the 100-wide group
		expect(rects[1].rect).toEqual({ x: 25, y: 0, width: 50, height: 50 })
	})

	test('skips the canvas background', () => {
		const canvas = { ...base('bg'), type: 'canvas' } as unknown as SomeButtonGraphicsDrawElement
		const rects = buildElementRects([canvas, box('a', 0, 0, 1, 1)], CONTENT, NO_HIDDEN, selectable('bg', 'a'))

		expect(rects.map((r) => r.id)).toEqual(['a'])
	})

	test('skips disabled and hidden elements', () => {
		const disabled = { ...box('off', 0, 0, 1, 1), enabled: false } as SomeButtonGraphicsDrawElement
		const rects = buildElementRects(
			[disabled, box('hidden', 0, 0, 1, 1), box('shown', 0, 0, 1, 1)],
			CONTENT,
			new Set(['hidden']),
			selectable('off', 'hidden', 'shown')
		)

		expect(rects.map((r) => r.id)).toEqual(['shown'])
	})

	test('does not descend into reference children, which cannot be selected individually', () => {
		const reference = {
			...base('ref'),
			type: 'reference',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			rotation: 0,
			children: [box('inner', 0, 0, 1, 1)],
		} as unknown as SomeButtonGraphicsDrawElement

		expect(buildElementRects([reference], CONTENT, NO_HIDDEN, selectable('ref')).map((r) => r.id)).toEqual(['ref'])
	})

	test('emits only the composite itself, not the internal children it renders as', () => {
		// A composite is converted to a group whose children carry generated ids absent from the edited model
		const composite = group('comp', 0, 0, 1, 1, [box('comp-abc123/inner', 0, 0, 1, 1)])

		expect(buildElementRects([composite], CONTENT, NO_HIDDEN, selectable('comp')).map((r) => r.id)).toEqual(['comp'])
	})

	test('gives a line the extent of its endpoints, regardless of direction', () => {
		const line = {
			...base('l'),
			type: 'line',
			fromX: 0.75,
			fromY: 0.25,
			toX: 0.25,
			toY: 0.75,
			borderWidth: 1,
			borderColor: 0,
			borderPosition: 'center',
		} as unknown as SomeButtonGraphicsDrawElement

		expect(buildElementRects([line], CONTENT, NO_HIDDEN, selectable('l'))[0].rect).toEqual({
			x: 10 + 25,
			y: 20 + 25,
			width: 50,
			height: 50,
		})
	})
})

describe('hitTestElements', () => {
	test('returns null over empty space', () => {
		const rects = buildElementRects([box('a', 0, 0, 0.25, 0.25)], CONTENT, NO_HIDDEN, selectable('a'))

		expect(hitTestElements(rects, 100, 100)).toBeNull()
	})

	test('prefers the top-most of two overlapping elements', () => {
		const rects = buildElementRects(
			[box('under', 0, 0, 1, 1), box('over', 0, 0, 1, 1)],
			CONTENT,
			NO_HIDDEN,
			selectable('under', 'over')
		)

		expect(hitTestElements(rects, 60, 70)?.id).toBe('over')
	})

	test('prefers a group child over the group containing it', () => {
		const rects = buildElementRects(
			[group('g', 0, 0, 1, 1, [box('child', 0, 0, 1, 1)])],
			CONTENT,
			NO_HIDDEN,
			selectable('g', 'child')
		)

		expect(hitTestElements(rects, 60, 70)?.id).toBe('child')
	})

	test('selects the composite as a whole when one of its rendered parts is clicked', () => {
		const composite = group('comp', 0, 0, 1, 1, [box('comp-abc123/inner', 0, 0, 1, 1)])
		const rects = buildElementRects([composite], CONTENT, NO_HIDDEN, selectable('comp'))

		expect(hitTestElements(rects, 60, 70)?.id).toBe('comp')
	})

	test('hits the group itself where the child does not cover it', () => {
		const rects = buildElementRects(
			[group('g', 0, 0, 1, 1, [box('child', 0, 0, 0.25, 0.25)])],
			CONTENT,
			NO_HIDDEN,
			selectable('g', 'child')
		)

		expect(hitTestElements(rects, 100, 110)?.id).toBe('g')
	})
})
