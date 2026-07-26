import { describe, expect, test } from 'vitest'
import { ElementConversionCache, type ElementConversionCacheEntry } from '../../lib/Graphics/ElementConversionCache.js'
import type { CompositeElementIdString } from '../../lib/Instance/Definitions.js'

// Helper to create a minimal cache entry with sensible defaults
function makeEntry(overrides: Partial<ElementConversionCacheEntry> = {}): ElementConversionCacheEntry {
	return {
		drawElement: null,
		usedVariables: new Set(),
		compositeElement: null,
		referencedLocation: null,
		...overrides,
	}
}

function makeCompositeId(id: string): CompositeElementIdString {
	return `conn:${id}` as CompositeElementIdString
}

describe('ElementConversionCache', () => {
	describe('basic operations', () => {
		test('get returns undefined for a missing key', () => {
			const cache = new ElementConversionCache()
			expect(cache.get('missing')).toBeUndefined()
		})

		test('set and get round-trip', () => {
			const cache = new ElementConversionCache()
			const entry = makeEntry({ usedVariables: new Set(['var:x']) })
			cache.set('elem1', entry)
			expect(cache.get('elem1')).toBe(entry)
		})

		test('delete removes an entry', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry())
			cache.delete('elem1')
			expect(cache.get('elem1')).toBeUndefined()
		})

		test('delete on a missing key is a no-op', () => {
			const cache = new ElementConversionCache()
			expect(() => cache.delete('nonexistent')).not.toThrow()
		})

		test('clear removes all entries', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry())
			cache.set('elem2', makeEntry())
			cache.clear()
			expect(cache.get('elem1')).toBeUndefined()
			expect(cache.get('elem2')).toBeUndefined()
		})

		test('clear also flushes queued invalidations', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry())
			cache.queueInvalidate('elem1')
			cache.clear()
			// Re-add the entry; it should not be evicted by the previously queued invalidation
			cache.set('elem1', makeEntry())
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeDefined()
		})
	})

	describe('queueInvalidate + applyQueuedInvalidations', () => {
		test('queued element is removed after apply', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry())
			cache.queueInvalidate('elem1')
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeUndefined()
		})

		test('multiple queued elements are all removed', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry())
			cache.set('elem2', makeEntry())
			cache.set('elem3', makeEntry())
			cache.queueInvalidate('elem1')
			cache.queueInvalidate('elem3')
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeUndefined()
			expect(cache.get('elem2')).toBeDefined()
			expect(cache.get('elem3')).toBeUndefined()
		})

		test('queue is cleared after apply so a second apply has no effect', () => {
			const cache = new ElementConversionCache()
			cache.queueInvalidate('elem1')
			cache.applyQueuedInvalidations()
			// Now add the entry; re-running apply must not remove it
			cache.set('elem1', makeEntry())
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeDefined()
		})

		test('queuing a non-cached element does not throw', () => {
			const cache = new ElementConversionCache()
			cache.queueInvalidate('nonexistent')
			expect(() => cache.applyQueuedInvalidations()).not.toThrow()
		})
	})

	describe('queueInvalidateCompositeType + applyQueuedInvalidations', () => {
		test('entries with a matching composite element are removed', () => {
			const cache = new ElementConversionCache()
			const compositeId = makeCompositeId('button-A')
			cache.set(
				'elem1',
				makeEntry({ compositeElement: { elementId: compositeId, childPropOverrides: {}, childIdPrefix: '' } })
			)
			cache.set('elem2', makeEntry()) // no composite — should survive
			cache.queueInvalidateCompositeType([compositeId])
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeUndefined()
			expect(cache.get('elem2')).toBeDefined()
		})

		test('entries with a different composite element survive', () => {
			const cache = new ElementConversionCache()
			const keepId = makeCompositeId('keep')
			const dropId = makeCompositeId('drop')
			cache.set(
				'elem1',
				makeEntry({ compositeElement: { elementId: keepId, childPropOverrides: {}, childIdPrefix: '' } })
			)
			cache.queueInvalidateCompositeType([dropId])
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeDefined()
		})

		test('multiple composite type IDs can be queued in one call', () => {
			const cache = new ElementConversionCache()
			const idA = makeCompositeId('A')
			const idB = makeCompositeId('B')
			cache.set('elemA', makeEntry({ compositeElement: { elementId: idA, childPropOverrides: {}, childIdPrefix: '' } }))
			cache.set('elemB', makeEntry({ compositeElement: { elementId: idB, childPropOverrides: {}, childIdPrefix: '' } }))
			cache.queueInvalidateCompositeType([idA, idB])
			cache.applyQueuedInvalidations()
			expect(cache.get('elemA')).toBeUndefined()
			expect(cache.get('elemB')).toBeUndefined()
		})

		test('composite type queue is cleared after apply', () => {
			const cache = new ElementConversionCache()
			const compositeId = makeCompositeId('button-A')
			cache.queueInvalidateCompositeType([compositeId])
			cache.applyQueuedInvalidations()
			// Re-add; second apply must not remove it
			cache.set(
				'elem1',
				makeEntry({ compositeElement: { elementId: compositeId, childPropOverrides: {}, childIdPrefix: '' } })
			)
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeDefined()
		})
	})

	describe('queueInvalidateVariables + applyQueuedInvalidations', () => {
		test('entries that use a changed variable are removed', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry({ usedVariables: new Set(['var:x', 'var:y']) }))
			cache.queueInvalidateVariables(['var:x'])
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeUndefined()
		})

		test('entries with no matching variables survive', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry({ usedVariables: new Set(['var:z']) }))
			cache.queueInvalidateVariables(['var:x'])
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeDefined()
		})

		test('entries with no used variables survive', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry({ usedVariables: new Set() }))
			cache.queueInvalidateVariables(['var:x'])
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeDefined()
		})

		test('multiple variables can be queued in one call', () => {
			const cache = new ElementConversionCache()
			cache.set('elemA', makeEntry({ usedVariables: new Set(['var:a']) }))
			cache.set('elemB', makeEntry({ usedVariables: new Set(['var:b']) }))
			cache.set('elemC', makeEntry({ usedVariables: new Set(['var:c']) }))
			cache.queueInvalidateVariables(['var:a', 'var:b'])
			cache.applyQueuedInvalidations()
			expect(cache.get('elemA')).toBeUndefined()
			expect(cache.get('elemB')).toBeUndefined()
			expect(cache.get('elemC')).toBeDefined()
		})

		test('variable queue is cleared after apply', () => {
			const cache = new ElementConversionCache()
			cache.queueInvalidateVariables(['var:x'])
			cache.applyQueuedInvalidations()
			// Re-add; second apply must not remove it
			cache.set('elem1', makeEntry({ usedVariables: new Set(['var:x']) }))
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeDefined()
		})
	})

	describe('queueInvalidateReferencedLocation', () => {
		test('entries matching the location are queued and removed on apply', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry({ referencedLocation: '1/0/0' }))
			cache.set('elem2', makeEntry({ referencedLocation: '2/0/0' }))
			cache.queueInvalidateReferencedLocation('1/0/0')
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeUndefined()
			expect(cache.get('elem2')).toBeDefined()
		})

		test('entries with null referencedLocation are not affected', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry({ referencedLocation: null }))
			cache.queueInvalidateReferencedLocation('1/0/0')
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeDefined()
		})

		test('entries with no referencedLocation property are not affected', () => {
			const cache = new ElementConversionCache()
			const entry = makeEntry()
			// Omit referencedLocation entirely by deleting it from the spread result
			const { referencedLocation: _referencedLocation, ...entryWithoutRef } = entry
			cache.set('elem1', entryWithoutRef)
			cache.queueInvalidateReferencedLocation('1/0/0')
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeDefined()
		})

		test('multiple entries can reference the same location', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry({ referencedLocation: '1/0/0' }))
			cache.set('elem2', makeEntry({ referencedLocation: '1/0/0' }))
			cache.queueInvalidateReferencedLocation('1/0/0')
			cache.applyQueuedInvalidations()
			expect(cache.get('elem1')).toBeUndefined()
			expect(cache.get('elem2')).toBeUndefined()
		})
	})

	describe('purgeUnusedElements', () => {
		test('elements not in the active set are removed', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry())
			cache.set('elem2', makeEntry())
			cache.purgeUnusedElements(new Set(['elem1']))
			expect(cache.get('elem1')).toBeDefined()
			expect(cache.get('elem2')).toBeUndefined()
		})

		test('all elements are removed when active set is empty', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry())
			cache.set('elem2', makeEntry())
			cache.purgeUnusedElements(new Set())
			expect(cache.get('elem1')).toBeUndefined()
			expect(cache.get('elem2')).toBeUndefined()
		})

		test('all elements are preserved when all are active', () => {
			const cache = new ElementConversionCache()
			cache.set('elem1', makeEntry())
			cache.set('elem2', makeEntry())
			cache.purgeUnusedElements(new Set(['elem1', 'elem2']))
			expect(cache.get('elem1')).toBeDefined()
			expect(cache.get('elem2')).toBeDefined()
		})
	})

	describe('combined invalidation', () => {
		test('direct, composite, and variable invalidations are all applied atomically', () => {
			const cache = new ElementConversionCache()
			const compositeId = makeCompositeId('comp-X')
			cache.set('direct', makeEntry())
			cache.set(
				'composite',
				makeEntry({ compositeElement: { elementId: compositeId, childPropOverrides: {}, childIdPrefix: '' } })
			)
			cache.set('variable', makeEntry({ usedVariables: new Set(['var:v']) }))
			cache.set('survivor', makeEntry({ usedVariables: new Set(['var:other']) }))

			cache.queueInvalidate('direct')
			cache.queueInvalidateCompositeType([compositeId])
			cache.queueInvalidateVariables(['var:v'])
			cache.applyQueuedInvalidations()

			expect(cache.get('direct')).toBeUndefined()
			expect(cache.get('composite')).toBeUndefined()
			expect(cache.get('variable')).toBeUndefined()
			expect(cache.get('survivor')).toBeDefined()
		})
	})
})
