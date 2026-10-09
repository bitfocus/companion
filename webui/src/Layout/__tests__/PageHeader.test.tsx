import { faCog } from '@fortawesome/free-solid-svg-icons'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PageHeader } from '../PageHeader.js'
import { TopBarPageContext, type TopBarPage } from '../TopBarContext.js'

describe('PageHeader', () => {
	it('draws its own header outside the app frame', () => {
		render(<PageHeader icon={faCog} title="Debug Log" />)

		expect(screen.getByRole('heading', { name: 'Debug Log' })).toBeInTheDocument()
	})

	it('hands its title to the top bar inside the app frame, and draws nothing itself', () => {
		const setTopBarPage = vi.fn<(page: TopBarPage | null) => void>()

		const { unmount } = render(
			<TopBarPageContext.Provider value={setTopBarPage}>
				<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings" />
			</TopBarPageContext.Provider>
		)

		expect(screen.queryByRole('heading')).toBeNull()
		expect(setTopBarPage).toHaveBeenLastCalledWith({
			icon: faCog,
			title: 'Settings',
			helpAction: '/user-guide/config/settings',
		})

		// Leaving the page clears it from the bar
		unmount()
		expect(setTopBarPage).toHaveBeenLastCalledWith(null)
	})
})
