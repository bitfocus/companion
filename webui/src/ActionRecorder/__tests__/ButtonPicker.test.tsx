import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { ButtonPicker } from '../ButtonPicker.js'

vi.mock('~/Buttons/ButtonGridHeader.js', () => ({
	ButtonGridHeader: ({
		changePage,
		setPage,
	}: {
		changePage: (delta: number) => void
		setPage: (page: number) => void
	}) => (
		<div>
			<button onClick={() => changePage(1)}>Next page</button>
			<button onClick={() => setPage(2)}>Choose page 2</button>
		</div>
	),
}))
vi.mock('~/Buttons/ButtonInfiniteGrid.js', () => ({
	ButtonInfiniteGrid: ({
		pageNumber,
		buttonClick,
	}: {
		pageNumber: number
		buttonClick: (location: unknown, pressed: boolean) => void
	}) => (
		<button onClick={() => buttonClick({ pageNumber, row: 0, column: 0 }, true)}>
			Select page {pageNumber} button
		</button>
	),
}))
vi.mock('~/Hooks/useHasBeenRendered.js', () => ({ useHasBeenRendered: () => [true, null] }))
vi.mock('~/Hooks/useControlConfig.js', () => {
	const config = { config: { type: 'button-layered', steps: { '0': { action_sets: { down: [], up: [] } } } } }
	return { useControlConfig: (controlId: string | undefined) => ({ controlConfig: controlId ? config : undefined }) }
})
vi.mock('~/Components/DropdownInputFieldSimple.js', () => ({
	SimpleDropdownInputField: ({ id, value, disabled }: { id: string; value: string; disabled: boolean }) => (
		<input id={id} value={value} disabled={disabled} readOnly />
	),
}))

describe('Recorder button destination', () => {
	it.each(['Next page', 'Choose page 2'])(
		'clears the destination after %s and saves only a fresh selection',
		async (pageAction) => {
			const user = userEvent.setup()
			const selectButton = vi.fn()
			const getControlIdAt = vi.fn((page: number) => `button-page-${page}`)
			const store = {
				pages: { data: [{}, {}], getControlIdAt },
				userConfig: { properties: { gridSize: { minRow: 0, maxRow: 1, minColumn: 0, maxColumn: 1 } } },
			} as unknown as RootAppStore
			render(
				<RootAppStoreContext.Provider value={store}>
					<ButtonPicker selectButton={selectButton} />
				</RootAppStoreContext.Provider>
			)
			await user.click(screen.getByRole('button', { name: 'Select page 1 button' }))
			const append = screen.getByRole('button', { name: 'Append to the selected button action group' })
			const replace = screen.getByRole('button', { name: 'Replace actions in the selected button action group' })
			expect(append).toBeEnabled()
			getControlIdAt.mockClear()
			await user.click(screen.getByRole('button', { name: pageAction }))
			expect(screen.getByText('Select a button above')).toBeInTheDocument()
			expect(append).toBeDisabled()
			expect(replace).toBeDisabled()
			expect(screen.getByLabelText('Step')).toBeDisabled()
			expect(screen.getByLabelText('Action group')).toBeDisabled()
			expect(getControlIdAt).not.toHaveBeenCalled()
			await user.click(screen.getByRole('button', { name: 'Select page 2 button' }))
			await user.click(append)
			expect(selectButton).toHaveBeenCalledExactlyOnceWith('button-page-2', '0', 'down', 'append')
		}
	)
})
