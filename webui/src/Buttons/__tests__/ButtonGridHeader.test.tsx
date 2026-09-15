import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import { PageNumberPicker, type PageNumberOption } from '../ButtonGridHeader.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A long enough list that the current page can sit well below the fold. */
function numberedPages(count: number): PageNumberOption[] {
	return Array.from({ length: count }, (_, i) => ({ value: i + 1, label: `${i + 1}` }))
}

const INSERT_OPTION: PageNumberOption = { value: -1, label: '[ Insert new page ]' }

interface PickerOptions {
	pageNumber?: number
	pageOptions?: PageNumberOption[]
	/** A spy to observe changes, or `null` to render the picker read-only (no setPage). */
	setPage?: ((page: number) => void) | null
	changePage?: ((delta: number) => void) | undefined
	children?: React.ReactNode
}

/** Controlled wrapper so the picker's value updates on setPage calls. */
function ControlledPicker({
	pageNumber = 1,
	pageOptions = numberedPages(20),
	setPage: externalSetPage,
	changePage,
	children,
}: PickerOptions) {
	const [page, setPage] = useState(pageNumber)
	return (
		<MenuPortalContext.Provider value={document.body}>
			<PageNumberPicker
				pageNumber={page}
				pageOptions={pageOptions}
				changePage={changePage}
				setPage={
					externalSetPage === null
						? undefined
						: (v) => {
								setPage(v)
								externalSetPage?.(v)
							}
				}
			>
				{children}
			</PageNumberPicker>
		</MenuPortalContext.Provider>
	)
}

function renderPicker(opts: PickerOptions = {}) {
	const user = userEvent.setup()
	const utils = render(<ControlledPicker {...opts} />)
	return { ...utils, user }
}

const getListbox = () => screen.getByRole('listbox')
const queryListbox = () => screen.queryByRole('listbox')

/** The trigger is the only accessible button when the prev/next arrows are hidden. */
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
	const buttons = screen.getAllByRole('button')
	// Order in the DOM: [prev?, trigger, next?]. The trigger is the chevron next to the input.
	const trigger = buttons.length === 1 ? buttons[0] : buttons[1]
	await user.click(trigger)
	return getListbox()
}

// ---------------------------------------------------------------------------
// Rendering / structure
// ---------------------------------------------------------------------------

describe('PageNumberPicker — rendering', () => {
	it('renders a combobox input', () => {
		renderPicker()
		expect(screen.getByRole('combobox')).toBeInTheDocument()
	})

	it('shows the current page number as the input placeholder', () => {
		renderPicker({ pageNumber: 7 })
		expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', '7')
	})

	it('shows the page name alongside the number in the placeholder when one is set', () => {
		renderPicker({
			pageNumber: 3,
			pageOptions: [
				{ value: 1, label: '1' },
				{ value: 2, label: '2' },
				{ value: 3, label: '3 (Studio)' },
			],
		})
		expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', '3 (Studio)')
	})

	it('falls back to the raw page number when the page is not in the options', () => {
		renderPicker({ pageNumber: 99, pageOptions: numberedPages(3) })
		expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', '99')
	})

	it('renders children in the header', () => {
		renderPicker({ children: <button type="button">Extra action</button> })
		expect(screen.getByRole('button', { name: 'Extra action' })).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Enabled / disabled state
// ---------------------------------------------------------------------------

describe('PageNumberPicker — enabled state', () => {
	it('disables the input when setPage is not provided', () => {
		renderPicker({ setPage: null })
		expect(screen.getByRole('combobox')).toBeDisabled()
	})

	it('enables the input when setPage is provided', () => {
		renderPicker({ setPage: vi.fn() })
		expect(screen.getByRole('combobox')).toBeEnabled()
	})

	it('hides the prev/next arrows when changePage is not provided', () => {
		renderPicker({ changePage: undefined })
		// Only the dropdown trigger is accessible.
		expect(screen.getAllByRole('button')).toHaveLength(1)
	})

	it('shows the prev/next arrows when changePage is provided', () => {
		renderPicker({ changePage: vi.fn() })
		// prev, trigger, next
		expect(screen.getAllByRole('button')).toHaveLength(3)
	})
})

// ---------------------------------------------------------------------------
// Navigation arrows
// ---------------------------------------------------------------------------

describe('PageNumberPicker — navigation arrows', () => {
	it('calls changePage(-1) when clicking the previous arrow', async () => {
		const changePage = vi.fn()
		const { user } = renderPicker({ changePage })
		await user.click(screen.getAllByRole('button')[0])
		expect(changePage).toHaveBeenCalledWith(-1)
	})

	it('calls changePage(1) when clicking the next arrow', async () => {
		const changePage = vi.fn()
		const { user } = renderPicker({ changePage })
		const buttons = screen.getAllByRole('button')
		await user.click(buttons[buttons.length - 1])
		expect(changePage).toHaveBeenCalledWith(1)
	})
})

// ---------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------

describe('PageNumberPicker — open / close', () => {
	it('opens the listbox when clicking the trigger', async () => {
		const { user } = renderPicker()
		await openMenu(user)
		expect(getListbox()).toBeInTheDocument()
	})

	it('lists every page option when open', async () => {
		const { user } = renderPicker({ pageOptions: numberedPages(20) })
		const list = await openMenu(user)
		for (let page = 1; page <= 20; page++) {
			expect(within(list).getByRole('option', { name: `${page}` })).toBeInTheDocument()
		}
	})

	it('closes the listbox when pressing Escape', async () => {
		const { user } = renderPicker()
		await openMenu(user)
		await user.keyboard('{Escape}')
		expect(queryListbox()).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('PageNumberPicker — selection', () => {
	it('calls setPage with the numeric page value when clicking an option', async () => {
		const setPage = vi.fn()
		const { user } = renderPicker({ setPage })
		const list = await openMenu(user)
		await user.click(within(list).getByRole('option', { name: '8' }))
		expect(setPage).toHaveBeenCalledWith(8)
		expect(typeof setPage.mock.calls[0][0]).toBe('number')
	})

	it('selects a page via keyboard (ArrowDown + Enter)', async () => {
		const setPage = vi.fn()
		const { user } = renderPicker({ setPage })
		await user.click(screen.getByRole('combobox'))
		await user.keyboard('{ArrowDown}{Enter}')
		expect(setPage).toHaveBeenCalledTimes(1)
		expect(typeof setPage.mock.calls[0][0]).toBe('number')
	})

	it('reflects the newly chosen page in the placeholder', async () => {
		const { user } = renderPicker({ pageNumber: 1 })
		const list = await openMenu(user)
		await user.click(within(list).getByRole('option', { name: '12' }))
		expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', '12')
	})

	it('supports selecting a sentinel option with a negative value (e.g. insert new page)', async () => {
		const setPage = vi.fn()
		const { user } = renderPicker({ setPage, pageOptions: [...numberedPages(3), INSERT_OPTION] })
		const list = await openMenu(user)
		await user.click(within(list).getByRole('option', { name: INSERT_OPTION.label }))
		expect(setPage).toHaveBeenCalledWith(-1)
	})
})

// ---------------------------------------------------------------------------
// Current page highlight / scroll-into-view on open (#4456)
// ---------------------------------------------------------------------------

describe('PageNumberPicker — highlights the current page on open (#4456)', () => {
	it('highlights and marks the current page as selected when the menu opens', async () => {
		const { user } = renderPicker({ pageNumber: 15, pageOptions: numberedPages(20) })
		const list = await openMenu(user)
		const current = within(list).getByRole('option', { name: '15' })
		// base-ui highlights (and scrolls to) the active item on open; the active item must be
		// the current page, not the top of the list.
		await waitFor(() => expect(current).toHaveAttribute('data-highlighted'))
		expect(current).toHaveAttribute('data-selected')
	})

	it('does not highlight a non-current page', async () => {
		const { user } = renderPicker({ pageNumber: 15, pageOptions: numberedPages(20) })
		const list = await openMenu(user)
		await waitFor(() => expect(within(list).getByRole('option', { name: '15' })).toHaveAttribute('data-highlighted'))
		expect(within(list).getByRole('option', { name: '1' })).not.toHaveAttribute('data-highlighted')
	})

	it('resolves the current page by value even when the label carries a page name', async () => {
		const pageOptions: PageNumberOption[] = [
			{ value: 1, label: '1' },
			{ value: 2, label: '2' },
			{ value: 3, label: '3 (Studio)' },
			{ value: 4, label: '4' },
		]
		const { user } = renderPicker({ pageNumber: 3, pageOptions })
		const list = await openMenu(user)
		const current = within(list).getByRole('option', { name: '3 (Studio)' })
		await waitFor(() => expect(current).toHaveAttribute('data-highlighted'))
		expect(current).toHaveAttribute('data-selected')
	})

	it('highlights the synthetic option when the current page is missing from the list', async () => {
		const { user } = renderPicker({ pageNumber: 99, pageOptions: numberedPages(5) })
		const list = await openMenu(user)
		const current = within(list).getByRole('option', { name: '99' })
		await waitFor(() => expect(current).toHaveAttribute('data-highlighted'))
		expect(current).toHaveAttribute('data-selected')
	})
})

// ---------------------------------------------------------------------------
// Fuzzy filtering
// ---------------------------------------------------------------------------

describe('PageNumberPicker — filtering', () => {
	it('filters the options as the user types', async () => {
		const { user } = renderPicker({ pageOptions: numberedPages(20) })
		const input = screen.getByRole('combobox')
		await user.click(input)
		await user.type(input, '20')
		const list = getListbox()
		expect(within(list).getByRole('option', { name: '20' })).toBeInTheDocument()
		expect(within(list).queryByRole('option', { name: '5' })).toBeNull()
	})

	it('shows the empty message when nothing matches', async () => {
		const { user } = renderPicker()
		const input = screen.getByRole('combobox')
		await user.click(input)
		await user.type(input, 'zzzzz')
		expect(screen.getByText('No options found.')).toBeInTheDocument()
	})
})
