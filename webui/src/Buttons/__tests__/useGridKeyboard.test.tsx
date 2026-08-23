import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { ButtonGridStore } from '../ButtonGridStore.js'
import type { GridZoomController } from '../GridZoom.js'
import { isTypingTarget, useGridKeyboard } from '../useGridKeyboard.js'
import { at, makeGridActions } from './gridViewTestHelpers.js'

const GRID_SIZE: UserConfigGridSize = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

function setup(options: { gridSize?: UserConfigGridSize | undefined; pageNumber?: number | null } = {}) {
	const store = new ButtonGridStore()
	const actions = makeGridActions()
	const setPageNumber = vi.fn()
	const zoom: GridZoomController = { zoomIn: vi.fn(), zoomOut: vi.fn(), zoomReset: vi.fn(), setZoom: vi.fn() }

	const { result } = renderHook(() =>
		useGridKeyboard({
			store,
			actions,
			gridSize: 'gridSize' in options ? options.gridSize : GRID_SIZE,
			pageNumber: 'pageNumber' in options ? (options.pageNumber ?? null) : 1,
			pageCount: 3,
			setPageNumber,
			zoom,
		})
	)

	/** Press a key on the grid, as the panel that owns the handler would report it */
	const press = (key: string, modifiers: Record<string, unknown> = {}) => {
		const event = { key, preventDefault: vi.fn(), target: document.body, ...modifiers } as any
		act(() => result.current(event))
		return event
	}

	return { store, actions, setPageNumber, zoom, press }
}

describe('zooming', () => {
	it.each([
		['=', 'zoomIn'],
		['-', 'zoomOut'],
		['0', 'zoomReset'],
	] as const)('takes ctrl+%s for itself, rather than letting the browser zoom the page', (key, method) => {
		const { zoom, press } = setup()

		const event = press(key, { ctrlKey: true })

		expect(zoom[method]).toHaveBeenCalled()
		expect(event.preventDefault).toHaveBeenCalled()
	})

	it('treats cmd the same as ctrl, since one machine has each', () => {
		const { zoom, press } = setup()

		press('=', { metaKey: true })

		expect(zoom.zoomIn).toHaveBeenCalled()
	})

	it('leaves alt combinations alone, which belong to the browser', () => {
		const { zoom, press } = setup()

		press('=', { ctrlKey: true, altKey: true })

		expect(zoom.zoomIn).not.toHaveBeenCalled()
	})

	it('still zooms before the grid size is known, since that needs no grid', () => {
		const { zoom, press } = setup({ gridSize: undefined })

		press('0', { ctrlKey: true })

		expect(zoom.zoomReset).toHaveBeenCalled()
	})
})

describe('walking around the grid', () => {
	it.each([
		['ArrowDown', at(2, 1)],
		['ArrowUp', at(0, 1)],
		['ArrowLeft', at(1, 0)],
		['ArrowRight', at(1, 2)],
	])('moves the focus with %s, selecting where it lands', (key, expected) => {
		const { store, press } = setup()
		act(() => store.setSelection([at(1, 1)]))

		press(key)

		expect(store.focus).toEqual(expected)
		expect(store.selectedLocations).toEqual([expected])
	})

	it('extends the selection when shift is held', () => {
		const { store, press } = setup()
		act(() => store.setSelection([at(1, 1)]))

		press('ArrowRight', { shiftKey: true })

		expect(store.selectedLocations).toEqual([at(1, 1), at(1, 2)])
	})

	it('walks the focus without disturbing the selection when ctrl is held', () => {
		const { store, press } = setup()
		act(() => store.setSelection([at(1, 1)]))

		press('ArrowRight', { ctrlKey: true })

		expect(store.focus).toEqual(at(1, 2))
		expect(store.selectedLocations).toEqual([at(1, 1)])
	})

	it('builds up a scattered selection with space, so a mouse is not needed', () => {
		const { store, press } = setup()
		act(() => store.setSelection([at(1, 1)]))
		press('ArrowRight', { ctrlKey: true })

		press(' ')

		expect(store.selectedLocations).toEqual([at(1, 1), at(1, 2)])
	})

	it('does nothing at all before the grid size is known', () => {
		const { store, press } = setup({ gridSize: undefined })

		press('ArrowRight')

		expect(store.focus).toBeNull()
	})

	it('selects everything on the page with ctrl+A', () => {
		const { store, press } = setup()

		press('a', { ctrlKey: true })

		expect(store.selectionCount).toBe(32)
	})

	it('has nothing to select before the page has been resolved', () => {
		const { store, press } = setup({ pageNumber: null })

		press('a', { ctrlKey: true })

		expect(store.selectionCount).toBe(0)
	})
})

describe('changing page from the keyboard', () => {
	it('takes the focus with it, so the arrows carry on from the same place', () => {
		const { store, setPageNumber, press } = setup()
		act(() => store.setSelection([at(1, 1)]))

		press('PageUp')

		expect(setPageNumber).toHaveBeenCalledWith(2)
		expect(store.focus).toEqual(at(1, 1, 2))
	})

	it('wraps round the end rather than stopping there', () => {
		const { store, setPageNumber, press } = setup()
		act(() => store.setSelection([at(1, 1, 3)]))

		press('PageUp')

		expect(setPageNumber).toHaveBeenCalledWith(1)
	})

	it('goes back a page, wrapping round the start', () => {
		const { store, setPageNumber, press } = setup()
		act(() => store.setSelection([at(1, 1, 2)]))
		press('PageDown')
		expect(setPageNumber).toHaveBeenCalledWith(1)

		act(() => store.setSelection([at(1, 1, 1)]))
		press('PageDown')
		expect(setPageNumber).toHaveBeenLastCalledWith(3)
	})

	it.each(['PageUp', 'PageDown'])('does nothing with %s while nothing is focused', (key) => {
		const { setPageNumber, press } = setup()

		press(key)

		expect(setPageNumber).not.toHaveBeenCalled()
	})
})

describe('acting on the selection', () => {
	it.each(['Backspace', 'Delete'])('asks about clearing the selection with %s', (key) => {
		const { store, actions, press } = setup()
		act(() => store.setSelection([at(1, 1), at(1, 2)]))

		press(key)

		expect(actions.clearButtons).toHaveBeenCalledWith([at(1, 1), at(1, 2)])
	})

	it('leaves ctrl+delete alone, which is not this', () => {
		const { store, actions, press } = setup()
		act(() => store.setSelection([at(1, 1)]))

		press('Delete', { ctrlKey: true })

		expect(actions.clearButtons).not.toHaveBeenCalled()
	})

	it('copies and cuts the selection', () => {
		const { store, press } = setup()
		act(() => store.setSelection([at(1, 1)]))

		press('c', { ctrlKey: true })
		expect(store.clipboard).toEqual({ locations: [at(1, 1)], mode: 'copy' })

		press('x', { ctrlKey: true })
		expect(store.clipboard).toEqual({ locations: [at(1, 1)], mode: 'cut' })
	})

	it('pastes at the focused cell, through the same path as everything else', () => {
		const { store, actions, press } = setup()
		act(() => store.setSelection([at(1, 1)]))
		act(() => store.setClipboard([at(2, 2)], 'copy'))

		press('v', { ctrlKey: true })

		expect(actions.pasteAt).toHaveBeenCalledWith(at(1, 1))
	})

	it('does none of it with nothing selected', () => {
		const { store, actions, press } = setup()

		press('c', { ctrlKey: true })
		press('Delete')

		expect(store.clipboard).toBeNull()
		expect(actions.clearButtons).not.toHaveBeenCalled()
	})

	it('ignores a key it has nothing to do with', () => {
		const { store, press } = setup()
		act(() => store.setSelection([at(1, 1)]))

		expect(() => press('q')).not.toThrow()
		expect(store.clipboard).toBeNull()
	})
})

describe('escape, from anywhere on the page', () => {
	function renderWithEscape(inner: React.ReactNode = null) {
		const store = new ButtonGridStore()
		const actions = makeGridActions()
		const goBack = vi.spyOn(store, 'goBack')

		function Harness() {
			useGridKeyboard({
				store,
				actions,
				gridSize: GRID_SIZE,
				pageNumber: 1,
				pageCount: 3,
				setPageNumber: vi.fn(),
				zoom: { zoomIn: vi.fn(), zoomOut: vi.fn(), zoomReset: vi.fn(), setZoom: vi.fn() },
			})
			return <>{inner}</>
		}

		const utils = render(<Harness />)
		return { ...utils, store, goBack }
	}

	it('unwinds the active tool wherever the focus happens to be', () => {
		const { goBack } = renderWithEscape()

		fireEvent.keyDown(document.body, { key: 'Escape' })

		expect(goBack).toHaveBeenCalled()
	})

	it('stops listening once the page is gone', () => {
		const { goBack, unmount } = renderWithEscape()

		unmount()
		fireEvent.keyDown(document.body, { key: 'Escape' })

		expect(goBack).not.toHaveBeenCalled()
	})

	it('ignores every other key', () => {
		const { goBack } = renderWithEscape()

		fireEvent.keyDown(document.body, { key: 'a' })

		expect(goBack).not.toHaveBeenCalled()
	})

	it('stands aside for whatever has already answered the key', () => {
		const { goBack } = renderWithEscape()

		const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
		event.preventDefault()
		document.body.dispatchEvent(event)

		expect(goBack).not.toHaveBeenCalled()
	})

	it('stands aside for a dialog or menu that escape closes', () => {
		const { goBack } = renderWithEscape(<div role="dialog" />)

		fireEvent.keyDown(document.body, { key: 'Escape' })

		expect(goBack).not.toHaveBeenCalled()
	})

	it('leaves escape to the field being typed in', () => {
		const { goBack, container } = renderWithEscape(<input />)

		fireEvent.keyDown(container.querySelector('input') as HTMLElement, { key: 'Escape' })

		expect(goBack).not.toHaveBeenCalled()
	})
})

describe('where the keys belong to something else', () => {
	it.each([
		['a text field', document.createElement('input')],
		['a text area', document.createElement('textarea')],
	])('leaves %s alone', (_name, element) => {
		expect(isTypingTarget(element)).toBe(true)
	})

	it('leaves anything being edited in place alone', () => {
		const element = document.createElement('div')
		element.contentEditable = 'true'
		// jsdom does not work `isContentEditable` out from the attribute
		Object.defineProperty(element, 'isContentEditable', { value: true })

		expect(isTypingTarget(element)).toBe(true)
	})

	it('leaves the expression editor alone, which is neither', () => {
		const element = document.createElement('div')
		element.classList.add('native-edit-context')

		expect(isTypingTarget(element)).toBe(true)
	})

	it('answers for anything else, including nothing at all', () => {
		expect(isTypingTarget(document.createElement('div'))).toBe(false)
		expect(isTypingTarget(null)).toBe(false)
		expect(isTypingTarget(new EventTarget())).toBe(false)
	})

	it('does nothing when a key arrives from a text field inside the grid panel', () => {
		const { store, press } = setup()
		act(() => store.setSelection([at(1, 1)]))

		press('Delete', { target: document.createElement('input') })

		expect(store.selectionCount).toBe(1)
	})
})
