import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { MenuActionItemProps } from '~/Components/ActionMenu.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ButtonGridStore } from '../ButtonGridStore.js'
import type { GridToolActions } from '../GridTools/index.js'
import { useButtonContextMenu } from '../useButtonContextMenu.js'

type ClickableMenuItem = Extract<MenuActionItemProps, { do: () => void }>

function at(row: number, column: number, pageNumber = 1): ControlLocation {
	return { pageNumber, row, column }
}

/** Every location holds a control, unless the test says otherwise */
function makeWrapper(occupied?: (location: ControlLocation) => boolean) {
	// Deep partial of the root store - typed loosely on purpose, the hook only reaches for `pages`
	const rootStore: any = {
		pages: {
			getControlIdAtLocation: (location: ControlLocation) =>
				!occupied || occupied(location) ? `control:${location.row}/${location.column}` : null,
		},
	}

	// The menu's actions are mutations, so it needs a query client even though nothing is sent here
	const queryClient = new QueryClient()

	return function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<RootAppStoreContext.Provider value={rootStore}>{children}</RootAppStoreContext.Provider>
			</QueryClientProvider>
		)
	}
}

function setup(occupied?: (location: ControlLocation) => boolean) {
	const store = new ButtonGridStore()
	const actions: GridToolActions = {
		openEditor: vi.fn(),
		press: vi.fn(),
		transfer: vi.fn(),
		clearButtons: vi.fn(),
	}

	const { result } = renderHook(() => useButtonContextMenu({ store, actions, setTabResetToken: vi.fn() }), {
		wrapper: makeWrapper(occupied),
	})

	const openAt = (location: ControlLocation) => act(() => result.current.doButtonContextMenu(location, 0, 0))
	const labels = () => result.current.contextMenuItems.map((item) => ('isSeparator' in item ? '---' : item.label))
	// Every item this menu builds runs a function, but the shared type also covers link items, and an
	// optional `do?: never` on those defeats narrowing by `in`
	const item = (label: string): ClickableMenuItem => {
		const found = result.current.contextMenuItems.find((i) => !('isSeparator' in i) && i.label === label)
		if (!found || 'isSeparator' in found) throw new Error(`no menu item ${label}, have: ${labels().join(', ')}`)
		return found as ClickableMenuItem
	}

	return { store, actions, result, openAt, labels, item }
}

describe('useButtonContextMenu', () => {
	it('acts on the one button when nothing is selected', () => {
		const { store, actions, openAt, item } = setup()
		openAt(at(1, 1))

		expect(item('Copy').label).toBe('Copy')

		act(() => item('Clear').do())
		expect(actions.clearButtons).toHaveBeenCalledWith([at(1, 1)])

		act(() => item('Copy').do())
		expect(store.clipboard).toEqual({ locations: [at(1, 1)], mode: 'copy' })
	})

	describe('within a selection', () => {
		it('names the count, so it is clear what is about to happen', () => {
			const { store, openAt, labels } = setup()
			act(() => store.selectRectangle(at(1, 1), at(1, 3), false))

			openAt(at(1, 2))

			expect(labels()).toContain('Copy 3 buttons')
			expect(labels()).toContain('Cut 3 buttons')
			expect(labels()).toContain('Clear 3 buttons')
		})

		it('copies the whole selection', () => {
			const { store, openAt, item } = setup()
			act(() => store.selectRectangle(at(1, 1), at(1, 3), false))
			openAt(at(1, 2))

			act(() => item('Copy 3 buttons').do())

			expect(store.clipboard?.locations).toEqual([at(1, 1), at(1, 2), at(1, 3)])
		})

		it('clears the whole selection', () => {
			const { store, actions, openAt, item } = setup()
			act(() => store.selectRectangle(at(1, 1), at(1, 3), false))
			openAt(at(1, 2))

			act(() => item('Clear 3 buttons').do())

			expect(actions.clearButtons).toHaveBeenCalledWith([at(1, 1), at(1, 2), at(1, 3)])
		})

		it('still offers the selection when the button under the cursor is empty', () => {
			const { store, openAt, item } = setup((location) => location.column !== 2)
			act(() => store.selectRectangle(at(1, 1), at(1, 3), false))
			openAt(at(1, 2))

			expect(item('Copy 3 buttons').disabled).toBeFalsy()
		})
	})

	describe('outside a selection', () => {
		it('acts on the button under the cursor, leaving the selection alone', () => {
			const { store, actions, openAt, item, labels } = setup()
			act(() => store.selectRectangle(at(1, 1), at(1, 3), false))

			openAt(at(3, 7))

			expect(labels()).toContain('Clear')
			act(() => item('Clear').do())
			expect(actions.clearButtons).toHaveBeenCalledWith([at(3, 7)])
			expect(store.selectionCount).toBe(3)
		})
	})

	it('treats a single selected button as just the one under the cursor', () => {
		const { store, openAt, labels } = setup()
		act(() => store.selectWithModifiers(at(1, 1), { range: false, toggle: false }))

		openAt(at(1, 1))

		expect(labels()).toContain('Copy')
		expect(labels()).not.toContain('Copy 1 buttons')
	})

	it('disables the paste entries until something is on the clipboard', () => {
		const { store, openAt, item } = setup()
		openAt(at(1, 1))
		expect(item('Paste here').disabled).toBe(true)

		act(() => store.setClipboard([at(2, 2)], 'copy'))
		openAt(at(1, 1))
		expect(item('Paste here').disabled).toBeFalsy()
	})
})
