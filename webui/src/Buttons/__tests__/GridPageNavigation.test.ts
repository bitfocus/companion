import { beforeEach, describe, expect, it } from 'vitest'
import { getLastViewedPage, rememberViewedPage, resolveViewedPage } from '../GridPageNavigation.js'

beforeEach(() => {
	window.sessionStorage.clear()
})

describe('where /buttons comes back to', () => {
	it('starts at the first page when nothing has been looked at yet', () => {
		expect(getLastViewedPage()).toBe(1)
	})

	it('comes back to the page that was left', () => {
		rememberViewedPage(7)

		expect(getLastViewedPage()).toBe(7)
	})

	it('ignores a remembered page that makes no sense, rather than showing nothing', () => {
		window.sessionStorage.setItem('lastButtonsPage', 'somewhere')
		expect(getLastViewedPage()).toBe(1)

		window.sessionStorage.setItem('lastButtonsPage', '0')
		expect(getLastViewedPage()).toBe(1)
	})
})

describe('which page a URL means', () => {
	it('shows the page it names', () => {
		expect(resolveViewedPage(3, 10)).toBe(3)
	})

	it('carries on where it was left when the URL names no page', () => {
		rememberViewedPage(4)

		expect(resolveViewedPage(0, 10)).toBe(4)
	})

	it('holds at the last page for a bookmark from before some were deleted', () => {
		expect(resolveViewedPage(99, 10)).toBe(10)
	})

	it('holds at the first page for a number below it', () => {
		expect(resolveViewedPage(-5, 10)).toBe(1)
	})

	it('still names a page before any have arrived, rather than page 0', () => {
		expect(resolveViewedPage(3, 0)).toBe(1)
	})

	it('does not resume onto a page that no longer exists', () => {
		rememberViewedPage(20)

		expect(resolveViewedPage(0, 5)).toBe(5)
	})
})
