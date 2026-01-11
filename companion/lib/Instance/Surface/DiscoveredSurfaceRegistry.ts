import type { HIDDevice } from '@companion-surface/host'
import type { CheckDeviceInfo } from './IpcTypes.js'

/**
 * Information about a discovered surface during a HID scan.
 */
export interface DiscoveredHidSurface {
	/** Unique id of the surface as reported by the plugin (may collide, will be resolved later) */
	surfaceId: string
	/** Whether the surfaceId is known to not be unique */
	surfaceIdIsNotUnique: boolean
	/** Human friendly description of the surface (typically model name) */
	description: string
	/** The HID device info, if this is a HID-based surface */
	hidDevice?: HIDDevice
	/** Info for scanned (non-HID) surfaces, used to open the device */
	scannedDeviceInfo?: CheckDeviceInfo
}

/**
 * Interface for a handler that can open discovered HID surfaces.
 */
export interface HidSurfaceOpener {
	/**
	 * Open a discovered surface.
	 * @param surface - The surface to open (as returned from scanHidDevices)
	 * @param resolvedSurfaceId - The collision-resolved surface ID to use
	 */
	openDiscoveredSurface(surface: DiscoveredHidSurface, resolvedSurfaceId: string): Promise<void>
}

/**
 * Information cached for each discovered device.
 */
interface DeviceCacheEntry {
	/** The prefixed device path (`${instanceId}:${devicePath}`) */
	prefixedDevicePath: `${string}:${string}`
	/** The collision-resolved surface ID */
	resolvedSurfaceId: string
	/** The handler that can open this surface (only for HID-scanned surfaces) */
	opener?: HidSurfaceOpener
	/** The discovered surface info (only for HID-scanned surfaces) */
	surface?: DiscoveredHidSurface
}

/**
 * Manages the registry of discovered surfaces, including:
 * - Generating stable synthetic identifiers for devices without hardware serials
 * - Caching opener info for HID-scanned surfaces to enable direct re-opening
 * - Tracking device paths for surface lifecycle management
 *
 * Identifiers are deterministic strings built from a `uniquenessKey` and a
 * small numeric index. The registry avoids collisions during a scan and
 * caches identifiers per device path.
 */
export class DiscoveredSurfaceRegistry {
	/**
	 * Cache of device info, keyed by `${uniquenessKey}||${prefixedDevicePath}`
	 */
	readonly #deviceCache = new Map<string, DeviceCacheEntry>()

	/**
	 * Reverse lookup: resolvedSurfaceId -> cache key
	 */
	readonly #surfaceIdToKey = new Map<string, string>()

	/**
	 * Return a cached identifier or assign the next available one.
	 *
	 * @param uniquenessKey - Device-type key (e.g. "vendor:product").
	 * @param alwaysAddSuffix - Force numeric suffix on the first id when true.
	 * @param prefixedDevicePath - Path used for caching, prefixed with instanceId (e.g. "instance123:/dev/hidraw0").
	 * @param opener - Optional handler that can open this surface (for HID-scanned surfaces).
	 * @param surface - Optional discovered surface info (for HID-scanned surfaces).
	 * @returns The collision-resolved surface ID.
	 */
	trackSurface(
		uniquenessKey: string,
		alwaysAddSuffix: boolean,
		prefixedDevicePath: `${string}:${string}`,
		opener?: HidSurfaceOpener,
		surface?: DiscoveredHidSurface
	): string {
		const cacheKey = `${uniquenessKey}||${prefixedDevicePath}`

		// If there is something cached against the devicePath, update opener info and return
		const cached = this.#deviceCache.get(cacheKey)
		if (cached) {
			// Update opener info in case it changed
			cached.opener = opener
			cached.surface = surface
			return cached.resolvedSurfaceId
		}

		// Loop until we find a non-colliding ID
		for (let i = 1; ; i++) {
			const resolvedSurfaceId = i > 1 || alwaysAddSuffix ? `${uniquenessKey}-dev${i}` : uniquenessKey
			if (!this.#surfaceIdToKey.has(resolvedSurfaceId)) {
				this.#surfaceIdToKey.set(resolvedSurfaceId, cacheKey)

				const entry: DeviceCacheEntry = {
					prefixedDevicePath,
					resolvedSurfaceId,
					opener,
					surface,
				}
				this.#deviceCache.set(cacheKey, entry)

				return resolvedSurfaceId
			}
		}
	}

	/**
	 * Prepare for a new scan, purging stale entries for devices that are no longer seen.
	 * This should be called once before processing a scan.
	 * @param devicePathsToKeep - Set of prefixed device paths that should not be pruned
	 */
	prepareForScan(devicePathsToKeep: Set<`${string}:${string}`>): void {
		// Remove cache entries that aren't in the keep set
		for (const [key, entry] of this.#deviceCache.entries()) {
			if (!devicePathsToKeep.has(entry.prefixedDevicePath)) {
				this.#deviceCache.delete(key)
				this.#surfaceIdToKey.delete(entry.resolvedSurfaceId)
			}
		}
	}

	/**
	 * Forget a specific device by its prefixed path.
	 * This should be called when a discovered surface is no longer available.
	 * @param prefixedDevicePath - The prefixed device path to forget
	 */
	forgetSurface(prefixedDevicePath: `${string}:${string}`): void {
		// Find and remove the entry for this device path
		for (const [key, entry] of this.#deviceCache.entries()) {
			if (entry.prefixedDevicePath === prefixedDevicePath) {
				this.#deviceCache.delete(key)
				this.#surfaceIdToKey.delete(entry.resolvedSurfaceId)
				break
			}
		}
	}

	/**
	 * Forget all devices belonging to a specific instance.
	 * @param instanceId - The instance ID prefix to match
	 */
	forgetInstance(instanceId: string): void {
		const prefix = `${instanceId}:`
		for (const [key, entry] of this.#deviceCache.entries()) {
			if (entry.prefixedDevicePath.startsWith(prefix)) {
				this.#deviceCache.delete(key)
				this.#surfaceIdToKey.delete(entry.resolvedSurfaceId)
			}
		}
	}

	/**
	 * Get the opener info for a surface by its resolved ID.
	 * @param resolvedSurfaceId - The surface ID to look up
	 * @returns The opener and surface info if available, or undefined
	 */
	getOpenerInfo(resolvedSurfaceId: string): { opener: HidSurfaceOpener; surface: DiscoveredHidSurface } | undefined {
		const key = this.#surfaceIdToKey.get(resolvedSurfaceId)
		if (!key) return undefined

		const entry = this.#deviceCache.get(key)
		if (!entry?.opener || !entry?.surface) return undefined

		return { opener: entry.opener, surface: entry.surface }
	}
}
