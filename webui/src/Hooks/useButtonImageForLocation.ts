import QuickLRU from 'quick-lru'
import { useCallback, useSyncExternalStore } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'
import { trpcClient } from '~/Resources/TRPC'

/**
 * Button images are shared, not per-component.
 *
 * tRPC subscriptions are not deduplicated the way queries are, so without this every component
 * watching a location opened its own subscription and started from a blank image - the grid flashed
 * empty whenever a cell was culled and scrolled back into view, and any second view of the same
 * button (the edit panel preview, a multi-selection preview) flashed again.
 *
 * So locations are refcounted: one subscription each, however many components are watching. The last
 * known image is kept behind after the final watcher leaves, so a remount paints immediately and
 * corrects itself when the server's initial value lands.
 */

const NO_IMAGE: WrappedImage = { image: null, isUsed: false }

interface ActiveEntry {
	image: WrappedImage
	refCount: number
	unsubscribe: () => void
	listeners: Set<() => void>
}

const activeEntries = new Map<string, ActiveEntry>()

/** Last known image for locations nothing is watching any more, so a remount has something to draw */
const recentImages = new QuickLRU<string, WrappedImage>({ maxSize: 500 })

function acquire(key: string, location: ControlLocation): ActiveEntry {
	const existing = activeEntries.get(key)
	if (existing) {
		existing.refCount++
		return existing
	}

	const entry: ActiveEntry = {
		image: recentImages.get(key) ?? NO_IMAGE,
		refCount: 1,
		unsubscribe: () => {},
		listeners: new Set(),
	}
	activeEntries.set(key, entry)

	const subscription = trpcClient.preview.graphics.location.subscribe(
		{ location },
		{
			onData: (data: WrappedImage) => {
				entry.image = data
				for (const listener of entry.listeners) listener()
			},
			onError: (e: unknown) => {
				console.error(`Button image subscription failed for ${key}: ${e}`)
			},
		}
	)
	entry.unsubscribe = () => subscription.unsubscribe()

	return entry
}

function release(key: string): void {
	const entry = activeEntries.get(key)
	if (!entry) return

	entry.refCount--
	if (entry.refCount > 0) return

	entry.unsubscribe()
	activeEntries.delete(key)

	// Hold onto the pixels, so the next component to want this location has something to draw at once
	if (entry.image.image) recentImages.set(key, entry.image)
}

/**
 * Load and retrieve a button image for a specific control location.
 * @param location Location of the control to load
 * @param disable Disable loading of this preview
 */
export function useButtonImageForLocation(location: ControlLocation, disable = false): WrappedImage {
	const key = disable ? null : formatLocation(location)

	// Captured so the subscription is set up from the location that produced `key`, without making the
	// caller's (usually inline, so unstable) location object part of the subscribe identity
	const { pageNumber, row, column } = location

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			if (!key) return () => {}

			const entry = acquire(key, { pageNumber, row, column })
			entry.listeners.add(onStoreChange)

			return () => {
				entry.listeners.delete(onStoreChange)
				release(key)
			}
		},
		[key, pageNumber, row, column]
	)

	const getSnapshot = useCallback(() => {
		if (!key) return NO_IMAGE
		return activeEntries.get(key)?.image ?? recentImages.get(key) ?? NO_IMAGE
	}, [key])

	return useSyncExternalStore(subscribe, getSnapshot)
}

/** Exposed for tests - drops all cached images and subscriptions */
export function resetButtonImageCache(): void {
	for (const [key, entry] of activeEntries) {
		entry.unsubscribe()
		activeEntries.delete(key)
	}
	recentImages.clear()
}
