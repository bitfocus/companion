import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ButtonGridView } from '../ButtonGridViewContext.js'

/** What the URL says, and where the page asked to go */
let routeMatch: { page: string } | false = { page: '2' }
const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
	const original = await importOriginal<Record<string, unknown>>()
	return { ...original, useMatchRoute: () => () => routeMatch, useNavigate: () => navigateMock }
})

/** Whether the layout has room for the grid and a panel side by side */
let isLargeScreen = true

vi.mock('@dnd-kit/react', () => ({
	DragOverlay: () => null,
	useDragDropMonitor: () => undefined,
	useDragOperation: () => ({ source: null }),
	useDraggable: () => ({ ref: () => undefined, isDragSource: false }),
	useDroppable: () => ({ ref: () => undefined, isDropTarget: false }),
}))

vi.mock('~/Resources/TRPC.js', async (importOriginal) => {
	const original = await importOriginal<Record<string, unknown>>()
	return { ...original, useMutationExt: () => ({ mutateAsync: async () => undefined }) }
})

/**
 * The grid, the editor and the other tabs are covered by their own tests. Standing in for them keeps
 * this about what the page itself decides: which page is being looked at, and which tab answers it.
 */
let panelProps: any = null
let view: ButtonGridView = null as any

vi.mock('../ButtonGridPanel.js', async () => {
	const { useButtonGridView } = await import('../ButtonGridViewContext.js')
	return {
		ButtonsGridPanel: (props: any) => {
			panelProps = props
			view = useButtonGridView()
			return <div data-testid="grid-panel" />
		},
	}
})

let editButtonProps: any = null
/** How many times the editor has been built, which a changed key resets */
let editButtonMounts = 0

vi.mock('../EditButton/EditButton.js', async () => {
	const { useEffect } = await import('react')
	return {
		EditButton: (props: any) => {
			editButtonProps = props
			useEffect(() => {
				editButtonMounts++
			}, [])
			return <div data-testid="edit-button" />
		},
	}
})

vi.mock('../ButtonGridSelectionPanel.js', () => ({
	ButtonGridSelectionPanel: () => <div data-testid="selection-panel" />,
}))
vi.mock('../Pages.js', () => ({ PagesList: () => <div data-testid="pages-list" /> }))
vi.mock('../PageVariablesPanel.js', () => ({ PageVariablesPanel: () => null }))
vi.mock('../Presets/Presets.js', () => ({ ConnectionPresets: () => null }))
vi.mock('../ActionRecorder/index.js', () => ({ ActionRecorder: () => null }))

const { ButtonsPage } = await import('../index.js')
const { RootAppStoreContext } = await import('~/Stores/RootAppStore.js')
const { at } = await import('./gridViewTestHelpers.js')

const GRID_SIZE = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

function setup(overrides: { pageCount?: number } = {}) {
	const pageCount = overrides.pageCount ?? 3
	// Deep partial of the root store - the page only reaches for these
	const rootStore: any = {
		userConfig: { properties: { gridSize: GRID_SIZE } },
		pages: {
			pageCount,
			data: Array.from({ length: pageCount }, (_, index) => ({ name: `Page ${index + 1}` })),
			get: (pageNumber: number) => ({ name: `Page ${pageNumber}` }),
			// Only the first row holds buttons, so there is somewhere empty to move one to
			getControlIdAtLocation: (location: any) => (location.row === 1 ? 'control1' : null),
		},
	}

	const queryClient = new QueryClient()
	return render(
		<QueryClientProvider client={queryClient}>
			<RootAppStoreContext.Provider value={rootStore}>
				<ButtonsPage />
			</RootAppStoreContext.Provider>
		</QueryClientProvider>
	)
}

const tab = (name: RegExp) => screen.queryByRole('tab', { name })

beforeEach(() => {
	routeMatch = { page: '2' }
	isLargeScreen = true
	navigateMock.mockClear()
	panelProps = null
	editButtonProps = null
	editButtonMounts = 0
	window.sessionStorage.clear()

	// The layout reads the breakpoints from the stylesheet, which jsdom never loads
	for (const [name, value] of Object.entries({
		sm: '576px',
		md: '768px',
		lg: '992px',
		xl: '1200px',
		'2xl': '1400px',
	})) {
		document.documentElement.style.setProperty(`--breakpoint-${name}`, value)
	}

	// The zoom control remembers its level, and this environment provides no local storage
	const stored = new Map<string, string>()
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => stored.get(key) ?? null,
		setItem: (key: string, value: string) => stored.set(key, value),
		removeItem: (key: string) => stored.delete(key),
	})

	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: isLargeScreen,
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}))
})

describe('which page is being looked at', () => {
	it('shows the page the URL names', () => {
		setup()

		expect(panelProps.pageNumber).toBe(2)
		expect(navigateMock).not.toHaveBeenCalled()
	})

	it('corrects a URL naming a page that does not exist, rather than showing an empty grid', () => {
		routeMatch = { page: '99' }

		setup()

		expect(panelProps.pageNumber).toBe(3)
		expect(navigateMock).toHaveBeenCalledWith({ to: '/buttons/3' })
	})

	it('carries on where it was left when the URL names no page', () => {
		window.sessionStorage.setItem('lastButtonsPage', '3')
		routeMatch = false

		setup()

		expect(panelProps.pageNumber).toBe(3)
	})

	it('remembers the page it moves to, so coming back lands there', () => {
		setup()

		act(() => {
			panelProps.changePage(3)
		})

		expect(navigateMock).toHaveBeenCalledWith({ to: '/buttons/3' })
		expect(window.sessionStorage.getItem('lastButtonsPage')).toBe('3')
	})
})

describe('where the grid goes', () => {
	it('gets a column of its own when there is room for one', () => {
		setup()

		expect(screen.getByTestId('grid-panel')).toBeInTheDocument()
		expect(tab(/Buttons/)).toBeNull()
	})

	it('becomes a tab when there is not', () => {
		isLargeScreen = false

		setup()

		expect(tab(/Buttons/)).toBeInTheDocument()
	})

	it('leaves the grid tab behind when the window grows, since the grid is now beside it', () => {
		isLargeScreen = false
		setup()
		expect(tab(/Buttons/)).toHaveAttribute('aria-selected', 'true')

		isLargeScreen = true
		act(() => {
			window.dispatchEvent(new Event('resize'))
		})

		expect(tab(/Pages/)).toBeInTheDocument()
	})
})

describe('the panel beside the grid', () => {
	it('offers nothing to edit until something is selected', () => {
		setup()

		expect(tab(/Edit Button/)).toBeNull()
		expect(screen.queryByTestId('edit-button')).toBeNull()
	})

	it('edits the button that was opened, naming it on the tab', () => {
		setup()

		act(() => view.actions.openEditor(at(1, 1, 2)))

		expect(tab(/Edit Button 2\/1\/1/)).toBeInTheDocument()
		expect(screen.getByTestId('edit-button')).toBeInTheDocument()
		expect(editButtonProps.location).toEqual(at(1, 1, 2))
	})

	it('shows the selection instead once there is more than one button in it', () => {
		setup()
		act(() => view.actions.openEditor(at(1, 1, 2)))

		act(() => view.store.setSelection([at(1, 1, 2), at(1, 2, 2)]))

		expect(tab(/Selection \(2\)/)).toBeInTheDocument()
		expect(screen.getByTestId('selection-panel')).toBeInTheDocument()
		expect(screen.queryByTestId('edit-button')).toBeNull()
	})

	it('stays out of the way on a narrow screen, where it would replace the grid mid-gesture', () => {
		isLargeScreen = false
		setup()

		act(() => view.store.setSelection([at(1, 1, 2), at(1, 2, 2)]))

		expect(tab(/Selection \(2\)/)).toHaveAttribute('aria-selected', 'false')
		expect(tab(/Buttons/)).toHaveAttribute('aria-selected', 'true')
	})

	it('falls back to the pages list when what it was showing is deselected', () => {
		setup()
		act(() => view.store.setSelection([at(1, 1, 2), at(1, 2, 2)]))
		expect(tab(/Selection/)).toHaveAttribute('aria-selected', 'true')

		act(() => view.store.clearSelection())

		expect(tab(/Selection/)).toBeNull()
		expect(tab(/Pages/)).toHaveAttribute('aria-selected', 'true')
	})

	it('follows a button reference to wherever it points', () => {
		setup()
		act(() => view.actions.openEditor(at(1, 1, 2)))

		act(() => {
			editButtonProps.navigateToControl(at(2, 3, 3))
		})

		expect(navigateMock).toHaveBeenCalledWith({ to: '/buttons/3' })
		expect(view.store.selectedLocations).toEqual([at(2, 3, 3)])
		expect(editButtonProps.location).toEqual(at(2, 3, 3))
	})
})

describe('what the tools are told about the grid', () => {
	it('answers which cells hold a button from the pages store', () => {
		setup()

		expect(view.actions.isOccupied(at(1, 1, 2))).toBe(true)
		expect(view.actions.isOccupied(at(2, 1, 2))).toBe(false)
	})

	it('rebuilds the editor once the button under it has been moved out', () => {
		setup()
		act(() => {
			view.actions.openEditor(at(1, 1, 2))
		})
		expect(editButtonMounts).toBe(1)

		act(() => {
			view.actions.transfer('move', [{ fromLocation: at(1, 1, 2), toLocation: at(2, 2, 2) }], () => undefined)
		})

		// Editing a button that has just been moved away would be editing nothing
		expect(editButtonMounts).toBe(2)
	})
})

describe('the grid panel', () => {
	it('is given the same key handler as the editor, so a key means the same in both', () => {
		setup()
		act(() => {
			view.actions.openEditor(at(1, 1, 2))
		})

		expect(typeof panelProps.onKeyDown).toBe('function')
		expect(panelProps.onKeyDown).toBe(editButtonProps.onKeyUp)
	})

	it('is told which button has a menu open on it, and only while it is', () => {
		setup()

		expect(panelProps.contextMenuButton).toBeNull()

		act(() => {
			view.onContextMenu(at(1, 1, 2), 10, 20)
		})

		expect(panelProps.contextMenuButton).toEqual(at(1, 1, 2))
	})
})
