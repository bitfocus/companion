import type { CollapseEvictionOwner } from './CollapseHelper.js'

/**
 * Eviction of orphaned UI collapse-state keys from localStorage.
 *
 * `CollapseHelper` persists expand/collapse state under `companion_ui_collapsed_*` keys, one
 * (or more) per control/connection. Historically these keys were never removed when their owning
 * control was deleted, so they accumulated until localStorage hit its quota and writes started
 * failing. This module bounds that growth without losing useful state:
 *
 * 1. {@link evictDeadOwnedKeys} (primary) — deletes only keys whose declared `owner` is confirmably
 *    absent from the currently-loaded set of live ids. Keys without an owner (fixed UI sections, or
 *    legacy keys written before owner metadata existed) are kept. No storageId string parsing.
 * 2. {@link evictBySizeIfNeeded} (backstop) — if the total key count exceeds {@link MAX_COLLAPSE_KEYS},
 *    evicts the least-recently-used keys until back under the cap. Keys with no `lastUsedAt`
 *    (legacy bloat) sort oldest and so are evicted first.
 *
 * Everything here is best-effort: failures (including absent/blocked localStorage) are swallowed.
 */

const KEY_PREFIX = 'companion_ui_collapsed_'

/**
 * Maximum number of collapse-state keys to retain. Values can be a few KB each (a panel with
 * many entities), so this keeps the total comfortably within the localStorage quota.
 */
export const MAX_COLLAPSE_KEYS = 500

/** The complete, currently-loaded set of live entity ids, used to detect dead `owner`s. */
export interface LiveIdSets {
	/** Union of all control ids (buttons, triggers, expression variables), e.g. `bank:xxx`, `trigger:xxx`. */
	controls: ReadonlySet<string>
	/** All connection ids. */
	connections: ReadonlySet<string>
}

interface ParsedEntry {
	key: string
	lastUsedAt: number | undefined
	owner: CollapseEvictionOwner | undefined
}

/** Scan localStorage for collapse-state keys and parse the bits of metadata we care about. */
function enumerateCollapseEntries(): ParsedEntry[] {
	const entries: ParsedEntry[] = []

	for (let i = 0; i < window.localStorage.length; i++) {
		const key = window.localStorage.key(i)
		if (!key || !key.startsWith(KEY_PREFIX)) continue

		let lastUsedAt: number | undefined
		let owner: CollapseEvictionOwner | undefined
		try {
			const raw = window.localStorage.getItem(key)
			if (raw) {
				const parsed = JSON.parse(raw)
				if (typeof parsed?.lastUsedAt === 'number') lastUsedAt = parsed.lastUsedAt
				if (parsed?.owner && typeof parsed.owner.kind === 'string' && typeof parsed.owner.id === 'string') {
					owner = parsed.owner
				}
			}
		} catch (_e) {
			// Unparseable value: treat as a key with no metadata (kept by known-id eviction,
			// evicted first by the size cap as it has no lastUsedAt).
		}

		entries.push({ key, lastUsedAt, owner })
	}

	return entries
}

function isOwnerDead(owner: CollapseEvictionOwner, live: LiveIdSets): boolean {
	switch (owner.kind) {
		case 'control':
			return !live.controls.has(owner.id)
		case 'connection':
			return !live.connections.has(owner.id)
		default:
			// Unknown kind (e.g. written by a newer version): keep, never delete on doubt.
			return false
	}
}

/**
 * Primary eviction: remove keys whose declared owner is confirmably absent from the live set.
 * Must only be called once the relevant stores have fully loaded, so that an absent id genuinely
 * means "deleted" rather than "not loaded yet".
 */
export function evictDeadOwnedKeys(live: LiveIdSets): void {
	try {
		for (const entry of enumerateCollapseEntries()) {
			if (entry.owner && isOwnerDead(entry.owner, live)) {
				window.localStorage.removeItem(entry.key)
			}
		}
	} catch (e) {
		console.warn('Failed to evict dead collapse-state keys:', e)
	}
}

/**
 * Backstop eviction: if there are more than {@link MAX_COLLAPSE_KEYS} collapse-state keys, remove
 * the least-recently-used ones until back under the cap. Safe to run at bootstrap with no store
 * data; this is what relieves users whose localStorage is already full.
 */
export function evictBySizeIfNeeded(): void {
	try {
		const entries = enumerateCollapseEntries()
		if (entries.length <= MAX_COLLAPSE_KEYS) return

		// Oldest first; missing lastUsedAt (legacy keys) sorts as oldest and is evicted first.
		entries.sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0))

		const removeCount = entries.length - MAX_COLLAPSE_KEYS
		for (let i = 0; i < removeCount; i++) {
			window.localStorage.removeItem(entries[i].key)
		}
	} catch (e) {
		console.warn('Failed to size-cap collapse-state keys:', e)
	}
}
