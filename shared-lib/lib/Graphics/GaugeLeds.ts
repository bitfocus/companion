import type { ButtonGraphicsGaugeDrawElement } from '../Model/StyleLayersModel.js'
import { buildGaugeColorModel, type GaugeColorRun, type GaugeRGBA } from './GaugeColorModel.js'
import { rgbRev } from './Util.js'

/**
 * A single coloured run of a gauge, baked for LED output. `start`/`end` are in 0–100 track-position
 * space (0 = the value's 0% end, 100 = its 100% end), NOT angles — this keeps `simple` mode (which
 * ignores angles and sweeps the value across the strip) trivial and unambiguous. The ring geometry
 * needed to place these on a physical ring lives on {@link LedGaugeDescription}.
 */
export interface LedGaugeArc {
	start: number
	end: number
	/** Packed RGB (0xRRGGBB); the gauge's alpha is premultiplied over black, since LEDs have no bg. */
	color: number
}

/**
 * A gauge baked into a compact, resolution-independent form for driving a surface's LED strip/ring.
 * The surface samples this into its own `segments * 3` RGB buffer via {@link sampleLedsToBuffer}, so
 * nothing large crosses the render/IPC boundaries. Colours come from the same {@link buildGaugeColorModel}
 * the pixel renderer uses, so LEDs always match the on-screen gauge.
 */
export interface LedGaugeDescription {
	/** True when the source gauge is a ring; only then is faithful `full-ring` placement possible. */
	isRing: boolean
	/** Overall swept arc in gauge degrees (0 = top, clockwise), continuous: `start .. start + sweep`. */
	startAngle: number
	endAngle: number
	/** Whether the fill direction is reversed (matches the gauge's `reverse`). */
	reverse: boolean
	/** Coloured runs (fill + dimmed track) covering the whole 0–100 track; gaps only occur if empty. */
	arcs: LedGaugeArc[]
}

const finite = (v: unknown, fallback: number): number => {
	const n = Number(v)
	return Number.isFinite(n) ? n : fallback
}

/**
 * Composite a gauge RGBA over black (LEDs have no background) and pack into 0xRRGGBB. `scale` folds in
 * the track dimming: on black, both the `dimmed` (rgb×trackAmount) and `transparent` (composited at
 * trackAmount) styles reduce to the same `rgb × alpha × trackAmount`, so the fill just passes `scale=1`.
 */
function toLed(c: GaugeRGBA, scale = 1): number {
	const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n * c.a * scale)))
	return (clamp(c.r) << 16) | (clamp(c.g) << 8) | clamp(c.b)
}

/**
 * Bake a resolved gauge element into an {@link LedGaugeDescription}. Reuses the shared gauge colour
 * model, so the emitted colours are identical to the rendered pixels. The marker overlay is
 * intentionally omitted (a thin line does not translate meaningfully to discrete LEDs).
 */
export function bakeGaugeToLeds(element: ButtonGraphicsGaugeDrawElement): LedGaugeDescription {
	const startAngleDeg = finite(element.startAngle, 0)
	const endAngleDeg = finite(element.endAngle, 360)
	let sweepDeg = (((endAngleDeg - startAngleDeg) % 360) + 360) % 360
	if (sweepDeg === 0) sweepDeg = 360

	const base = {
		isRing: element.orientation === 'ring',
		startAngle: startAngleDeg,
		endAngle: startAngleDeg + sweepDeg,
		reverse: !!element.reverse,
	}

	const model = buildGaugeColorModel(element)
	if (!model) return { ...base, arcs: [] }

	const { fillStart, fillEnd, hasFill, trackAmount, runs, singleColor, rgbaAt } = model
	const multiColour = element.multiColour
	const singleFillColor = toLed(rgbRev(singleColor, true))

	const arcs: LedGaugeArc[] = []
	// Emit a run interval [a, b] (track-position space), subdividing gradients so the colour ramps.
	const emit = (a: number, b: number, run: GaugeColorRun, colorFor: (mid: number) => number): void => {
		if (b - a <= 1e-6) return
		const steps = run.gradient ? Math.max(1, Math.min(64, Math.ceil(b - a))) : 1
		for (let s = 0; s < steps; s++) {
			const sa = a + ((b - a) * s) / steps
			const sb = a + ((b - a) * (s + 1)) / steps
			arcs.push({ start: sa, end: sb, color: colorFor((sa + sb) / 2) })
		}
	}

	// Walk runs in position order; within each, track-left, fill, track-right (mirrors the renderer).
	for (const run of runs) {
		const trackColor = (mid: number): number => toLed(rgbaAt(run, mid), trackAmount)
		const fillColor = (mid: number): number => (multiColour ? toLed(rgbaAt(run, mid)) : singleFillColor)

		const leftEnd = Math.min(run.end, hasFill ? fillStart : run.end)
		emit(run.start, leftEnd, run, trackColor)

		if (hasFill) {
			const fillLo = Math.max(run.start, fillStart)
			const fillHi = Math.min(run.end, fillEnd)
			emit(fillLo, fillHi, run, fillColor)

			const rightStart = Math.max(run.start, fillEnd)
			emit(rightStart, run.end, run, trackColor)
		}
	}

	return { ...base, arcs }
}

const mod360 = (deg: number): number => ((deg % 360) + 360) % 360

/**
 * Sample a baked LED description into a packed RGB buffer (`segments * 3` bytes, 3 per segment).
 *
 * - `full-ring` (only when the gauge is a ring): segment `i`'s physical angle is `180 + i/segments*360`
 *   degrees (segment 0 at 6 o'clock, clockwise), mapped through the ring geometry to a track position.
 *   Segments outside the swept arc (deadzone) are left off. Non-ring gauges fall back to `simple`.
 * - `simple`: the value is swept across all segments — segment `i` samples track position
 *   `(i + 0.5) / segments`, with segment 0 at the 0% end (the 100% end when `reverse`). Angles are
 *   ignored.
 */
export function sampleLedsToBuffer(
	desc: LedGaugeDescription,
	segments: number,
	mode: 'full-ring' | 'simple'
): Uint8Array {
	const buffer = new Uint8Array(Math.max(0, segments) * 3)
	if (segments <= 0 || desc.arcs.length === 0) return buffer

	const sweep = desc.endAngle - desc.startAngle
	const colorAtPos = (pos: number): number | null => {
		for (const arc of desc.arcs) {
			if (pos >= arc.start - 1e-6 && pos <= arc.end + 1e-6) return arc.color
		}
		return null
	}

	const useRing = mode === 'full-ring' && desc.isRing && sweep > 0
	const posAtFrac = (frac: number): number => (desc.reverse ? 1 - frac : frac) * 100

	for (let i = 0; i < segments; i++) {
		let color: number | null
		if (useRing) {
			// Physical angle of this LED: segment 0 at 6 o'clock (180deg), increasing clockwise.
			const physDeg = 180 + (i / segments) * 360
			const offset = mod360(physDeg - desc.startAngle)
			if (offset > sweep + 1e-6) {
				color = null // deadzone
			} else {
				color = colorAtPos(posAtFrac(offset / sweep))
			}
		} else {
			color = colorAtPos(posAtFrac((i + 0.5) / segments))
		}

		const offset = i * 3
		if (color !== null) {
			buffer[offset] = (color >> 16) & 0xff
			buffer[offset + 1] = (color >> 8) & 0xff
			buffer[offset + 2] = color & 0xff
		}
	}

	return buffer
}
