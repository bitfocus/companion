import isEqual from 'fast-deep-equal'
import type { SurfaceHandler } from './Handler.js'
import LogController from '../Log/Controller.js'

const FIRMWARE_UPDATE_POLL_INTERVAL = 1000 * 60 * 60 * 24 // 24 hours
const FIRMWARE_PAYLOAD_CACHE_TTL = 1000 * 60 * 60 * 4 // 4 hours
const FIRMWARE_PAYLOAD_CACHE_MAX_TTL = 1000 * 60 * 60 * 24 // 24 hours

interface PayloadCacheEntry {
	timestamp: number
	payload: unknown
}

export class SurfaceFirmwareUpdateCheck {
	readonly #logger = LogController.createLogger('Surface/FirmwareUpdateCheck')

	readonly #payloadCache = new Map<string, PayloadCacheEntry>()

	readonly #payloadUpdating = new Map<string, Promise<unknown | null>>()

	/**
	 * All the opened and active surfaces
	 */
	readonly #surfaceHandlers: Map<string, SurfaceHandler | null>

	readonly #updateDevicesList: () => void

	constructor(surfaceHandlers: Map<string, SurfaceHandler | null>, updateDevicesList: () => void) {
		this.#surfaceHandlers = surfaceHandlers
		this.#updateDevicesList = updateDevicesList

		setInterval(() => this.#checkAllSurfacesForUpdates(), FIRMWARE_UPDATE_POLL_INTERVAL)
		setTimeout(() => this.#checkAllSurfacesForUpdates(), 5000)
	}

	#checkAllSurfacesForUpdates() {
		// Compile a list of all urls to check, and the surfaces that use them
		const allUpdateUrls = new Map<string, string[]>()
		for (const [surfaceId, handler] of this.#surfaceHandlers) {
			if (!handler) continue
			const updateUrl = handler.panel.info.firmwareUpdateVersionsUrl
			if (!updateUrl) continue

			const currentList = allUpdateUrls.get(updateUrl)
			if (currentList) {
				currentList.push(surfaceId)
			} else {
				allUpdateUrls.set(updateUrl, [surfaceId])
			}
		}

		// No updates to check
		if (allUpdateUrls.size === 0) return

		this.#logger.debug(`Checking for firmware updates from ${allUpdateUrls.size} urls`)

		Promise.resolve()
			.then(async () => {
				await Promise.allSettled(
					Array.from(allUpdateUrls).map(async ([url, surfaceIds]) => {
						// Scrape the api for an updated payload
						const versionsInfo = await this.#fetchPayloadForUrl(url, true)

						// Perform the update for each surface
						await Promise.allSettled(
							surfaceIds.map(async (surfaceId) => {
								const handler = this.#surfaceHandlers.get(surfaceId)
								if (!handler) return

								return this.#performForSurface(handler, versionsInfo).catch((e) => {
									this.#logger.error(`Failed to check for firmware updates for surface "${surfaceId}":  ${e}`)
								})
							})
						)
					})
				)

				// Inform the ui, even though there may be no changes
				this.#updateDevicesList()
			})
			.catch((e) => {
				this.#logger.warn(`Failed to check for firmware updates: ${e}`)
			})
	}

	/**
	 * Fetch the payload for a specific url, either from cache or from the server
	 * @param url The url to fetch the payload from
	 * @param skipCache Whether to skip the cache and always fetch a new payload
	 * @returns The payload, or null if it could not be fetched
	 */
	async #fetchPayloadForUrl(url: string, skipCache?: boolean): Promise<unknown | null> {
		let cacheEntry = this.#payloadCache.get(url)

		// Check if the cache is too old to be usable
		if (cacheEntry && cacheEntry.timestamp < Date.now() - FIRMWARE_PAYLOAD_CACHE_MAX_TTL) {
			cacheEntry = undefined
			this.#payloadCache.delete(url)
		}

		// Check if cache is new enough to return directly
		if (!skipCache && cacheEntry && cacheEntry.timestamp >= Date.now() - FIRMWARE_PAYLOAD_CACHE_TTL) {
			return cacheEntry.payload
		}

		// If one is in flight, return that
		const currentInFlight = this.#payloadUpdating.get(url)
		if (currentInFlight) return currentInFlight

		const { promise: pendingPromise, resolve } = Promise.withResolvers<unknown | null>()
		this.#payloadUpdating.set(url, pendingPromise)

		// Fetch new data
		void fetch(url)
			.then(async (res) => res.json())
			.catch((e) => {
				this.#logger.warn(`Failed to fetch firmware update payload from "${url}": ${e}`)
				return null
			})
			.then((newPayload) => {
				// Update cache with the new value
				if (newPayload) {
					this.#payloadCache.set(url, { timestamp: Date.now(), payload: newPayload })
				}

				// No longer in flight
				this.#payloadUpdating.delete(url)

				// Return the new value
				resolve(newPayload || cacheEntry?.payload || null)
			})

		return pendingPromise
	}

	/**
	 * Trigger a check for updates for a specific surface
	 * @param surface Surface to check for updates
	 */
	triggerCheckSurfaceForUpdates(surface: SurfaceHandler): void {
		setTimeout(() => {
			Promise.resolve()
				.then(async () => {
					// fetch latest versions info
					const versionsInfo = surface.panel.info.firmwareUpdateVersionsUrl
						? await this.#fetchPayloadForUrl(surface.panel.info.firmwareUpdateVersionsUrl)
						: null

					const changed = await this.#performForSurface(surface, versionsInfo)

					// Inform ui of the updates
					if (changed) this.#updateDevicesList()
				})

				.catch((e) => {
					this.#logger.warn(`Failed to check for firmware updates for surface "${surface.surfaceId}": ${e}`)
				})
		}, 0)
	}

	async #performForSurface(surface: SurfaceHandler, versionsInfo: unknown | null): Promise<boolean> {
		// Check if panel has updates
		const firmwareUpdatesBefore = surface.panel.info.hasFirmwareUpdates
		await surface.panel.checkForFirmwareUpdates?.(versionsInfo ?? undefined)
		if (isEqual(firmwareUpdatesBefore, surface.panel.info.hasFirmwareUpdates)) return false

		this.#logger.info(`Firmware updates change for surface "${surface.surfaceId}"`)

		return true
	}
}
