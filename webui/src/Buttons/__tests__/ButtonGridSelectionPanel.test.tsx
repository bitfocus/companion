import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WrappedImage } from '@companion-app/shared/Model/Common.js'

const subscribeMock = vi.fn((_input: unknown, _handlers: { onData: (data: WrappedImage) => void }) => ({
	unsubscribe: vi.fn(),
}))

// The preview draws each selected button, which means a live image subscription apiece
vi.mock('~/Resources/TRPC', () => ({
	trpcClient: { preview: { graphics: { location: { subscribe: subscribeMock } } } },
}))

const { ButtonGridSelectionPanel } = await import('../ButtonGridSelectionPanel.js')
const { resetButtonImageCache } = await import('~/Hooks/useButtonImageForLocation.js')

const { at, makeGridView, renderInGridView } = await import('./gridViewTestHelpers.js')

/** Push an image down every open subscription, as the server would */
function emitAll(data: WrappedImage) {
	act(() => {
		for (const [, handlers] of subscribeMock.mock.calls) handlers.onData(data)
	})
}

// The previews are drawn only once the browser has the image, which jsdom will never report on its
// own - so loading resolves immediately here
beforeEach(() => {
	// Image subscriptions are shared and refcounted, so a location one test watched would otherwise
	// still be live for the next
	resetButtonImageCache()

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

function setup() {
	const view = makeGridView()
	subscribeMock.mockClear()
	const utils = renderInGridView(<ButtonGridSelectionPanel />, view)
	return { view, ...utils }
}

describe('the selection panel', () => {
	it('says so when nothing is selected', () => {
		setup()

		expect(screen.getByText('Nothing selected')).toBeInTheDocument()
	})

	it('describes the selection as a region rather than a list of coordinates', () => {
		const { view } = setup()

		act(() => view.store.setSelection([at(1, 1, 4), at(1, 2, 4), at(2, 1, 4), at(2, 2, 4)]))

		expect(screen.getByRole('heading', { name: '4 buttons selected' })).toBeInTheDocument()
		expect(screen.getByText(/Page 4/)).toHaveTextContent('2×2 region')
	})

	it('leaves the cells that were not picked as holes, so the shape reads correctly', () => {
		const { view, container } = setup()

		// An L: three of the four cells in a 2x2 bounding box
		act(() => view.store.setSelection([at(1, 1), at(2, 1), at(2, 2)]))

		expect(container.querySelectorAll('.button-grid-selection-hole')).toHaveLength(1)
		expect(container.querySelectorAll('.button-control')).toHaveLength(3)
	})

	it('draws each selected button', () => {
		const { view, container } = setup()
		act(() => view.store.setSelection([at(1, 1), at(1, 2)]))

		emitAll({ image: 'data:image/png;base64,AAAA', isUsed: true })

		const drawn = [...container.querySelectorAll('.button-border')].map(
			(el) => (el as HTMLElement).style.backgroundImage
		)
		expect(drawn).toHaveLength(2)
		expect(drawn.every((image) => image.includes('data:image/png;base64,AAAA'))).toBe(true)
	})

	it('draws a placeholder for a selected cell holding nothing', () => {
		const { view, container } = setup()
		act(() => view.store.setSelection([at(1, 1)]))

		emitAll({ image: 'data:image/png;base64,AAAA', isUsed: false })

		expect(container.querySelector('.button-placeholder')).toHaveTextContent('1/1')
	})

	it('summarises a selection too large to draw, rather than opening a subscription per cell', () => {
		const { view, container } = setup()

		// 11x11 bounding box, past the 120-cell cap
		act(() => view.store.setSelection([at(0, 0), at(10, 10)]))

		expect(screen.getByText('Too many buttons to preview.')).toBeInTheDocument()
		expect(container.querySelector('.button-grid-selection-preview')).toBeNull()
		expect(subscribeMock).not.toHaveBeenCalled()
	})

	it('offers the same actions as the bar above the grid', () => {
		const { view } = setup()
		act(() => view.store.setSelection([at(1, 1), at(1, 2)]))

		for (const label of ['Copy', 'Move', 'Swap', 'Delete', 'Deselect']) {
			expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
		}
	})
})
