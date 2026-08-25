import { fireEvent, render } from '@testing-library/react'
import { createRef, useLayoutEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { ButtonInfiniteGridButtonProps, ButtonInfiniteGridRef } from '../ButtonInfiniteGrid.js'

/** Whatever dnd-kit says is being dragged right now */
let dragOperationSource: { type: string } | null = null

// The grid asks dnd-kit what is being dragged so a button drag and a rubber-band do not both happen
// from the same pointerdown. Nothing here drags a real button, so the answer is stood in for.
vi.mock('@dnd-kit/react', () => ({
	useDragOperation: () => ({ source: dragOperationSource }),
	useDraggable: () => ({ ref: () => undefined, isDragSource: false }),
	useDroppable: () => ({ ref: () => undefined, isDropTarget: false }),
}))

vi.mock('~/Resources/TRPC', () => ({
	trpcClient: { preview: { graphics: { location: { subscribe: () => ({ unsubscribe: () => undefined }) } } } },
}))

const { ButtonInfiniteGrid } = await import('../ButtonInfiniteGrid.js')
const { gridTileGeometry } = await import('../GridCanvasGeometry.js')

const GRID_SIZE: UserConfigGridSize = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }
const PAGE = 2
const DRAW_SCALE = 2
const TILE = gridTileGeometry(DRAW_SCALE).size

/** jsdom lays nothing out, so the viewport it reports is whatever the test says it is */
const VIEWPORT = { width: 600, height: 400 }

/** The middle of a cell, in the canvas pixels a pointer event carries */
function centreOf(row: number, column: number) {
	return { clientX: column * TILE + TILE / 2, clientY: row * TILE + TILE / 2 }
}

function at(row: number, column: number, pageNumber = PAGE): ControlLocation {
	return { pageNumber, row, column }
}

/** Standing in for the real cell, which has an image subscription and a store behind it */
function StubButton({ row, column, selected, copySource, contextMenuOpen }: ButtonInfiniteGridButtonProps) {
	return (
		<div
			data-testid={`cell-${row}-${column}`}
			data-selected={String(selected)}
			data-copy-source={String(copySource)}
			data-context-menu={String(contextMenuOpen)}
		/>
	)
}

function setup(
	overrides: {
		gridSize?: UserConfigGridSize
		canStart?: (additive: boolean) => boolean
		marquee?: boolean
		hover?: boolean
		extra?: Partial<React.ComponentProps<typeof ButtonInfiniteGrid>>
	} = {}
) {
	const onSelect = vi.fn()
	const canStart = vi.fn(overrides.canStart ?? (() => true))
	const onHoverLocation = vi.fn()
	const ref = createRef<ButtonInfiniteGridRef>()

	const utils = render(
		<ButtonInfiniteGrid
			ref={ref}
			pageNumber={PAGE}
			gridSize={overrides.gridSize ?? GRID_SIZE}
			ButtonIconFactory={StubButton as any}
			marquee={overrides.marquee === false ? null : { canStart, onSelect }}
			onHoverLocation={overrides.hover === false ? null : onHoverLocation}
			drawScale={DRAW_SCALE}
			{...overrides.extra}
		/>
	)

	const grid = utils.container.querySelector('.button-infinite-grid') as HTMLElement

	return { ...utils, grid, ref, onSelect, canStart, onHoverLocation }
}

const marqueeBox = (grid: HTMLElement) => grid.querySelector<HTMLElement>('.button-grid-marquee')

beforeEach(() => {
	dragOperationSource = null
	VIEWPORT.width = 600
	VIEWPORT.height = 400

	// The scroller's own size, which is what decides how much of the grid is drawn
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => VIEWPORT.width })
	Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => VIEWPORT.height })
	// Every element sits at the top left, so a pointer's client coordinates are canvas coordinates
	Element.prototype.getBoundingClientRect = vi.fn(() => new DOMRect(0, 0, VIEWPORT.width, VIEWPORT.height))
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('what the grid draws', () => {
	it('draws what is on screen plus enough spill to scroll into, rather than the whole grid', () => {
		const { queryByTestId } = setup()

		// Under four cells fit across, so the spill reaches about two more each way
		expect(queryByTestId('cell-0-0')).toBeInTheDocument()
		expect(queryByTestId('cell-3-6')).toBeInTheDocument()
		expect(queryByTestId('cell-0-7')).toBeNull()
	})

	it('draws no rubber-band until one is dragged out', () => {
		const { grid } = setup()

		expect(marqueeBox(grid)).toBeNull()
	})

	it('draws at its natural size when no zoom level is given', () => {
		const { queryByTestId } = setup({ extra: { drawScale: undefined as unknown as number } })

		// Smaller cells, so more of them fit on the same screen
		expect(queryByTestId('cell-0-7')).toBeInTheDocument()
	})

	it('tells the page how much room it needs to be worth showing at all', () => {
		const setViewportMinHeight = vi.fn()

		setup({ extra: { setViewportMinHeight } })

		// Two rows and enough for a scrollbar
		expect(setViewportMinHeight).toHaveBeenCalledWith(2 * TILE + 15)
	})

	it('caps itself to the grid when asked, for the pages that show one whole grid', () => {
		const { grid } = setup({ extra: { maxHeightToMatchCanvas: true } })

		expect(grid.style.maxHeight).toBe(`${4 * TILE + 30}px`)
	})

	it('marks itself as live when the press tool is armed', () => {
		const { grid } = setup({ extra: { isHot: true } })

		expect(grid).toHaveClass('button-armed')
	})

	it('marks the one cell each of the pick-from grids points at', () => {
		const { getByTestId } = setup({
			extra: {
				selectedButton: at(1, 1),
				copySourceButton: at(1, 2),
				contextMenuButton: at(2, 1),
				marquee: null,
				onHoverLocation: null,
			},
		})

		expect(getByTestId('cell-1-1')).toHaveAttribute('data-selected', 'true')
		expect(getByTestId('cell-1-2')).toHaveAttribute('data-copy-source', 'true')
		expect(getByTestId('cell-2-1')).toHaveAttribute('data-context-menu', 'true')
		expect(getByTestId('cell-0-0')).toHaveAttribute('data-selected', 'false')
	})

	it('leaves the cells alone on a page other than the one being pointed at', () => {
		const { getByTestId } = setup({
			extra: { selectedButton: at(1, 1, PAGE + 1), marquee: null, onHoverLocation: null },
		})

		expect(getByTestId('cell-1-1')).toHaveAttribute('data-selected', 'false')
	})

	it('keeps drawing what was on screen when the grid is hidden, rather than emptying it', () => {
		const { grid, queryByTestId } = setup()
		// A scroll while it is visible is what there is to remember
		grid.scrollLeft = 0
		fireEvent.scroll(grid)

		VIEWPORT.width = 0
		VIEWPORT.height = 0
		fireEvent(window, new Event('resize'))

		// Switching tab must not unmount every button, only to rebuild them all on the way back
		expect(queryByTestId('cell-3-6')).toBeInTheDocument()
	})
})

describe('dragging out a rubber-band', () => {
	it('selects the rectangle the pointer was dragged across', () => {
		const { grid, onSelect } = setup()

		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerUp(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		expect(onSelect).toHaveBeenCalledWith(at(0, 0), at(1, 2), false)
	})

	it('captures the pointer, so a box dragged off the edge still delivers its release', () => {
		const { grid } = setup()
		// jsdom does not implement pointer capture, which is why the grid calls it optionally; stand it in
		const capture = vi.fn()
		grid.setPointerCapture = capture

		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })

		// Without this, a pointerup outside .button-infinite-grid never reaches the grid and the box sticks
		expect(capture).toHaveBeenCalledWith(1)
	})

	it('draws the box while it is being dragged, so what it covers is visible', () => {
		const { grid } = setup()

		fireEvent.pointerDown(grid, { ...centreOf(1, 2), button: 0, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { ...centreOf(0, 0), pointerId: 1, pointerType: 'mouse' })

		// Dragged up and to the left, so the box is measured from where the pointer got to
		const box = marqueeBox(grid)
		expect(box?.style.left).toBe(`${centreOf(0, 0).clientX}px`)
		expect(box?.style.width).toBe(`${2 * TILE}px`)
		expect(box?.style.height).toBe(`${TILE}px`)
	})

	it('ignores a pointer that never travelled, which was a click on a button', () => {
		const { grid, onSelect } = setup()

		fireEvent.pointerDown(grid, { ...centreOf(1, 1), button: 0, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, {
			clientX: centreOf(1, 1).clientX + 3,
			clientY: centreOf(1, 1).clientY,
			pointerId: 1,
			pointerType: 'mouse',
		})
		fireEvent.pointerUp(grid, { ...centreOf(1, 1), pointerId: 1, pointerType: 'mouse' })

		expect(marqueeBox(grid)).toBeNull()
		expect(onSelect).not.toHaveBeenCalled()
	})

	it('asks the active tool whether a box would mean anything before drawing one', () => {
		const { grid, canStart, onSelect } = setup({ canStart: () => false })

		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerUp(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		expect(canStart).toHaveBeenCalledWith(false)
		expect(marqueeBox(grid)).toBeNull()
		expect(onSelect).not.toHaveBeenCalled()
	})

	it.each([
		['shiftKey', { shiftKey: true }],
		['ctrlKey', { ctrlKey: true }],
		['metaKey', { metaKey: true }],
	])('carries %s through as adding to what is already there', (_name, modifier) => {
		const { grid, canStart, onSelect } = setup()

		fireEvent.pointerDown(grid, { ...centreOf(0, 0), ...modifier, button: 0, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerUp(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		// Whether a box means anything depends on this, so the tool is asked with it rather than after
		expect(canStart).toHaveBeenCalledWith(true)
		expect(onSelect).toHaveBeenCalledWith(at(0, 0), at(1, 2), true)
	})

	it('leaves a touch to scroll the grid, which matters more than rubber-banding with a finger', () => {
		const { grid, canStart, onSelect } = setup()

		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'touch' })
		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'touch' })
		fireEvent.pointerUp(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'touch' })

		expect(canStart).not.toHaveBeenCalled()
		expect(onSelect).not.toHaveBeenCalled()
	})

	it('leaves the right button to the context menu', () => {
		const { grid, canStart } = setup()

		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 2, pointerId: 1, pointerType: 'mouse' })

		expect(canStart).not.toHaveBeenCalled()
	})

	it('does nothing on a grid that is only picked from', () => {
		const { grid, onSelect } = setup({ marquee: false })

		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerUp(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		expect(marqueeBox(grid)).toBeNull()
		expect(onSelect).not.toHaveBeenCalled()
	})

	it('gives way once a button starts being dragged from the same press', () => {
		const { grid, onSelect, rerender, container } = setup()
		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })

		dragOperationSource = { type: 'grid-button' }
		rerender(
			<ButtonInfiniteGrid
				pageNumber={PAGE}
				gridSize={GRID_SIZE}
				ButtonIconFactory={StubButton}
				marquee={{ canStart: () => true, onSelect }}
				onHoverLocation={null}
				drawScale={DRAW_SCALE}
			/>
		)

		const live = container.querySelector('.button-infinite-grid') as HTMLElement
		fireEvent.pointerMove(live, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerUp(live, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		expect(marqueeBox(live)).toBeNull()
		expect(onSelect).not.toHaveBeenCalled()
	})

	it('drops the box when a different pointer is released, rather than selecting from it', () => {
		const { grid, onSelect } = setup()
		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		fireEvent.pointerUp(grid, { ...centreOf(1, 2), pointerId: 9, pointerType: 'mouse' })

		expect(marqueeBox(grid)).toBeNull()
		expect(onSelect).not.toHaveBeenCalled()
	})

	it('ignores a move from a pointer that is not the one drawing the box', () => {
		const { grid } = setup()
		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })

		fireEvent.pointerMove(grid, { ...centreOf(2, 4), pointerId: 9, pointerType: 'mouse' })

		expect(marqueeBox(grid)).toBeNull()
	})

	it('abandons the box when the pointer is taken away mid-drag', () => {
		const { grid, onSelect } = setup()
		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		fireEvent.pointerCancel(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		// Cancelling is a release as far as the box is concerned - what it covered is what was wanted
		expect(marqueeBox(grid)).toBeNull()
		expect(onSelect).toHaveBeenCalledWith(at(0, 0), at(1, 2), false)
	})
})

describe('before the canvas has been measured', () => {
	beforeEach(() => {
		// Nothing has a position yet, so there is no cell for a pointer to be over
		Element.prototype.getBoundingClientRect = vi.fn(() => undefined as unknown as DOMRect)
	})

	it('starts no rubber-band', () => {
		const { grid, onSelect } = setup()

		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerUp(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		expect(marqueeBox(grid)).toBeNull()
		expect(onSelect).not.toHaveBeenCalled()
	})

	it('draws no box for a pointer that moves after the canvas goes away', () => {
		Element.prototype.getBoundingClientRect = vi.fn(() => new DOMRect(0, 0, VIEWPORT.width, VIEWPORT.height))
		const { grid, onSelect } = setup()
		fireEvent.pointerDown(grid, { ...centreOf(0, 0), button: 0, pointerId: 1, pointerType: 'mouse' })

		Element.prototype.getBoundingClientRect = vi.fn(() => undefined as unknown as DOMRect)
		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerUp(grid, { ...centreOf(1, 2), pointerId: 1, pointerType: 'mouse' })

		expect(marqueeBox(grid)).toBeNull()
		expect(onSelect).not.toHaveBeenCalled()
	})

	it('reports no cell under the cursor', () => {
		const { grid, onHoverLocation } = setup()

		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerType: 'mouse' })

		expect(onHoverLocation).toHaveBeenCalledWith(null, { range: false, toggle: false })
	})
})

describe('panning with the middle button', () => {
	it('scrolls the grid by how far the pointer moved, and starts no rubber-band', () => {
		const { grid, canStart } = setup()
		grid.scrollLeft = 200
		grid.scrollTop = 100

		fireEvent.pointerDown(grid, { clientX: 100, clientY: 100, button: 1, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { clientX: 70, clientY: 90, pointerId: 1, pointerType: 'mouse' })

		// Dragged left, so the grid moves right underneath it
		expect(grid.scrollLeft).toBe(230)
		expect(grid.scrollTop).toBe(110)
		expect(canStart).not.toHaveBeenCalled()
	})

	it('shows the grabbing cursor while panning and drops it on release', () => {
		const { grid } = setup()
		expect(grid).not.toHaveClass('button-grid-panning')

		// Driven by state, not the ref the pan math uses: a ref mutation would not re-render, so the
		// class would only appear on some later unrelated render and linger after the pan ended
		fireEvent.pointerDown(grid, { clientX: 100, clientY: 100, button: 1, pointerId: 1, pointerType: 'mouse' })
		expect(grid).toHaveClass('button-grid-panning')

		fireEvent.pointerUp(grid, { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' })
		expect(grid).not.toHaveClass('button-grid-panning')
	})

	it('stops panning once the button is released', () => {
		const { grid } = setup()
		fireEvent.pointerDown(grid, { clientX: 100, clientY: 100, button: 1, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerUp(grid, { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' })

		fireEvent.pointerMove(grid, { clientX: 40, clientY: 100, pointerId: 1, pointerType: 'mouse' })

		expect(grid.scrollLeft).toBeCloseTo(0)
	})

	it('ignores a move belonging to a different pointer', () => {
		const { grid } = setup()
		fireEvent.pointerDown(grid, { clientX: 100, clientY: 100, button: 1, pointerId: 1, pointerType: 'mouse' })

		fireEvent.pointerMove(grid, { clientX: 40, clientY: 100, pointerId: 9, pointerType: 'mouse' })

		expect(grid.scrollLeft).toBeCloseTo(0)
	})

	it('stops panning when the pointer is taken away, without selecting anything', () => {
		const { grid, onSelect } = setup()
		fireEvent.pointerDown(grid, { clientX: 100, clientY: 100, button: 1, pointerId: 1, pointerType: 'mouse' })

		fireEvent.pointerCancel(grid, { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' })
		fireEvent.pointerMove(grid, { clientX: 40, clientY: 100, pointerId: 1, pointerType: 'mouse' })

		expect(grid.scrollLeft).toBeCloseTo(0)
		expect(onSelect).not.toHaveBeenCalled()
	})
})

describe('what is under the cursor', () => {
	it('reports the cell the pointer is over, with the modifiers being held', () => {
		const { grid, onHoverLocation } = setup()

		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerType: 'mouse', shiftKey: true })

		expect(onHoverLocation).toHaveBeenCalledWith(at(1, 2), { range: true, toggle: false })
	})

	it('treats ctrl and cmd alike, since one machine has each', () => {
		const { grid, onHoverLocation } = setup()

		fireEvent.pointerMove(grid, { ...centreOf(0, 0), pointerType: 'mouse', metaKey: true })

		expect(onHoverLocation).toHaveBeenCalledWith(at(0, 0), { range: false, toggle: true })
	})

	it('reports nothing for the padding around the canvas, which is not a cell', () => {
		const { grid, onHoverLocation } = setup()

		fireEvent.pointerMove(grid, { clientX: 8 * TILE + 20, clientY: 10, pointerType: 'mouse' })

		expect(onHoverLocation).toHaveBeenCalledWith(null, { range: false, toggle: false })
	})

	it('reports nothing once the pointer leaves the grid', () => {
		const { grid, onHoverLocation } = setup()

		fireEvent.pointerLeave(grid)

		expect(onHoverLocation).toHaveBeenLastCalledWith(null, { range: false, toggle: false })
	})

	it('says nothing about a touch, which has no hover to report', () => {
		const { grid, onHoverLocation } = setup()

		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerType: 'touch' })

		expect(onHoverLocation).not.toHaveBeenCalled()
	})

	it('leaves a drag in flight to draw its own preview', () => {
		dragOperationSource = { type: 'grid-button' }
		const { grid, onHoverLocation } = setup()

		fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerType: 'mouse' })

		expect(onHoverLocation).not.toHaveBeenCalled()
	})

	it('does nothing on a grid with nothing to show under the cursor', () => {
		const { grid } = setup({ hover: false })

		expect(() => fireEvent.pointerMove(grid, { ...centreOf(1, 2), pointerType: 'mouse' })).not.toThrow()
		expect(() => fireEvent.pointerLeave(grid)).not.toThrow()
	})
})

describe('moving the grid to a cell', () => {
	it('starts with the first cell in the top left corner, wherever that is', () => {
		const { grid } = setup({ gridSize: { minRow: -1, maxRow: 3, minColumn: -2, maxColumn: 7 } })

		expect(grid.scrollTop).toBe(TILE)
		expect(grid.scrollLeft).toBe(2 * TILE)
	})

	it('goes back to that corner when asked', () => {
		const { grid, ref } = setup()
		grid.scrollLeft = 400
		grid.scrollTop = 300

		ref.current?.resetPosition()

		expect(grid.scrollLeft).toBeCloseTo(0)
		expect(grid.scrollTop).toBeCloseTo(0)
	})

	it('does nothing when asked before the grid has been laid out', () => {
		const calls: (() => void)[] = []

		// The parent's layout effect runs after the grid's own, but before the grid has re-rendered
		// with the element it was handed - so this is the one moment its handle has nothing to scroll
		function CallOnFirstLayout() {
			const gridRef = useRef<ButtonInfiniteGridRef>(null)
			useLayoutEffect(() => {
				const grid = gridRef.current
				if (grid)
					calls.push(
						() => grid.revealLocation(at(3, 5)),
						() => grid.resetPosition()
					)
			}, [])

			return (
				<ButtonInfiniteGrid
					ref={gridRef}
					pageNumber={PAGE}
					gridSize={GRID_SIZE}
					ButtonIconFactory={StubButton}
					marquee={null}
					onHoverLocation={null}
					drawScale={DRAW_SCALE}
				/>
			)
		}

		const { container } = render(<CallOnFirstLayout />)

		expect(calls).toHaveLength(2)
		for (const call of calls) expect(call).not.toThrow()
		expect((container.querySelector('.button-infinite-grid') as HTMLElement).scrollLeft).toBeCloseTo(0)
	})

	it('leaves the grid where it is for a cell already in view', () => {
		const { grid, ref } = setup()
		grid.scrollLeft = 0

		ref.current?.revealLocation(at(1, 1))

		expect(grid.scrollLeft).toBeCloseTo(0)
		expect(grid.scrollTop).toBeCloseTo(0)
	})

	it('scrolls the least it can to bring a cell past the far edge into view', () => {
		const { grid, ref } = setup()

		ref.current?.revealLocation(at(3, 5))

		expect(grid.scrollLeft).toBe(6 * TILE - VIEWPORT.width)
		expect(grid.scrollTop).toBe(4 * TILE - VIEWPORT.height)
	})

	it('scrolls back for a cell that has been left behind', () => {
		const { grid, ref } = setup()
		grid.scrollLeft = 5 * TILE
		grid.scrollTop = 3 * TILE

		ref.current?.revealLocation(at(1, 2))

		expect(grid.scrollLeft).toBe(2 * TILE)
		expect(grid.scrollTop).toBe(TILE)
	})
})
