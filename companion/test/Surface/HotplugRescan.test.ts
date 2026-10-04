import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { HotplugRescan } from '../../lib/Surface/HotplugRescan.js'

describe('HotplugRescan', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('scans immediately and again after each delay', () => {
		const scan = vi.fn()
		const rescan = new HotplugRescan(scan, [1000, 3000])

		rescan.trigger()
		expect(scan).toHaveBeenCalledTimes(1)

		vi.advanceTimersByTime(999)
		expect(scan).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(1)
		expect(scan).toHaveBeenCalledTimes(2)

		vi.advanceTimersByTime(2000)
		expect(scan).toHaveBeenCalledTimes(3)

		vi.advanceTimersByTime(60000)
		expect(scan).toHaveBeenCalledTimes(3)
	})

	test('a further connect event restarts the delayed scans instead of adding to them', () => {
		const scan = vi.fn()
		const rescan = new HotplugRescan(scan, [1000, 3000])

		rescan.trigger()
		vi.advanceTimersByTime(500)
		rescan.trigger()
		expect(scan).toHaveBeenCalledTimes(2)

		// The first event's 1000ms scan would have fired here
		vi.advanceTimersByTime(500)
		expect(scan).toHaveBeenCalledTimes(2)

		vi.advanceTimersByTime(2500)
		expect(scan).toHaveBeenCalledTimes(4)
		expect(vi.getTimerCount()).toBe(0)
	})

	test('cancel drops the delayed scans', () => {
		const scan = vi.fn()
		const rescan = new HotplugRescan(scan, [1000, 3000])

		rescan.trigger()
		rescan.cancel()

		vi.advanceTimersByTime(60000)
		expect(scan).toHaveBeenCalledTimes(1)
		expect(vi.getTimerCount()).toBe(0)
	})
})
