import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
	ButtonGridViewProvider,
	useButtonGridStore,
	useButtonGridView,
	useGridActiveToolId,
	useGridClipboard,
	useGridDragAnyButton,
	useGridDragPreviewValid,
	useGridDropGhostSource,
	useGridFocus,
	useGridHint,
	useGridIsSelected,
	useGridIsTransferSource,
	useGridPendingChange,
	useGridPendingChangesJoin,
	useGridPressMode,
	useGridSelectedLocations,
	useGridSelectionCount,
	useGridSelectionPageNumber,
} from '../ButtonGridViewContext.js'
import { at, makeGridView, type GridViewHarness } from './gridViewTestHelpers.js'

const NO_MODIFIERS = { range: false, toggle: false }

/**
 * The hooks are how every cell reads the store, so what matters is that each reports the store's
 * current answer and re-renders when - and only when - its own answer changes.
 */
function renderGridHook<T>(hook: () => T, view: GridViewHarness) {
	return renderHook(hook, {
		wrapper: ({ children }) => <ButtonGridViewProvider value={view}>{children}</ButtonGridViewProvider>,
	})
}

describe('the grid view context', () => {
	it('refuses to be used outside a provider, rather than reading from nothing', () => {
		expect(() => renderHook(() => useButtonGridView())).toThrow(/ButtonGridViewProvider/)
	})

	it('hands out the store and the actions it was given', () => {
		const view = makeGridView()

		const { result } = renderGridHook(() => useButtonGridView(), view)
		const { result: storeResult } = renderGridHook(() => useButtonGridStore(), view)

		expect(result.current.store).toBe(view.store)
		expect(result.current.actions).toBe(view.actions)
		expect(storeResult.current).toBe(view.store)
	})

	describe('per-cell answers', () => {
		it('reports whether this one cell is selected', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridIsSelected('1/1/1'), view)
			expect(result.current).toBe(false)

			act(() => view.store.selectWithModifiers(at(1, 1), NO_MODIFIERS))

			expect(result.current).toBe(true)
		})

		it('leaves an unaffected cell alone when the selection changes', () => {
			const view = makeGridView()
			let renders = 0
			const { result } = renderGridHook(() => {
				renders++
				return useGridIsSelected('1/3/3')
			}, view)

			const before = renders
			act(() => view.store.selectWithModifiers(at(1, 1), NO_MODIFIERS))

			// A boolean that has not changed bails out, so only the two cells that did are woken
			expect(renders).toBe(before)
			expect(result.current).toBe(false)
		})

		it('reports the button heading for this cell, so it can be drawn as a ghost', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridDropGhostSource('1/2/2'), view)
			expect(result.current).toBeNull()

			act(() => view.store.setDragPreview({ placements: new Map([['1/2/2', at(1, 1)]]), valid: true }))

			expect(result.current).toEqual(at(1, 1))
		})

		it('reports whether a drop would be refused', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridDragPreviewValid(), view)
			expect(result.current).toBe(true)

			act(() => view.store.setDragPreview({ placements: new Map([['1/2/2', at(1, 1)]]), valid: false }))

			expect(result.current).toBe(false)
		})

		it('reports whether this cell has been picked up by a tool', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridIsTransferSource('1/1/1'), view)
			expect(result.current).toBe(false)

			act(() => {
				view.store.setTool('move', view.actions)
				view.store.handleTap(at(1, 1), NO_MODIFIERS, view.actions)
			})

			expect(result.current).toBe(true)
		})

		it('reports what a modifier-click would do to this cell', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridPendingChange('1/2/2'), view)
			expect(result.current).toBeNull()

			act(() => {
				view.store.selectWithModifiers(at(1, 1), NO_MODIFIERS)
				view.store.handleHover(at(2, 2), { range: false, toggle: true }, view.actions)
			})

			expect(result.current).toBe('add')
		})
	})

	describe('answers about the grid as a whole', () => {
		it('reports press mode', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridPressMode(), view)
			expect(result.current).toBe(false)

			act(() => view.store.setTool('press', view.actions))

			expect(result.current).toBe(true)
		})

		it('reports whether any button can be dragged', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridDragAnyButton(), view)
			expect(result.current).toBe(false)

			act(() => view.store.setTool('arrange', view.actions))

			expect(result.current).toBe(true)
		})

		it('reports which set a pending change would join, so it can be drawn in that set’s colour', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridPendingChangesJoin(), view)
			expect(result.current).toBe('selection')

			act(() => view.store.setTool('copy', view.actions))

			expect(result.current).toBe('held-buttons')
		})

		it('reports the active tool', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridActiveToolId(), view)
			expect(result.current).toBe('select')

			act(() => view.store.setTool('delete', view.actions))

			expect(result.current).toBe('delete')
		})

		it('reports the selection, its size and its page', () => {
			const view = makeGridView()
			const count = renderGridHook(() => useGridSelectionCount(), view)
			const locations = renderGridHook(() => useGridSelectedLocations(), view)
			const page = renderGridHook(() => useGridSelectionPageNumber(), view)

			expect(count.result.current).toBe(0)
			expect(locations.result.current).toEqual([])
			expect(page.result.current).toBeNull()

			act(() => view.store.setSelection([at(1, 1, 4), at(1, 2, 4)]))

			expect(count.result.current).toBe(2)
			expect(locations.result.current).toEqual([at(1, 1, 4), at(1, 2, 4)])
			expect(page.result.current).toBe(4)
		})

		it('reports where the keyboard focus is', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridFocus(), view)
			expect(result.current).toBeNull()

			act(() => view.store.selectWithModifiers(at(2, 3), NO_MODIFIERS))

			expect(result.current).toEqual(at(2, 3))
		})

		it('reports what is on the clipboard', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridClipboard(), view)
			expect(result.current).toBeNull()

			act(() => view.store.setClipboard([at(1, 1)], 'cut'))

			expect(result.current).toEqual({ locations: [at(1, 1)], mode: 'cut' })
		})

		it('reports what the grid has to say, which depends on the actions as well as the store', () => {
			const view = makeGridView()
			const { result } = renderGridHook(() => useGridHint(), view)
			expect(result.current).toBeNull()

			act(() => view.store.setTool('copy', view.actions))

			expect(result.current).toBe('Press the button you want to copy')
		})
	})
})
