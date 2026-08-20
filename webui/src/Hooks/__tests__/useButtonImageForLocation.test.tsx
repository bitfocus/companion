import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'

const subscribeMock = vi.fn()
const unsubscribeMock = vi.fn()

vi.mock('~/Resources/TRPC', () => ({
	trpcClient: {
		preview: {
			graphics: {
				location: {
					subscribe: (...args: unknown[]) => subscribeMock(...args),
				},
			},
		},
	},
}))

const { useButtonImageForLocation, resetButtonImageCache } = await import('../useButtonImageForLocation.js')

const locationA: ControlLocation = { pageNumber: 1, row: 2, column: 3 }
const locationB: ControlLocation = { pageNumber: 1, row: 2, column: 4 }

/** Push a value down the most recent subscription, as the server would */
function emit(data: WrappedImage, callIndex = subscribeMock.mock.calls.length - 1) {
	const handlers = subscribeMock.mock.calls[callIndex][1] as { onData: (d: WrappedImage) => void }
	act(() => handlers.onData(data))
}

const IMAGE_A: WrappedImage = { image: 'data:image/png;base64,AAAA', isUsed: true }
const IMAGE_B: WrappedImage = { image: 'data:image/png;base64,BBBB', isUsed: true }

beforeEach(() => {
	subscribeMock.mockReset()
	unsubscribeMock.mockReset()
	subscribeMock.mockImplementation(() => ({ unsubscribe: unsubscribeMock }))
})

afterEach(() => {
	resetButtonImageCache()
})

describe('useButtonImageForLocation', () => {
	it('starts with no image and subscribes to the location', () => {
		const { result } = renderHook(() => useButtonImageForLocation(locationA))

		expect(result.current).toEqual({ image: null, isUsed: false })
		expect(subscribeMock).toHaveBeenCalledTimes(1)
		expect(subscribeMock.mock.calls[0][0]).toEqual({ location: locationA })
	})

	it('delivers images from the subscription', () => {
		const { result } = renderHook(() => useButtonImageForLocation(locationA))

		emit(IMAGE_A)

		expect(result.current).toEqual(IMAGE_A)
	})

	it('opens one subscription for many watchers of the same location', () => {
		const first = renderHook(() => useButtonImageForLocation(locationA))
		const second = renderHook(() => useButtonImageForLocation(locationA))

		expect(subscribeMock).toHaveBeenCalledTimes(1)

		emit(IMAGE_A)

		expect(first.result.current).toEqual(IMAGE_A)
		expect(second.result.current).toEqual(IMAGE_A)
	})

	it('gives a late joiner the image that already arrived, with no second subscription', () => {
		renderHook(() => useButtonImageForLocation(locationA))
		emit(IMAGE_A)

		const late = renderHook(() => useButtonImageForLocation(locationA))

		expect(late.result.current).toEqual(IMAGE_A)
		expect(subscribeMock).toHaveBeenCalledTimes(1)
	})

	it('keeps the subscription while any watcher remains', () => {
		const first = renderHook(() => useButtonImageForLocation(locationA))
		renderHook(() => useButtonImageForLocation(locationA))

		first.unmount()

		expect(unsubscribeMock).not.toHaveBeenCalled()
	})

	it('unsubscribes once the last watcher leaves', () => {
		const first = renderHook(() => useButtonImageForLocation(locationA))
		const second = renderHook(() => useButtonImageForLocation(locationA))

		first.unmount()
		second.unmount()

		expect(unsubscribeMock).toHaveBeenCalledTimes(1)
	})

	it('paints the last known image immediately when a location is watched again', () => {
		const first = renderHook(() => useButtonImageForLocation(locationA))
		emit(IMAGE_A)
		first.unmount()

		// This is the flash that used to happen when a grid cell was culled and scrolled back into view
		const second = renderHook(() => useButtonImageForLocation(locationA))

		expect(second.result.current).toEqual(IMAGE_A)
		expect(subscribeMock).toHaveBeenCalledTimes(2)
	})

	it('keeps locations independent', () => {
		const a = renderHook(() => useButtonImageForLocation(locationA))
		const b = renderHook(() => useButtonImageForLocation(locationB))

		expect(subscribeMock).toHaveBeenCalledTimes(2)

		emit(IMAGE_A, 0)
		emit(IMAGE_B, 1)

		expect(a.result.current).toEqual(IMAGE_A)
		expect(b.result.current).toEqual(IMAGE_B)
	})

	it('does not subscribe when disabled', () => {
		const { result } = renderHook(() => useButtonImageForLocation(locationA, true))

		expect(subscribeMock).not.toHaveBeenCalled()
		expect(result.current).toEqual({ image: null, isUsed: false })
	})

	it('resubscribes when the watched location changes', () => {
		const { rerender } = renderHook(({ location }) => useButtonImageForLocation(location), {
			initialProps: { location: locationA },
		})

		rerender({ location: locationB })

		expect(subscribeMock).toHaveBeenCalledTimes(2)
		expect(subscribeMock.mock.calls[1][0]).toEqual({ location: locationB })
		expect(unsubscribeMock).toHaveBeenCalledTimes(1)
	})

	it('does not resubscribe when given an equal location object on every render', () => {
		const { rerender } = renderHook(() => useButtonImageForLocation({ pageNumber: 1, row: 2, column: 3 }))

		rerender()
		rerender()

		expect(subscribeMock).toHaveBeenCalledTimes(1)
	})
})
