import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { CompanionOptionValues } from '@companion-module/host'
import { TriggersEventTimer } from '../../../lib/Controls/ControlTypes/Triggers/Events/Timer.js'
import { TriggerExecutionSource } from '../../../lib/Controls/ControlTypes/Triggers/TriggerExecutionSource.js'
import type { DataUserConfig } from '../../../lib/Data/UserConfig.js'
import { mockUserConfig } from '../../utils/MockUserConfig.js'
import { MockTriggerEventBus } from './Helpers.js'

function createTimer(lastTick = 100, userconfig: DataUserConfig = mockUserConfig({ timezone: '' })) {
	const bus = new MockTriggerEventBus()
	bus.setLastTickTime(lastTick)
	const executeActions = vi.fn()
	const timer = new TriggersEventTimer(userconfig, bus.asTriggerEvents(), 'trigger:test', executeActions)
	return { bus, timer, executeActions }
}

function makeEvent(options: CompanionOptionValues): EventInstance {
	return { id: 'event01', type: 'unused', enabled: true, options }
}

describe('TriggersEventTimer', () => {
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date'],
		})
	})
	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	describe('interval events', () => {
		function tick(bus: MockTriggerEventBus, tickSeconds: number) {
			bus.emitTick(tickSeconds, tickSeconds * 1000)
			vi.runAllTimers()
		}

		test('fires once the period has elapsed', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 5) // baseline is lastTick + 1 = 101

			tick(bus, 105)
			expect(executeActions).not.toHaveBeenCalled()

			tick(bus, 106)
			expect(executeActions).toHaveBeenCalledTimes(1)
			expect(executeActions).toHaveBeenCalledWith(106000, TriggerExecutionSource.Other)

			// next firing is rebased from the last execution
			tick(bus, 110)
			expect(executeActions).toHaveBeenCalledTimes(1)
			tick(bus, 111)
			expect(executeActions).toHaveBeenCalledTimes(2)
		})

		test('fires when a tick overshoots the deadline', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 5)

			tick(bus, 250)
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('does not fire when disabled', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setInterval('a', 5)

			tick(bus, 200)
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('enabling rebases the interval from the next tick', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setInterval('a', 5)

			tick(bus, 120)
			expect(executeActions).not.toHaveBeenCalled()

			timer.setEnabled(true) // baseline becomes 121

			tick(bus, 125)
			expect(executeActions).not.toHaveBeenCalled()
			tick(bus, 126)
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('setEnabled when already enabled does not rebase', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 5)

			tick(bus, 103)
			timer.setEnabled(true)

			tick(bus, 106)
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('a period of zero or less is ignored', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 0)
			timer.setInterval('b', -5)

			tick(bus, 100000)
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('clearInterval stops the event', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 5)
			timer.clearInterval('a')

			tick(bus, 200)
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('replacing an interval with the same id discards the old one', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 2)
			timer.setInterval('a', 50)

			tick(bus, 110)
			expect(executeActions).not.toHaveBeenCalled()
			tick(bus, 151)
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('multiple intervals due on the same tick execute the actions once', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 2)
			timer.setInterval('b', 3)

			tick(bus, 106)
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('destroy stops listening to ticks', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 5)
			timer.destroy()

			tick(bus, 200)
			expect(executeActions).not.toHaveBeenCalled()
		})
	})

	describe('random interval events', () => {
		function tick(bus: MockTriggerEventBus, tickSeconds: number) {
			bus.emitTick(tickSeconds, tickSeconds * 1000)
			vi.runAllTimers()
		}

		test('period is recalculated within [min, max] after each execution', () => {
			const random = vi.spyOn(Math, 'random').mockReturnValue(0)

			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 3, 7) // random=0 -> period 3, baseline 101

			// Next recalculation should pick the maximum
			random.mockReturnValue(0.999999)

			tick(bus, 103)
			expect(executeActions).not.toHaveBeenCalled()
			tick(bus, 104)
			expect(executeActions).toHaveBeenCalledTimes(1)

			// period is now 7, rebased from tick 104
			tick(bus, 110)
			expect(executeActions).toHaveBeenCalledTimes(1)
			tick(bus, 111)
			expect(executeActions).toHaveBeenCalledTimes(2)
		})

		test('maximum less than minimum never fires', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 5, 3)

			tick(bus, 100000)
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('minimum of zero or less never fires', () => {
			const { bus, timer, executeActions } = createTimer(100)
			timer.setEnabled(true)
			timer.setInterval('a', 0, 5)
			timer.setInterval('b', -2, 5)

			tick(bus, 100000)
			expect(executeActions).not.toHaveBeenCalled()
		})
	})

	describe('time of day events', () => {
		// June 8 2026 is a Monday
		function tickAt(bus: MockTriggerEventBus, time: Date) {
			vi.setSystemTime(time)
			bus.emitTick(bus.getLastTickTime() + 1, time.getTime())
			vi.runAllTimers()
		}

		test('fires at the scheduled time on a matching day', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0, 500)) // Monday 10:00:00.5
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setTimeOfDay('a', { time: '11:00:00', days: [1] })

			tickAt(bus, new Date(2026, 5, 8, 10, 59, 59, 500))
			expect(executeActions).not.toHaveBeenCalled()

			tickAt(bus, new Date(2026, 5, 8, 11, 0, 0, 500))
			expect(executeActions).toHaveBeenCalledTimes(1)

			// Does not fire again until the next matching day
			tickAt(bus, new Date(2026, 5, 8, 11, 0, 1, 500))
			expect(executeActions).toHaveBeenCalledTimes(1)

			// Sunday June 14 does not match
			tickAt(bus, new Date(2026, 5, 14, 11, 0, 0, 500))
			expect(executeActions).toHaveBeenCalledTimes(1)

			// Monday June 15 does
			tickAt(bus, new Date(2026, 5, 15, 11, 0, 0, 500))
			expect(executeActions).toHaveBeenCalledTimes(2)
		})

		test('skips forward to the next matching day in the same week', () => {
			vi.setSystemTime(new Date(2026, 5, 10, 10, 0, 0, 500)) // Wednesday
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setTimeOfDay('a', { time: '11:00:00', days: [1, 5] }) // Monday & Friday

			// Thursday is not a match
			tickAt(bus, new Date(2026, 5, 11, 11, 30, 0, 500))
			expect(executeActions).not.toHaveBeenCalled()

			// Friday June 12 is
			tickAt(bus, new Date(2026, 5, 12, 11, 0, 0, 500))
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('wraps to next week when the day has already passed', () => {
			vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0, 500)) // Wednesday, after 11:00
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setTimeOfDay('a', { time: '11:00:00', days: [1] }) // Mondays only

			tickAt(bus, new Date(2026, 5, 15, 10, 59, 59, 500))
			expect(executeActions).not.toHaveBeenCalled()

			tickAt(bus, new Date(2026, 5, 15, 11, 0, 0, 500)) // Monday June 15
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('wraps across a year boundary', () => {
			vi.setSystemTime(new Date(2026, 11, 31, 13, 0, 0, 500)) // Thursday Dec 31, after 12:00
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setTimeOfDay('a', { time: '12:00:00', days: [5] }) // Fridays only

			tickAt(bus, new Date(2026, 11, 31, 23, 59, 59, 500))
			expect(executeActions).not.toHaveBeenCalled()

			tickAt(bus, new Date(2027, 0, 1, 12, 0, 0, 500)) // Friday Jan 1 2027
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('invalid configurations never fire', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0, 500))
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setTimeOfDay('a', { time: '9:00:00', days: [1] }) // hour must be 2 digits
			timer.setTimeOfDay('b', { time: '25:00:00', days: [1] }) // invalid hour
			timer.setTimeOfDay('c', { time: '11:00:00', days: [] }) // no days
			timer.setTimeOfDay('d', { time: 11, days: [1] }) // not a string

			tickAt(bus, new Date(2026, 6, 8, 10, 0, 0, 500)) // a month later
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('does not fire when disabled', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0, 500))
			const { bus, timer, executeActions } = createTimer()
			timer.setTimeOfDay('a', { time: '11:00:00', days: [1] })

			tickAt(bus, new Date(2026, 5, 8, 11, 0, 0, 500))
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('clearTimeOfDay stops the event', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0, 500))
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setTimeOfDay('a', { time: '11:00:00', days: [1] })
			timer.clearTimeOfDay('a')

			tickAt(bus, new Date(2026, 5, 8, 11, 0, 0, 500))
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('the configured timezone determines the firing instant (independent of host timezone)', () => {
			// The same wall-clock time (11:00 Monday) fires at two different UTC instants depending on the
			// configured zone. A system-timezone implementation can only ever fire at one instant, so it
			// must fail one of these assertions on ANY host (including a New York CI runner).
			vi.setSystemTime(new Date('2026-06-08T00:00:00Z'))
			const tokyo = createTimer(100, mockUserConfig({ timezone: 'Asia/Tokyo' })) // UTC+9 -> 11:00 == 02:00Z
			const ny = createTimer(100, mockUserConfig({ timezone: 'America/New_York' })) // UTC-4 -> 11:00 == 15:00Z
			tokyo.timer.setEnabled(true)
			ny.timer.setEnabled(true)
			tokyo.timer.setTimeOfDay('a', { time: '11:00:00', days: [1] })
			ny.timer.setTimeOfDay('a', { time: '11:00:00', days: [1] })

			// At 02:00Z only the Tokyo-configured timer is due
			tickAt(tokyo.bus, new Date('2026-06-08T02:00:00Z'))
			tickAt(ny.bus, new Date('2026-06-08T02:00:00Z'))
			expect(tokyo.executeActions).toHaveBeenCalledTimes(1)
			expect(ny.executeActions).not.toHaveBeenCalled()

			// At 15:00Z the New York-configured timer becomes due
			tickAt(ny.bus, new Date('2026-06-08T15:00:00Z'))
			expect(ny.executeActions).toHaveBeenCalledTimes(1)
		})

		test('recomputes the next execute time when the timezone changes', () => {
			// Configured for Tokyo, the event is due at 02:00Z. Switching to New York must move it to 15:00Z.
			// Comparing two explicit zones (not the host) means this catches a missing recompute on any host.
			const config = { timezone: 'Asia/Tokyo' }
			vi.setSystemTime(new Date('2026-06-08T00:00:00Z'))
			const { bus, timer, executeActions } = createTimer(100, mockUserConfig(config))
			timer.setEnabled(true)
			timer.setTimeOfDay('a', { time: '11:00:00', days: [1] }) // 11:00 Tokyo == 02:00Z initially

			// Switch to New York before the Tokyo instant arrives
			config.timezone = 'America/New_York'

			// The tick recomputes for New York, so the Tokyo instant (02:00Z) no longer fires
			tickAt(bus, new Date('2026-06-08T02:00:00Z'))
			expect(executeActions).not.toHaveBeenCalled()

			// 11:00 New York == 15:00Z
			tickAt(bus, new Date('2026-06-08T15:00:00Z'))
			expect(executeActions).toHaveBeenCalledTimes(1)
		})
	})

	describe('specific date events', () => {
		function tickAt(bus: MockTriggerEventBus, time: Date) {
			vi.setSystemTime(time)
			bus.emitTick(bus.getLastTickTime() + 1, time.getTime())
			vi.runAllTimers()
		}

		test('fires once at the configured date and time', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0, 500))
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setSpecificDate('a', { date: '2026-06-09', time: '12:00:00' })

			tickAt(bus, new Date(2026, 5, 9, 11, 59, 59, 500))
			expect(executeActions).not.toHaveBeenCalled()

			tickAt(bus, new Date(2026, 5, 9, 12, 0, 0, 500))
			expect(executeActions).toHaveBeenCalledTimes(1)

			// Once fired, it never fires again
			tickAt(bus, new Date(2026, 5, 9, 12, 0, 1, 500))
			tickAt(bus, new Date(2027, 5, 9, 12, 0, 0, 500))
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('a date in the past never fires', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0, 500))
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setSpecificDate('a', { date: '2026-06-01', time: '12:00:00' })

			tickAt(bus, new Date(2027, 5, 8, 10, 0, 0, 500))
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('missing date or time never fires', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0, 500))
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setSpecificDate('a', { date: '2026-06-09' })
			timer.setSpecificDate('b', { time: '12:00:00' })

			tickAt(bus, new Date(2027, 5, 8, 10, 0, 0, 500))
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('an out-of-range time never fires (and is not normalized into a valid instant)', () => {
			// '25:70' must be rejected outright. A lenient parser would let zonedTimeToUtc normalize it
			// (25:70 -> next day 02:10) and schedule at an unexpected instant, so assert it never fires
			// across the whole window where a normalized value could have landed.
			vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0, 500))
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setSpecificDate('a', { date: '2026-06-09', time: '25:70' })

			tickAt(bus, new Date(2026, 5, 9, 12, 0, 0, 500))
			tickAt(bus, new Date(2026, 5, 10, 2, 10, 0, 500)) // where 25:70 would normalize to
			tickAt(bus, new Date(2026, 5, 11, 2, 10, 0, 500))
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('clearSpecificDate stops the event', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0, 500))
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setSpecificDate('a', { date: '2026-06-09', time: '12:00:00' })
			timer.clearSpecificDate('a')

			tickAt(bus, new Date(2026, 5, 9, 12, 0, 0, 500))
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('interprets the configured date and time in the configured timezone (independent of host)', () => {
			// 12:00 on 2026-06-09 fires at two different UTC instants depending on the configured zone, so a
			// system-timezone implementation must fail one of these assertions on any host.
			vi.setSystemTime(new Date('2026-06-08T00:00:00Z'))
			const tokyo = createTimer(100, mockUserConfig({ timezone: 'Asia/Tokyo' })) // UTC+9 -> 12:00 == 03:00Z
			const ny = createTimer(100, mockUserConfig({ timezone: 'America/New_York' })) // UTC-4 -> 12:00 == 16:00Z
			tokyo.timer.setEnabled(true)
			ny.timer.setEnabled(true)
			tokyo.timer.setSpecificDate('a', { date: '2026-06-09', time: '12:00:00' })
			ny.timer.setSpecificDate('a', { date: '2026-06-09', time: '12:00:00' })

			// At 03:00Z only the Tokyo-configured timer is due
			tickAt(tokyo.bus, new Date('2026-06-09T03:00:00Z'))
			tickAt(ny.bus, new Date('2026-06-09T03:00:00Z'))
			expect(tokyo.executeActions).toHaveBeenCalledTimes(1)
			expect(ny.executeActions).not.toHaveBeenCalled()

			// At 16:00Z the New York-configured timer becomes due
			tickAt(ny.bus, new Date('2026-06-09T16:00:00Z'))
			expect(ny.executeActions).toHaveBeenCalledTimes(1)
		})
	})

	describe('sun events', () => {
		const LONDON = { latitude: 51.5, longitude: -0.1 }

		/** Probe whether a fresh sun event would fire for a tick at the given wall time */
		function wouldFireAt(params: CompanionOptionValues, nowTime: number): boolean {
			const bus = new MockTriggerEventBus()
			const executeActions = vi.fn()
			const timer = new TriggersEventTimer(
				mockUserConfig({ timezone: '' }),
				bus.asTriggerEvents(),
				'trigger:probe',
				executeActions
			)
			timer.setEnabled(true)
			timer.setSun('a', params)
			bus.emitTick(1, nowTime)
			vi.runAllTimers()
			timer.destroy()
			return executeActions.mock.calls.length > 0
		}

		/** Binary search for the exact ms timestamp at which the sun event starts firing */
		function findExecuteTime(params: CompanionOptionValues): number {
			let lo = Date.now()
			let hi = lo + 50 * 3600 * 1000
			expect(wouldFireAt(params, lo)).toBe(false)
			expect(wouldFireAt(params, hi)).toBe(true)
			while (lo + 1 < hi) {
				const mid = Math.floor((lo + hi) / 2)
				if (wouldFireAt(params, mid)) {
					hi = mid
				} else {
					lo = mid
				}
			}
			return hi
		}

		test('schedules sunset within the next day, and not immediately', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 0, 30, 0, 0))
			const executeTime = findExecuteTime({ type: 'sunset', ...LONDON, offset: 0 })

			expect(executeTime).toBeGreaterThan(Date.now())
			expect(executeTime).toBeLessThan(Date.now() + 26 * 3600 * 1000)
		})

		test('sunrise and sunset are distinct times', () => {
			// Note: the absolute times produced depend on the host timezone, so only
			// relative properties can be asserted here
			vi.setSystemTime(new Date(2026, 5, 8, 0, 30, 0, 0))
			const sunrise = findExecuteTime({ type: 'sunrise', ...LONDON, offset: 0 })
			const sunset = findExecuteTime({ type: 'sunset', ...LONDON, offset: 0 })

			expect(sunrise).not.toBe(sunset)
			// For London in June, the gap between the two events is many hours, whichever order they fall in
			expect(Math.abs(sunset - sunrise)).toBeGreaterThan(4 * 3600 * 1000)
		})

		test('offset shifts the execute time by exactly that many minutes', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 0, 30, 0, 0))
			const base = findExecuteTime({ type: 'sunset', ...LONDON, offset: 0 })
			const shifted = findExecuteTime({ type: 'sunset', ...LONDON, offset: 30 })

			expect(shifted - base).toBe(30 * 60 * 1000)
		})

		test('invalid coordinates do not throw, and still schedule a (meaningless) time', () => {
			// The NaN propagates into an Invalid Date, but Date.setFullYear() resets the time to +0,
			// so a valid-but-meaningless execute time is produced. The UI validates the inputs,
			// so this only documents that bad data is tolerated without crashing.
			vi.setSystemTime(new Date(2026, 5, 8, 0, 30, 0, 0))
			const params = { type: 'sunset', latitude: 'abc', longitude: -0.1, offset: 0 }

			expect(wouldFireAt(params, Date.now() + 50 * 3600 * 1000)).toBe(true)
		})

		test('clearSun stops the event', () => {
			vi.setSystemTime(new Date(2026, 5, 8, 0, 30, 0, 0))
			const { bus, timer, executeActions } = createTimer()
			timer.setEnabled(true)
			timer.setSun('a', { type: 'sunset', ...LONDON, offset: 0 })
			timer.clearSun('a')

			bus.emitTick(1, Date.now() + 50 * 3600 * 1000)
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()
		})
	})

	describe('descriptions', () => {
		test('formatSeconds', () => {
			const { timer } = createTimer()
			expect(timer.formatSeconds(1)).toBe('1 second')
			expect(timer.formatSeconds(45)).toBe('45 seconds')
			expect(timer.formatSeconds(60)).toBe('1:00 minute')
			expect(timer.formatSeconds(90)).toBe('1:30 minutes')
			expect(timer.formatSeconds(3600)).toBe('1:00:00 hour')
			expect(timer.formatSeconds(3661)).toBe('1:01:01 hours')
		})

		test('getIntervalDescription', () => {
			const { timer } = createTimer()
			expect(timer.getIntervalDescription(makeEvent({ seconds: 30 }))).toBe('Every <strong>30 seconds</strong>')
			expect(timer.getIntervalDescription(makeEvent({ seconds: '90' }))).toBe('Every <strong>1:30 minutes</strong>')
			expect(timer.getIntervalDescription(makeEvent({ seconds: 0 }))).toBe('Never: interval must be greater than 0')
		})

		test('getRandomIntervalDescription', () => {
			const { timer } = createTimer()
			expect(timer.getRandomIntervalDescription(makeEvent({ minimum: 5, maximum: 10 }))).toBe(
				'Every <strong>5 seconds - 10 seconds</strong>'
			)
			expect(timer.getRandomIntervalDescription(makeEvent({ minimum: 10, maximum: 5 }))).toBe(
				'Never (maximum is less than minimum interval)'
			)
			expect(timer.getRandomIntervalDescription(makeEvent({ minimum: 0, maximum: 5 }))).toBe(
				'Never (minimum interval is zero or less)'
			)
		})

		test('getTimeOfDayDescription', () => {
			const { timer } = createTimer()
			expect(timer.getTimeOfDayDescription(makeEvent({ days: [0, 1, 2, 3, 4, 5, 6], time: '09:00:00' }))).toBe(
				'<strong>Daily</strong>, 09:00:00'
			)
			expect(timer.getTimeOfDayDescription(makeEvent({ days: [1, 2, 3, 4, 5], time: '09:00:00' }))).toBe(
				'<strong>Weekdays</strong>, 09:00:00'
			)
			expect(timer.getTimeOfDayDescription(makeEvent({ days: ['1', '2', '3', '4', '5'], time: '09:00:00' }))).toBe(
				'<strong>Weekdays</strong>, 09:00:00'
			)
			expect(timer.getTimeOfDayDescription(makeEvent({ days: [0, 6], time: '09:00:00' }))).toBe(
				'<strong>Weekends</strong>, 09:00:00'
			)
			expect(timer.getTimeOfDayDescription(makeEvent({ days: [1, 3], time: '09:00:00' }))).toBe(
				'<strong>Mon, Wed</strong>, 09:00:00'
			)
			expect(timer.getTimeOfDayDescription(makeEvent({ days: 'nope', time: '09:00:00' }))).toBe(
				'<strong>Unknown</strong>, 09:00:00'
			)
		})

		test('getSpecificDateDescription', () => {
			const { timer } = createTimer()
			expect(timer.getSpecificDateDescription(makeEvent({ date: '2026-07-01', time: '12:00:00' }))).toBe(
				'<strong>Once</strong>, on 2026-07-01 at 12:00:00'
			)
		})

		test('getSunDescription', () => {
			const { timer } = createTimer()
			expect(timer.getSunDescription(makeEvent({ type: 'sunrise', offset: 5 }))).toBe(
				'At <strong>Sunrise</strong>, 5 min offset'
			)
			expect(timer.getSunDescription(makeEvent({ type: 'sunset', offset: 0 }))).toBe(
				'At <strong>Sunset</strong>, 0 min offset'
			)
			expect(timer.getSunDescription(makeEvent({ type: 'other', offset: 0 }))).toBe(
				'At <strong>Error</strong>, 0 min offset'
			)
		})
	})
})
