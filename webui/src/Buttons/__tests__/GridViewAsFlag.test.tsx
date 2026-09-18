import { act, renderHook } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GRID_VIEW_AS_FLAG_STORAGE_KEY, useGridViewAsFlag } from '../GridViewAsFlag.js'

// jsdom runs on an opaque origin, so window.localStorage is undefined. Install a minimal in-memory Storage.
class MemoryStorage {
	#m = new Map<string, string>()
	get length(): number {
		return this.#m.size
	}
	key(i: number): string | null {
		return Array.from(this.#m.keys())[i] ?? null
	}
	getItem(k: string): string | null {
		return this.#m.has(k) ? this.#m.get(k)! : null
	}
	setItem(k: string, v: string): void {
		this.#m.set(k, String(v))
	}
	removeItem(k: string): void {
		this.#m.delete(k)
	}
	clear(): void {
		this.#m.clear()
	}
}

beforeAll(() => {
	Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true })
})

describe('useGridViewAsFlag', () => {
	beforeEach(() => window.localStorage.clear())

	it('is off until somebody turns it on', () => {
		expect(renderHook(() => useGridViewAsFlag()).result.current[0]).toBe(false)
	})

	it('remembers being turned on', () => {
		const { result } = renderHook(() => useGridViewAsFlag())

		act(() => result.current[1](true))

		expect(result.current[0]).toBe(true)
		// A second reader of the flag sees it too, without the page being reloaded
		expect(renderHook(() => useGridViewAsFlag()).result.current[0]).toBe(true)
	})

	it('can be turned back off', () => {
		const { result } = renderHook(() => useGridViewAsFlag())

		act(() => result.current[1](true))
		act(() => result.current[1](false))

		expect(result.current[0]).toBe(false)
	})

	// The value is hand-editable, and a page which will not load is a worse outcome than a flag which is off
	it('is off for a stored value which makes no sense', () => {
		window.localStorage.setItem(GRID_VIEW_AS_FLAG_STORAGE_KEY, 'not json at all')

		expect(renderHook(() => useGridViewAsFlag()).result.current[0]).toBe(false)
	})
})
