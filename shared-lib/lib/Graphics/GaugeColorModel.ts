import type { ButtonGraphicsGaugeDrawElement } from '../Model/StyleLayersModel.js'
import { rgbRev } from './Util.js'

export interface GaugeRGBA {
	r: number
	g: number
	b: number
	a: number
}

/**
 * A contiguous run of the track between two color stops, in 0–100 track-position space.
 * `gradient` runs interpolate from `colorStart` to `colorEnd`; solid runs use `colorStart` throughout.
 */
export interface GaugeColorRun {
	start: number
	end: number
	colorStart: number
	colorEnd: number
	gradient: boolean
}

/**
 * The parts of a gauge that are expensive/fiddly to compute and must be identical between the on-screen
 * pixel renderer (`GraphicsLayeredButtonRenderer`) and the LED baker (`bakeGaugeToLeds`): the fill
 * interval, the color runs and the fill color. Everything works in 0–100 "track-position" space
 * (0 = the min/start end, 100 = the max/end); the caller maps that onto its own pixels or LED segments.
 *
 * Trivial per-element flags (`symmetric`, `trackStyle`, `multiColour`, geometry, …) are intentionally
 * NOT here — each caller reads those straight off the element.
 */
export interface GaugeColorModel {
	/** Where the current value sits on the 0–100 track. */
	valuePos: number
	/**
	 * The filled ("lit") interval on the 0–100 track. Normally `[0, value]`, but for centre-bar / pan /
	 * symmetric (stereo-width) gauges the fill is a band anywhere on the track, so it needs both ends.
	 */
	fillStart: number
	fillEnd: number
	/** Whether any fill is drawn (fill enabled and the interval is non-empty). */
	hasFill: boolean
	/** Dimming for the unfilled track (0 = off … 1 = full color). Shared so pixels and LEDs dim alike. */
	trackAmount: number
	/** The color stops resolved into contiguous runs tiling the whole 0–100 track. */
	runs: GaugeColorRun[]
	/** Fill color when the gauge is single-color: the highest stop at or below the value. */
	singleColor: number
	/** Color of a run at track position `p` (interpolates gradient runs). */
	rgbaAt: (run: GaugeColorRun, p: number) => GaugeRGBA
}

const finite = (v: unknown, fallback: number): number => {
	const n = Number(v)
	return Number.isFinite(n) ? n : fallback
}

/**
 * Resolve a gauge's value + color stops into the shared {@link GaugeColorModel}. Returns `null` when
 * there is nothing to draw (no color stops / no runs), matching the renderer's early-out.
 */
export function buildGaugeColorModel(element: ButtonGraphicsGaugeDrawElement): GaugeColorModel | null {
	// --- Value mapping (authored Min..Max domain → 0–100 track position) ---
	const min = finite(element.min, 0)
	const max = finite(element.max, 100)
	const range = max - min
	const norm = (v: number): number => {
		if (range === 0) return 0
		return Math.max(0, Math.min(100, ((v - min) / range) * 100))
	}

	const valuePos = norm(finite(element.value, 0))
	const originPos = norm(finite(element.origin, min))

	// Active fill interval in track-position space (0–100).
	// Non-symmetric: from the origin toward the value (handles normal bars, centre-bar, pan).
	// Symmetric: a band of length = value, centred on the origin (handles stereo-width).
	let fillStart: number
	let fillEnd: number
	if (element.symmetric) {
		const half = valuePos / 2
		fillStart = Math.max(0, Math.min(100, originPos - half))
		fillEnd = Math.max(0, Math.min(100, originPos + half))
	} else {
		fillStart = Math.min(originPos, valuePos)
		fillEnd = Math.max(originPos, valuePos)
	}
	const hasFill = element.fillEnabled && fillEnd > fillStart

	const trackAmount = Math.max(0, Math.min(100, finite(element.trackAmount, 0))) / 100

	// --- Color stops → runs between consecutive stops, with the first anchored to position 0
	//     and the last extended to 100 so the track never has an uncolored gap. ---
	const stops = [...element.stops]
		.map((s) => ({ pos: norm(finite(s.value, 0)), color: finite(s.color, 0), gradient: !!s.gradient }))
		.sort((a, b) => a.pos - b.pos)
	if (stops.length === 0) return null

	const runs: GaugeColorRun[] = []
	for (let i = 0; i < stops.length; i++) {
		const start = i === 0 ? 0 : stops[i].pos
		const end = i + 1 < stops.length ? stops[i + 1].pos : 100
		if (end <= start) continue
		const gradient = stops[i].gradient && i + 1 < stops.length
		runs.push({
			start,
			end,
			colorStart: stops[i].color,
			colorEnd: gradient ? stops[i + 1].color : stops[i].color,
			gradient,
		})
	}
	if (runs.length === 0) return null

	// Single-color fill: color of the highest stop whose position <= value.
	let singleColor = stops[0].color
	for (const s of stops) if (s.pos <= valuePos) singleColor = s.color

	const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
	const rgbaAt = (run: GaugeColorRun, p: number): GaugeRGBA => {
		const c0 = rgbRev(run.colorStart, true)
		if (!run.gradient) return c0
		const c1 = rgbRev(run.colorEnd, true)
		const span = run.end - run.start
		const t = span > 0 ? Math.max(0, Math.min(1, (p - run.start) / span)) : 0
		return { r: lerp(c0.r, c1.r, t), g: lerp(c0.g, c1.g, t), b: lerp(c0.b, c1.b, t), a: lerp(c0.a, c1.a, t) }
	}

	return { valuePos, fillStart, fillEnd, hasFill, trackAmount, runs, singleColor, rgbaAt }
}
