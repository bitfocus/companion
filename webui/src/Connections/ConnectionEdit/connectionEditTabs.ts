export type ConnectionEditTab = 'settings' | 'docs' | 'diagnostics'

/** Settings keeps its existing bare URL; only alternate views add a search parameter. */
export function validateConnectionEditSearch(search: Record<string, unknown>): { tab?: 'docs' | 'diagnostics' } {
	return { tab: search.tab === 'docs' || search.tab === 'diagnostics' ? search.tab : undefined }
}
