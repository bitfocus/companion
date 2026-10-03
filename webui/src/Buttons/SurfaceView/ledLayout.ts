import { sampleLedsToBuffer, type LedGaugeDescription } from '@companion-app/shared/Graphics/GaugeLeds.js'
import type { SurfaceSchemaLedsConfig } from '@companion-app/shared/Model/Surfaces.js'

/**
 * A control's leds, laid out to draw.
 *
 * In the units of `viewBox`, where the control itself is the box from 0 to 100 - so a ring can sit outside it.
 */
export type LedLayout =
	| {
			type: 'ring'
			viewBox: string
			/** Radius of the middle of the ring, and how thick it is */
			radius: number
			width: number
			/** One arc per led, as an svg path along the ring */
			segments: { path: string; color: string | null }[]
	  }
	| {
			type: 'strip'
			viewBox: string
			segments: { x: number; y: number; width: number; height: number; color: string | null }[]
	  }

/** The gap between the control's edge and the ring, and the ring's thickness, as a fraction of the control */
const RING_GAP = 3
const RING_WIDTH = 7

/** How far beyond the control the drawing reaches, so the ring fits; SurfaceCanvas.css insets the svg to match */
export const LED_RING_OVERHANG = 12

/** The gap between neighbouring leds: enough to tell them apart, not so much that the ring reads as dots */
const SEGMENT_GAP_DEGREES = 1
const STRIP_GAP = 1

/**
 * Lay out a control's leds, lit the way the surface would light them.
 *
 * Sampled with the same `sampleLedsToBuffer` the surface is driven with, so each segment is the colour the device
 * shows for it. A ring goes around the outside of the control, with segment 0 at six o'clock running clockwise as
 * the panel numbers them; a simple strip runs left to right across the bottom of it.
 */
export function layoutLeds(config: SurfaceSchemaLedsConfig, leds: LedGaugeDescription | null): LedLayout {
	const count = Math.max(0, config.segments)
	const buffer = leds ? sampleLedsToBuffer(leds, count, config.mode) : null

	const colorAt = (index: number): string | null => {
		if (!buffer) return null

		const r = buffer[index * 3]
		const g = buffer[index * 3 + 1]
		const b = buffer[index * 3 + 2]
		return r || g || b ? `rgb(${r}, ${g}, ${b})` : null
	}

	if (config.mode === 'full-ring') {
		const radius = 50 + RING_GAP + RING_WIDTH / 2
		const span = 360 / Math.max(1, count)
		const gap = Math.min(SEGMENT_GAP_DEGREES, span / 2)

		const segments = Array.from({ length: count }, (_, index) => {
			// Gauge degrees: 0 at the top, clockwise
			const centre = 180 + index * span
			return { path: arcPath(radius, centre - span / 2 + gap / 2, centre + span / 2 - gap / 2), color: colorAt(index) }
		})

		const extent = 100 + LED_RING_OVERHANG * 2
		return {
			type: 'ring',
			viewBox: `${-LED_RING_OVERHANG} ${-LED_RING_OVERHANG} ${extent} ${extent}`,
			radius,
			width: RING_WIDTH,
			segments,
		}
	}

	const width = 100 / Math.max(1, count)
	const segments = Array.from({ length: count }, (_, index) => ({
		x: index * width + STRIP_GAP / 2,
		y: 92,
		width: Math.max(0, width - STRIP_GAP),
		height: 6,
		color: colorAt(index),
	}))

	return { type: 'strip', viewBox: '0 0 100 100', segments }
}

/** An svg arc around the control's centre, between two gauge angles (0 at the top, clockwise) */
function arcPath(radius: number, fromDegrees: number, toDegrees: number): string {
	const point = (degrees: number) => {
		const radians = (degrees * Math.PI) / 180
		return `${round(50 + radius * Math.sin(radians))} ${round(50 - radius * Math.cos(radians))}`
	}
	const largeArc = toDegrees - fromDegrees > 180 ? 1 : 0

	return `M ${point(fromDegrees)} A ${radius} ${radius} 0 ${largeArc} 1 ${point(toDegrees)}`
}

function round(value: number): number {
	return Math.round(value * 1000) / 1000
}
