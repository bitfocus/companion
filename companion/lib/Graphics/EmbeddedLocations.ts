import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { DisplayedLocationsSet, type DisplayedLocations, type DisplayedSize } from './DisplayedLocations.js'

/**
 * Shows the locations each shown location embeds (with reference elements, or as a mirror of another button) wherever
 * it is shown, at the same sizes, so that anything drawn for what is shown (eg a Link button) is drawn for them too.
 * Kept up to date as what is shown, and what each location embeds, change.
 */
export class EmbeddedLocations {
	readonly #displayed: DisplayedLocations
	readonly #getEmbedded: (location: ControlLocation) => ReadonlySet<string> | null

	/** What each location shows of those it embeds, by location (see formatLocation) */
	readonly #shown = new Map<string, { readonly set: DisplayedLocationsSet; entries: EmbeddedEntry[] }>()
	/**
	 * How many of the times each location is shown at each size are because something embeds it, by location then size.
	 * Those don't show what it embeds in turn: what something embeds already includes what that embeds, and two that
	 * embed each other would otherwise keep each other shown for good
	 */
	readonly #shownByEmbedding = new Map<string, Map<string, number>>()
	/** Locations to refresh, done one at a time as showing one can change what another is shown at */
	readonly #pending = new Map<string, ControlLocation>()
	#refreshing = false

	/**
	 * @param getEmbedded - the locations a location's render embeds, in the form of formatLocation
	 */
	constructor(displayed: DisplayedLocations, getEmbedded: (location: ControlLocation) => ReadonlySet<string> | null) {
		this.#displayed = displayed
		this.#getEmbedded = getEmbedded

		displayed.on('changed', (location) => this.refresh(location))
	}

	/** What a location embeds, or the sizes it is shown at, may have changed */
	refresh(location: ControlLocation): void {
		this.#pending.set(formatLocation(location), location)
		if (this.#refreshing) return

		this.#refreshing = true
		try {
			for (const [key, pending] of this.#pending) {
				this.#pending.delete(key)
				this.#refreshOne(key, pending)
			}
		} finally {
			this.#refreshing = false
		}
	}

	#refreshOne(key: string, location: ControlLocation): void {
		// Only the sizes it is shown at itself, not because something embeds it
		const byEmbedding = this.#shownByEmbedding.get(key)
		const sizes = this.#displayed
			.getSizeCounts(location)
			.filter((size) => size.count > (byEmbedding?.get(sizeKey(size)) ?? 0))
		const embedded = sizes.length > 0 ? this.#getEmbedded(location) : null

		const entries: EmbeddedEntry[] = []
		for (const embeddedKey of embedded ?? []) {
			const embeddedLocation = parseLocation(embeddedKey)
			if (!embeddedLocation || embeddedKey === key) continue
			for (const { width, height } of sizes) {
				entries.push({ key: embeddedKey, location: embeddedLocation, size: { width, height } })
			}
		}

		let shown = this.#shown.get(key)
		if (!shown) {
			if (entries.length === 0) return
			shown = { set: new DisplayedLocationsSet(this.#displayed), entries: [] }
			this.#shown.set(key, shown)
		}

		// Counted before showing them, as showing them refreshes those locations
		this.#countByEmbedding(shown.entries, -1)
		this.#countByEmbedding(entries, 1)
		shown.entries = entries
		shown.set.replace(entries)
		if (entries.length === 0) this.#shown.delete(key)
	}

	#countByEmbedding(entries: readonly EmbeddedEntry[], delta: 1 | -1): void {
		for (const entry of entries) {
			let counts = this.#shownByEmbedding.get(entry.key)
			if (!counts) {
				counts = new Map()
				this.#shownByEmbedding.set(entry.key, counts)
			}
			const count = (counts.get(sizeKey(entry.size)) ?? 0) + delta
			if (count > 0) counts.set(sizeKey(entry.size), count)
			else counts.delete(sizeKey(entry.size))
			if (counts.size === 0) this.#shownByEmbedding.delete(entry.key)
		}
	}
}

interface EmbeddedEntry {
	/** The embedded location (see formatLocation) */
	readonly key: string
	readonly location: ControlLocation
	readonly size: DisplayedSize
}

function sizeKey(size: DisplayedSize): string {
	return `${size.width}x${size.height}`
}

/** A location from the form formatLocation gives it */
function parseLocation(key: string): ControlLocation | null {
	const [pageNumber, row, column] = key.split('/').map(Number)
	if (![pageNumber, row, column].every(Number.isInteger)) return null
	return { pageNumber, row, column }
}
