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

export interface UpstreamUrlHost {
	upstreamUrl: string
	upstreamHost: string
}

/**
 * Parse UPSTREAM_URL env var into url and bare host.
 * Uses localhost by default to avoid IPv4/IPv6 mismatches.
 * Handles IPv6 addresses like [::1]:8000.
 */
export function upstreamUrlHost(): UpstreamUrlHost {
	const upstreamUrl = process.env.UPSTREAM_URL || 'localhost:8000'
	const upstreamHost = upstreamUrl.startsWith('[')
		? upstreamUrl.slice(1, upstreamUrl.indexOf(']')) // e.g. ::1
		: upstreamUrl.split(':')[0] // e.g. localhost or 127.0.0.1
	return { upstreamUrl, upstreamHost }
}
