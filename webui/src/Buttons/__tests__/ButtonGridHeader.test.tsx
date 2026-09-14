import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import { PageNumberPicker, type PageNumberOption } from '../ButtonGridHeader.js'

// A long enough list that the current page can be well below the fold.
const PAGE_OPTIONS: PageNumberOption[] = Array.from({ length: 20 }, (_, i) => ({
	value: i + 1,
	label: `${i + 1}`,
}))

function ControlledPicker({ initialPage }: { initialPage: number }) {
	const [page, setPage] = useState(initialPage)
	return (
		<MenuPortalContext.Provider value={document.body}>
			<PageNumberPicker pageNumber={page} setPage={setPage} changePage={undefined} pageOptions={PAGE_OPTIONS} />
		</MenuPortalContext.Provider>
	)
}

function renderPicker(initialPage: number) {
	const user = userEvent.setup()
	render(<ControlledPicker initialPage={initialPage} />)
	const input = screen.getByRole('combobox')
	return { input, user }
}

describe('PageNumberPicker', () => {
	it('highlights the current page when the menu opens so it is scrolled into view (#4456)', async () => {
		const { user } = renderPicker(15)

		await user.click(screen.getByRole('button'))

		const list = screen.getByRole('listbox')
		const current = within(list).getByRole('option', { name: '15' })

		// base-ui highlights (and scrolls to) the active item on open; with the current page
		// resolved as the selected index, that active item must be the current page.
		await waitFor(() => expect(current).toHaveAttribute('data-highlighted'))
		expect(current).toHaveAttribute('data-selected')
	})

	it('calls setPage with the chosen page number', async () => {
		const setPage = vi.fn()
		const user = userEvent.setup()
		render(
			<MenuPortalContext.Provider value={document.body}>
				<PageNumberPicker pageNumber={3} setPage={setPage} changePage={undefined} pageOptions={PAGE_OPTIONS} />
			</MenuPortalContext.Provider>
		)
		await user.click(screen.getByRole('button'))
		await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '8' }))
		expect(setPage).toHaveBeenCalledWith(8)
	})
})
