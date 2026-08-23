import { safeSetSessionStorage } from '~/Helpers/SafeStorage.js'

const SESSION_STORAGE_LAST_BUTTONS_PAGE = 'lastButtonsPage'

/** Remember which page was being looked at, so opening /buttons again comes back to it */
export function rememberViewedPage(pageNumber: number): void {
	safeSetSessionStorage(SESSION_STORAGE_LAST_BUTTONS_PAGE, pageNumber.toString())
}

/** Where /buttons goes when it is opened without a page, which is wherever it was left */
export function getLastViewedPage(): number {
	const lastPage = Number(window.sessionStorage.getItem(SESSION_STORAGE_LAST_BUTTONS_PAGE))
	if (!isNaN(lastPage) && lastPage > 0) {
		return lastPage
	}
	return 1
}

/**
 * Which page to show for what the URL says.
 *
 * The URL is the source of truth, but it can name a page that does not exist - a bookmark from
 * before some pages were deleted, or a hand-typed number - so it is resolved to a real page rather
 * than showing an empty grid.
 */
export function resolveViewedPage(rawPageNumber: number, pageCount: number): number {
	const highestPage = Math.max(1, pageCount)
	// Nothing in the URL means "carry on where I left off"
	const wanted = rawPageNumber <= 0 ? getLastViewedPage() : rawPageNumber

	return Math.min(Math.max(wanted, 1), highestPage)
}
