/**
 * Generator for stable fake serial numbers for usb devices without hardware serials.
 *
 * Generates deterministic serials by hashing just the uniqueness key and an index.
 */
export class StableDeviceIdGenerator {
	/**
	 * Cache of device info to fake serial
	 * Map: `${uniquenessKey}||${devicePath}` -> string
	 */
	#previousForDevicePath = new Map<string, { path: string; serial: string }>()

	/**
	 * Track which serialnumbers were returned during this scan
	 */
	#returnedThisScan = new Set<string>()

	/**
	 * Generate a stable serial number for a device without a hardware serial.
	 *
	 * @param uniquenessKey - Identifier for the device type (e.g., "vendorId:productId")
	 * @param alwaysAddSuffix - Whether to always add a suffix to avoid collisions
	 * @param path - Device path (e.g., "/dev/hidraw0")
	 * @returns A stable fake serial number
	 */
	generateId(uniquenessKey: string, alwaysAddSuffix: boolean, devicePath: string): string {
		const pathCacheKey = `${uniquenessKey}||${devicePath}`

		// If there is something cached against the devicePath, use that
		const cachedSerial = this.#previousForDevicePath.get(pathCacheKey)
		if (cachedSerial) return cachedSerial.serial

		// Loop until we find a non-colliding ID
		for (let i = 1; ; i++) {
			const fakeSerial = i > 1 || alwaysAddSuffix ? `${uniquenessKey}-${i}` : uniquenessKey
			if (!this.#returnedThisScan.has(fakeSerial)) {
				this.#returnedThisScan.add(fakeSerial)
				this.#previousForDevicePath.set(pathCacheKey, {
					path: devicePath,
					serial: fakeSerial,
				})
				return fakeSerial
			}
		}
	}

	/**
	 * Prepare for a new scan, purging stale entries for devices that are no longer seen.
	 * This should be called once before processing a scan.
	 * @param devicePathsToKeep - Set of device paths that should not be pruned
	 */
	prepareForScan(devicePathsToKeep: Set<string>): void {
		// Remove path cache entries that aren't in the keep set
		for (const [id, info] of this.#previousForDevicePath.entries()) {
			if (!devicePathsToKeep.has(info.path)) {
				this.#previousForDevicePath.delete(id)
			}
		}

		// Clear the seen set for the next scan
		this.#returnedThisScan.clear()

		// Prepopulate the returned set with existing serials to avoid collisions
		for (const entry of this.#previousForDevicePath.values()) {
			this.#returnedThisScan.add(entry.serial)
		}
	}

	/**
	 * Forget a specific device by its path.
	 * This should be called when a discovered surface is no longer available.
	 * @param devicePath - The device path to forget
	 */
	forgetDevice(devicePath: string): void {
		// Find and remove the entry for this device path
		for (const [id, info] of this.#previousForDevicePath.entries()) {
			if (info.path === devicePath) {
				this.#previousForDevicePath.delete(id)
				// Note: We don't remove from #returnedThisScan as that's only valid during a scan cycle
				break
			}
		}
	}
}
