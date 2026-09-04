import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useImperativeHandle } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GridMarqueeHandling } from '../ButtonInfiniteGrid.js'
import type { GridButtonModifiers } from '../GridButtonPreview.js'
import type { GridZoomController } from '../GridZoom.js'

/** The props the panel handed the grid last, and the handle it drives it with */
let gridProps: any = null
const gridHandle = { resetPosition: vi.fn(), revealLocation: vi.fn() }

// The grid itself is covered by its own tests, and standing in for it keeps this about what the
// panel around it wires up
vi.mock('../ButtonInfiniteGrid.js', () => ({
	PrimaryButtonGridIcon: () => null,
	ButtonInfiniteGrid: ({ ref, ...props }: any) => {
		gridProps = props
		useImperativeHandle(ref, () => gridHandle, [])
		return <div data-testid="grid" />
	},
}))

// The grid is built lazily, once the panel has been scrolled into view - which jsdom never reports
vi.mock('~/Hooks/useHasBeenRendered.js', () => ({
	useHasBeenRendered: () => [true, () => undefined],
}))

vi.mock('@dnd-kit/react', () => ({
	DragOverlay: () => null,
	useDragOperation: () => ({ source: null }),
	useDraggable: () => ({ ref: () => undefined, isDragSource: false }),
	useDroppable: () => ({ ref: () => undefined, isDropTarget: false }),
}))

const { ButtonsGridPanel } = await import('../ButtonGridPanel.js')
const { RootAppStoreContext } = await import('~/Stores/RootAppStore.js')
const { ButtonGridViewProvider } = await import('../ButtonGridViewContext.js')
const { at, makeGridView } = await import('./gridViewTestHelpers.js')

const GRID_SIZE = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

function setup(overrides: { pageCount?: number; pageNumber?: number; viewAs?: any } = {}) {
	const view = makeGridView()
	const changePage = vi.fn()
	const zoom: GridZoomController = { zoomIn: vi.fn(), zoomOut: vi.fn(), zoomReset: vi.fn(), setZoom: vi.fn() }
	const onKeyDown = vi.fn()

	// The panel only reads the resolution and the toggle; the rest belongs to the popover
	const viewAs: any = {
		state: { enabled: false, selection: { type: 'surfaceType', surfaceType: '', offset: { rows: 0, columns: 0 } } },
		resolution: { status: 'off' },
		surfaceChoices: [],
		surfaceTypeChoices: [],
		setEnabled: vi.fn(),
		setSelection: vi.fn(),
		setOffset: vi.fn(),
		...overrides.viewAs,
	}

	// Deep partial of the root store - the panel and its header only reach for these
	const rootStore: any = {
		userConfig: { properties: { gridSize: GRID_SIZE, gridSizePromptGrow: false } },
		surfaces: { getSurfacesOverflowingBounds: () => ({ surfaces: [], neededBounds: GRID_SIZE }) },
		pages: {
			data: Array.from({ length: overrides.pageCount ?? 3 }, (_, index) => ({ name: `Page ${index + 1}` })),
			get: (pageNumber: number) => ({ name: `Page ${pageNumber}` }),
		},
		variablesStore: { allVariableDefinitions: { get: () => [] } },
	}

	const queryClient = new QueryClient()
	const utils = render(
		<QueryClientProvider client={queryClient}>
			<RootAppStoreContext.Provider value={rootStore}>
				<ButtonGridViewProvider value={view}>
					<ButtonsGridPanel
						pageNumber={overrides.pageNumber ?? 2}
						onKeyDown={onKeyDown}
						changePage={changePage}
						gridZoomValue={150}
						gridZoomController={zoom}
						contextMenuButton={null}
						onButtonContextMenu={vi.fn()}
						viewAs={viewAs}
						gridSize={GRID_SIZE}
						surfaceView={null}
					/>
				</ButtonGridViewProvider>
			</RootAppStoreContext.Provider>
		</QueryClientProvider>
	)

	const content = utils.container.querySelector('.button-grid-panel-content') as HTMLElement
	// The chevrons either side of the page picker, which carry no label of their own
	const pageStep = (direction: 'left' | 'right') =>
		utils.container.querySelector(`.button-grid-header [data-icon="chevron-${direction}"]`)?.closest('button')

	return { ...utils, view, rootStore, changePage, zoom, onKeyDown, content, pageStep }
}

beforeEach(() => {
	gridProps = null
	gridHandle.resetPosition.mockClear()
	gridHandle.revealLocation.mockClear()
})

describe('the grid panel', () => {
	it('builds the grid once the panel has been seen', () => {
		setup()

		expect(screen.getByTestId('grid')).toBeInTheDocument()
		expect(gridProps.pageNumber).toBe(2)
		expect(gridProps.gridSize).toBe(GRID_SIZE)
	})

	it('draws the grid at the zoom level it was given', () => {
		setup()

		expect(gridProps.drawScale).toBe(1.5)
	})

	it('marks the grid as live while the press tool is armed', () => {
		const { view } = setup()
		expect(gridProps.isHot).toBe(false)

		act(() => view.store.setTool('press', view.actions))

		expect(gridProps.isHot).toBe(true)
	})

	it('goes back to the home position when asked', () => {
		setup()

		fireEvent.click(screen.getByTitle('Home Position'))

		expect(gridHandle.resetPosition).toHaveBeenCalled()
	})
})

describe('what a dragged box means', () => {
	it('asks the active tool whether one is worth drawing', () => {
		const { view } = setup()
		const marquee: GridMarqueeHandling = gridProps.marquee

		act(() => view.store.setTool('select', view.actions))

		// Select rubber-bands freely; a tool holding buttons does not
		expect(marquee.canStart(false)).toBe(true)
		act(() => view.store.setTool('press', view.actions))
		expect(marquee.canStart(false)).toBe(false)
	})

	it('hands what it covered to the active tool', () => {
		const { view } = setup()
		const marquee: GridMarqueeHandling = gridProps.marquee

		act(() => marquee.onSelect(at(1, 1, 2), at(2, 3, 2), false))

		expect(view.store.selectionCount).toBe(6)
	})
})

describe('what is under the cursor', () => {
	it('goes to the active tool, so it can ghost what it is holding', () => {
		const { view } = setup()
		const handleHover = vi.spyOn(view.store, 'handleHover')
		const modifiers: GridButtonModifiers = { range: true, toggle: false }

		act(() => {
			gridProps.onHoverLocation(at(1, 1, 2), modifiers)
		})

		expect(handleHover).toHaveBeenCalledWith(at(1, 1, 2), modifiers, view.actions)
	})
})

describe('keeping the focus in view', () => {
	it('scrolls to the focused cell, since walking off the screen is no use', () => {
		const { view } = setup()

		act(() => view.store.setSelection([at(1, 1, 2)]))

		expect(gridHandle.revealLocation).toHaveBeenCalledWith(at(1, 1, 2))
	})

	it('leaves the grid alone for a focus on another page', () => {
		const { view } = setup()

		act(() => view.store.setSelection([at(1, 1, 3)]))

		expect(gridHandle.revealLocation).not.toHaveBeenCalled()
	})
})

describe('changing page from the panel', () => {
	it('steps to the next and previous page', () => {
		const { changePage, pageStep } = setup()

		fireEvent.click(pageStep('right') as HTMLElement)
		expect(changePage).toHaveBeenCalledWith(3)

		fireEvent.click(pageStep('left') as HTMLElement)
		expect(changePage).toHaveBeenLastCalledWith(1)
	})

	it('wraps round rather than stopping at either end', () => {
		const { changePage, pageStep } = setup({ pageCount: 2 })

		fireEvent.click(pageStep('right') as HTMLElement)

		expect(changePage).toHaveBeenCalledWith(1)
	})

	it('wraps back round to the last page from the first', () => {
		const { changePage, pageStep } = setup({ pageNumber: 1 })

		fireEvent.click(pageStep('left') as HTMLElement)

		expect(changePage).toHaveBeenCalledWith(3)
	})

	it('goes nowhere when the page it is on is not a number', () => {
		const { changePage, pageStep } = setup({ pageNumber: NaN })

		fireEvent.click(pageStep('right') as HTMLElement)

		expect(changePage).not.toHaveBeenCalled()
	})

	it('goes to a page picked from the list', async () => {
		const { container, changePage } = setup()

		fireEvent.click(container.querySelector('.dropdown-field-trigger') as HTMLElement)
		fireEvent.click(await screen.findByText('3 (Page 3)'))

		expect(changePage).toHaveBeenCalledWith(3)
	})

	it('goes nowhere for a page that stopped existing while the list was open', async () => {
		const { container, rootStore, changePage } = setup()
		fireEvent.click(container.querySelector('.dropdown-field-trigger') as HTMLElement)
		const option = await screen.findByText('3 (Page 3)')

		rootStore.pages.data.length = 1
		fireEvent.click(option)

		expect(changePage).not.toHaveBeenCalled()
	})
})

describe('zooming with the wheel', () => {
	it('zooms in and out when ctrl or cmd is held, instead of zooming the whole page', () => {
		const { content, zoom } = setup()

		const zoomIn = new WheelEvent('wheel', { deltaY: -1, ctrlKey: true, cancelable: true, bubbles: true })
		act(() => void content.dispatchEvent(zoomIn))
		expect(zoom.zoomIn).toHaveBeenCalled()
		expect(zoomIn.defaultPrevented).toBe(true)

		act(() => void content.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, metaKey: true, cancelable: true })))
		expect(zoom.zoomOut).toHaveBeenCalled()
	})

	it('leaves a plain wheel to scroll the grid', () => {
		const { content, zoom } = setup()

		const event = new WheelEvent('wheel', { deltaY: -1, cancelable: true })
		act(() => void content.dispatchEvent(event))

		expect(zoom.zoomIn).not.toHaveBeenCalled()
		expect(event.defaultPrevented).toBe(false)
	})

	it('does nothing for a wheel that did not move', () => {
		const { content, zoom } = setup()

		act(() => void content.dispatchEvent(new WheelEvent('wheel', { deltaY: 0, ctrlKey: true, cancelable: true })))

		expect(zoom.zoomIn).not.toHaveBeenCalled()
		expect(zoom.zoomOut).not.toHaveBeenCalled()
	})
})

describe('the colour an about-to-change cell is outlined in', () => {
	it('matches the selection while a selecting tool is active', () => {
		const { content } = setup()

		expect(content.style.getPropertyValue('--pending-change-color')).toBe('var(--color-primary)')
	})

	it('matches the held buttons while a transfer tool is', () => {
		const { view, content } = setup()

		act(() => view.store.setTool('move', view.actions))

		expect(content.style.getPropertyValue('--pending-change-color')).toBe('var(--color-copy-source)')
	})
})

describe('keys pressed on the panel', () => {
	it('go to whatever the page gave it', () => {
		const { container, onKeyDown } = setup()

		fireEvent.keyDown(container.querySelector('.button-grid-panel') as HTMLElement, { key: 'ArrowDown' })

		expect(onKeyDown).toHaveBeenCalled()
	})
})
