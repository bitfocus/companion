import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { QuarantinedRender, RenderStallStatus } from '@companion-app/shared/Model/RenderStall.js'
import { RenderStallBannerView } from '../RenderStallBannerView.js'

const BUTTON_ENTRY: QuarantinedRender = {
	key: 'abc',
	location: { pageNumber: 2, row: 1, column: 3 },
	description: 'button 2/1/3',
	texts: [{ text: 'Hello 👋', font: 'companion-sans', weight: 'normal', fontsize: 14 }],
	time: Date.now(),
}

function renderBanner(status: RenderStallStatus) {
	const callbacks = { onRetry: vi.fn(), onPostponeRestart: vi.fn(), onRestartNow: vi.fn() }
	const rootRoute = createRootRoute({ component: () => <RenderStallBannerView status={status} {...callbacks} /> })
	const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) })
	const result = render(<RouterProvider router={router} />)
	return { ...callbacks, ...result }
}

describe('RenderStallBannerView', () => {
	it('shows nothing when nothing stalled', async () => {
		const { container } = renderBanner({ quarantined: [], lostThreads: 0, restart: null })

		// Wait for the router to render
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(container).toBeEmptyDOMElement()
	})

	it('lists what stalled, with a link to its page, and retries it', async () => {
		const { onRetry } = renderBanner({ quarantined: [BUTTON_ENTRY], lostThreads: 0, restart: null })

		const link = await screen.findByText('Button 2/1/3')
		expect(link.closest('a')).toHaveAttribute('href', '/buttons/2')
		expect(screen.getByText('"Hello 👋"')).toBeInTheDocument()
		expect(screen.queryByText('Restart now')).not.toBeInTheDocument()

		fireEvent.click(screen.getByText('Try again'))
		expect(onRetry).toHaveBeenCalledWith('abc')
	})

	it('describes a draw which is not on a page', async () => {
		renderBanner({
			quarantined: [{ ...BUTTON_ENTRY, location: null, description: 'preview' }],
			lostThreads: 0,
			restart: null,
		})

		expect(await screen.findByText('preview')).toBeInTheDocument()
	})

	it('counts down to a scheduled restart, which can be postponed', async () => {
		const { onPostponeRestart, onRestartNow } = renderBanner({
			quarantined: [],
			lostThreads: 4,
			restart: { type: 'scheduled', at: Date.now() + 42_000 },
		})

		expect(
			await screen.findByText(/4 render threads are stuck, so Companion will restart in 4[12]s/)
		).toBeInTheDocument()

		fireEvent.click(screen.getByText('Postpone 10 minutes'))
		expect(onPostponeRestart).toHaveBeenCalled()
		fireEvent.click(screen.getByText('Restart now'))
		expect(onRestartNow).toHaveBeenCalled()
	})

	it('leaves a restart to the user', async () => {
		renderBanner({ quarantined: [], lostThreads: 4, restart: { type: 'manual' } })

		expect(await screen.findByText(/restarting automatically hasn't helped/)).toBeInTheDocument()
		expect(screen.getByText('Restart now')).toBeInTheDocument()
		expect(screen.queryByText('Postpone 10 minutes')).not.toBeInTheDocument()
	})
})
