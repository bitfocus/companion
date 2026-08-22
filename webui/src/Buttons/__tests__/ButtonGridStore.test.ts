import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatLocation as formatLocationKey } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { ButtonGridStore } from '../ButtonGridStore.js'
import { buildTransferPairs, locationsInRectangle } from '../GridGeometry.js'
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
		// The real one asks before replacing anything, and only reports back once it has happened
		transfer: vi.fn((_operation, _pairs, onApplied: () => void) => onApplied()),
		clearButtons: vi.fn(),
		// Tests act on a grid where every cell holds a button unless they say otherwise
		isOccupied: vi.fn(() => true),
		pasteAt: vi.fn(),
		fitsOnGrid: vi.fn(() => true),
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

		it('is unwound by going back, so a stray cut is not stuck on the grid forever', () => {
			// Mixing the keyboard with the toolbar could leave buttons marked with nothing to clear them
			store.setClipboard([at(1, 1)], 'cut')

			store.goBack(actions)

			expect(store.clipboard).toBeNull()
			expect(store.isTransferSource('1/1/1')).toBe(false)
		})

		it('is unwound after the selection, so each press of escape does one visible thing', () => {
			store.selectWithModifiers(at(2, 2), NO_MODIFIERS)
			store.setClipboard([at(1, 1)], 'copy')

			store.goBack(actions)
			expect(store.selectionCount).toBe(0)
			expect(store.clipboard).not.toBeNull()

			store.goBack(actions)
			expect(store.clipboard).toBeNull()
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
			expect(actions.transfer).toHaveBeenCalledWith(
				'copy',
				[{ fromLocation: at(1, 1), toLocation: at(2, 2) }],
				expect.any(Function)
			)
		})

		it('marks the picked-up button while waiting for a destination', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			expect(store.isTransferSource('1/1/1')).toBe(true)
		})

		it('picks the buttons up rather than leaving them selected as well', () => {
			// Two copies of the same thing is what let deselecting clear one and leave the tool holding
			// the other, still asking where to put them
			store.selectRectangle(at(1, 1), at(1, 2), false)
			store.setTool('copy', actions)

			expect(store.selectionCount).toBe(0)
			expect(store.isTransferSource('1/1/1')).toBe(true)
			expect(store.hint(actions)).toBe('Where do you want it?')
		})

		it('hands them back when you change your mind', () => {
			store.selectRectangle(at(1, 1), at(1, 2), false)
			store.setTool('copy', actions)

			store.goBack(actions)

			// Backing out of a misclicked tool should not cost the selection you built up to use it
			expect(store.selectedLocations).toEqual([at(1, 1), at(1, 2)])
			expect(store.isTransferSource('1/1/1')).toBe(false)
		})

		it('leaves the selection where the buttons landed', () => {
			// The transfer action moves the selection to the destinations; the tool must not undo that
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.setSelection([at(2, 2)])
			store.handleTap(at(2, 2), NO_MODIFIERS, actions)

			expect(store.selectedLocations).toEqual([at(2, 2)])
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
			expect(actions.transfer).toHaveBeenCalledWith(
				'move',
				[
					{ fromLocation: at(1, 1), toLocation: at(2, 2) },
					{ fromLocation: at(1, 2), toLocation: at(2, 3) },
				],
				expect.any(Function)
			)
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
			expect(actions.transfer).toHaveBeenCalledWith(
				'copy',
				[{ fromLocation: at(3, 3), toLocation: at(2, 2) }],
				expect.any(Function)
			)
		})

		it('keeps a region together, anchored at the tapped cell', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(2, 2), RANGE)
			store.setTool('copy', actions)

			store.handleTap(at(0, 5), NO_MODIFIERS, actions)

			expect(actions.transfer).toHaveBeenCalledWith(
				'copy',
				[
					{ fromLocation: at(1, 1), toLocation: at(0, 5) },
					{ fromLocation: at(1, 2), toLocation: at(0, 6) },
					{ fromLocation: at(2, 1), toLocation: at(1, 5) },
					{ fromLocation: at(2, 2), toLocation: at(1, 6) },
				],
				expect.any(Function)
			)
		})

		it('survives a page change, so a button can be copied to another page', () => {
			store.setTool('copy', actions)
			store.handleTap(at(1, 1, 1), NO_MODIFIERS, actions)

			store.setViewPage(2, actions)

			expect(store.activeToolId).toBe('copy')
			expect(store.hint(actions)).toBe('Where do you want it?')

			store.handleTap(at(1, 1, 2), NO_MODIFIERS, actions)
			expect(actions.transfer).toHaveBeenCalledWith(
				'copy',
				[{ fromLocation: at(1, 1, 1), toLocation: at(1, 1, 2) }],
				expect.any(Function)
			)
		})
	})

	describe('revising what a transfer tool is holding', () => {
		const held = () => [...store.transferSourceKeys].sort()

		it('adds a button that was left out', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleTap(at(2, 2), TOGGLE, actions)

			expect(held()).toEqual(['1/1/1', '1/2/2'])
			// Still holding, not placing - the tap revised the set rather than putting it down
			expect(actions.transfer).not.toHaveBeenCalled()
		})

		it('drops a button that should not have been picked up', () => {
			store.setTool('copy', actions)
			store.handleMarquee(at(1, 1), at(1, 3), false, actions)

			store.handleTap(at(1, 2), TOGGLE, actions)

			expect(held()).toEqual(['1/1/1', '1/1/3'])
		})

		it('extends the region from where the pick started', () => {
			store.setTool('copy', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleTap(at(2, 2), RANGE, actions)

			expect(held()).toEqual(['1/1/1', '1/1/2', '1/2/1', '1/2/2'])
		})

		it('measures a shift-click from the corner a box was drawn from', () => {
			store.setTool('move', actions)
			// Bottom-right to top-left, so the anchor is not the first cell of the region
			store.handleMarquee(at(2, 2), at(1, 1), false, actions)

			store.handleTap(at(3, 2), RANGE, actions)

			expect(held()).toEqual(['1/2/2', '1/3/2'])
		})

		it('goes back to asking for a source once the last one is taken away', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleTap(at(1, 1), TOGGLE, actions)

			expect(held()).toEqual([])
			expect(store.hint(actions)).toBe('Press the button you want to move')
		})

		it('drops a landing spot drawn for the old set', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(3, 3), NO_MODIFIERS, actions)

			store.handleTap(at(2, 2), TOGGLE, actions)

			expect(store.dropGhostSource('1/3/3')).toBeNull()
		})

		it('starts the set off when there is nothing yet to revise', () => {
			store.setTool('move', actions)

			store.handleTap(at(1, 1), TOGGLE, actions)

			expect(held()).toEqual(['1/1/1'])
			expect(store.hint(actions)).toBe('Where do you want it?')
		})
	})

	describe('what a transfer tool does with the selection it was armed over', () => {
		it('adds to the selection when a modifier click arrives with nothing yet in hand', () => {
			// Escape hands the buttons back to the selection, so this is the state after backing out
			store.setTool('move', actions)
			store.handleMarquee(at(1, 1), at(1, 2), false, actions)
			store.goBack(actions)
			expect(store.selectionCount).toBe(2)

			store.handleTap(at(3, 3), TOGGLE, actions)

			expect([...store.transferSourceKeys].sort()).toEqual(['1/1/1', '1/1/2', '1/3/3'])
			// Held, not selected - one or the other owns them
			expect(store.selectionCount).toBe(0)
			expect(actions.transfer).not.toHaveBeenCalled()
		})

		it('leaves nothing selected when it declines to take a single button', () => {
			// Clicking a button to look at it selects it, so this is where the tool is usually armed
			// from. Leaving it highlighted makes it look picked up when it is not.
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.setTool('copy', actions)

			expect(store.selectionCount).toBe(0)
			expect(store.hint(actions)).toBe('Press the button you want to copy')
		})

		it('drops the selection when a plain tap picks something up instead', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(2, 2), TOGGLE)
			store.setTool('move', actions)
			store.goBack(actions)

			store.handleTap(at(3, 3), NO_MODIFIERS, actions)

			expect([...store.transferSourceKeys]).toEqual(['1/3/3'])
			expect(store.selectionCount).toBe(0)
		})
	})

	describe('changing your mind about which transfer tool', () => {
		const held = () => [...store.transferSourceKeys].sort()

		it('keeps the buttons when switching between copy, move and swap', () => {
			store.setTool('copy', actions)
			store.handleMarquee(at(1, 1), at(1, 2), false, actions)
			expect(held()).toEqual(['1/1/1', '1/1/2'])

			store.setTool('move', actions)

			expect(held()).toEqual(['1/1/1', '1/1/2'])
			expect(store.hint(actions)).toBe('Where do you want it?')
		})

		it('keeps a single button too, which arming over a selection would not have taken', () => {
			store.setTool('copy', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.setTool('swap', actions)

			expect(held()).toEqual(['1/1/1'])
			expect(store.hint(actions)).toBe('Where do you want it?')
		})

		it('hands them back as a selection when leaving for a tool with no use for them', () => {
			store.setTool('move', actions)
			store.handleMarquee(at(1, 1), at(1, 2), false, actions)

			store.setTool('select', actions)

			expect(held()).toEqual([])
			expect(store.selectedLocations).toEqual([at(1, 1), at(1, 2)])
		})

		it('asks about the buttons in hand when switching to delete', () => {
			store.setTool('move', actions)
			store.handleMarquee(at(1, 1), at(1, 2), false, actions)

			store.setTool('delete', actions)

			expect(actions.clearButtons).toHaveBeenCalledWith([at(1, 1), at(1, 2)])
		})

		it('puts them down when switching to press mode, where a highlight only misleads', () => {
			store.setTool('move', actions)
			store.handleMarquee(at(1, 1), at(1, 2), false, actions)

			store.setTool('press', actions)

			expect(held()).toEqual([])
			expect(store.selectionCount).toBe(0)
		})
	})

	describe('what a modifier-click would do to the selection', () => {
		it('shows the button a ctrl-click would add', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)

			store.handleHover(at(2, 2), TOGGLE, actions)

			expect(store.pendingChange('1/2/2')).toBe('add')
			expect(store.pendingChange('1/1/1')).toBeNull()
		})

		it('shows the button a ctrl-click would drop', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(2, 2), TOGGLE)

			store.handleHover(at(2, 2), TOGGLE, actions)

			expect(store.pendingChange('1/2/2')).toBe('remove')
		})

		it('shows the rectangle a shift-click would reach', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)

			store.handleHover(at(2, 2), RANGE, actions)

			expect(store.pendingChange('1/1/2')).toBe('add')
			expect(store.pendingChange('1/2/1')).toBe('add')
			expect(store.pendingChange('1/2/2')).toBe('add')
		})

		it('stays quiet for a plain hover, where the click replaces the lot', () => {
			// Lighting up everything about to be dropped says more about what is being left behind
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.selectWithModifiers(at(2, 2), TOGGLE)

			store.handleHover(at(3, 3), NO_MODIFIERS, actions)

			expect(store.pendingChange('1/1/1')).toBeNull()
			expect(store.pendingChange('1/3/3')).toBeNull()
		})

		it('flips to "another click would put it back" without waiting for the pointer to move', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.handleHover(at(2, 2), TOGGLE, actions)
			expect(store.pendingChange('1/2/2')).toBe('add')

			store.handleTap(at(2, 2), TOGGLE, actions)

			expect(store.pendingChange('1/2/2')).toBe('remove')
		})

		it('speaks up for every hover in multi-select, where every tap does something', () => {
			store.setTool('multi-select', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleHover(at(2, 2), NO_MODIFIERS, actions)
			expect(store.pendingChange('1/2/2')).toBe('add')

			store.handleHover(at(1, 1), NO_MODIFIERS, actions)
			expect(store.pendingChange('1/1/1')).toBe('remove')
		})

		it('is dropped when the tool changes', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.handleHover(at(2, 2), TOGGLE, actions)

			store.setTool('multi-select', actions)

			expect(store.pendingChange('1/2/2')).toBeNull()
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

	describe('drag preview', () => {
		const preview = (entries: [string, ControlLocation][], valid = true) => ({
			placements: new Map(entries),
			valid,
		})

		it('says which button would end up on each cell, not just that one would', () => {
			store.setDragPreview(preview([['1/2/1', at(1, 1)]]))

			// The cell can then draw that button's own image, which is what makes a block checkable
			expect(store.dropGhostSource('1/2/1')).toEqual(at(1, 1))
			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})

		it('reports a drop that would be refused', () => {
			expect(store.dragPreviewValid).toBe(true)

			store.setDragPreview(preview([['1/1/1', at(2, 2)]], false))
			expect(store.dragPreviewValid).toBe(false)
		})

		it('clears when the drag ends', () => {
			store.setDragPreview(preview([['1/1/1', at(2, 2)]]))
			store.setDragPreview(null)

			expect(store.dropGhostSource('1/1/1')).toBeNull()
		})

		it('does not wake every cell for an unchanged answer', () => {
			// This runs on every pointer move of a drag
			store.setDragPreview(
				preview([
					['1/1/1', at(2, 1)],
					['1/1/2', at(2, 2)],
				])
			)

			const listener = vi.fn()
			store.subscribe(listener)
			store.setDragPreview(
				preview([
					['1/1/2', at(2, 2)],
					['1/1/1', at(2, 1)],
				])
			)

			expect(listener).not.toHaveBeenCalled()
		})

		it('notifies when the same cells would receive different buttons', () => {
			store.setDragPreview(preview([['1/1/1', at(2, 1)]]))

			const listener = vi.fn()
			store.subscribe(listener)
			store.setDragPreview(preview([['1/1/1', at(3, 1)]]))

			expect(listener).toHaveBeenCalled()
		})
	})

	describe('hovering with a tool armed', () => {
		it('shows nothing until the tool has picked something up', () => {
			store.setTool('move', actions)
			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})

		it('ghosts where the picked-up buttons would land', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleHover(at(3, 4), NO_MODIFIERS, actions)

			expect(store.dropGhostSource('1/3/4')).toEqual(at(1, 1))
		})

		it('puts the region under the cursor, wherever the box was drawn from', () => {
			store.setTool('copy', actions)
			// Dragged out bottom-right to top-left, which is the case that is impossible to guess at
			store.handleMarquee(at(2, 2), at(1, 1), false, actions)

			store.handleHover(at(3, 5), NO_MODIFIERS, actions)

			// An even-sided region has no middle cell, so the upper left of the two carries the cursor
			expect(store.dropGhostSource('1/3/5')).toEqual(at(1, 1))
			expect(store.dropGhostSource('1/4/6')).toEqual(at(2, 2))
		})

		it('centres an odd-sided region on the cursor, rather than hanging it below and right', () => {
			store.setTool('copy', actions)
			store.handleMarquee(at(0, 0), at(2, 2), false, actions)

			store.handleHover(at(2, 4), NO_MODIFIERS, actions)

			// The middle of the 3x3 is the cell being pointed at, and the rest sits around it
			expect(store.dropGhostSource('1/2/4')).toEqual(at(1, 1))
			expect(store.dropGhostSource('1/1/3')).toEqual(at(0, 0))
			expect(store.dropGhostSource('1/3/5')).toEqual(at(2, 2))
		})

		it('places where the ghost said it would', () => {
			store.setTool('copy', actions)
			store.handleMarquee(at(0, 0), at(2, 2), false, actions)
			store.handleHover(at(2, 4), NO_MODIFIERS, actions)

			store.handleTap(at(2, 4), NO_MODIFIERS, actions)

			const pairs = vi.mocked(actions.transfer).mock.calls[0][1]
			expect(pairs).toContainEqual({ fromLocation: at(1, 1), toLocation: at(2, 4) })
			expect(pairs).toContainEqual({ fromLocation: at(0, 0), toLocation: at(1, 3) })
		})

		it('shows no landing spot while a modifier would revise the selection instead', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			store.handleHover(at(2, 2), TOGGLE, actions)

			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})

		it('shows which buttons a shift-click would take instead', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleHover(at(2, 2), RANGE, actions)

			// The rectangle from the anchor, which is otherwise guesswork - the same problem the landing
			// ghost solves for placing. The one already in hand is not changing, so it is not marked.
			expect(store.pendingChange('1/1/2')).toBe('add')
			expect(store.pendingChange('1/2/1')).toBe('add')
			expect(store.pendingChange('1/2/2')).toBe('add')
			expect(store.pendingChange('1/1/1')).toBeNull()
			expect(store.pendingChange('1/3/3')).toBeNull()
			// And no landing spot, since the click would not place anything
			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})

		it('shows the buttons a smaller shift-rectangle would give up', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleTap(at(1, 3), RANGE, actions)

			// Back towards the anchor: the far end of what is held would drop out
			store.handleHover(at(1, 2), RANGE, actions)

			expect(store.pendingChange('1/1/3')).toBe('remove')
			expect(store.pendingChange('1/1/1')).toBeNull()
			expect(store.pendingChange('1/1/2')).toBeNull()
		})

		it('shows a ctrl hover taking a button in', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleHover(at(2, 2), TOGGLE, actions)

			expect(store.pendingChange('1/2/2')).toBe('add')
			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})

		it('shows a ctrl hover putting one back, which is the other thing it can mean', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleTap(at(2, 2), TOGGLE, actions)

			store.handleHover(at(2, 2), TOGGLE, actions)

			expect(store.pendingChange('1/2/2')).toBe('remove')
			expect(store.pendingChange('1/1/1')).toBeNull()
		})

		it('drops the preview once the modifier is released', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(2, 2), RANGE, actions)

			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			expect(store.pendingChange('1/2/2')).toBeNull()
		})

		it('drops the preview once the buttons are taken', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(2, 2), RANGE, actions)

			store.handleTap(at(2, 2), RANGE, actions)

			expect(store.pendingChange('1/2/2')).toBeNull()
			expect([...store.transferSourceKeys].sort()).toEqual(['1/1/1', '1/1/2', '1/2/1', '1/2/2'])
		})

		it('does not wake every cell for an unchanged answer', () => {
			// This runs on every pointer move with a modifier held
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(2, 2), TOGGLE, actions)

			const listener = vi.fn()
			store.subscribe(listener)
			store.handleHover(at(2, 2), TOGGLE, actions)

			expect(listener).not.toHaveBeenCalled()
		})

		it('brings it back once the modifier is released', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(2, 2), TOGGLE, actions)

			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			expect(store.dropGhostSource('1/2/2')).toEqual(at(1, 1))
		})

		it('shows the end of a swap that empties, not just the one that fills', () => {
			// Swapping with an empty cell is how a button is moved into one, and half of that is a cell
			// becoming empty - which is only visible if the preview draws it
			actions.isOccupied = vi.fn((location) => formatLocationKey(location) === '1/1/1')
			store.setTool('swap', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			expect(store.dropGhostSource('1/2/2')).toEqual(at(1, 1))
			// The empty cell is heading back the other way, so the source is emptying
			expect(store.dropGhostSource('1/1/1')).toEqual(at(2, 2))
		})

		it('shows both ends of a swap, so the displaced buttons are visible too', () => {
			store.setTool('swap', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			expect(store.dropGhostSource('1/2/2')).toEqual(at(1, 1))
			expect(store.dropGhostSource('1/1/1')).toEqual(at(2, 2))
		})

		it('marks a placement that would fall off the grid', () => {
			actions.fitsOnGrid = vi.fn(() => false)
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleHover(at(3, 7), NO_MODIFIERS, actions)

			expect(store.dragPreviewValid).toBe(false)
		})

		it('refuses to place buttons that would land off the grid, keeping hold of them', () => {
			actions.fitsOnGrid = vi.fn(() => false)
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)

			store.handleTap(at(3, 7), NO_MODIFIERS, actions)

			expect(actions.transfer).not.toHaveBeenCalled()
			// Still holding them, so the next tap can put them somewhere with more room
			expect(store.hint(actions)).toBe('Where do you want it?')
		})

		it('clears when the pointer leaves the grid', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			store.handleHover(null, NO_MODIFIERS, actions)

			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})

		it('clears once the buttons have been placed', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			store.handleTap(at(2, 2), NO_MODIFIERS, actions)

			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})

		it('clears when the tool is backed out of', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			store.goBack(actions)

			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})

		it('clears when a different tool is armed', () => {
			store.setTool('move', actions)
			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			store.setTool('select', actions)

			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})

		it('means nothing to the select tool', () => {
			store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
			store.handleHover(at(2, 2), NO_MODIFIERS, actions)

			expect(store.dropGhostSource('1/2/2')).toBeNull()
		})
	})

	describe('dragging a box', () => {
		it('selects the region under the selecting tools', () => {
			for (const tool of ['select', 'multi-select', 'arrange'] as const) {
				store.setTool(tool, actions)
				expect(store.allowsMarquee(false), tool).toBe(true)
			}

			store.setTool('select', actions)
			store.handleMarquee(at(1, 1), at(2, 2), false, actions)
			expect(store.selectionCount).toBe(4)
		})

		it('picks what a transfer should take, rather than selecting it', () => {
			store.setTool('copy', actions)
			expect(store.allowsMarquee(false)).toBe(true)

			store.handleMarquee(at(1, 1), at(2, 2), false, actions)

			expect(store.selectionCount).toBe(0)
			expect(store.isTransferSource('1/1/1')).toBe(true)
			expect(store.hint(actions)).toBe('Where do you want it?')
		})

		it('carries the region to the destination in one go', () => {
			store.setTool('move', actions)
			store.handleMarquee(at(1, 1), at(1, 2), false, actions)

			store.handleTap(at(3, 4), NO_MODIFIERS, actions)

			expect(actions.transfer).toHaveBeenCalledWith(
				'move',
				[
					{ fromLocation: at(1, 1), toLocation: at(3, 4) },
					{ fromLocation: at(1, 2), toLocation: at(3, 5) },
				],
				expect.any(Function)
			)
		})

		it('stops offering a box once the transfer is asking where to put them', () => {
			store.setTool('copy', actions)
			store.handleMarquee(at(1, 1), at(2, 2), false, actions)

			// A plain box would mean nothing here, and drawing one would just leave a stray rectangle
			expect(store.allowsMarquee(false)).toBe(false)
			// An additive one adds to what is in hand, which is worth drawing
			expect(store.allowsMarquee(true)).toBe(true)
		})

		it('adds to what a transfer is already holding', () => {
			store.setTool('move', actions)
			store.handleMarquee(at(1, 1), at(1, 2), false, actions)

			store.handleMarquee(at(3, 3), at(3, 4), true, actions)

			expect([...store.transferSourceKeys].sort()).toEqual(['1/1/1', '1/1/2', '1/3/3', '1/3/4'])
		})

		it('does not add the same button twice', () => {
			store.setTool('move', actions)
			store.handleMarquee(at(1, 1), at(1, 2), false, actions)

			store.handleMarquee(at(1, 2), at(1, 3), true, actions)

			expect([...store.transferSourceKeys].sort()).toEqual(['1/1/1', '1/1/2', '1/1/3'])
		})

		it('drops a landing spot drawn before the region grew', () => {
			store.setTool('move', actions)
			store.handleMarquee(at(1, 1), at(1, 2), false, actions)
			store.handleHover(at(3, 3), NO_MODIFIERS, actions)

			store.handleMarquee(at(2, 5), at(2, 6), true, actions)

			expect(store.dropGhostSource('1/3/3')).toBeNull()
		})

		it('ignores a box over nothing at all', () => {
			actions.isOccupied = vi.fn(() => false)
			store.setTool('copy', actions)

			store.handleMarquee(at(1, 1), at(2, 2), false, actions)

			expect(store.hint(actions)).toBe('Press the button you want to copy')
		})

		it('clears a region under the delete tool, counting only what is there', () => {
			actions.isOccupied = vi.fn((location) => location.column === 1)
			store.setTool('delete', actions)

			store.handleMarquee(at(1, 1), at(2, 2), false, actions)

			expect(actions.clearButtons).toHaveBeenCalledWith([at(1, 1), at(2, 1)])
		})

		it('is never offered in press mode', () => {
			store.setTool('press', actions)
			expect(store.allowsMarquee(false)).toBe(false)
			expect(store.allowsMarquee(true)).toBe(false)
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

	describe('clicking an empty cell', () => {
		/** A grid where only 1/1/1 holds a button */
		const onlyOneButton = () => {
			actions.isOccupied = vi.fn((location) => formatLocationKey(location) === '1/1/1')
		}

		it('is ignored by delete, rather than asking about nothing', () => {
			onlyOneButton()
			store.setTool('delete', actions)

			store.handleTap(at(2, 2), NO_MODIFIERS, actions)
			expect(actions.clearButtons).not.toHaveBeenCalled()

			store.handleTap(at(1, 1), NO_MODIFIERS, actions)
			expect(actions.clearButtons).toHaveBeenCalledWith([at(1, 1)])
		})

		it('is ignored when picking a source to copy or move', () => {
			for (const tool of ['copy', 'move'] as const) {
				onlyOneButton()
				store.setTool('select', actions)
				store.setTool(tool, actions)

				store.handleTap(at(2, 2), NO_MODIFIERS, actions)
				// Still waiting for a source, so nothing was picked up
				expect(store.hint(actions), tool).toBe(`Press the button you want to ${tool}`)
			}
		})

		it('is accepted by swap, which is how a button is moved into an empty cell', () => {
			onlyOneButton()
			store.setTool('swap', actions)

			store.handleTap(at(2, 2), NO_MODIFIERS, actions)

			expect(store.hint(actions)).toBe('Where do you want it?')
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

describe('buildTransferPairs', () => {
	it('lands the top-left of a region on the destination', () => {
		const pairs = buildTransferPairs([at(1, 1), at(1, 2)], at(3, 5), 'top-left')

		expect(pairs).toEqual([
			{ fromLocation: at(1, 1), toLocation: at(3, 5) },
			{ fromLocation: at(1, 2), toLocation: at(3, 6) },
		])
	})

	it('lands the middle of an odd region on the destination', () => {
		const region = [at(0, 0), at(0, 1), at(0, 2), at(1, 0), at(1, 1), at(1, 2), at(2, 0), at(2, 1), at(2, 2)]

		const pairs = buildTransferPairs(region, at(2, 4), 'center')

		expect(pairs).toContainEqual({ fromLocation: at(1, 1), toLocation: at(2, 4) })
		expect(pairs).toContainEqual({ fromLocation: at(0, 0), toLocation: at(1, 3) })
		expect(pairs).toContainEqual({ fromLocation: at(2, 2), toLocation: at(3, 5) })
	})

	it('takes the upper left of the two middles when a region has an even side', () => {
		const pairs = buildTransferPairs([at(0, 0), at(0, 1)], at(2, 4), 'center')

		expect(pairs).toEqual([
			{ fromLocation: at(0, 0), toLocation: at(2, 4) },
			{ fromLocation: at(0, 1), toLocation: at(2, 5) },
		])
	})

	it('agrees with itself for a single button, whichever anchor is asked for', () => {
		for (const anchor of ['top-left', 'center'] as const) {
			expect(buildTransferPairs([at(1, 1)], at(3, 5), anchor), anchor).toEqual([
				{ fromLocation: at(1, 1), toLocation: at(3, 5) },
			])
		}
	})

	it('measures from the bounding box, not the order the cells came in', () => {
		const pairs = buildTransferPairs([at(2, 2), at(1, 1)], at(3, 5), 'top-left')

		expect(pairs).toEqual([
			{ fromLocation: at(2, 2), toLocation: at(4, 6) },
			{ fromLocation: at(1, 1), toLocation: at(3, 5) },
		])
	})

	it('keeps the gaps in a region, so its shape survives the trip', () => {
		// An L: the hole at 1/2 is what makes it an L rather than a square
		const pairs = buildTransferPairs([at(1, 1), at(2, 1), at(2, 2)], at(0, 5), 'top-left')

		expect(pairs.map((pair) => formatLocationKey(pair.toLocation))).toEqual(['1/0/5', '1/1/5', '1/1/6'])
	})
})
