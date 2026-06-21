import { describe, expect, test } from 'vitest'
import { isOriginAllowed, matchUpgradePathname } from '../../lib/UI/Handler.js'

describe('matchUpgradePathname', () => {
	test('matches plain /trpc', () => {
		expect(matchUpgradePathname('/trpc')).toBe(true)
	})

	test('matches /trpc with trailing slash', () => {
		expect(matchUpgradePathname('/trpc/')).toBe(true)
	})

	test('matches /trpc with query string', () => {
		expect(matchUpgradePathname('/trpc?foo=1')).toBe(true)
		expect(matchUpgradePathname('/trpc/?foo=1&bar=2')).toBe(true)
	})

	test('rejects other paths', () => {
		expect(matchUpgradePathname('/')).toBe(false)
		expect(matchUpgradePathname('/other')).toBe(false)
		expect(matchUpgradePathname('/trpc2')).toBe(false)
		expect(matchUpgradePathname('/trpc/extra')).toBe(false)
		expect(matchUpgradePathname('/api/trpc')).toBe(false)
	})

	test('rejects missing url', () => {
		expect(matchUpgradePathname(undefined)).toBe(false)
		expect(matchUpgradePathname('')).toBe(false)
	})
})

describe('isOriginAllowed', () => {
	const noProxy = { trustForwardedHost: false }
	const withProxy = { trustForwardedHost: true }

	test('allows same-origin http with explicit port', () => {
		expect(isOriginAllowed({ origin: 'http://host:8000', host: 'host:8000' }, noProxy)).toBe(true)
	})

	test('allows same-origin https on default port', () => {
		expect(isOriginAllowed({ origin: 'https://host', host: 'host' }, noProxy)).toBe(true)
	})

	test('allows same-origin http with default port stripped', () => {
		expect(isOriginAllowed({ origin: 'http://host:80', host: 'host' }, noProxy)).toBe(true)
		expect(isOriginAllowed({ origin: 'http://host', host: 'host' }, noProxy)).toBe(true)
	})

	test('compares host case-insensitively', () => {
		expect(isOriginAllowed({ origin: 'http://HOST:8000', host: 'host:8000' }, noProxy)).toBe(true)
		expect(isOriginAllowed({ origin: 'http://host:8000', host: 'HOST:8000' }, noProxy)).toBe(true)
	})

	test('rejects a cross-origin host', () => {
		expect(isOriginAllowed({ origin: 'http://evil.com', host: 'host:8000' }, noProxy)).toBe(false)
	})

	test('rejects a mismatched port', () => {
		expect(isOriginAllowed({ origin: 'http://host:9999', host: 'host:8000' }, noProxy)).toBe(false)
	})

	test('allows a missing Origin header (non-browser client)', () => {
		expect(isOriginAllowed({ host: 'host:8000' }, noProxy)).toBe(true)
	})

	test('rejects a "null" Origin', () => {
		expect(isOriginAllowed({ origin: 'null', host: 'host:8000' }, noProxy)).toBe(false)
	})

	test('rejects a malformed Origin', () => {
		expect(isOriginAllowed({ origin: 'not a url', host: 'host:8000' }, noProxy)).toBe(false)
		expect(isOriginAllowed({ origin: '::::', host: 'host:8000' }, noProxy)).toBe(false)
	})

	test('rejects when there is no host to compare against', () => {
		expect(isOriginAllowed({ origin: 'http://host:8000' }, noProxy)).toBe(false)
	})

	test('allows an IPv6 host', () => {
		expect(isOriginAllowed({ origin: 'http://[::1]:8000', host: '[::1]:8000' }, noProxy)).toBe(true)
	})

	test('honors X-Forwarded-Host behind a trusted proxy', () => {
		expect(
			isOriginAllowed(
				{ origin: 'https://public.example.com', host: 'internal:3000', 'x-forwarded-host': 'public.example.com' },
				withProxy
			)
		).toBe(true)
	})

	test('ignores X-Forwarded-Host when not behind a trusted proxy (spoof protection)', () => {
		expect(
			isOriginAllowed(
				{ origin: 'https://public.example.com', host: 'internal:3000', 'x-forwarded-host': 'public.example.com' },
				noProxy
			)
		).toBe(false)
	})

	test('uses the first X-Forwarded-Host value from a comma-separated list', () => {
		expect(
			isOriginAllowed(
				{ origin: 'https://public.example.com', host: 'internal:3000', 'x-forwarded-host': 'public.example.com, proxy' },
				withProxy
			)
		).toBe(true)
	})

	test('uses the first X-Forwarded-Host value from an array', () => {
		expect(
			isOriginAllowed(
				{ origin: 'https://public.example.com', host: 'internal:3000', 'x-forwarded-host': ['public.example.com', 'proxy'] },
				withProxy
			)
		).toBe(true)
	})
})
