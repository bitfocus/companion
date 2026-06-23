import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { VariableValue } from '@companion-app/shared/Model/Variables.js'
import { InternalTime } from '../../lib/Internal/Time.js'

type VariableValues = Record<string, VariableValue | undefined>

// InternalTime captures `#startTime` from Date.now() in its constructor and reads `new Date()` in
// updateVariables(). Faking timers (including 'Date') before constructing makes both deterministic.
// It also schedules a 500ms interval that would otherwise outlive the test.
beforeEach(() => {
	vi.useFakeTimers({
		toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date'],
	})
})
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

/** Construct an InternalTime at a fixed wall-clock time and capture its emitted variable values. */
function createTime(now: Date) {
	vi.setSystemTime(now)
	const time = new InternalTime()
	const setVariables = vi.fn<(values: VariableValues) => void>()
	time.on('setVariables', setVariables)
	return { time, setVariables }
}

/** Grab the most recent values object emitted via setVariables. */
function lastValues(setVariables: ReturnType<typeof vi.fn>): VariableValues {
	expect(setVariables).toHaveBeenCalled()
	return setVariables.mock.lastCall![0]
}

describe('InternalTime', () => {
	describe('getVariableDefinitions', () => {
		test('returns the full set of time/date variable definitions', () => {
			const { time } = createTime(new Date('2024-01-01T00:00:00'))

			const defs = time.getVariableDefinitions()
			const names = defs.map((d) => d.name)

			expect(defs).toHaveLength(16)
			expect(names).toEqual([
				'date_iso',
				'date_y',
				'date_m',
				'date_d',
				'date_dow',
				'date_weekday',
				'time_hms',
				'time_hm',
				'time_h',
				'time_m',
				'time_s',
				'time_hms_12',
				'time_hm_12',
				'time_h_12',
				'time_unix',
				'uptime',
			])

			// Every definition should carry a human-readable description
			for (const def of defs) {
				expect(typeof def.description).toBe('string')
				expect(def.description.length).toBeGreaterThan(0)
			}
		})
	})

	describe('updateVariables', () => {
		test('emits zero-padded date and time values for single-digit components', () => {
			// 2024-03-05 09:07:08 local time -> all of month/day/hour/minute/second are single digit
			const { time, setVariables } = createTime(new Date(2024, 2, 5, 9, 7, 8))

			time.updateVariables()

			const values = lastValues(setVariables)
			expect(values).toMatchObject({
				date_iso: '2024-03-05',
				date_y: 2024,
				date_m: '03',
				date_d: '05',
				time_hms: '09:07:08',
				time_hm: '09:07',
				time_h: '09',
				time_m: '07',
				time_s: '08',
			})
		})

		test('emits day-of-week as a number and a unix timestamp in seconds', () => {
			const now = new Date(2024, 2, 5, 9, 7, 8) // a Tuesday
			const { time, setVariables } = createTime(now)

			time.updateVariables()

			const values = lastValues(setVariables)
			expect(values.date_dow).toBe(now.getDay())
			expect(values.date_dow).toBe(2)
			expect(values.time_unix).toBe(Math.floor(now.getTime() / 1000))
		})

		test('converts midnight to 12 in 12-hour format', () => {
			const { time, setVariables } = createTime(new Date(2024, 0, 1, 0, 5, 0))

			time.updateVariables()

			const values = lastValues(setVariables)
			expect(values.time_h_12).toBe('12')
			expect(values.time_hm_12).toBe('12:05')
			expect(values.time_hms_12).toBe('12:05:00')
			// 24-hour value remains zero-padded midnight
			expect(values.time_h).toBe('00')
		})

		test('converts noon to 12 in 12-hour format', () => {
			const { time, setVariables } = createTime(new Date(2024, 0, 1, 12, 0, 0))

			time.updateVariables()

			const values = lastValues(setVariables)
			expect(values.time_h_12).toBe('12')
			expect(values.time_h).toBe('12')
		})

		test('converts afternoon hours to 12-hour format', () => {
			const { time, setVariables } = createTime(new Date(2024, 0, 1, 13, 0, 0))

			time.updateVariables()

			const values = lastValues(setVariables)
			expect(values.time_h_12).toBe('01')
			expect(values.time_h).toBe('13')
		})

		test('reports uptime as whole seconds elapsed since construction', () => {
			const { time, setVariables } = createTime(new Date(2024, 0, 1, 0, 0, 0))

			vi.advanceTimersByTime(5000)
			time.updateVariables()

			expect(lastValues(setVariables).uptime).toBe(5)
		})
	})

	describe('interval', () => {
		test('emits setVariables roughly twice per second via its internal interval', () => {
			const { setVariables } = createTime(new Date(2024, 0, 1, 0, 0, 0))

			expect(setVariables).not.toHaveBeenCalled()

			vi.advanceTimersByTime(500)
			expect(setVariables).toHaveBeenCalledTimes(1)

			vi.advanceTimersByTime(500)
			expect(setVariables).toHaveBeenCalledTimes(2)
		})
	})
})
