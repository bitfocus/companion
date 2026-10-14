import { describe, expect, test } from 'vitest'
import {
	activePageIdForPath,
	matchedPageIdForPath,
	navLocationForPath,
	SETTINGS_SECTION,
	SURFACES_SECTION,
	VARIABLES_SECTION,
} from '../navRegistry.js'

describe('matchedPageIdForPath', () => {
	test.each([
		['/variables', 'connections'],
		['/variables/my_connection', 'connections'],
		['/variables/custom', 'custom'],
		['/variables/custom/my_var', 'custom'],
		['/variables/expression', 'expression'],
		['/variables/expression/abc123', 'expression'],
	])('%s is on the %s page', (pathname, pageId) => {
		expect(matchedPageIdForPath(VARIABLES_SECTION, pathname)).toBe(pageId)
	})

	test('child routes of a nested page match that page, not the section root', () => {
		expect(matchedPageIdForPath(SURFACES_SECTION, '/surfaces/integrations/xyz')).toBe('integrations')
		expect(matchedPageIdForPath(SETTINGS_SECTION, '/settings/protocols/tcp')).toBe('protocols')
	})

	test('an extra path counts at its own length', () => {
		expect(matchedPageIdForPath(SURFACES_SECTION, '/surfaces/discover')).toBe('remote')
		expect(matchedPageIdForPath(SURFACES_SECTION, '/surfaces/discover/abc')).toBe('remote')
	})

	test('a path outside the section matches nothing', () => {
		expect(matchedPageIdForPath(VARIABLES_SECTION, '/buttons')).toBe(null)
		// A shared prefix is not a match
		expect(matchedPageIdForPath(VARIABLES_SECTION, '/variablesx')).toBe(null)
	})
})

describe('activePageIdForPath', () => {
	test("falls back to the section's first page", () => {
		expect(activePageIdForPath(VARIABLES_SECTION, '/buttons')).toBe('connections')
		expect(activePageIdForPath(VARIABLES_SECTION, '/variables/custom/x')).toBe('custom')
	})
})

describe('navLocationForPath', () => {
	test('a page in a section, including its child routes', () => {
		const location = navLocationForPath('/settings/protocols/tcp')
		expect(location?.section?.id).toBe('settings')
		expect(location?.page.id).toBe('protocols')
	})

	test('a top-level page, including its child routes', () => {
		const location = navLocationForPath('/connections/abc123')
		expect(location?.section).toBe(null)
		expect(location?.page.id).toBe('connections')
	})

	test('a location outside the nav', () => {
		expect(navLocationForPath('/getting-started')).toBe(null)
		// A shared prefix is not a match
		expect(navLocationForPath('/buttonsx')).toBe(null)
	})
})
