/**
 * Shared utilities for Vite config and dev scripts.
 * Pure functions only — no side effects, safe to import anywhere.
 */

/**
 * Normalize a base path: ensure leading slash, no trailing slash.
 * Returns '' if no base path is set.
 */
export function normalizeBasePath(base: string): string {
	let normalized = base.startsWith('/') ? base : `/${base}`
	normalized = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
	return normalized === '/' ? '' : normalized
}
