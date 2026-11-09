import { useCallback, useEffect, useRef } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { isTypingTarget } from '~/util/isTypingTarget.js'
import type { ButtonGridStore } from './ButtonGridStore.js'
import type { GridToolActions } from './GridTools/index.js'
import type { GridZoomController } from './GridZoom.js'

export interface UseGridKeyboardOptions {
	store: ButtonGridStore
	actions: GridToolActions
	/** Undefined until the user config has arrived, when there is no grid to navigate */
	gridSize: UserConfigGridSize | undefined
	pageNumber: number
	pageCount: number
	setPageNumber: (pageNumber: number) => void
	zoom: GridZoomController
}

/**
 * The keys the grid answers to.
 *
 * Escape is handled for the whole page rather than only wherever the focus happens to be; everything
 * else arrives through the returned handler, which the grid panel and the button editor both bind.
 */
export function useGridKeyboard({
	store,
	actions,
	gridSize,
	pageNumber,
	pageCount,
	setPageNumber,
	zoom,
}: UseGridKeyboardOptions): (e: React.KeyboardEvent) => void {
	// Escape is the way out of whatever the grid has got itself into, so which corner of the page
	// holds the focus should not decide whether it works: clicking a tab on the right is not a reason
	// to be stuck holding a set of buttons, and something you press to be sure you are not about to
	// do anything has to work when you press it.
	//
	// Bound to the document rather than to the grid, and stepping aside for anything with a nearer
	// claim on the key - a text field, or an open dialog or menu that Escape closes.
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || e.defaultPrevented) return
			if (isTypingTarget(e.target)) return
			if (document.querySelector('[role="dialog"], [role="menu"]')) return

			store.goBack(actions)
		}

		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [store, actions])

	// The button Enter is holding down. Let go of wherever the focus has gone by then, or when the window loses
	// it, so a button is never left stuck down.
	const enterPressRef = useRef<ControlLocation | null>(null)
	useEffect(() => {
		const release = () => {
			const location = enterPressRef.current
			if (!location) return

			enterPressRef.current = null
			store.handleTestPress(location, false, actions)
		}
		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === 'Enter') release()
		}

		document.addEventListener('keyup', handleKeyUp)
		window.addEventListener('blur', release)
		return () => {
			document.removeEventListener('keyup', handleKeyUp)
			window.removeEventListener('blur', release)
			release()
		}
	}, [store, actions])

	return useCallback(
		(e: React.KeyboardEvent) => {
			const isControlOrCommandCombo = (e.ctrlKey || e.metaKey) && !e.altKey

			// e.target is the actual element where the event happened, e.currentTarget is the element where the event listener is attached
			if (isTypingTarget(e.target)) return

			if (isControlOrCommandCombo && e.key === '=') {
				e.preventDefault()
				zoom.zoomIn(true)
				return
			}
			if (isControlOrCommandCombo && e.key === '-') {
				e.preventDefault()
				zoom.zoomOut(true)
				return
			}
			if (isControlOrCommandCombo && e.key === '0') {
				e.preventDefault()
				zoom.zoomReset()
				return
			}

			if (!gridSize) return

			// Shift extends the selection as the focus moves, ctrl walks the focus without disturbing it,
			// and a plain arrow selects wherever it lands and opens it - the same three behaviours as any file list
			const navigate = (rowDelta: number, columnDelta: number) => {
				e.preventDefault()

				if (e.shiftKey) {
					store.extendFocus(rowDelta, columnDelta, gridSize)
				} else if (isControlOrCommandCombo) {
					store.moveFocusOnly(rowDelta, columnDelta, gridSize)
				} else {
					const next = store.moveFocus(rowDelta, columnDelta, gridSize)
					if (next) store.handleFocusMoved(next, actions)
				}
			}

			switch (e.key) {
				// Escape is deliberately not here - it is handled for the whole page rather than only
				// wherever the focus happens to be
				case 'ArrowDown':
					navigate(1, 0)
					return
				case 'ArrowUp':
					navigate(-1, 0)
					return
				case 'ArrowLeft':
					navigate(0, -1)
					return
				case 'ArrowRight':
					navigate(0, 1)
					return
				case ' ':
					// Build up a scattered selection without needing a mouse
					e.preventDefault()
					store.toggleFocused()
					return
				case 'Enter': {
					// Press the focused button for real, as ctrl+shift+click does. Only on the way down: the editor
					// hands its key-ups in here too, and an Enter there is for whatever it is on.
					if (e.type !== 'keydown' || e.repeat || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
					const focus = store.focus
					if (!focus || enterPressRef.current) return

					e.preventDefault()
					enterPressRef.current = focus
					store.handleTestPress(focus, true, actions)
					return
				}
				case 'PageUp': {
					const focus = store.focus
					if (!focus) return
					// The grid panel scrolls, so keep the browser from paging it while we change page
					e.preventDefault()
					const newPageNumber = focus.pageNumber >= pageCount ? 1 : focus.pageNumber + 1
					setPageNumber(newPageNumber)
					store.moveFocusToPage(newPageNumber)
					return
				}
				case 'PageDown': {
					const focus = store.focus
					if (!focus) return
					e.preventDefault()
					const newPageNumber = focus.pageNumber <= 1 ? pageCount : focus.pageNumber - 1
					setPageNumber(newPageNumber)
					store.moveFocusToPage(newPageNumber)
					return
				}
			}

			if (isControlOrCommandCombo && e.key.toLowerCase() === 'a') {
				e.preventDefault()
				store.selectAllOnPage(pageNumber, gridSize)
				return
			}

			// Selection and focus travel together, so what follows needs both or neither
			const selection = store.selectedLocations
			const focus = store.focus
			if (selection.length === 0 || !focus) return

			if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Backspace' || e.key === 'Delete')) {
				actions.clearButtons([...selection])
				return
			}
			if (isControlOrCommandCombo && e.key.toLowerCase() === 'c') {
				store.setClipboard(selection, 'copy')
				return
			}
			if (isControlOrCommandCombo && e.key.toLowerCase() === 'x') {
				store.setClipboard(selection, 'cut')
				return
			}
			if (isControlOrCommandCombo && e.key.toLowerCase() === 'v') {
				actions.pasteAt(focus)
			}
		},
		[store, actions, gridSize, pageNumber, pageCount, setPageNumber, zoom]
	)
}
