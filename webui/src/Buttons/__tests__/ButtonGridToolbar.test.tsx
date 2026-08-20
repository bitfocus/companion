import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ButtonGridContextBar } from '../ButtonGridContextBar.js'
import { ButtonGridStore } from '../ButtonGridStore.js'
import { ButtonGridToolbar } from '../ButtonGridToolbar.js'
import { ButtonGridViewProvider, type ButtonGridView } from '../ButtonGridViewContext.js'
import type { GridToolActions } from '../GridTools/index.js'

function at(row: number, column: number, pageNumber = 1): ControlLocation {
	return { pageNumber, row, column }
}

/**
 * The toolbar and the context bar are two views of the same store, so they are rendered together -
 * the thing worth checking is that picking a tool in one is reflected in the other.
 */
function setup() {
	const store = new ButtonGridStore()
	const actions: GridToolActions = {
		openEditor: vi.fn(),
		press: vi.fn(),
		transfer: vi.fn(),
		clearButtons: vi.fn(),
	}
	const view: ButtonGridView = { store, actions, onContextMenu: vi.fn() }

	const utils = render(
		<ButtonGridViewProvider value={view}>
			<ButtonGridToolbar />
			<ButtonGridContextBar />
		</ButtonGridViewProvider>
	)

	return { store, actions, ...utils }
}

describe('the grid toolbar and context bar', () => {
	it('offers every tool', () => {
		setup()

		for (const label of ['Select', 'Arrange', 'Press', 'Copy', 'Move', 'Swap', 'Delete']) {
			expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
		}
	})

	it('marks the active tool as pressed', () => {
		setup()

		expect(screen.getByRole('button', { name: /Select/ })).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByRole('button', { name: /Copy/ })).toHaveAttribute('aria-pressed', 'false')
	})

	it('says nothing at rest', () => {
		setup()

		expect(screen.queryByText(/Press the button/)).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument()
	})

	it('picking a tool asks for a source', () => {
		const { store } = setup()

		fireEvent.click(screen.getByRole('button', { name: /Copy/ }))

		expect(store.activeToolId).toBe('copy')
		expect(screen.getByText('Press the button you want to copy')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument()
	})

	it('the hint follows the tool to its next step', () => {
		const { store, actions } = setup()

		fireEvent.click(screen.getByRole('button', { name: /Copy/ }))
		act(() => store.handleTap(at(1, 1), { range: false, toggle: false }, actions))

		expect(screen.getByText('Where do you want it?')).toBeInTheDocument()
	})

	it('cancel unwinds one step, then leaves the tool', () => {
		const { store, actions } = setup()

		fireEvent.click(screen.getByRole('button', { name: /Copy/ }))
		act(() => store.handleTap(at(1, 1), { range: false, toggle: false }, actions))

		fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))
		expect(store.activeToolId).toBe('copy')
		expect(screen.getByText('Press the button you want to copy')).toBeInTheDocument()

		fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))
		expect(store.activeToolId).toBe('select')
	})

	it('clicking the active tool again is the quick way back to select', () => {
		const { store } = setup()

		fireEvent.click(screen.getByRole('button', { name: /Press/ }))
		expect(store.activeToolId).toBe('press')

		fireEvent.click(screen.getByRole('button', { name: /Press/ }))
		expect(store.activeToolId).toBe('select')
	})

	it('shows what is selected once there is more than one', () => {
		const { store } = setup()

		act(() => store.selectRectangle(at(1, 1), at(1, 2), false))

		expect(screen.getByText(/2 buttons selected/)).toBeInTheDocument()
		expect(screen.getByText(/on page 1/)).toBeInTheDocument()
	})

	it('stays quiet for a single selected button, which the editor already covers', () => {
		const { store } = setup()

		act(() => store.selectWithModifiers(at(1, 1), { range: false, toggle: false }))

		expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
	})

	it('picking a transfer tool with a selection skips straight to the destination', () => {
		const { store } = setup()
		act(() => store.selectRectangle(at(1, 1), at(1, 2), false))

		fireEvent.click(screen.getByRole('button', { name: 'Move' }))

		expect(store.activeToolId).toBe('move')
		expect(screen.getByText('Where do you want it?')).toBeInTheDocument()
	})

	it('does not repeat the transfer tools in the selection bar', () => {
		const { store } = setup()
		act(() => store.selectRectangle(at(1, 1), at(1, 2), false))

		// The palette above already acts on the selection; a second copy of it is just more chrome
		expect(screen.getAllByRole('button', { name: /Copy/ })).toHaveLength(1)
		expect(screen.getAllByRole('button', { name: /Swap/ })).toHaveLength(1)
	})

	it('offers delete next to the count, since the delete tool works tap-by-tap', () => {
		const { store, actions } = setup()
		act(() => store.selectRectangle(at(1, 1), at(1, 2), false))

		const deleteButtons = screen.getAllByRole('button', { name: /Delete/ })
		expect(deleteButtons).toHaveLength(2)

		fireEvent.click(deleteButtons[deleteButtons.length - 1])
		expect(actions.clearButtons).toHaveBeenCalledWith([at(1, 1), at(1, 2)])
	})

	it('deselecting drops the selection', () => {
		const { store } = setup()
		act(() => store.selectRectangle(at(1, 1), at(1, 2), false))

		fireEvent.click(screen.getByRole('button', { name: /Deselect/ }))

		expect(store.selectionCount).toBe(0)
	})
})
