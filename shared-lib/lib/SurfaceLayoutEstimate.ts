/**
 * Estimating the face of a surface which did not describe one, from nothing but its layout: where each control is
 * by row and column, and how big its display is.
 */
import type { SurfaceRect } from './SurfaceLayout.js'

/** The gap left between controls, as a fraction of the smallest control. Stands in for the bezel of a real device. */
const CONTROL_GAP_RATIO = 0.14

type Axis = 'x' | 'y'

/** One control, as far as estimating a face goes */
export interface FaceEstimateInput {
	/** Its column (x) and row (y) on the panel */
	track: Record<Axis, number>
	/** How big its display is on the face, or null when it has none */
	display: { width: number; height: number } | null
	/** Whether it has a ring of leds around it, which makes it a knob */
	ring: boolean
}

export interface FaceEstimate {
	/** Where each control is, in the order they were given */
	bounds: SurfaceRect[]
	extent: { width: number; height: number }
}

/** The span of tracks a control covers on one axis, inclusive */
interface TrackSpan {
	first: number
	last: number
}

/**
 * Lay a face out from nothing but each control's row and column, and the size of its display.
 *
 * Tracks (columns and rows) are as big as the displays in them, and a control smaller than the room it has sits
 * centred in it. Empty tracks between occupied ones keep their room: controls numbered 0, 3, 5 left space for what
 * is between, and closing it up would draw the device narrower than it is.
 *
 * A display bigger than the others in its track - an info bar under a row of keys - spills into the empty cells
 * beside it before widening its own track, so the keys above it stay evenly spaced. A cell two controls would both
 * spill into is left to neither.
 *
 * A control with no display - a touch button, a plain key, a knob - fills the cell the displays around it leave,
 * which is a better guess at its shape than any fixed size; one with a ring of leds is a knob, so stays round. On
 * a surface with no displays at all there is nothing to go on, so every control is a nominal key.
 *
 * Sizes assume every display has the same pixel density, which real devices don't (a Stream Deck + draws its touch
 * strip at more pixels per mm than its keys). The shapes and ordering are right; the proportions are only as good
 * as that assumption, which is what a described appearance is for.
 */
export function estimateFace(inputs: readonly FaceEstimateInput[], fallbackSide: number): FaceEstimate {
	const lengthOf = (size: { width: number; height: number }, axis: Axis) => (axis === 'x' ? size.width : size.height)

	// What a track's displays ask for, leaving out any display too big for it - those spill instead, if they can
	const spilling = new Set<number>()
	const baseSizes: Record<Axis, Map<number, number>> = { x: new Map(), y: new Map() }
	for (const axis of ['x', 'y'] as const) {
		const byTrack = new Map<number, number[]>()
		inputs.forEach((input, index) => {
			if (!input.display) return
			const entries = byTrack.get(input.track[axis]) ?? []
			entries.push(index)
			byTrack.set(input.track[axis], entries)
		})

		for (const [track, indices] of byTrack) {
			const lengths = indices.map((index) => lengthOf(inputs[index].display!, axis))
			let base = 0
			indices.forEach((index, i) => {
				const others = lengths.filter((_, j) => j !== i)
				if (others.length > 0 && lengths[i] > Math.max(...others)) {
					spilling.add(index * 2 + (axis === 'x' ? 0 : 1))
				} else {
					base = Math.max(base, lengths[i])
				}
			})
			baseSizes[axis].set(track, base)
		}
	}
	const isSpilling = (index: number, axis: Axis) => spilling.has(index * 2 + (axis === 'x' ? 0 : 1))

	// A control with no display fills the cell around it, falling back to square where only one side is known
	const sizes = inputs.map((input) => {
		if (input.display) return input.display

		const width = baseSizes.x.get(input.track.x) ?? baseSizes.y.get(input.track.y) ?? fallbackSide
		const height = baseSizes.y.get(input.track.y) ?? width
		if (input.ring) {
			const side = Math.min(width, height)
			return { width: side, height: side }
		}
		return { width, height }
	})

	const range = (axis: Axis) => {
		const tracks = inputs.map((input) => input.track[axis])
		return { min: Math.min(...tracks), max: Math.max(...tracks) }
	}

	// The room each track has before anything spills into it, which spilling is measured against
	const singleSpanSizes = (axis: Axis, spans: readonly TrackSpan[] | null) => {
		const { min, max } = range(axis)
		const result = new Map<number, number>()
		for (let track = min; track <= max; track++) result.set(track, 0)
		inputs.forEach((input, index) => {
			if (spans ? spans[index].first !== spans[index].last : isSpilling(index, axis)) return
			const track = input.track[axis]
			result.set(track, Math.max(result.get(track) ?? 0, lengthOf(sizes[index], axis)))
		})
		for (const [track, size] of result) if (size === 0) result.set(track, fallbackSide)
		return result
	}

	const before = { x: singleSpanSizes('x', null), y: singleSpanSizes('y', null) }
	const gap = Math.round(Math.min(...before.x.values(), ...before.y.values()) * CONTROL_GAP_RATIO)

	const spans = {
		x: spillSpans(inputs, sizes, 'x', before.x, gap, isSpilling),
		y: spillSpans(inputs, sizes, 'y', before.y, gap, isSpilling),
	}

	// The tracks as everything which did not spill asks for them, grown where a spilling control is still too big
	// for the room it spilt into. Every track on the axis grows alike, not only those it covers, so the controls
	// either side of it stay as evenly spaced as they were - the face gets a little roomier rather than lopsided.
	const trackSizes = { x: singleSpanSizes('x', spans.x), y: singleSpanSizes('y', spans.y) }
	for (const axis of ['x', 'y'] as const) {
		inputs.forEach((_, index) => {
			const span = spans[axis][index]
			if (span.first === span.last) return

			const short = lengthOf(sizes[index], axis) - spanLength(trackSizes[axis], span, gap)
			if (short <= 0) return

			const grow = short / (span.last - span.first + 1)
			for (const [track, size] of trackSizes[axis]) trackSizes[axis].set(track, size + grow)
		})
	}

	const offsets = { x: trackOffsets(trackSizes.x, gap), y: trackOffsets(trackSizes.y, gap) }

	const bounds = inputs.map((_, index) => {
		const size = sizes[index]
		const place = (axis: Axis) => {
			const span = spans[axis][index]
			const room = spanLength(trackSizes[axis], span, gap)
			// Centred in the room the device leaves for it, rather than stretched to fill it
			return (offsets[axis].get(span.first) ?? 0) + (room - lengthOf(size, axis)) / 2
		}
		return { x: place('x'), y: place('y'), width: size.width, height: size.height }
	})

	return {
		bounds,
		extent: { width: trackExtent(trackSizes.x, gap), height: trackExtent(trackSizes.y, gap) },
	}
}

/**
 * Which tracks each control covers on one axis: its own, and for one too big for its track, the empty cells beside
 * it it spills into - alternately after it and before it, until it fits or there is no more room. A cell two
 * controls would both spill into is left to neither, so where they meet neither takes the space between them.
 */
function spillSpans(
	inputs: readonly FaceEstimateInput[],
	sizes: readonly { width: number; height: number }[],
	axis: Axis,
	trackSizes: ReadonlyMap<number, number>,
	gap: number,
	isSpilling: (index: number, axis: Axis) => boolean
): TrackSpan[] {
	const across: Axis = axis === 'x' ? 'y' : 'x'
	const occupied = new Set(inputs.map((input) => `${input.track[axis]}/${input.track[across]}`))
	const tracks = [...trackSizes.keys()]
	const min = Math.min(...tracks)
	const max = Math.max(...tracks)

	const spanFor = (index: number, blocked: ReadonlySet<string>): TrackSpan => {
		const input = inputs[index]
		const own = input.track[axis]
		const span = { first: own, last: own }
		if (!isSpilling(index, axis)) return span

		const length = axis === 'x' ? sizes[index].width : sizes[index].height
		const free = (track: number) => {
			const cell = `${track}/${input.track[across]}`
			return track >= min && track <= max && !occupied.has(cell) && !blocked.has(cell)
		}

		while (spanLength(trackSizes, span, gap) < length) {
			if (free(span.last + 1)) span.last++
			else if (free(span.first - 1)) span.first--
			else break
		}
		return span
	}

	// Where every control would spill with the rest of the face to itself, to find the cells more than one wants
	const wanted = new Map<string, number>()
	inputs.forEach((input, index) => {
		const span = spanFor(index, new Set())
		for (let track = span.first; track <= span.last; track++) {
			if (track === input.track[axis]) continue
			const cell = `${track}/${input.track[across]}`
			wanted.set(cell, (wanted.get(cell) ?? 0) + 1)
		}
	})
	const contested = new Set([...wanted].filter(([, count]) => count > 1).map(([cell]) => cell))

	return inputs.map((_, index) => spanFor(index, contested))
}

/** How long a span of tracks is, with the gaps between them */
function spanLength(sizes: ReadonlyMap<number, number>, span: TrackSpan, gap: number): number {
	let length = 0
	for (let track = span.first; track <= span.last; track++) length += sizes.get(track) ?? 0
	return length + gap * (span.last - span.first)
}

/** Where each track starts, laid out in order with a gap between them */
function trackOffsets(sizes: ReadonlyMap<number, number>, gap: number): Map<number, number> {
	const offsets = new Map<number, number>()

	let position = 0
	for (const track of [...sizes.keys()].sort((a, b) => a - b)) {
		offsets.set(track, position)
		position += (sizes.get(track) ?? 0) + gap
	}

	return offsets
}

/** How far the tracks reach in total, without a trailing gap */
function trackExtent(sizes: ReadonlyMap<number, number>, gap: number): number {
	let extent = 0
	for (const size of sizes.values()) extent += size + gap

	return Math.max(0, extent - gap)
}
