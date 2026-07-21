import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { useLocalStorage } from '../useLocalStorage.js'

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

beforeEach(() => {
	window.localStorage.clear()
})

afterEach(() => {
	window.localStorage.clear()
})

/** Simulate another window/tab writing the key: mutate storage directly, then fire the native `storage` event. */
function simulateCrossWindowWrite(key: string, value: unknown): void {
	window.localStorage.setItem(key, JSON.stringify(value))
	window.dispatchEvent(new StorageEvent('storage', { key }))
}

describe('useLocalStorage', () => {
	test('initializes from localStorage and persists writes', () => {
		window.localStorage.setItem('k', JSON.stringify('stored'))

		const { result } = renderHook(() => useLocalStorage('k', 'fallback'))
		expect(result.current[0]).toBe('stored')

		act(() => result.current[1]('updated'))
		expect(result.current[0]).toBe('updated')
		expect(window.localStorage.getItem('k')).toBe(JSON.stringify('updated'))
	})

	test('falls back to the initial value when nothing is stored', () => {
		const { result } = renderHook(() => useLocalStorage('missing', 'fallback'))
		expect(result.current[0]).toBe('fallback')
	})

	test('supports functional updates', () => {
		const { result } = renderHook(() => useLocalStorage('n', 1))
		act(() => result.current[1]((prev) => prev + 1))
		expect(result.current[0]).toBe(2)
	})

	test('does NOT live-sync across windows by default', () => {
		const { result } = renderHook(() => useLocalStorage('tab', 'step1'))
		expect(result.current[0]).toBe('step1')

		act(() => simulateCrossWindowWrite('tab', 'step2'))

		// The other window's change must not move this window's selection
		expect(result.current[0]).toBe('step1')
	})

	test('live-syncs across windows when sync is enabled', () => {
		const { result } = renderHook(() => useLocalStorage('tab', 'step1', { sync: true }))
		expect(result.current[0]).toBe('step1')

		act(() => simulateCrossWindowWrite('tab', 'step2'))

		expect(result.current[0]).toBe('step2')
	})

	test('ignores cross-window events for other keys even when syncing', () => {
		const { result } = renderHook(() => useLocalStorage('tab', 'step1', { sync: true }))

		act(() => simulateCrossWindowWrite('somethingElse', 'noise'))

		expect(result.current[0]).toBe('step1')
	})

	test('removeValue clears storage and resets to the initial value', () => {
		const { result } = renderHook(() => useLocalStorage('k', 'fallback'))
		act(() => result.current[1]('changed'))
		expect(window.localStorage.getItem('k')).toBe(JSON.stringify('changed'))

		act(() => result.current[2]())
		expect(result.current[0]).toBe('fallback')
		expect(window.localStorage.getItem('k')).toBeNull()
	})
})
