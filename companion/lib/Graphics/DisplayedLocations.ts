import { EventEmitter } from 'node:events'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

/**
 * The size a location is shown at, in pixels, as it is laid out: on a surface mounted on its side the button is laid
 * out with its width and height swapped, then turned to fit, so this is the swapped size
 */
export interface DisplayedSize {
	width: number
	height: number
	/**
	 * The size is of the content of the button alone, without its decoration (eg the top bar), as when Link serves it
	 * onwards for another installation to decorate. Defaults to false: the size of the whole button
	 */
	contentOnly?: boolean
}

interface DisplayedLocationsEvents {
	/** The sizes a location is shown at have changed */
	changed: [location: ControlLocation]
}

/** Releases a location acquired with {@link DisplayedLocations.acquire}. Only the first call has any effect */
export type ReleaseDisplayedLocation = () => void

function locationKey(location: ControlLocation): string {
	return `${location.pageNumber}/${location.row}/${location.column}`
}

/** Identifies a size, for counting what shows a location at it */
export function displayedSizeKey(size: DisplayedSize): string {
	return `${size.width}x${size.height}${size.contentOnly ? ' content' : ''}`
}

/** A copy of a size, without anything else that came with it */
function copySize({ width, height, contentOnly }: DisplayedSize): DisplayedSize {
	return contentOnly ? { width, height, contentOnly } : { width, height }
}

/**
 * Which locations are being shown right now, and at what sizes: on surfaces, in the web ui, to satellite
 * subscriptions and to Link peers. Lets something drawn elsewhere (eg a Link button) be drawn for what is on screen,
 * rather than for what was shown last.
 */
export class DisplayedLocations extends EventEmitter<DisplayedLocationsEvents> {
	/** Count of what shows each size of each location */
	readonly #locations = new Map<
		string,
		{ location: ControlLocation; sizes: Map<string, DisplayedSize & { count: number }> }
	>()

	constructor() {
		super()
		this.setMaxListeners(0)
	}

	/** Note that a location is being shown at a size, until the returned function is called */
	acquire(location: ControlLocation, size: DisplayedSize): ReleaseDisplayedLocation {
		const key = locationKey(location)
		let entry = this.#locations.get(key)
		if (!entry) {
			entry = { location: { ...location }, sizes: new Map() }
			this.#locations.set(key, entry)
		}

		const sKey = displayedSizeKey(size)
		const sizeEntry = entry.sizes.get(sKey)
		if (sizeEntry) {
			sizeEntry.count++
		} else {
			entry.sizes.set(sKey, { ...copySize(size), count: 1 })
			this.emit('changed', entry.location)
		}

		let released = false
		return () => {
			if (released) return
			released = true
			this.#release(key, sKey)
		}
	}

	#release(key: string, sKey: string): void {
		const entry = this.#locations.get(key)
		const sizeEntry = entry?.sizes.get(sKey)
		if (!entry || !sizeEntry) return

		sizeEntry.count--
		if (sizeEntry.count > 0) return

		entry.sizes.delete(sKey)
		if (entry.sizes.size === 0) this.#locations.delete(key)
		this.emit('changed', entry.location)
	}

	/** The distinct sizes a location is being shown at, and by how many things at each */
	getSizeCounts(location: ControlLocation): (DisplayedSize & { count: number })[] {
		const entry = this.#locations.get(locationKey(location))
		if (!entry) return []
		return Array.from(entry.sizes.values(), (size) => ({ ...copySize(size), count: size.count }))
	}

	/** The distinct sizes a location is being shown at */
	getSizes(location: ControlLocation): DisplayedSize[] {
		const entry = this.#locations.get(locationKey(location))
		if (!entry) return []
		return Array.from(entry.sizes.values(), copySize)
	}
}

/**
 * The locations one thing (eg a surface) is showing, replaced as a whole each time it draws something else, so that
 * only what has changed is acquired or released
 */
export class DisplayedLocationsSet {
	readonly #displayed: DisplayedLocations
	#held = new Map<string, ReleaseDisplayedLocation>()

	constructor(displayed: DisplayedLocations) {
		this.#displayed = displayed
	}

	/** Show exactly these, releasing anything shown before that isn't among them */
	replace(entries: Iterable<{ location: ControlLocation; size: DisplayedSize }>): void {
		const next = new Map<string, ReleaseDisplayedLocation>()
		for (const { location, size } of entries) {
			const key = `${locationKey(location)}@${displayedSizeKey(size)}`
			if (next.has(key)) continue

			const existing = this.#held.get(key)
			if (existing) {
				this.#held.delete(key)
				next.set(key, existing)
			} else {
				next.set(key, this.#displayed.acquire(location, size))
			}
		}

		// Acquired before releasing, so that something that stays shown doesn't briefly look gone
		for (const release of this.#held.values()) release()
		this.#held = next
	}

	clear(): void {
		this.replace([])
	}
}
