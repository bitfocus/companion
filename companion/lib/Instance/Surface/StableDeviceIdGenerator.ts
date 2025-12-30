import { createHash } from 'node:crypto'

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
	 * @param path - Device path (e.g., "/dev/hidraw0")
	 * @returns A stable fake serial number
	 */
	generateId(uniquenessKey: string, devicePath: string): string {
		const pathCacheKey = `${uniquenessKey}||${devicePath}`

		// If there is something cached against the devicePath, use that
		const cachedSerial = this.#previousForDevicePath.get(pathCacheKey)
		if (cachedSerial) return cachedSerial.serial

		// Loop until we find a non-colliding ID
		for (let i = 0; ; i++) {
			const fakeSerial = createHash('sha1').update(`${uniquenessKey}||${i}`).digest('hex')
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
	 */
	prepareForScan(seenDevicePaths: Set<string>): void {
		// Remove path cache entries that weren't seen
		for (const [id, info] of this.#previousForDevicePath.entries()) {
			if (!seenDevicePaths.has(info.path)) {
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
}
