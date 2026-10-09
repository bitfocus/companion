import { describe, expect, it } from 'vitest'
import { channelFromVersionBuild } from '../updateChannel.js'

describe('channelFromVersionBuild', () => {
	it('treats a tagged release (no build suffix) as stable', () => {
		expect(channelFromVersionBuild('')).toBe('stable')
	})

	it('detects beta builds from the git ref', () => {
		expect(channelFromVersionBuild('1234-beta-abcdef0')).toBe('beta')
		expect(channelFromVersionBuild('1234-v4-1-0-Beta-abcdef0')).toBe('beta')
	})

	it('treats any other ref as experimental', () => {
		expect(channelFromVersionBuild('1234-main-abcdef0')).toBe('experimental')
		expect(channelFromVersionBuild('1234-feat-uiRefresh-abcdef0')).toBe('experimental')
	})
})
