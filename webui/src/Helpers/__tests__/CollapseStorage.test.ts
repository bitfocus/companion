import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import type { CollapseEvictionOwner } from '../CollapseHelper.js'
import { evictBySizeIfNeeded, evictDeadOwnedKeys, MAX_COLLAPSE_KEYS, type LiveIdSets } from '../CollapseStorage.js'

const PREFIX = 'companion_ui_collapsed_'

// jsdom here runs on an opaque origin, so window.localStorage is undefined. Install a minimal
// in-memory Storage so we can exercise the eviction logic directly.
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

function seed(
	storageId: string,
	value: { owner?: CollapseEvictionOwner; lastUsedAt?: number; raw?: string } = {}
): string {
	const key = `${PREFIX}${storageId}`
	if (value.raw !== undefined) {
		window.localStorage.setItem(key, value.raw)
	} else {
		window.localStorage.setItem(
			key,
			JSON.stringify({ defaultExpandedAt: {}, ids: {}, lastUsedAt: value.lastUsedAt, owner: value.owner })
		)
	}
	return key
}

function collapseKeys(): string[] {
	const keys: string[] = []
	for (let i = 0; i < window.localStorage.length; i++) {
		const key = window.localStorage.key(i)
		if (key?.startsWith(PREFIX)) keys.push(key)
	}
	return keys.sort()
}

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('evictDeadOwnedKeys', () => {
	const live: LiveIdSets = {
		controls: new Set(['bank:live', 'trigger:live', 'expression-variable:live']),
		connections: new Set(['conn-live']),
	}

	test('removes keys whose owner is a dead control or connection', () => {
		const deadControl = seed('action_bank:dead_0', { owner: { kind: 'control', id: 'bank:dead' }, lastUsedAt: 1 })
		const deadConn = seed('preset-sections-conn-dead', {
			owner: { kind: 'connection', id: 'conn-dead' },
			lastUsedAt: 1,
		})

		evictDeadOwnedKeys(live)

		expect(window.localStorage.getItem(deadControl)).toBeNull()
		expect(window.localStorage.getItem(deadConn)).toBeNull()
	})

	test('keeps keys whose owner is still live', () => {
		const liveControl = seed('action_bank:live_0', { owner: { kind: 'control', id: 'bank:live' }, lastUsedAt: 1 })
		const liveConn = seed('preset-sections-conn-live', {
			owner: { kind: 'connection', id: 'conn-live' },
			lastUsedAt: 1,
		})

		evictDeadOwnedKeys(live)

		expect(window.localStorage.getItem(liveControl)).not.toBeNull()
		expect(window.localStorage.getItem(liveConn)).not.toBeNull()
	})

	test('keeps owner-less (fixed) and legacy keys', () => {
		const fixed = seed('action_recorder', { lastUsedAt: 1 })
		const legacy = seed('actions_bank:gone_entities', { raw: JSON.stringify({ defaultExpandedAt: {}, ids: {} }) })
		const unparseable = seed('garbage', { raw: 'not json' })

		evictDeadOwnedKeys(live)

		expect(window.localStorage.getItem(fixed)).not.toBeNull()
		expect(window.localStorage.getItem(legacy)).not.toBeNull()
		expect(window.localStorage.getItem(unparseable)).not.toBeNull()
	})

	test('uses owner metadata not string parsing (control id containing underscores)', () => {
		// The embedded id contains underscores; a naive `_`-split parser would mis-extract it.
		const liveWithUnderscore: LiveIdSets = { controls: new Set(['bank:ab_cd_ef']), connections: new Set() }
		const key = seed('actions_bank:ab_cd_ef_entities', {
			owner: { kind: 'control', id: 'bank:ab_cd_ef' },
			lastUsedAt: 1,
		})

		evictDeadOwnedKeys(liveWithUnderscore)

		expect(window.localStorage.getItem(key)).not.toBeNull()
	})

	test('does not touch unrelated localStorage keys', () => {
		window.localStorage.setItem('debug_config', '{"warn":true}')
		evictDeadOwnedKeys(live)
		expect(window.localStorage.getItem('debug_config')).toBe('{"warn":true}')
	})
})

describe('evictBySizeIfNeeded', () => {
	test('is a no-op when under the cap', () => {
		for (let i = 0; i < 10; i++) seed(`k${i}`, { lastUsedAt: i })
		evictBySizeIfNeeded()
		expect(collapseKeys()).toHaveLength(10)
	})

	test('evicts oldest (and lastUsedAt-less) keys first until under the cap', () => {
		const overBy = 5
		const total = MAX_COLLAPSE_KEYS + overBy

		// First `overBy` keys have no lastUsedAt (legacy bloat) — should be evicted first.
		const legacyKeys: string[] = []
		for (let i = 0; i < overBy; i++) legacyKeys.push(seed(`legacy${i}`))
		// The rest have ascending, recent timestamps.
		for (let i = 0; i < total - overBy; i++) seed(`fresh${i}`, { lastUsedAt: 1000 + i })

		evictBySizeIfNeeded()

		const remaining = collapseKeys()
		expect(remaining).toHaveLength(MAX_COLLAPSE_KEYS)
		for (const legacy of legacyKeys) {
			expect(window.localStorage.getItem(legacy)).toBeNull()
		}
	})
})
