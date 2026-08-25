import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'

const subscribeMock = vi.fn((_input: unknown, _handlers: { onData: (data: WrappedImage) => void }) => ({
	unsubscribe: vi.fn(),
}))

vi.mock('~/Resources/TRPC', () => ({
	trpcClient: { preview: { graphics: { location: { subscribe: subscribeMock } } } },
}))

/** What dnd-kit says is being dragged, and what it was told about each cell */
let dragOperationSource: { type: string } | null = null
const draggables: { id: string; disabled: boolean }[] = []

vi.mock('@dnd-kit/react', () => ({
	useDragOperation: () => ({ source: dragOperationSource }),
	useDraggable: (options: { id: string; disabled: boolean }) => {
		draggables.push({ id: options.id, disabled: options.disabled })
		return { ref: () => undefined, isDragSource: false }
	},
	useDroppable: () => ({ ref: () => undefined, isDropTarget: false }),
}))

const { PrimaryButtonGridIcon } = await import('../ButtonInfiniteGrid.js')
const { ButtonGridIcon, ButtonGridIconBase } = await import('../GridButtonIcons.js')
const { resetButtonImageCache } = await import('~/Hooks/useButtonImageForLocation.js')
const { ButtonGridViewProvider } = await import('../ButtonGridViewContext.js')
const { at, makeGridView } = await import('./gridViewTestHelpers.js')

/** Push an image down every open subscription, as the server would */
function emitAll(data: WrappedImage) {
	act(() => {
		for (const [, handlers] of subscribeMock.mock.calls) handlers.onData(data)
	})
}

beforeEach(() => {
	// Image subscriptions are shared and refcounted, so a location one test watched would otherwise
	// still be live for the next
	resetButtonImageCache()
	subscribeMock.mockClear()
	draggables.length = 0
	dragOperationSource = null

	// The previews are drawn only once the browser has the image, which jsdom will never report
	vi.stubGlobal(
		'Image',
		class {
			onload: (() => void) | null = null
			set src(_value: string) {
				this.onload?.()
			}
		}
	)
})

function setup(location: ControlLocation = at(1, 2), view = makeGridView()) {
	const utils = render(
		<ButtonGridViewProvider value={view}>
			<PrimaryButtonGridIcon
				pageNumber={location.pageNumber}
				row={location.row}
				column={location.column}
				left={10}
				top={20}
				fixedSize
				onClick={undefined}
				onContextMenu={undefined}
				selected={false}
				copySource={false}
				contextMenuOpen={false}
			/>
		</ButtonGridViewProvider>
	)

	const cell = utils.container.querySelector('.button-control') as HTMLElement
	const draggable = () => draggables[draggables.length - 1]

	return { ...utils, view, cell, draggable }
}

/** Whichever cell is asking, say it holds a button */
const OCCUPIED: WrappedImage = { image: 'data:image/png;base64,AAAA', isUsed: true }
const EMPTY: WrappedImage = { image: null, isUsed: false }

describe('a cell on the main grid', () => {
	it('draws the button that lives there', () => {
		const { cell } = setup()
		emitAll(OCCUPIED)

		expect(cell.querySelector('.button-border')).toHaveStyle({ backgroundImage: `url(${OCCUPIED.image})` })
	})

	it('names an empty cell, so the grid can be read without counting', () => {
		const { cell } = setup(at(1, 2))
		emitAll(EMPTY)

		expect(cell.querySelector('.button-placeholder')).toHaveTextContent('1/2')
	})

	it('hands a tap to whichever tool is active, with the modifiers that were held', () => {
		const { view, cell } = setup(at(1, 2))
		emitAll(OCCUPIED)
		const handleTap = vi.spyOn(view.store, 'handleTap')

		fireEvent.pointerDown(cell, { clientX: 0, clientY: 0, pointerId: 1, button: 0 })
		fireEvent.pointerUp(cell, { clientX: 0, clientY: 0, pointerId: 1, button: 0, shiftKey: true })

		expect(handleTap).toHaveBeenCalledWith(at(1, 2), { range: true, toggle: false }, view.actions)
	})

	it('fires the button for real once the press tool is armed', () => {
		const { view, cell } = setup(at(1, 2))
		act(() => {
			view.store.setTool('press', view.actions)
		})
		const handlePress = vi.spyOn(view.store, 'handlePress')

		fireEvent.pointerDown(cell, { clientX: 0, clientY: 0, pointerId: 1, button: 0 })

		expect(handlePress).toHaveBeenCalledWith(at(1, 2), true, view.actions)
	})

	it('opens the menu for the cell it was opened on', () => {
		const { view, cell } = setup(at(1, 2))

		fireEvent.contextMenu(cell, { clientX: 40, clientY: 50 })

		expect(view.onContextMenu).toHaveBeenCalledWith(at(1, 2), 40, 50)
	})

	it('shows a button the tool is holding as its source', () => {
		const view = makeGridView()
		const { cell } = setup(at(1, 2), view)

		// Only a deliberate multiple selection is taken as what the tool should carry
		act(() => {
			view.store.setSelection([at(1, 2), at(1, 3)])
			view.store.setTool('move', view.actions)
		})

		expect(cell).toHaveClass('copy-source')
	})

	it('shows what a modifier click here would do while the modifier is held', () => {
		const view = makeGridView()
		const { cell } = setup(at(1, 2), view)

		act(() => view.store.setPendingChanges(new Map([[formatLocation(at(1, 2)), 'add']])))

		expect(cell).toHaveClass('pending-add')
	})
})

describe('what a cell says about a drag', () => {
	it('marks every cell as a home for a preset, since one can go anywhere', () => {
		dragOperationSource = { type: 'preset' }
		const { cell } = setup()

		expect(cell).toHaveClass('drophere')
	})

	it('says nothing extra while a button is being dragged around the grid', () => {
		dragOperationSource = { type: 'grid-button' }
		const { cell } = setup()

		// The landing region lights up on its own; marking every cell would say nothing
		expect(cell).not.toHaveClass('drophere')
	})

	it('draws the button that would end up here, over the one already there', () => {
		const view = makeGridView()
		const { cell } = setup(at(1, 2), view)

		act(() => view.store.setDragPreview({ placements: new Map([[formatLocation(at(1, 2)), at(3, 3)]]), valid: true }))
		emitAll(OCCUPIED)

		expect(cell.querySelector('.button-drop-ghost')).toHaveStyle({ backgroundImage: `url(${OCCUPIED.image})` })
		expect(cell).toHaveClass('drophover')
	})

	it('marks a landing spot that would be refused, rather than letting it look fine', () => {
		const view = makeGridView()
		const { cell } = setup(at(1, 2), view)

		act(() => view.store.setDragPreview({ placements: new Map([[formatLocation(at(1, 2)), at(3, 3)]]), valid: false }))

		expect(cell).toHaveClass('dropinvalid')
		expect(cell).not.toHaveClass('drophover')
	})

	it('draws an empty button for the end of a swap that empties, not the button leaving it', () => {
		const view = makeGridView()
		const { cell } = setup(at(1, 2), view)

		// Nothing is coming here, but this cell is still part of what the drop changes
		act(() => view.store.setDragPreview({ placements: new Map([[formatLocation(at(1, 2)), at(1, 2)]]), valid: true }))
		emitAll(EMPTY)

		expect(cell.querySelector('.button-drop-ghost')).toBeInTheDocument()
	})
})

describe('which cells can be dragged', () => {
	it('offers no drag for an empty cell, where it could only end in nothing happening', () => {
		const { draggable } = setup()
		emitAll(EMPTY)

		expect(draggable().disabled).toBe(true)
	})

	it('leaves an unselected button to rubber-band from while selecting', () => {
		const { draggable } = setup()
		emitAll(OCCUPIED)

		expect(draggable().disabled).toBe(true)
	})

	it('drags a button that is part of the selection, taking the rest with it', () => {
		const view = makeGridView()
		const { draggable } = setup(at(1, 2), view)
		emitAll(OCCUPIED)

		act(() => view.store.setSelection([at(1, 2)]))

		expect(draggable().disabled).toBe(false)
	})

	it('drags any button once the arrange tool is armed', () => {
		const view = makeGridView()
		const { draggable } = setup(at(1, 2), view)
		emitAll(OCCUPIED)

		act(() => {
			view.store.setTool('arrange', view.actions)
		})

		expect(draggable().disabled).toBe(false)
	})

	it('drags nothing in press mode, so a drag can never swallow a press', () => {
		const view = makeGridView()
		const { draggable } = setup(at(1, 2), view)
		emitAll(OCCUPIED)

		act(() => {
			view.store.setSelection([at(1, 2)])
			view.store.setTool('press', view.actions)
		})

		expect(draggable().disabled).toBe(true)
	})

	it('leaves an undraggable cell unmarked, since it is still a cell you can click', () => {
		const { cell } = setup()
		emitAll(EMPTY)

		// dnd-kit marks whatever holds its ref, so the ref is withheld rather than passed disabled
		expect(cell).not.toHaveAttribute('aria-disabled')
	})
})

describe('the cells on the grids that are only picked from', () => {
	it('draws the button at the location it was given', () => {
		const { container } = render(<ButtonGridIcon pageNumber={2} row={1} column={3} left={0} top={0} image={null} />)
		emitAll(OCCUPIED)

		expect(container.querySelector('.button-border')).toHaveStyle({ backgroundImage: `url(${OCCUPIED.image})` })
		expect(container.querySelector('.button-border')).toHaveAttribute('title', '2/1/3')
	})

	it('names an empty one by its position on the page', () => {
		const { container } = render(<ButtonGridIconBase pageNumber={2} row={1} column={3} left={4} top={5} image={null} />)

		expect(container.querySelector('.button-placeholder')).toHaveTextContent('1/3')
		expect(container.querySelector('.button-control')).toHaveStyle({ left: '4px', top: '5px' })
	})
})
