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
		expect(desc.arcs.length).toBeGreaterThan(0)
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

	test('zero segments yields an empty buffer', () => {
		const desc = bakeGaugeToLeds(makeGauge({ orientation: 'ring' }))
		expect(sampleLedsToBuffer(desc, 0, 'full-ring')).toHaveLength(0)
	})
})
