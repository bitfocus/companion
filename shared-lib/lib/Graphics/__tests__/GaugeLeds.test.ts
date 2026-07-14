import { describe, expect, test } from 'vitest'
import type { ButtonGraphicsGaugeDrawElement } from '../../Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '../../Model/StyleModel.js'
import { bakeGaugeToLeds, sampleLedsToBuffer } from '../GaugeLeds.js'

const GREEN = 0x00ff00

function makeGauge(overrides: Partial<ButtonGraphicsGaugeDrawElement> = {}): ButtonGraphicsGaugeDrawElement {
	return {
		id: 'gauge-1',
		usage: ButtonGraphicsElementUsage.Leds,
		enabled: true,
		opacity: 100,
		contentHash: '',
		type: 'gauge',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		value: 50,
		min: 0,
		max: 100,
		origin: 0,
		symmetric: false,
		orientation: 'horizontal',
		reverse: false,
		trackWidth: 100,
		startAngle: 0,
		endAngle: 360,
		ringWidth: 20,
		roundedEnds: false,
		fillEnabled: true,
		multiColour: false,
		// Single green stop → the whole track is green; fill vs track distinguished by brightness.
		stops: [{ value: 0, color: GREEN, gradient: false }],
		markerEnabled: false,
		markerColor: 0xffffff,
		markerWidth: 15,
		trackStyle: 'transparent',
		trackAmount: 0,
		...overrides,
	}
}

/** Read segment `i` as an [r,g,b] tuple. */
function seg(buffer: Uint8Array, i: number): [number, number, number] {
	return [buffer[i * 3], buffer[i * 3 + 1], buffer[i * 3 + 2]]
}

describe('bakeGaugeToLeds', () => {
	test('captures ring geometry and single-colour fill/track', () => {
		const desc = bakeGaugeToLeds(makeGauge({ value: 50, orientation: 'ring', startAngle: 10, endAngle: 190 }))
		expect(desc.isRing).toBe(true)
		expect(desc.startAngle).toBe(10)
		expect(desc.endAngle).toBe(190) // 10 + sweep(180)
		expect(desc.reverse).toBe(false)
		// Fill (0..50) is bright green; track (50..100) is off (trackAmount 0).
		expect(desc.arcs).toEqual([
			{ start: 0, end: 50, color: GREEN },
			{ start: 50, end: 100, color: 0 },
		])
	})

	test('a dimmed track is the fill colour scaled by trackAmount', () => {
		const desc = bakeGaugeToLeds(makeGauge({ value: 50, trackAmount: 40 }))
		expect(desc.arcs).toEqual([
			{ start: 0, end: 50, color: GREEN },
			{ start: 50, end: 100, color: 0x006600 }, // 255 * 0.4 = 102 = 0x66
		])
	})

	test('reverse is carried through to the description', () => {
		expect(bakeGaugeToLeds(makeGauge({ reverse: true })).reverse).toBe(true)
	})

	test('empty stops produce no arcs', () => {
		const desc = bakeGaugeToLeds(makeGauge({ stops: [] }))
		expect(desc.arcs).toHaveLength(0)
	})
})

describe('sampleLedsToBuffer - simple mode', () => {
	test('sweeps the fill from segment 0, leaving the rest off', () => {
		const desc = bakeGaugeToLeds(makeGauge({ value: 50, trackAmount: 0 }))
		const buffer = sampleLedsToBuffer(desc, 10, 'simple')

		expect(buffer).toHaveLength(30)
		// Segments 0..4 sample positions 5,15,25,35,45 (<=50) → filled green.
		for (let i = 0; i < 5; i++) expect(seg(buffer, i)).toEqual([0, 255, 0])
		// Segments 5..9 sample 55..95 (>50) → track, dimmed to off.
		for (let i = 5; i < 10; i++) expect(seg(buffer, i)).toEqual([0, 0, 0])
	})

	test('reverse sweeps the fill in from the last segment', () => {
		const desc = bakeGaugeToLeds(makeGauge({ value: 50, reverse: true, trackAmount: 0 }))
		const buffer = sampleLedsToBuffer(desc, 10, 'simple')

		// Segment i samples 100 - (i + 0.5) * 10, so the fill (<=50) now lands on the far half.
		for (let i = 0; i < 5; i++) expect(seg(buffer, i)).toEqual([0, 0, 0])
		for (let i = 5; i < 10; i++) expect(seg(buffer, i)).toEqual([0, 255, 0])
	})

	test('non-ring gauge under full-ring mode falls back to simple', () => {
		const desc = bakeGaugeToLeds(makeGauge({ value: 50, orientation: 'horizontal', trackAmount: 0 }))
		const asSimple = sampleLedsToBuffer(desc, 10, 'simple')
		const asFullRing = sampleLedsToBuffer(desc, 10, 'full-ring')
		expect(Array.from(asFullRing)).toEqual(Array.from(asSimple))
	})
})

describe('sampleLedsToBuffer - full-ring mode', () => {
	test('a full circle lights every segment (no deadzone)', () => {
		const desc = bakeGaugeToLeds(
			makeGauge({ value: 100, orientation: 'ring', startAngle: 0, endAngle: 360, trackAmount: 100 })
		)
		const buffer = sampleLedsToBuffer(desc, 8, 'full-ring')
		for (let i = 0; i < 8; i++) expect(seg(buffer, i)).toEqual([0, 255, 0])
	})

	test('a half ring leaves deadzone segments off', () => {
		// sweep 0..180deg. Segment i physical angle = 180 + i*90 (6 o'clock, clockwise).
		// i0=180 (in), i1=270 (deadzone), i2=360→0 (in), i3=450→90 (in).
		const desc = bakeGaugeToLeds(
			makeGauge({ value: 100, orientation: 'ring', startAngle: 0, endAngle: 180, trackAmount: 100 })
		)
		const buffer = sampleLedsToBuffer(desc, 4, 'full-ring')
		expect(seg(buffer, 0)).toEqual([0, 255, 0])
		expect(seg(buffer, 1)).toEqual([0, 0, 0]) // deadzone
		expect(seg(buffer, 2)).toEqual([0, 255, 0])
		expect(seg(buffer, 3)).toEqual([0, 255, 0])
	})

	test('reverse flips which end of the swept arc the fill grows from', () => {
		// Sweep 0..180deg over 8 segments; segment i physical angle = 180 + i*45 (6 o'clock, clockwise),
		// so i1..i3 are the deadzone and the remainder land at track offsets 180,0,45,90,135 degrees.
		// Fill is 0..60, so the three segments nearest the p=0 end are lit.
		const gauge = { value: 60, orientation: 'ring', startAngle: 0, endAngle: 180, trackAmount: 0 } as const
		const forward = sampleLedsToBuffer(bakeGaugeToLeds(makeGauge(gauge)), 8, 'full-ring')
		const reversed = sampleLedsToBuffer(bakeGaugeToLeds(makeGauge({ ...gauge, reverse: true })), 8, 'full-ring')

		const lit = (buffer: Uint8Array): boolean[] =>
			Array.from({ length: 8 }, (_, i) => seg(buffer, i).some((c) => c > 0))

		// p=0 is at the arc's end (i4), so the fill runs i4 → i6.
		expect(lit(forward)).toEqual([false, false, false, false, true, true, true, false])
		// Reversed, p=0 is at the arc's start (i0), so the fill runs back from i0 → i6.
		expect(lit(reversed)).toEqual([true, false, false, false, false, false, true, true])
	})

	test('zero segments yields an empty buffer', () => {
		const desc = bakeGaugeToLeds(makeGauge({ orientation: 'ring' }))
		expect(sampleLedsToBuffer(desc, 0, 'full-ring')).toHaveLength(0)
	})
})
