import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
	DEFAULT_ESTIMATED_GRID_HEIGHT,
	EntityListHeightCacheProvider,
	useEntityListHeightCache,
} from '../EntityListHeightCacheContext.js'

function renderCache() {
	const { result } = renderHook(() => useEntityListHeightCache(), {
		wrapper: ({ children }) => <EntityListHeightCacheProvider>{children}</EntityListHeightCacheProvider>,
	})
	return result.current
}

describe('EntityListHeightCache', () => {
	it('throws when used outside a provider', () => {
		// React logs the render error to console.error; silence it for clean test output
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
		expect(() => renderHook(() => useEntityListHeightCache())).toThrow(/EntityListHeightCacheProvider/)
		spy.mockRestore()
	})

	it('returns the default estimate when nothing is cached', () => {
		const cache = renderCache()
		expect(cache.estimate('entity-1', 'conn::action::def')).toBe(DEFAULT_ESTIMATED_GRID_HEIGHT)
	})

	it('returns the exact cached height for a known entity', () => {
		const cache = renderCache()
		cache.set('entity-1', 'conn::action::def', 321)
		expect(cache.estimate('entity-1', 'conn::action::def')).toBe(321)
	})

	it('estimates an unseen entity from another entity of the same definition', () => {
		const cache = renderCache()
		cache.set('entity-1', 'conn::action::def', 280)
		// A different entity that shares the definition key, never measured itself
		expect(cache.estimate('entity-2', 'conn::action::def')).toBe(280)
	})

	it('falls back to the default for an entity of an unknown definition', () => {
		const cache = renderCache()
		cache.set('entity-1', 'conn::action::def', 280)
		expect(cache.estimate('entity-2', 'conn::action::other')).toBe(DEFAULT_ESTIMATED_GRID_HEIGHT)
	})

	it('prefers the exact entity height over the definition estimate', () => {
		const cache = renderCache()
		cache.set('entity-1', 'conn::action::def', 280)
		cache.set('entity-2', 'conn::action::def', 410)
		expect(cache.estimate('entity-2', 'conn::action::def')).toBe(410)
	})

	it('ignores a zero height (an unmeasured/hidden element)', () => {
		const cache = renderCache()
		cache.set('entity-1', 'conn::action::def', 0)
		expect(cache.estimate('entity-1', 'conn::action::def')).toBe(DEFAULT_ESTIMATED_GRID_HEIGHT)
	})

	it('clear() drops all cached heights so estimates fall back to the default', () => {
		const cache = renderCache()
		cache.set('entity-1', 'conn::action::def', 280)
		cache.clear()
		expect(cache.estimate('entity-1', 'conn::action::def')).toBe(DEFAULT_ESTIMATED_GRID_HEIGHT)
	})
})
