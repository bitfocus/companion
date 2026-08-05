import { describe, expect, test } from 'vitest'
import type { ElementGeometry } from '@companion-app/shared/Graphics/Geometry.js'
import { DrawBounds } from '@companion-app/shared/Graphics/Util.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { filterElementRects, hitTestElements } from '../elementHitTest.js'

const NO_HIDDEN: ReadonlySet<string> = new Set()

// Ids the edited model knows about. Composite internals are deliberately absent from this set.
function selectable(...ids: string[]): ReadonlySet<string> {
	return new Set(ids)
}

function base(id: string) {
	return { id, usage: 'automatic', enabled: true, opacity: 1, contentHash: id } as const
}

function box(id: string): SomeButtonGraphicsDrawElement {
	return {
		...base(id),
		type: 'box',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		color: 0,
		borderWidth: 0,
		borderColor: 0,
		borderPosition: 'inside',
	} as unknown as SomeButtonGraphicsDrawElement
}

function group(id: string, children: SomeButtonGraphicsDrawElement[]): SomeButtonGraphicsDrawElement {
	return {
		...base(id),
		type: 'group',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		squareCoords: false,
		children,
	} as unknown as SomeButtonGraphicsDrawElement
}

/**
 * Stand-in for what the renderer emits. The bounds composition itself is the renderer's job (and is
 * covered by its own tests) - these only exercise the editor's policy on top of it.
 */
function geom(id: string, x: number, y: number, width: number, height: number, rotation = 0): ElementGeometry {
	const bounds = new DrawBounds(x, y, width, height)
	return { id, bounds, rotations: rotation ? [{ pivot: bounds, angle: rotation }] : [] }
}

describe('filterElementRects', () => {
	test('keeps a selectable element, marking a root element as top-level', () => {
		const rects = filterElementRects([geom('a', 10, 20, 50, 25)], [box('a')], NO_HIDDEN, selectable('a'))

		expect(rects).toHaveLength(1)
		expect(rects[0]).toMatchObject({
			id: 'a',
			isTopLevel: true,
			rect: { x: 10, y: 20, width: 50, height: 25 },
		})
	})

	test('a group child is kept, but not marked top-level', () => {
		const rects = filterElementRects(
			[geom('g', 0, 0, 100, 100), geom('child', 0, 0, 50, 100)],
			[group('g', [box('child')])],
			NO_HIDDEN,
			selectable('g', 'child')
		)

		expect(rects.map((r) => r.id)).toEqual(['g', 'child'])
		expect(rects[1].isTopLevel).toBe(false)
	})

	test('carries the rotations through', () => {
		const rects = filterElementRects([geom('a', 0, 0, 10, 10, 30)], [box('a')], NO_HIDDEN, selectable('a'))

		expect(rects[0].rotations).toEqual([{ pivot: new DrawBounds(0, 0, 10, 10), angle: 30 }])
	})

	test('skips the canvas background', () => {
		const canvas = { ...base('bg'), type: 'canvas' } as unknown as SomeButtonGraphicsDrawElement
		const rects = filterElementRects(
			[geom('bg', 0, 0, 100, 100), geom('a', 0, 0, 100, 100)],
			[canvas, box('a')],
			NO_HIDDEN,
			selectable('bg', 'a')
		)

		expect(rects.map((r) => r.id)).toEqual(['a'])
	})

	test('skips disabled and hidden elements', () => {
		const disabled = { ...box('off'), enabled: false } as SomeButtonGraphicsDrawElement
		const rects = filterElementRects(
			[geom('off', 0, 0, 100, 100), geom('hidden', 0, 0, 100, 100), geom('shown', 0, 0, 100, 100)],
			[disabled, box('hidden'), box('shown')],
			new Set(['hidden']),
			selectable('off', 'hidden', 'shown')
		)

		expect(rects.map((r) => r.id)).toEqual(['shown'])
	})

	test('drops reference children, which cannot be selected individually', () => {
		const reference = {
			...base('ref'),
			type: 'reference',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			rotation: 0,
			children: [box('inner')],
		} as unknown as SomeButtonGraphicsDrawElement

		const rects = filterElementRects(
			[geom('ref', 0, 0, 100, 100), geom('inner', 0, 0, 100, 100)],
			[reference],
			NO_HIDDEN,
			selectable('ref')
		)

		expect(rects.map((r) => r.id)).toEqual(['ref'])
	})

	test('keeps only the composite itself, not the internal children it renders as', () => {
		// A composite is converted to a group whose children carry generated ids absent from the edited model
		const composite = group('comp', [box('comp-abc123/inner')])
		const rects = filterElementRects(
			[geom('comp', 0, 0, 100, 100), geom('comp-abc123/inner', 0, 0, 100, 100)],
			[composite],
			NO_HIDDEN,
			selectable('comp')
		)

		expect(rects.map((r) => r.id)).toEqual(['comp'])
	})

	test('pads a thin line out to a grabbable thickness, without moving its centre', () => {
		const line = {
			...base('l'),
			type: 'line',
			fromX: 0,
			fromY: 0.5,
			toX: 1,
			toY: 0.5,
			borderWidth: 0.01,
			borderColor: 0,
			borderPosition: 'center',
		} as unknown as SomeButtonGraphicsDrawElement

		// The renderer only pads the line out to its 1px stroke
		const rects = filterElementRects([geom('l', 10, 49.5, 100, 1)], [line], NO_HIDDEN, selectable('l'))

		expect(rects[0].rect).toMatchObject({ x: 10, y: 46, width: 100, height: 8 })
	})

	test('leaves a line that already exceeds the minimum thickness alone', () => {
		const line = {
			...base('l'),
			type: 'line',
			fromX: 0,
			fromY: 0,
			toX: 1,
			toY: 1,
			borderWidth: 0.01,
			borderColor: 0,
			borderPosition: 'center',
		} as unknown as SomeButtonGraphicsDrawElement

		const rects = filterElementRects([geom('l', 10, 20, 100, 100)], [line], NO_HIDDEN, selectable('l'))

		expect(rects[0].rect).toMatchObject({ x: 10, y: 20, width: 100, height: 100 })
	})
})

describe('hitTestElements', () => {
	test('returns null over empty space', () => {
		const rects = filterElementRects([geom('a', 0, 0, 25, 25)], [box('a')], NO_HIDDEN, selectable('a'))

		expect(hitTestElements(rects, 100, 100)).toBeNull()
	})

	test('prefers the top-most of two overlapping elements', () => {
		const rects = filterElementRects(
			[geom('under', 0, 0, 100, 100), geom('over', 0, 0, 100, 100)],
			[box('under'), box('over')],
			NO_HIDDEN,
			selectable('under', 'over')
		)

		expect(hitTestElements(rects, 60, 70)?.id).toBe('over')
	})

	test('prefers a group child over the group containing it', () => {
		const rects = filterElementRects(
			[geom('g', 0, 0, 100, 100), geom('child', 0, 0, 100, 100)],
			[group('g', [box('child')])],
			NO_HIDDEN,
			selectable('g', 'child')
		)

		expect(hitTestElements(rects, 60, 70)?.id).toBe('child')
	})

	test('hits the group itself where the child does not cover it', () => {
		const rects = filterElementRects(
			[geom('g', 0, 0, 100, 100), geom('child', 0, 0, 25, 25)],
			[group('g', [box('child')])],
			NO_HIDDEN,
			selectable('g', 'child')
		)

		expect(hitTestElements(rects, 90, 90)?.id).toBe('g')
	})

	test('a rotated element is picked in its rotated frame, not its bounding box', () => {
		// A 40x20 box centred at (50, 50), rotated 90° - it now covers x 40-60, y 30-70
		const rects = filterElementRects([geom('a', 30, 40, 40, 20, 90)], [box('a')], NO_HIDDEN, selectable('a'))

		expect(hitTestElements(rects, 50, 65)?.id).toBe('a') // inside the rotated body, outside the unrotated one
		expect(hitTestElements(rects, 65, 50)).toBeNull() // inside the unrotated body, outside the rotated one
	})
})
