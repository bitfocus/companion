import { describe, expect, test } from 'vitest'
import { resolveReleaseVersion } from '../satellite-protocol/release-version.mts'

describe('resolveReleaseVersion', () => {
	describe('tag push', () => {
		test('publishes the package version as latest', () => {
			expect(
				resolveReleaseVersion({ event: 'push', tag: 'satellite-protocol-v1.2.3', packageVersion: '1.2.3' })
			).toEqual({ version: '1.2.3', distTag: 'latest' })
		})

		test('publishes a prerelease version as next', () => {
			expect(
				resolveReleaseVersion({
					event: 'push',
					tag: 'satellite-protocol-v2.0.0-beta.1',
					packageVersion: '2.0.0-beta.1',
				})
			).toEqual({ version: '2.0.0-beta.1', distTag: 'next' })
		})

		test.each(['satellite-protocol-v1.2.4', 'v1.2.3', '1.2.3', 'satellite-protocol-1.2.3'])(
			'rejects the tag %s for version 1.2.3',
			(tag) => {
				expect(() => resolveReleaseVersion({ event: 'push', tag, packageVersion: '1.2.3' })).toThrow(/does not match/)
			}
		)

		test('rejects an invalid package version', () => {
			expect(() =>
				resolveReleaseVersion({ event: 'push', tag: 'satellite-protocol-v1.2', packageVersion: '1.2' })
			).toThrow(/Invalid package version/)
		})
	})

	describe('manual prerelease', () => {
		const request = {
			event: 'workflow_dispatch',
			packageVersion: '0.1.0',
			bump: 'patch',
			distTag: 'dev',
			runNumber: 12,
			runAttempt: 1,
			sha: 'abc1234def5678',
		} as const

		test.each([
			['patch', '0.1.0', '0.1.1'],
			['minor', '0.1.0', '0.2.0'],
			['major', '0.1.0', '1.0.0'],
			['as-is', '0.1.0', '0.1.0'],
			['patch', '1.9.9', '1.9.10'],
			['minor', '1.2.3-beta.1', '1.3.0'],
			['as-is', '1.2.3-beta.1', '1.2.3'],
		])('a %s bump of %s is based on %s', (bump, packageVersion, base) => {
			expect(resolveReleaseVersion({ ...request, bump, packageVersion })).toEqual({
				version: `${base}-dev.12.1.gabc1234`,
				distTag: 'dev',
			})
		})

		test('includes the chosen dist-tag, run number and attempt', () => {
			expect(resolveReleaseVersion({ ...request, distTag: 'feature-x', runNumber: 40, runAttempt: 3 }).version).toBe(
				'0.1.1-feature-x.40.3.gabc1234'
			)
		})

		test('prefixes the sha so an all-digit sha stays a valid semver identifier', () => {
			expect(resolveReleaseVersion({ ...request, sha: '0123456789' }).version).toBe('0.1.1-dev.12.1.g0123456')
		})

		test.each(['latest', 'next', 'Dev', '1dev', 'dev tag', ''])('rejects the dist-tag %j', (distTag) => {
			expect(() => resolveReleaseVersion({ ...request, distTag })).toThrow(/dist-tag/)
		})

		test.each(['', 'huge', 'PATCH'])('rejects the bump %j', (bump) => {
			expect(() => resolveReleaseVersion({ ...request, bump })).toThrow(/bump/)
		})

		test.each(['', 'abc', 'not-a-sha'])('rejects the sha %j', (sha) => {
			expect(() => resolveReleaseVersion({ ...request, sha })).toThrow(/sha/)
		})
	})
})
