import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModuleDocsPanel } from '../ModuleDocsPanel.js'

function renderDocs(helpPath?: string) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<ModuleDocsPanel helpPath={helpPath} />
		</QueryClientProvider>
	)
}

afterEach(() => vi.unstubAllGlobals())

describe('ModuleDocsPanel', () => {
	it('renders documentation in the panel and resolves relative links', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => '# Example documentation\n\n[Setup](setup.md)',
		})
		vi.stubGlobal('fetch', fetchMock)
		renderDocs('https://example.com/module/HELP.md')
		expect(await screen.findByRole('heading', { name: 'Example documentation' })).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Setup' })).toHaveAttribute('href', 'https://example.com/module/setup.md')
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://example.com/module/HELP.md')
	})

	it('shows an error for failed HTTP responses rather than rendering the error page as docs', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
		renderDocs('https://example.com/missing.md')
		expect(await screen.findByText('Failed to load documentation: HTTP 404')).toBeInTheDocument()
	})

	it('does not fetch when documentation is unavailable', () => {
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		renderDocs()
		expect(screen.getByText('No documentation available for this version.')).toBeInTheDocument()
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
