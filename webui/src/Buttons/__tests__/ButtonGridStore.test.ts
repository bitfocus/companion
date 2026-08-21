import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { ButtonGridStore, locationsInRectangle } from '../ButtonGridStore.js'
import type { GridToolActions } from '../GridTools/index.js'

const GRID_SIZE: UserConfigGridSize = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

const NO_MODIFIERS = { range: false, toggle: false }
const RANGE = { range: true, toggle: false }
const TOGGLE = { range: false, toggle: true }

function at(row: number, column: number, pageNumber = 1): ControlLocation {
	return { pageNumber, row, column }
}

function makeActions(): GridToolActions {
	return {
		openEditor: vi.fn(),
		press: vi.fn(),
		transfer: vi.fn(),
		clearButtons: vi.fn(),
	}
}

describe('ButtonGridStore', () => {
	let store: ButtonGridStore
	let actions: GridToolActions

	beforeEach(() => {
		store = new ButtonGridStore()
		actions = makeActions()
	})

	describe('selection', () => {
		it('starts empty, in the select tool', () => {
			expect(store.selectionCount).toBe(0)
			expect(store.activeToolId).toBe('select')
			expect(store.pressMode).toBe(false)
		})

		it('selects a single button', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)

			expect(store.selectedLocations).toEqual([at(1, 1)])
			expect(store.isSelected('1/1/1')).toBe(true)
			expect(store.isSelected('1/2/2')).toBe(false)
		})

		it('replaces the selection on a plain click', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(2, 2), NO_MODIFIERS)

			expect(store.selectedLocations).toEqual([at(2, 2)])
		})

		it('extends a rectangle with shift', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(2, 3), RANGE)

			expect(store.selectionCount).toBe(6)
			expect(store.isSelected('1/1/1')).toBe(true)
			expect(store.isSelected('1/1/2')).toBe(true)
			expect(store.isSelected('1/2/3')).toBe(true)
			expect(store.isSelected('1/3/3')).toBe(false)
		})

		it('measures a shift range from the anchor, so dragging back shrinks it', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(3, 3), RANGE)
			store.selectWithModifiers(at(2, 2), RANGE)

			expect(store.selectionCount).toBe(4)
			expect(store.isSelected('1/3/3')).toBe(false)
		})

		it('adds and removes single cells with ctrl', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(2, 2), TOGGLE)
			expect(store.selectionCount).toBe(2)

			store.selectWithModifiers(at(2, 2), TOGGLE)
			expect(store.selectedLocations).toEqual([at(1, 1)])
		})

		it('starts a new selection when a modified click lands on another page', () => {
			store.selectWithModifiers(at(1, 1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(2, 2, 5), RANGE)

			// A selection spans one page, so there is nothing sensible to extend across
			expect(store.selectedLocations).toEqual([at(2, 2, 5)])
			expect(store.selectionPageNumber).toBe(5)
		})

		it('reports which page the selection is on', () => {
			expect(store.selectionPageNumber).toBeNull()

			store.selectWithModifiers(at(1, 1, 3), NO_MODIFIERS)
			expect(store.selectionPageNumber).toBe(3)
		})

		it('notifies subscribers when the selection changes', () => {
			const listener = vi.fn()
			store.subscribe(listener)

			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)

			expect(listener).toHaveBeenCalled()
		})

		it('does not notify when clearing an already empty selection', () => {
			const listener = vi.fn()
			store.subscribe(listener)

			store.clearSelection()

			expect(listener).not.toHaveBeenCalled()
		})

		it('stops notifying an unsubscribed listener', () => {
			const listener = vi.fn()
			const unsubscribe = store.subscribe(listener)
			unsubscribe()

			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)

			expect(listener).not.toHaveBeenCalled()
		})
	})

	describe('keyboard focus', () => {
		it('does nothing without a focus to move', () => {
			expect(store.moveFocus(1, 0, GRID_SIZE)).toBeNull()
		})

		it('moves the focus and selects where it lands', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)

			expect(store.moveFocus(1, 0, GRID_SIZE)).toEqual(at(2, 1))
			expect(store.selectedLocations).toEqual([at(2, 1)])
		})

		it('wraps at the edges of the grid', () => {
			store.selectWithModifiers(at(3, 7), NO_MODIFIERS)

			expect(store.moveFocus(1, 0, GRID_SIZE)).toEqual(at(0, 7))
			expect(store.moveFocus(0, 1, GRID_SIZE)).toEqual(at(0, 0))
		})

		it('keeps the same cell when moving to another page', () => {
			store.selectWithModifiers(at(2, 3, 1), NO_MODIFIERS)

			expect(store.moveFocusToPage(4)).toEqual(at(2, 3, 4))
			expect(store.selectedLocations).toEqual([at(2, 3, 4)])
		})
	})

	describe('dragging out a rectangle', () => {
		it('selects everything inside it', () => {
			store.selectRectangle(at(1, 1), at(2, 2), false)

			expect(store.selectionCount).toBe(4)
			expect(store.isSelected('1/1/1')).toBe(true)
			expect(store.isSelected('1/2/2')).toBe(true)
		})

		it('replaces the previous selection by default', () => {
			store.selectWithModifiers(at(0, 0), NO_MODIFIERS)
			store.selectRectangle(at(1, 1), at(1, 2), false)

			expect(store.isSelected('1/0/0')).toBe(false)
			expect(store.selectionCount).toBe(2)
		})

		it('adds to the previous selection when additive, without duplicating overlap', () => {
			store.selectRectangle(at(1, 1), at(1, 2), false)
			store.selectRectangle(at(1, 2), at(1, 3), true)

			expect(store.selectionCount).toBe(3)
			expect(store.isSelected('1/1/1')).toBe(true)
			expect(store.isSelected('1/1/3')).toBe(true)
		})

		it('starts over when an additive sweep lands on another page', () => {
			store.selectRectangle(at(1, 1, 1), at(1, 2, 1), false)
			store.selectRectangle(at(1, 1, 2), at(1, 1, 2), true)

			expect(store.selectedLocations).toEqual([at(1, 1, 2)])
		})

		it('leaves the anchor where the sweep began, so shift-click can extend it', () => {
			store.selectRectangle(at(1, 1), at(2, 2), false)
			store.selectWithModifiers(at(3, 3), RANGE)

			expect(store.selectionCount).toBe(9)
		})
	})

	describe('extending from the keyboard', () => {
		it('grows the selection from the anchor with shift', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)

			store.extendFocus(1, 0, GRID_SIZE)
			expect(store.selectionCount).toBe(2)

			store.extendFocus(1, 0, GRID_SIZE)
			expect(store.selectionCount).toBe(3)
		})

		it('shrinks again when the focus comes back', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.extendFocus(1, 0, GRID_SIZE)
			store.extendFocus(-1, 0, GRID_SIZE)

			expect(store.selectedLocations).toEqual([at(1, 1)])
		})

		it('moves the focus without touching the selection', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)

			expect(store.moveFocusOnly(1, 0, GRID_SIZE)).toEqual(at(2, 1))
			expect(store.selectedLocations).toEqual([at(1, 1)])
			expect(store.focus).toEqual(at(2, 1))
		})

		it('picks out cells one at a time with focus moves and toggles', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.moveFocusOnly(0, 2, GRID_SIZE)
			store.toggleFocused()

			expect(store.selectionCount).toBe(2)
			expect(store.isSelected('1/1/3')).toBe(true)
			// The focus stays where it was put, rather than jumping about as cells are picked
			expect(store.focus).toEqual(at(1, 3))
		})

		it('toggles a cell back off', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.toggleFocused()

			expect(store.selectionCount).toBe(0)
		})

		it('selects the whole page', () => {
			store.selectAllOnPage(2, GRID_SIZE)

			expect(store.selectionCount).toBe(32)
			expect(store.selectionPageNumber).toBe(2)
		})
	})

	describe('clipboard', () => {
		it('marks its contents as picked up, so the grid can show them', () => {
			store.setClipboard([at(1, 1)], 'cut')

			expect(store.clipboard).toEqual({ locations: [at(1, 1)], mode: 'cut' })
			expect(store.isTransferSource('1/1/1')).toBe(true)
		})

		it('stops marking them once cleared', () => {
			store.setClipboard([at(1, 1)], 'copy')
			store.clearClipboard()

			expect(store.clipboard).toBeNull()
			expect(store.isTransferSource('1/1/1')).toBe(false)
		})
	})

	describe('tools', () => {
		it('switches tool and reports press mode', () => {
			store.setTool('press', actions)

			expect(store.activeToolId).toBe('press')
			expect(store.pressMode).toBe(true)
		})

		it('routes a press straight through in press mode', () => {
			store.setTool('press', actions)
			store.handlePress(at(1, 1), true, actions)

			expect(actions.press).toHaveBeenCalledWith(at(1, 1), true)
		})

		it('drops the selection on entering press mode', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.setTool('press', actions)

			expect(store.selectionCount).toBe(0)
		})

		it('opens the editor when a single button is tapped in select mode', () => {
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			expect(actions.openEditor).toHaveBeenCalledWith(at(1, 1))
			expect(store.selectedLocations).toEqual([at(1, 1)])
		})

		it('does not open the editor for one of several', () => {
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			vi.mocked(actions.openEditor).mockClear()

			store.handleTap(at(2, 2), TOGGLE, actions)

			expect(actions.openEditor).not.toHaveBeenCalled()
			expect(store.selectionCount).toBe(2)
		})

		it('clears the selection when the page changes under select', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.setViewPage(2, actions)

			expect(store.selectionCount).toBe(0)
		})
	})

	describe('transfer tools', () => {
		it('asks for a source, then a destination', () => {
			store.setTool('copy', actions)
			expect(store.hint(actions)).toBe('Press the button you want to copy')

			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			expect(store.hint(actions)).toBe('Where do you want it?')
			expect(actions.transfer).not.toHaveBeenCalled()

			store.handleTap(at(2, 2), NO_MODIFIERS, actions)
			expect(actions.transfer).toHaveBeenCalledWith('copy', [{ fromLocation: at(1, 1), toLocation: at(2, 2) }])
		})

		it('marks the picked-up button while waiting for a destination', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			expect(store.isTransferSource('1/1/1')).toBe(true)
		})

		it('stays armed afterwards, ready for the next source', () => {
			store.setTool('copy', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleTap(at(2, 2), NO_MODIFIERS, actions)

			expect(store.activeToolId).toBe('copy')
			expect(store.hint(actions)).toBe('Press the button you want to copy')

			store.handleTap(at(3, 3), NO_MODIFIERS, actions)
			store.handleTap(at(0, 0), NO_MODIFIERS, actions)

			expect(actions.transfer).toHaveBeenCalledTimes(2)
		})

		it('skips straight to the destination when several buttons are selected', () => {
			store.selectRectangle(at(1, 1), at(1, 2), false)
			store.setTool('move', actions)

			expect(store.hint(actions)).toBe('Where do you want it?')

			store.handleTap(at(2, 2), NO_MODIFIERS, actions)
			expect(actions.transfer).toHaveBeenCalledWith('move', [
				{ fromLocation: at(1, 1), toLocation: at(2, 2) },
				{ fromLocation: at(1, 2), toLocation: at(2, 3) },
			])
		})

		it('still asks for a source when only the button you were looking at is selected', () => {
			// Clicking a button to see it selects it, so a single selection is not a statement of intent.
			// Taking it as the source would silently turn the user's first tap into the destination.
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.setTool('copy', actions)

			expect(store.hint(actions)).toBe('Press the button you want to copy')

			store.handleTap(at(3, 3), NO_MODIFIERS, actions)
			expect(actions.transfer).not.toHaveBeenCalled()

			store.handleTap(at(2, 2), NO_MODIFIERS, actions)
			expect(actions.transfer).toHaveBeenCalledWith('copy', [{ fromLocation: at(3, 3), toLocation: at(2, 2) }])
		})

		it('keeps a region together, anchored at the tapped cell', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(2, 2), RANGE)
			store.setTool('copy', actions)

			store.handleTap(at(0, 5), NO_MODIFIERS, actions)

			expect(actions.transfer).toHaveBeenCalledWith('copy', [
				{ fromLocation: at(1, 1), toLocation: at(0, 5) },
				{ fromLocation: at(1, 2), toLocation: at(0, 6) },
				{ fromLocation: at(2, 1), toLocation: at(1, 5) },
				{ fromLocation: at(2, 2), toLocation: at(1, 6) },
			])
		})

		it('survives a page change, so a button can be copied to another page', () => {
			store.setTool('copy', actions)
			store.handleTap(at(1, 1, 1), NO_MODIFIERS, actions)

			store.setViewPage(2, actions)

			expect(store.activeToolId).toBe('copy')
			expect(store.hint(actions)).toBe('Where do you want it?')

			store.handleTap(at(1, 1, 2), NO_MODIFIERS, actions)
			expect(actions.transfer).toHaveBeenCalledWith('copy', [{ fromLocation: at(1, 1, 1), toLocation: at(1, 1, 2) }])
		})
	})

	describe('going back', () => {
		it('unwinds a half-finished transfer to its source step', () => {
			store.setTool('copy', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.goBack(actions)

			expect(store.activeToolId).toBe('copy')
			expect(store.hint(actions)).toBe('Press the button you want to copy')
		})

		it('leaves the tool once there is nothing left to unwind', () => {
			store.setTool('copy', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.goBack(actions)
			store.goBack(actions)

			expect(store.activeToolId).toBe('select')
		})

		it('drops the selection before leaving the select tool', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)

			store.goBack(actions)

			expect(store.selectionCount).toBe(0)
			expect(store.activeToolId).toBe('select')
		})

		it('leaves press mode', () => {
			store.setTool('press', actions)
			store.goBack(actions)

			expect(store.activeToolId).toBe('select')
			expect(store.pressMode).toBe(false)
		})
	})

	describe('multi-select tool', () => {
		it('adds a button on a plain tap, with no modifier held', () => {
			store.setTool('multi-select', actions)

			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleTap(at(2, 2), NO_MODIFIERS, actions)

			expect(store.selectionCount).toBe(2)
		})

		it('removes a button that is tapped again', () => {
			store.setTool('multi-select', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleTap(at(2, 2), NO_MODIFIERS, actions)

			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			expect(store.selectedLocations).toEqual([at(2, 2)])
		})

		it('keeps what was already selected when entered', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.setTool('multi-select', actions)

			expect(store.selectedLocations).toEqual([at(1, 1)])
		})

		it('still extends a range with shift', () => {
			store.setTool('multi-select', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleTap(at(2, 2), RANGE, actions)

			expect(store.selectionCount).toBe(4)
		})

		it('never opens the editor, since tapping means selecting here', () => {
			store.setTool('multi-select', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			expect(actions.openEditor).not.toHaveBeenCalled()
		})

		it('explains itself until something is selected', () => {
			store.setTool('multi-select', actions)
			expect(store.hint(actions)).toBe('Tap buttons to add and remove them from the selection')

			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			// The context bar shows the count from here on, which says more
			expect(store.hint(actions)).toBeNull()
		})

		it('hands its selection to a transfer tool', () => {
			store.setTool('multi-select', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleTap(at(1, 2), NO_MODIFIERS, actions)

			store.setTool('copy', actions)
			expect(store.hint(actions)).toBe('Where do you want it?')
		})
	})

	describe('rubber-band selection', () => {
		it('is offered by the selecting tools', () => {
			expect(store.allowsMarquee).toBe(true)

			store.setTool('multi-select', actions)
			expect(store.allowsMarquee).toBe(true)

			store.setTool('arrange', actions)
			expect(store.allowsMarquee).toBe(true)
		})

		it('is not offered by the tools that place buttons', () => {
			// A drag under one of these is either moving something or nothing at all - drawing a
			// selection box over it leaves a stray rectangle behind
			for (const tool of ['copy', 'move', 'swap', 'delete', 'press'] as const) {
				store.setTool(tool, actions)
				expect(store.allowsMarquee, tool).toBe(false)
			}
		})
	})

	describe('arrange tool', () => {
		it('lets any button be dragged, unlike select', () => {
			expect(store.dragAnyButton).toBe(false)

			store.setTool('arrange', actions)
			expect(store.dragAnyButton).toBe(true)
		})

		it('still selects on a tap, so a region can be picked up', () => {
			store.setTool('arrange', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			expect(store.selectedLocations).toEqual([at(1, 1)])
		})

		it('is not a press mode', () => {
			store.setTool('arrange', actions)
			expect(store.pressMode).toBe(false)
		})
	})

	describe('delete tool', () => {
		it('confirms one button at a time', () => {
			store.setTool('delete', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			expect(actions.clearButtons).toHaveBeenCalledWith([at(1, 1)])
		})

		it('never acts on the existing selection just because it was armed', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.setTool('delete', actions)

			expect(actions.clearButtons).not.toHaveBeenCalled()
			expect(store.selectionCount).toBe(0)
		})
	})
})

describe('locationsInRectangle', () => {
	it('covers every cell between two corners', () => {
		expect(locationsInRectangle(at(1, 1), at(2, 2))).toEqual([at(1, 1), at(1, 2), at(2, 1), at(2, 2)])
	})

	it('works whichever corner comes first', () => {
		expect(locationsInRectangle(at(2, 2), at(1, 1))).toEqual([at(1, 1), at(1, 2), at(2, 1), at(2, 2)])
	})

	it('handles a single cell', () => {
		expect(locationsInRectangle(at(1, 1), at(1, 1))).toEqual([at(1, 1)])
	})
})
