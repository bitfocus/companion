import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WrappedImage } from '@companion-app/shared/Model/Common.js'
import { ButtonGridViewProvider } from '../ButtonGridViewContext.js'
import { GRID_BUTTON_DRAG_TYPE, type GridButtonDragItem } from '../GridButtonDragItem.js'

const subscribeMock = vi.fn((_input: unknown, _handlers: { onData: (data: WrappedImage) => void }) => ({
	unsubscribe: vi.fn(),
}))

vi.mock('~/Resources/TRPC', () => ({
	trpcClient: { preview: { graphics: { location: { subscribe: subscribeMock } } } },
}))

/**
 * dnd-kit renders the overlay into the top layer against a live drag operation. Standing in for it
 * keeps this about what the ghost draws, which is the part with anything to get wrong.
 */
let dragSource: { type: string; data: GridButtonDragItem | null } | null = null

vi.mock('@dnd-kit/react', () => ({
	DragOverlay: ({
		children,
		disabled,
	}: {
		children: (source: unknown) => React.JSX.Element
		disabled: (source: unknown) => boolean
	}): React.JSX.Element | null => (disabled(dragSource) ? null : children(dragSource)),
}))

const { GridButtonDragOverlay } = await import('../GridButtonDragOverlay.js')
const { resetButtonImageCache } = await import('~/Hooks/useButtonImageForLocation.js')
const { at, makeGridView } = await import('./gridViewTestHelpers.js')

/** Push an image down every open subscription, as the server would */
function emitAll(data: WrappedImage) {
	act(() => {
		for (const [, handlers] of subscribeMock.mock.calls) handlers.onData(data)
	})
}

beforeEach(() => {
	resetButtonImageCache()
	subscribeMock.mockClear()
	dragSource = null
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

function renderOverlay(selection: ReturnType<typeof at>[] = []): HTMLElement {
	const view = makeGridView()
	if (selection.length > 0) view.store.setSelection(selection)

	return render(
		<ButtonGridViewProvider value={view}>
			<GridButtonDragOverlay />
		</ButtonGridViewProvider>
	).container
}

function setup(origin: ReturnType<typeof at> | null, selection: ReturnType<typeof at>[] = []) {
	dragSource = origin ? { type: GRID_BUTTON_DRAG_TYPE, data: { location: origin } } : null

	return { container: renderOverlay(selection) }
}

describe('the drag ghost', () => {
	it('draws nothing when nothing is being dragged', () => {
		const { container } = setup(null)

		expect(container.querySelector('.grid-drag-ghost')).toBeNull()
	})

	it('stands aside for a drag that is not a grid button, so a preset keeps its own preview', () => {
		dragSource = { type: 'preset', data: null }

		expect(renderOverlay()).toBeEmptyDOMElement()
	})

	it('draws nothing for a grid drag that has not said what it picked up', () => {
		dragSource = { type: GRID_BUTTON_DRAG_TYPE, data: null }

		expect(renderOverlay()).toBeEmptyDOMElement()
	})

	it('draws the one button when it is not part of the selection', () => {
		const { container } = setup(at(1, 1), [at(3, 3), at(3, 4)])

		expect(container.querySelectorAll('.button-control')).toHaveLength(1)
		expect(container.querySelectorAll('.grid-drag-ghost-hole')).toHaveLength(0)
	})

	it('takes the whole selection when the dragged button belongs to it', () => {
		const { container } = setup(at(1, 1), [at(1, 1), at(1, 2), at(2, 1), at(2, 2)])

		expect(container.querySelectorAll('.button-control')).toHaveLength(4)
		// Laid out as the region it is, rather than a row of buttons
		expect((container.querySelector('.grid-drag-ghost') as HTMLElement).style.gridTemplateColumns).toBe(
			'repeat(2, var(--grid-drag-ghost-cell))'
		)
	})

	it('leaves the gaps in a region as holes, so its shape is what follows the cursor', () => {
		// An L: three of the four cells in a 2x2 bounding box
		const { container } = setup(at(1, 1), [at(1, 1), at(2, 1), at(2, 2)])

		expect(container.querySelectorAll('.button-control')).toHaveLength(3)
		expect(container.querySelectorAll('.grid-drag-ghost-hole')).toHaveLength(1)
	})

	it('draws each button being carried', () => {
		const { container } = setup(at(1, 1), [at(1, 1), at(1, 2)])

		emitAll({ image: 'data:image/png;base64,AAAA', isUsed: true })

		const drawn = [...container.querySelectorAll('.button-border')].map(
			(el) => (el as HTMLElement).style.backgroundImage
		)
		expect(drawn).toHaveLength(2)
		expect(drawn.every((image) => image.includes('data:image/png;base64,AAAA'))).toBe(true)
	})

	it('counts them instead once the region is a screenful, rather than drawing them all', () => {
		// A 7x7 bounding box, past the 36-cell cap
		const { container } = setup(at(0, 0), [at(0, 0), at(6, 6)])

		expect(container.querySelector('.grid-drag-ghost-count')).toHaveTextContent('2 buttons')
		expect(container.querySelectorAll('.button-control')).toHaveLength(0)
	})
})
