import { useCallback, useSyncExternalStore } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'
import { formatPreviewRenderSize, type PreviewRenderSize } from '@companion-app/shared/Model/Preview.js'
import { trpcClient } from '~/Resources/TRPC'

/**
 * Button images are shared, not per-component.
 *
 * tRPC subscriptions are not deduplicated the way queries are, so without this every component
 * watching a location opened its own subscription - the edit panel preview and a grid cell showing
 * the same button each opened a subscription and flashed empty independently before their first
 * image landed.
 *
 * So locations are refcounted: one subscription each, however many components are watching, sharing
 * the one live image. A location wanted at two different sizes is two subscriptions, since they carry
 * different images. When the last watcher leaves the subscription is torn down after a short grace
 * period, so fast unmount/remount (scroll thrash, StrictMode) reuses the still-live subscription
 * instead of flashing - but nothing is retained beyond that, so the image can never go stale.
 */

const NO_IMAGE: WrappedImage = { image: null, isUsed: false }

/** How long a subscription is kept warm after its last watcher leaves, to absorb unmount/remount thrash */
export const RELEASE_GRACE_MS = 100

interface ActiveEntry {
	image: WrappedImage
	unsubscribe: () => void
	listeners: Set<() => void>
	teardownTimer: ReturnType<typeof setTimeout> | null
}

const activeEntries = new Map<string, ActiveEntry>()

/** The listener set doubles as the refcount - one listener per watching component */
function acquire(key: string, location: ControlLocation, size: PreviewRenderSize, listener: () => void): void {
	const existing = activeEntries.get(key)
	if (existing) {
		if (existing.teardownTimer) {
			clearTimeout(existing.teardownTimer)
			existing.teardownTimer = null
		}
		existing.listeners.add(listener)
		return
	}

	const entry: ActiveEntry = {
		image: NO_IMAGE,
		unsubscribe: () => {},
		listeners: new Set([listener]),
		teardownTimer: null,
	}
	activeEntries.set(key, entry)

	const subscription = trpcClient.preview.graphics.location.subscribe(
		{ location, size },
		{
			onData: (data: WrappedImage) => {
				entry.image = data
				for (const l of entry.listeners) l()
			},
			onError: (e: unknown) => {
				console.error(`Button image subscription failed for ${key}: ${e}`)
			},
		}
	)
	entry.unsubscribe = () => subscription.unsubscribe()
}

function release(key: string, listener: () => void): void {
	const entry = activeEntries.get(key)
	if (!entry) return

	entry.listeners.delete(listener)
	if (entry.listeners.size > 0) return

	// Defer teardown briefly - a remount within the grace period re-acquires this same entry (see
	// acquire), reusing the live subscription rather than tearing down and flashing empty
	entry.teardownTimer = setTimeout(() => {
		entry.unsubscribe()
		activeEntries.delete(key)
	}, RELEASE_GRACE_MS)
}

/**
 * Load and retrieve a button image for a specific control location.
 * @param location Location of the control to load
 * @param size The pixel size to draw it at, which is how a cell shows what a non-square surface will make of it
 * @param disable Disable loading of this preview
 */
export function useButtonImageForLocation(
	location: ControlLocation,
	size: PreviewRenderSize,
	disable = false
): WrappedImage {
	const key = disable ? null : `${formatLocation(location)}@${formatPreviewRenderSize(size)}`

	// Captured so the subscription is set up from the location and size that produced `key`, without making the
	// caller's (usually inline, so unstable) objects part of the subscribe identity
	const { pageNumber, row, column } = location
	const { width, height } = size

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			if (!key) return () => {}

			acquire(key, { pageNumber, row, column }, { width, height }, onStoreChange)

			return () => release(key, onStoreChange)
		},
		[key, pageNumber, row, column, width, height]
	)

	const getSnapshot = useCallback(() => {
		if (!key) return NO_IMAGE
		return activeEntries.get(key)?.image ?? NO_IMAGE
	}, [key])

	return useSyncExternalStore(subscribe, getSnapshot)
}

/** Exposed for tests - tears down all subscriptions */
export function resetButtonImageCache(): void {
	for (const entry of activeEntries.values()) {
		if (entry.teardownTimer) clearTimeout(entry.teardownTimer)
		entry.unsubscribe()
	}
	activeEntries.clear()
}
