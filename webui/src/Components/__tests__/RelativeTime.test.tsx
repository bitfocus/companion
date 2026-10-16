import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RelativeTime } from '../RelativeTime.js'

const MINUTE = 60_000

describe('RelativeTime', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(2026, 0, 2, 12, 0, 0))
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('shows the time relative to now, with the absolute time on hover', () => {
		render(<RelativeTime timestamp={Date.now() - 5 * MINUTE} />)

		const el = screen.getByText('5 minutes ago')
		expect(el.title).toBe('2026-01-02 11:55:00')
	})

	it('prefixes and formats the hover text', () => {
		render(<RelativeTime timestamp={Date.now()} titlePrefix="Last seen" titleFormat="YYYY-MM-DD" />)

		expect(screen.getByText('a few seconds ago').title).toBe('Last seen 2026-01-02')
	})

	it('refreshes as time passes', () => {
		render(<RelativeTime timestamp={Date.now() - 5 * MINUTE} />)

		act(() => {
			vi.advanceTimersByTime(10 * MINUTE)
		})

		expect(screen.getByText('15 minutes ago')).toBeTruthy()
	})
})
