import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { CompositeElementIdString } from '../Instance/Definitions.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'

/**
 * Result of converting a single graphics element for drawing
 */
export interface ElementConversionCacheEntry {
	/** The converted draw element, or null if the element was disabled and filtered out */
	readonly drawElement: SomeButtonGraphicsDrawElement | null
	/** Variables referenced during expression evaluation for this element */
	readonly usedVariables: ReadonlySet<string>

	readonly compositeElement: {
		/** Composite element types referenced during evaluation (for composite elements only) */
		readonly elementId: CompositeElementIdString

		readonly childPropOverrides: VariableValues
		readonly childIdPrefix: string
	} | null
}

/**
 * Per-control cache for element conversion results.
 * Maintains a cache of converted draw elements with their dependency tracking,
 * and supports queued invalidation for thread-safe operation.
 */
export class ElementConversionCache {
	/** Cache of converted elements by element ID */
	readonly #cache = new Map<string, ElementConversionCacheEntry>()

	/** Queue of element IDs to invalidate before next conversion */
	readonly #invalidationQueue = new Set<string>()

	/** Composite element types that should trigger invalidation of elements using them */
	readonly #compositeTypesToInvalidate = new Set<CompositeElementIdString>()

	/** Variables that changed and should trigger invalidation of elements using them */
	readonly #changedVariables = new Set<string>()

	/**
	 * Get a cached element entry
	 * @param elementId The element ID to look up
	 * @returns The cached entry, or undefined if not cached
	 */
	get(elementId: string): ElementConversionCacheEntry | undefined {
		return this.#cache.get(elementId)
	}

	/**
	 * Cache a converted element
	 * @param elementId The element ID
	 * @param entry The conversion result to cache
	 */
	set(elementId: string, entry: ElementConversionCacheEntry): void {
		this.#cache.set(elementId, entry)
	}

	/**
	 * Delete a cached element
	 * @param elementId The element ID to delete
	 */
	delete(elementId: string): void {
		this.#cache.delete(elementId)
	}

	/**
	 * Queue an element for invalidation. Thread-safe - the actual invalidation
	 * will be applied before the next conversion starts.
	 * @param elementId The element ID to invalidate
	 */
	queueInvalidate(elementId: string): void {
		this.#invalidationQueue.add(elementId)
	}

	/**
	 * Queue a composite element type for invalidation. All elements using this
	 * composite type will be invalidated before the next conversion.
	 * @param compositeTypeId The composite element type ID
	 */
	queueInvalidateCompositeType(compositeTypeIds: Iterable<CompositeElementIdString>): void {
		for (const id of compositeTypeIds) {
			this.#compositeTypesToInvalidate.add(id)
		}
	}

	/**
	 * Queue variables for invalidation. All elements using any of these
	 * variables will be invalidated before the next conversion.
	 * @param changedVariables Set of variable names that have changed
	 */
	queueInvalidateVariables(changedVariables: Iterable<string>): void {
		for (const variable of changedVariables) {
			this.#changedVariables.add(variable)
		}
	}

	/**
	 * Apply all queued invalidations. Call this at the start of a conversion
	 * operation to ensure thread-safe invalidation.
	 */
	applyQueuedInvalidations(): void {
		// Apply direct invalidations
		for (const elementId of this.#invalidationQueue) {
			this.#cache.delete(elementId)
		}
		this.#invalidationQueue.clear()

		// Apply composite type invalidations
		if (this.#compositeTypesToInvalidate.size > 0) {
			for (const [elementId, entry] of this.#cache) {
				if (entry.compositeElement && this.#compositeTypesToInvalidate.has(entry.compositeElement.elementId)) {
					this.#cache.delete(elementId)
				}
			}
			this.#compositeTypesToInvalidate.clear()
		}

		// Apply variable-based invalidations
		if (this.#changedVariables.size > 0) {
			for (const [elementId, entry] of this.#cache) {
				// Check if any of the element's used variables are in the changed set
				if (!entry.usedVariables.isDisjointFrom(this.#changedVariables)) {
					this.#cache.delete(elementId)
					continue
				}
			}
			this.#changedVariables.clear()
		}
	}

	/**
	 * Purge elements that are no longer in the active element list.
	 * Call this after conversion to clean up removed elements while
	 * keeping disabled elements cached.
	 * @param activeElementIds Set of element IDs that are currently in the element tree
	 */
	purgeUnusedElements(activeElementIds: ReadonlySet<string>): void {
		for (const elementId of this.#cache.keys()) {
			if (!activeElementIds.has(elementId)) {
				this.#cache.delete(elementId)
			}
		}
	}

	/**
	 * Clear the entire cache. Used when the control is destroyed or
	 * when a full refresh is needed.
	 */
	clear(): void {
		this.#cache.clear()
		this.#invalidationQueue.clear()
		this.#compositeTypesToInvalidate.clear()
		this.#changedVariables.clear()
	}

	/**
	 * Get all variables used by cached elements
	 * @returns Set of all variable names referenced by cached elements
	 */
	getAllUsedVariables(): Set<string> {
		return new Set(this.#cache.values().flatMap((entry) => entry.usedVariables))
	}
}
