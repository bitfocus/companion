import { describe, expect, test } from 'vitest'
import { matchUpgradePathname } from '../../lib/UI/Handler.js'

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
