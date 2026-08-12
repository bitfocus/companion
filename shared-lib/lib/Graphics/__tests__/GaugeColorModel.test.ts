import { describe, expect, test } from 'vitest'
import type { ButtonGraphicsGaugeDrawElement } from '../../Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '../../Model/StyleModel.js'
import { buildGaugeColorModel } from '../GaugeColorModel.js'

const GREEN = 0x00ff00
const YELLOW = 0xffff00
const RED = 0xff0000

function makeGauge(overrides: Partial<ButtonGraphicsGaugeDrawElement> = {}): ButtonGraphicsGaugeDrawElement {
	return {
		id: 'gauge-1',
		usage: ButtonGraphicsElementUsage.Automatic,
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
		origin: null,
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
		fillWidth: 100,
		stops: [{ value: 0, color: GREEN, gradient: false }],
		markerEnabled: false,
		markerColor: 0xffffff,
		markerWidth: 15,
		trackStyle: 'transparent',
		trackAmount: 0,
		...overrides,
	}
}

describe('buildGaugeColorModel origin handling', () => {
	test('null origin ("auto") grows the fill from the minimum on a positive range', () => {
		const model = buildGaugeColorModel(makeGauge({ min: 0, max: 100, value: 75, origin: null }))!
		expect(model.valuePos).toBe(75)
		expect(model.fillStart).toBe(0)
		expect(model.fillEnd).toBe(75)
	})

	test('null origin ("auto") grows the fill from the minimum on a negative range', () => {
		// The reported bug: a volume gauge -80..0. Value -20 sits 75% along the track and the fill must
		// grow from the minimum (0) to 75 — NOT backwards from 0dB (the maximum) as a hardcoded origin of 0 did.
		const model = buildGaugeColorModel(makeGauge({ min: -80, max: 0, value: -20, origin: null }))!
		expect(model.valuePos).toBe(75)
		expect(model.fillStart).toBe(0)
		expect(model.fillEnd).toBe(75)
	})

	test('null origin on a negative range behaves identically to the equivalent positive range', () => {
		const neg = buildGaugeColorModel(
			makeGauge({
				min: -80,
				max: 0,
				value: -20,
				origin: null,
				stops: [
					{ value: -80, color: GREEN, gradient: false },
					{ value: -40, color: GREEN, gradient: false },
					{ value: -15, color: YELLOW, gradient: false },
					{ value: -5, color: RED, gradient: false },
				],
			})
		)!
		const pos = buildGaugeColorModel(
			makeGauge({
				min: 0,
				max: 100,
				value: 75,
				origin: null,
				stops: [
					{ value: 0, color: GREEN, gradient: false },
					{ value: 60, color: GREEN, gradient: false },
					{ value: 85, color: YELLOW, gradient: false },
					{ value: 95, color: RED, gradient: false },
				],
			})
		)!
		// The fill grows from the minimum in both cases, and the value sits at the same 75% position.
		expect(neg.fillStart).toBe(pos.fillStart)
		expect(neg.fillEnd).toBe(pos.fillEnd)
		expect(neg.valuePos).toBe(pos.valuePos)
		// The thresholds -40/-15/-5 normalise to the loud end of the track (50/81.25/93.75%), not backwards.
		expect(neg.runs.map((r) => r.start)).toEqual([0, 50, 81.25, 93.75])
	})

	test('an explicit numeric origin of 0 still anchors the fill at that value (bipolar/pan behaviour)', () => {
		// On -80..0, origin 0 is the maximum end, so the fill is the band between the value and that end.
		const model = buildGaugeColorModel(makeGauge({ min: -80, max: 0, value: -20, origin: 0 }))!
		expect(model.fillStart).toBe(75)
		expect(model.fillEnd).toBe(100)
	})

	test('an explicit midpoint origin fills toward the value (pan)', () => {
		const model = buildGaugeColorModel(makeGauge({ min: 0, max: 100, value: 75, origin: 50 }))!
		expect(model.fillStart).toBe(50)
		expect(model.fillEnd).toBe(75)
	})
})

describe('buildGaugeColorModel stop color parsing', () => {
	test('css color string stops parse to the same runs/fill as the numeric equivalent', () => {
		const css = buildGaugeColorModel(
			makeGauge({
				value: 90,
				multiColour: true,
				stops: [
					{ value: 0, color: '#00ff00', gradient: false },
					{ value: 66, color: 'rgb(255, 255, 0)', gradient: false },
					{ value: 85, color: '#ff0000', gradient: false },
				],
			})
		)!
		const numeric = buildGaugeColorModel(
			makeGauge({
				value: 90,
				multiColour: true,
				stops: [
					{ value: 0, color: GREEN, gradient: false },
					{ value: 66, color: YELLOW, gradient: false },
					{ value: 85, color: RED, gradient: false },
				],
			})
		)!
		expect(css.runs.map((r) => r.colorStart)).toEqual(numeric.runs.map((r) => r.colorStart))
		expect(css.singleColor).toBe(RED)
		expect(css.singleColor).toBe(numeric.singleColor)
	})

	test('shorthand hex css strings are accepted', () => {
		const model = buildGaugeColorModel(makeGauge({ value: 0, stops: [{ value: 0, color: '#fff', gradient: false }] }))!
		expect(model.singleColor).toBe(0xffffff)
	})

	test('an invalid color string falls back to black rather than NaN', () => {
		const model = buildGaugeColorModel(
			makeGauge({ value: 0, stops: [{ value: 0, color: 'not-a-color', gradient: false }] })
		)!
		expect(model.singleColor).toBe(0)
	})
})
