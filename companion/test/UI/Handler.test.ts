import { describe, expect, test } from 'vitest'
import { isLoopbackHostAllowed, isOriginAllowed, matchUpgradePathname } from '../../lib/UI/Handler.js'

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
				{
					origin: 'https://public.example.com',
					host: 'internal:3000',
					'x-forwarded-host': 'public.example.com, proxy',
				},
				withProxy
			)
		).toBe(true)
	})

	test('uses the first X-Forwarded-Host value from an array', () => {
		expect(
			isOriginAllowed(
				{
					origin: 'https://public.example.com',
					host: 'internal:3000',
					'x-forwarded-host': ['public.example.com', 'proxy'],
				},
				withProxy
			)
		).toBe(true)
	})
})

describe('isLoopbackHostAllowed', () => {
	// The peer is not a trusted proxy (the caller resolved this per-request).
	const noProxy = { isTrustedProxy: false }
	// The peer is a trusted proxy (e.g. a 'loopback' config matching it, or a real forwarding proxy).
	const fromProxy = { isTrustedProxy: true }

	test('allows a loopback connection with a loopback Host', () => {
		expect(isLoopbackHostAllowed('127.0.0.1', 'localhost:8000', noProxy)).toBe(true)
		expect(isLoopbackHostAllowed('127.0.0.1', '127.0.0.1:8000', noProxy)).toBe(true)
		expect(isLoopbackHostAllowed('::1', '[::1]:8000', noProxy)).toBe(true)
	})

	test('rejects a loopback connection whose Host names a real domain (rebinding signature)', () => {
		expect(isLoopbackHostAllowed('127.0.0.1', 'evil.com', noProxy)).toBe(false)
		expect(isLoopbackHostAllowed('127.0.0.1', 'evil.com:8000', noProxy)).toBe(false)
		expect(isLoopbackHostAllowed('::1', 'codirect.live:8002', noProxy)).toBe(false)
	})

	test('rejects a domain that merely shares a loopback prefix (e.g. 127.evil.com)', () => {
		// An attacker can point such a domain at 127.0.0.1; it must not be treated as a loopback literal.
		expect(isLoopbackHostAllowed('127.0.0.1', '127.evil.com', noProxy)).toBe(false)
		expect(isLoopbackHostAllowed('127.0.0.1', '127.evil.com:8000', noProxy)).toBe(false)
		expect(isLoopbackHostAllowed('127.0.0.1', '127.0.0.1.evil.com', noProxy)).toBe(false)
		expect(isLoopbackHostAllowed('127.0.0.1', 'localhost.evil.com', noProxy)).toBe(false)
	})

	test('handles IPv4-mapped IPv6 loopback addresses', () => {
		expect(isLoopbackHostAllowed('::ffff:127.0.0.1', 'localhost:8000', noProxy)).toBe(true)
		expect(isLoopbackHostAllowed('::ffff:127.0.0.1', 'evil.com', noProxy)).toBe(false)
	})

	test('does not check non-loopback (LAN/remote) connections', () => {
		expect(isLoopbackHostAllowed('192.168.1.50', 'evil.com', noProxy)).toBe(true)
		expect(isLoopbackHostAllowed('192.168.1.50', 'companion.local:8000', noProxy)).toBe(true)
		expect(isLoopbackHostAllowed('203.0.113.4', 'anything', noProxy)).toBe(true)
	})

	test('skips the check when the peer is a trusted proxy forwarding an external host', () => {
		expect(isLoopbackHostAllowed('10.0.0.1', 'public.example.com', fromProxy)).toBe(true)
		// Loopback peer resolved as a trusted proxy (e.g. a 'loopback' config) also skips - unavoidable,
		// the local proxy and a local browser are indistinguishable at that point.
		expect(isLoopbackHostAllowed('127.0.0.1', 'evil.com', fromProxy)).toBe(true)
	})

	test('rejects a loopback connection with a missing or malformed Host', () => {
		expect(isLoopbackHostAllowed('127.0.0.1', undefined, noProxy)).toBe(false)
		expect(isLoopbackHostAllowed('127.0.0.1', '', noProxy)).toBe(false)
	})

	test('compares the Host case-insensitively', () => {
		expect(isLoopbackHostAllowed('127.0.0.1', 'LOCALHOST:8000', noProxy)).toBe(true)
		expect(isLoopbackHostAllowed('127.0.0.1', 'EVIL.com', noProxy)).toBe(false)
	})

	test('allows other 127.x loopback addresses and hosts', () => {
		expect(isLoopbackHostAllowed('127.0.0.2', '127.0.0.2:8000', noProxy)).toBe(true)
	})
})
