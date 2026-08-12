import { describe, expect, test } from 'vitest'
import {
	appendRotation,
	clipLineToRect,
	computeSelectionMarkerLines,
	inverseRotatePointThroughRotations,
	resolveMarkerTransform,
	rotatePointThroughRotations,
	type MarkerLine,
	type SelectedElementMarker,
} from '../Geometry.js'
import { DrawBounds } from '../Util.js'

/** Assert two lines match within floating-point tolerance, ignoring endpoint order (`img.line` doesn't care). */
function expectLine(actual: MarkerLine | null, expected: MarkerLine): void {
	expect(actual).not.toBeNull()
	const [ax1, ay1, ax2, ay2] = actual as MarkerLine
	const [ex1, ey1, ex2, ey2] = expected
	const close = (a: number, b: number, c: number, d: number): boolean =>
		Math.abs(a - c) < 1e-6 && Math.abs(b - d) < 1e-6
	const matches =
		(close(ax1, ay1, ex1, ey1) && close(ax2, ay2, ex2, ey2)) || (close(ax1, ay1, ex2, ey2) && close(ax2, ay2, ex1, ey1))
	expect(matches, `line ${JSON.stringify(actual)} does not match ${JSON.stringify(expected)} (either order)`).toBe(true)
}

describe('clipLineToRect', () => {
	test('horizontal line through the middle spans the full width', () => {
		expectLine(clipLineToRect(5, 5, 1, 0, 10, 10), [0, 5, 10, 5])
	})

	test('vertical line through the middle spans the full height', () => {
		expectLine(clipLineToRect(5, 5, 0, 1, 10, 10), [5, 0, 5, 10])
	})

	test('diagonal line through the centre hits opposite corners', () => {
		expectLine(clipLineToRect(5, 5, 1, 1, 10, 10), [0, 0, 10, 10])
	})

	test('point outside but infinite line still crosses the rect is clipped, not dropped', () => {
		expectLine(clipLineToRect(15, 5, 1, 0, 10, 10), [0, 5, 10, 5])
	})

	test('horizontal line entirely above the rect misses', () => {
		expect(clipLineToRect(5, 15, 1, 0, 10, 10)).toBeNull()
	})

	test('vertical line entirely beside the rect misses', () => {
		expect(clipLineToRect(15, 5, 0, 1, 10, 10)).toBeNull()
	})
})

describe('appendRotation', () => {
	const outerPivot = new DrawBounds(0, 0, 10, 10)
	const innerPivot = new DrawBounds(0, 0, 4, 4)

	test('a zero angle adds nothing', () => {
		expect(appendRotation([], innerPivot, 0)).toEqual([])
	})

	test('a non-zero angle appends a rotation about the pivot', () => {
		expect(appendRotation([], innerPivot, 30)).toEqual([{ pivot: innerPivot, angle: 30 }])
	})

	test('the parent chain stays outermost-first', () => {
		const parent = appendRotation([], outerPivot, 30)
		expect(appendRotation(parent, innerPivot, 10)).toEqual([
			{ pivot: outerPivot, angle: 30 },
			{ pivot: innerPivot, angle: 10 },
		])
	})

	test('a zero angle leaves the parent chain untouched', () => {
		const parent = appendRotation([], outerPivot, 30)
		expect(appendRotation(parent, innerPivot, 0)).toBe(parent)
	})
})

describe('rotatePointThroughRotations', () => {
	const bounds = new DrawBounds(2, 2, 4, 4) // centre (4, 4)
	const outer = new DrawBounds(0, 0, 20, 20) // centre (10, 10)

	test('an empty chain leaves the point where it is', () => {
		expect(rotatePointThroughRotations([], 3, 7)).toEqual([3, 7])
	})

	test('rotating 90° clockwise about a centre', () => {
		const [x, y] = rotatePointThroughRotations([{ pivot: bounds, angle: 90 }], 6, 4)
		expect(x).toBeCloseTo(4, 6)
		expect(y).toBeCloseTo(6, 6)
	})

	test('inverse undoes a nested chain exactly', () => {
		const rotations = [
			{ pivot: outer, angle: 37 },
			{ pivot: bounds, angle: -12 },
		]
		const [x, y] = rotatePointThroughRotations(rotations, 3, 7)
		const [bx, by] = inverseRotatePointThroughRotations(rotations, x, y)

		expect(bx).toBeCloseTo(3, 6)
		expect(by).toBeCloseTo(7, 6)
	})
})

describe('resolveMarkerTransform', () => {
	const bounds = new DrawBounds(2, 2, 4, 6) // centre (4, 5)

	test('an unrotated marker keeps its own centre and size', () => {
		expect(resolveMarkerTransform({ bounds, rotations: [] })).toEqual({
			centerX: 4,
			centerY: 5,
			width: 4,
			height: 6,
			angle: 0,
		})
	})

	test('rotating about its own centre changes only the angle', () => {
		const transform = resolveMarkerTransform({ bounds, rotations: [{ pivot: bounds, angle: 30 }] })

		expect(transform.centerX).toBeCloseTo(4, 6)
		expect(transform.centerY).toBeCloseTo(5, 6)
		expect(transform.angle).toBe(30)
	})

	test('a nested chain sums the angles and moves the centre to where the outer pivot puts it', () => {
		// A group rotated 90° about (10, 10) carries the element's centre from (4, 5) to (15, 4)
		const group = new DrawBounds(0, 0, 20, 20)
		const transform = resolveMarkerTransform({
			bounds,
			rotations: [
				{ pivot: group, angle: 90 },
				{ pivot: bounds, angle: 45 },
			],
		})

		expect(transform.centerX).toBeCloseTo(15, 6)
		expect(transform.centerY).toBeCloseTo(4, 6)
		expect(transform.angle).toBe(135)
		expect(transform.width).toBe(4)
		expect(transform.height).toBe(6)
	})
})

describe('computeSelectionMarkerLines', () => {
	// bounds centred in a 10x10 image: edges at x/y = 2 and 6, centre at (4, 4)
	const bounds = new DrawBounds(2, 2, 4, 4)

	test('without rotation, the four edges become full-image axis-aligned lines', () => {
		const marker: SelectedElementMarker = { bounds, rotations: [] }
		const lines = computeSelectionMarkerLines(marker, 10, 10, 0)

		expect(lines).toHaveLength(4)
		expectLine(lines[0], [0, 2, 10, 2]) // top edge
		expectLine(lines[1], [0, 6, 10, 6]) // bottom edge
		expectLine(lines[2], [2, 0, 2, 10]) // left edge
		expectLine(lines[3], [6, 0, 6, 10]) // right edge
	})

	test('outset pushes each edge line outward, away from the centre', () => {
		const marker: SelectedElementMarker = { bounds, rotations: [] }
		const lines = computeSelectionMarkerLines(marker, 10, 10, 1)

		expect(lines).toHaveLength(4)
		expectLine(lines[0], [0, 1, 10, 1]) // top: 2 → 1
		expectLine(lines[1], [0, 7, 10, 7]) // bottom: 6 → 7
		expectLine(lines[2], [1, 0, 1, 10]) // left: 2 → 1
		expectLine(lines[3], [7, 0, 7, 10]) // right: 6 → 7
	})

	test('rotating 90° about the centre swaps horizontal and vertical edges', () => {
		const marker: SelectedElementMarker = { bounds, rotations: [{ pivot: bounds, angle: 90 }] }
		const lines = computeSelectionMarkerLines(marker, 10, 10, 0)

		expect(lines).toHaveLength(4)
		// The top edge (y=2) rotates to a vertical line at x=6; the bottom edge (y=6) to x=2
		expectLine(lines[0], [6, 0, 6, 10])
		expectLine(lines[1], [2, 0, 2, 10])
		// The left edge (x=2) rotates to a horizontal line at y=2; the right edge (x=6) to y=6
		expectLine(lines[2], [0, 2, 10, 2])
		expectLine(lines[3], [0, 6, 10, 6])
	})

	test('rotating 45° about the centre produces the expected clipped diagonals', () => {
		const marker: SelectedElementMarker = { bounds, rotations: [{ pivot: bounds, angle: 45 }] }
		const lines = computeSelectionMarkerLines(marker, 10, 10, 0)

		const d = 2 * Math.SQRT2 // 2√2, the offset where a slope-±1 edge crosses the image border
		expect(lines).toHaveLength(4)
		expectLine(lines[0], [d, 0, 10, 10 - d]) // top edge: y = x - 2√2
		expectLine(lines[1], [0, d, 10 - d, 10]) // bottom edge: y = x + 2√2
		expectLine(lines[2], [0, 8 - d, 8 - d, 0]) // left edge: y = -x + (8 - 2√2)
		expectLine(lines[3], [d - 2, 10, 10, d - 2]) // right edge: y = -x + (8 + 2√2)
	})

	test('an arbitrary angle rotates each edge line by that angle about its midpoint', () => {
		const angle = 30
		const marker: SelectedElementMarker = { bounds, rotations: [{ pivot: bounds, angle }] }
		const lines = computeSelectionMarkerLines(marker, 10, 10, 0)
		expect(lines).toHaveLength(4)

		const rad = (angle * Math.PI) / 180
		// Rotate a point about the bounds centre (4, 4)
		const rotate = (x: number, y: number): [number, number] => {
			const dx = x - 4
			const dy = y - 4
			return [4 + dx * Math.cos(rad) - dy * Math.sin(rad), 4 + dx * Math.sin(rad) + dy * Math.cos(rad)]
		}
		// [edge midpoint x, y, unrotated direction in degrees]
		const edges: Array<[number, number, number]> = [
			[4, 2, 0],
			[4, 6, 0],
			[2, 4, 90],
			[6, 4, 90],
		]

		edges.forEach(([mx, my, direction], i) => {
			const [rx, ry] = rotate(mx, my)
			const [x1, y1, x2, y2] = lines[i]

			// The rotated midpoint lies on the returned segment (zero cross product = collinear)
			const cross = (x2 - x1) * (ry - y1) - (y2 - y1) * (rx - x1)
			expect(cross).toBeCloseTo(0, 6)

			// The segment's direction is the edge's direction plus the rotation (mod 180°)
			const mod180 = (deg: number): number => ((deg % 180) + 180) % 180
			const lineAngle = mod180((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI)
			expect(lineAngle).toBeCloseTo(mod180(direction + angle), 6)
		})
	})

	test('nested rotations compose (a group rotation is applied outermost)', () => {
		// A child rotated 90° about its own centre, inside a group rotated a further 90° about the
		// same centre, is a net 180° — the top edge (y=2) ends up at the bottom (y=6)
		const marker: SelectedElementMarker = {
			bounds,
			rotations: [
				{ pivot: bounds, angle: 90 },
				{ pivot: bounds, angle: 90 },
			],
		}
		const lines = computeSelectionMarkerLines(marker, 10, 10, 0)

		expect(lines).toHaveLength(4)
		expectLine(lines[0], [0, 6, 10, 6]) // top edge → bottom
		expectLine(lines[1], [0, 2, 10, 2]) // bottom edge → top
	})
})
