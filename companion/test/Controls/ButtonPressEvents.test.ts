import { describe, expect, test, vi } from 'vitest'
import { ButtonPressEvents } from '../../lib/Controls/ButtonPressEvents.js'

describe('ButtonPressEvents', () => {
	test('suppresses an ordinary release echo after a down request', () => {
		const send = vi.fn()
		const events = new ButtonPressEvents(send)

		events.request('down')
		events.request('up')

		expect(send).toHaveBeenCalledTimes(1)
	})

	test('allows an up request when no earlier automatic request was made', () => {
		const send = vi.fn()
		const events = new ButtonPressEvents(send)

		events.request('up')

		expect(send.mock.calls).toEqual([['press']])
	})

	test('allows each distinct held-stage request while still suppressing up', () => {
		const send = vi.fn()
		const events = new ButtonPressEvents(send)

		events.request('down')
		events.request('held')
		events.request('held')
		events.request('up')

		expect(send.mock.calls).toEqual([['press'], ['hold'], ['hold']])
	})

	test('finish prevents later requests', () => {
		const send = vi.fn()
		const events = new ButtonPressEvents(send)

		events.request('down')
		events.finish()
		events.request('held')
		events.request('up')

		expect(send).toHaveBeenCalledTimes(1)
	})

	test('contains a synchronous send exception and still records the attempt', () => {
		const send = vi.fn(() => {
			throw new Error('device unavailable')
		})
		const events = new ButtonPressEvents(send)

		expect(() => events.request('down')).not.toThrow()
		events.request('up')

		expect(send).toHaveBeenCalledTimes(1)
	})
})
