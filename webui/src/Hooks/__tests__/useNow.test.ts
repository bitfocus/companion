import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from '../useNow.js'

describe('useNow', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(1000)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('returns the current time', () => {
		const { result } = renderHook(() => useNow(60_000))

		expect(result.current).toBe(1000)
	})

	it('updates once the interval passes', () => {
		const { result } = renderHook(() => useNow(60_000))

		act(() => {
			vi.advanceTimersByTime(60_000)
		})

		expect(result.current).toBe(61_000)
	})

	it('stops updating once unmounted', () => {
		const { unmount } = renderHook(() => useNow(60_000))

		unmount()

		expect(vi.getTimerCount()).toBe(0)
	})
})
