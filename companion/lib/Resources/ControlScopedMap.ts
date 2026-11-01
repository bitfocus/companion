/**
 * A Map of items that each belong to a control, with a secondary index by controlId.
 *
 * Used where a change scoped to a few controls (eg a local variable changing) would otherwise have to walk
 * every item in the map to find the handful belonging to those controls.
 *
 * Iterating the map behaves like iterating a plain Map, including deleting the current entry mid-iteration.
 */
export class ControlScopedMap<V extends { readonly controlId: string }> {
	readonly #items = new Map<string, V>()
	readonly #byControl = new Map<string, Map<string, V>>()

	get size(): number {
		return this.#items.size
	}

	get(id: string): V | undefined {
		return this.#items.get(id)
	}

	set(id: string, value: V): this {
		const existing = this.#items.get(id)
		if (existing && existing.controlId !== value.controlId) this.#removeFromIndex(id, existing.controlId)

		this.#items.set(id, value)

		let controlItems = this.#byControl.get(value.controlId)
		if (!controlItems) {
			controlItems = new Map()
			this.#byControl.set(value.controlId, controlItems)
		}
		controlItems.set(id, value)

		return this
	}

	delete(id: string): boolean {
		const existing = this.#items.get(id)
		if (!existing) return false

		this.#items.delete(id)
		this.#removeFromIndex(id, existing.controlId)
		return true
	}

	clear(): void {
		this.#items.clear()
		this.#byControl.clear()
	}

	values(): MapIterator<V> {
		return this.#items.values()
	}

	entries(): MapIterator<[string, V]> {
		return this.#items.entries()
	}

	[Symbol.iterator](): MapIterator<[string, V]> {
		return this.#items.entries()
	}

	/** The items belonging to a control, or undefined if it has none */
	getForControl(controlId: string): ReadonlyMap<string, V> | undefined {
		return this.#byControl.get(controlId)
	}

	#removeFromIndex(id: string, controlId: string): void {
		const controlItems = this.#byControl.get(controlId)
		if (!controlItems) return

		controlItems.delete(id)
		if (controlItems.size === 0) this.#byControl.delete(controlId)
	}
}
