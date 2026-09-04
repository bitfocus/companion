import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'
import { DEFAULT_PREVIEW_RENDER_SIZE, type PreviewRenderSize } from '@companion-app/shared/Model/Preview.js'

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

const { useButtonImageForLocation, resetButtonImageCache, RELEASE_GRACE_MS } =
	await import('../useButtonImageForLocation.js')

const locationA: ControlLocation = { pageNumber: 1, row: 2, column: 3 }
const locationB: ControlLocation = { pageNumber: 1, row: 2, column: 4 }

/** The shape of a Stream Deck + touch strip segment, for the cases where the size is what differs */
const STRIP_SIZE: PreviewRenderSize = { width: 480, height: 240 }

/** Push a value down the most recent subscription, as the server would */
function emit(data: WrappedImage, callIndex = subscribeMock.mock.calls.length - 1) {
	const handlers = subscribeMock.mock.calls[callIndex][1] as { onData: (d: WrappedImage) => void }
	act(() => handlers.onData(data))
}

/** Let the deferred-teardown timer fire */
function elapseGracePeriod() {
	act(() => {
		vi.advanceTimersByTime(RELEASE_GRACE_MS)
	})
}

const IMAGE_A: WrappedImage = { image: 'data:image/png;base64,AAAA', isUsed: true }
const IMAGE_B: WrappedImage = { image: 'data:image/png;base64,BBBB', isUsed: true }

beforeEach(() => {
	vi.useFakeTimers()
	subscribeMock.mockReset()
	unsubscribeMock.mockReset()
	subscribeMock.mockImplementation(() => ({ unsubscribe: unsubscribeMock }))
})

afterEach(() => {
	resetButtonImageCache()
	vi.useRealTimers()
})

describe('useButtonImageForLocation', () => {
	it('starts with no image and subscribes to the location', () => {
		const { result } = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))

		expect(result.current).toEqual({ image: null, isUsed: false })
		expect(subscribeMock).toHaveBeenCalledTimes(1)
		expect(subscribeMock.mock.calls[0][0]).toEqual({ location: locationA, size: DEFAULT_PREVIEW_RENDER_SIZE })
	})

	it('delivers images from the subscription', () => {
		const { result } = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))

		emit(IMAGE_A)

		expect(result.current).toEqual(IMAGE_A)
	})

	it('opens one subscription for many watchers of the same location', () => {
		const first = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))
		const second = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))

		expect(subscribeMock).toHaveBeenCalledTimes(1)

		emit(IMAGE_A)

		expect(first.result.current).toEqual(IMAGE_A)
		expect(second.result.current).toEqual(IMAGE_A)
	})

	it('gives a late joiner the image that already arrived, with no second subscription', () => {
		renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))
		emit(IMAGE_A)

		const late = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))

		expect(late.result.current).toEqual(IMAGE_A)
		expect(subscribeMock).toHaveBeenCalledTimes(1)
	})

	it('keeps the subscription while any watcher remains', () => {
		const first = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))
		renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))

		first.unmount()
		elapseGracePeriod()

		expect(unsubscribeMock).not.toHaveBeenCalled()
	})

	it('defers unsubscribe until the grace period elapses after the last watcher leaves', () => {
		const first = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))
		const second = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))

		first.unmount()
		second.unmount()

		// Kept warm briefly rather than torn down immediately
		expect(unsubscribeMock).not.toHaveBeenCalled()

		elapseGracePeriod()

		expect(unsubscribeMock).toHaveBeenCalledTimes(1)
	})

	it('reuses the live subscription when re-watched within the grace period', () => {
		const first = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))
		emit(IMAGE_A)
		first.unmount()

		// Remount before the grace timer fires - e.g. a grid cell culled and scrolled straight back
		const second = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))

		// Same subscription reused, still holding the live image - no teardown, no flash
		expect(subscribeMock).toHaveBeenCalledTimes(1)
		expect(unsubscribeMock).not.toHaveBeenCalled()
		expect(second.result.current).toEqual(IMAGE_A)

		// The pending teardown was cancelled, so it never fires
		elapseGracePeriod()
		expect(unsubscribeMock).not.toHaveBeenCalled()
	})

	it('tears down after the grace period, and a later watcher starts blank rather than stale', () => {
		const first = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))
		emit(IMAGE_A)
		first.unmount()

		elapseGracePeriod()
		expect(unsubscribeMock).toHaveBeenCalledTimes(1)

		const second = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))

		// Nothing is retained past the grace period, so no risk of painting a stale image
		expect(second.result.current).toEqual({ image: null, isUsed: false })
		expect(subscribeMock).toHaveBeenCalledTimes(2)
	})

	it('keeps locations independent', () => {
		const a = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))
		const b = renderHook(() => useButtonImageForLocation(locationB, DEFAULT_PREVIEW_RENDER_SIZE))

		expect(subscribeMock).toHaveBeenCalledTimes(2)

		emit(IMAGE_A, 0)
		emit(IMAGE_B, 1)

		expect(a.result.current).toEqual(IMAGE_A)
		expect(b.result.current).toEqual(IMAGE_B)
	})

	it('keeps sizes independent, so a cell showing a strip does not share with one showing a button', () => {
		const square = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE))
		const strip = renderHook(() => useButtonImageForLocation(locationA, STRIP_SIZE))

		expect(subscribeMock).toHaveBeenCalledTimes(2)
		expect(subscribeMock.mock.calls[1][0]).toEqual({ location: locationA, size: STRIP_SIZE })

		emit(IMAGE_A, 0)
		emit(IMAGE_B, 1)

		expect(square.result.current).toEqual(IMAGE_A)
		expect(strip.result.current).toEqual(IMAGE_B)
	})

	it('shares one subscription between watchers of the same location and size', () => {
		renderHook(() => useButtonImageForLocation(locationA, STRIP_SIZE))
		renderHook(() => useButtonImageForLocation(locationA, STRIP_SIZE))

		expect(subscribeMock).toHaveBeenCalledTimes(1)
	})

	it('does not subscribe when disabled', () => {
		const { result } = renderHook(() => useButtonImageForLocation(locationA, DEFAULT_PREVIEW_RENDER_SIZE, true))

		expect(subscribeMock).not.toHaveBeenCalled()
		expect(result.current).toEqual({ image: null, isUsed: false })
	})

	it('resubscribes when the watched location changes', () => {
		const { rerender } = renderHook(
			({ location }) => useButtonImageForLocation(location, DEFAULT_PREVIEW_RENDER_SIZE),
			{
				initialProps: { location: locationA },
			}
		)

		rerender({ location: locationB })

		expect(subscribeMock).toHaveBeenCalledTimes(2)
		expect(subscribeMock.mock.calls[1][0]).toEqual({ location: locationB, size: DEFAULT_PREVIEW_RENDER_SIZE })

		// The old location is torn down on the same deferred schedule as any other release
		expect(unsubscribeMock).not.toHaveBeenCalled()
		elapseGracePeriod()
		expect(unsubscribeMock).toHaveBeenCalledTimes(1)
	})

	it('does not resubscribe when given an equal location object on every render', () => {
		const { rerender } = renderHook(() =>
			useButtonImageForLocation({ pageNumber: 1, row: 2, column: 3 }, DEFAULT_PREVIEW_RENDER_SIZE)
		)

		rerender()
		rerender()

		expect(subscribeMock).toHaveBeenCalledTimes(1)
	})
})
