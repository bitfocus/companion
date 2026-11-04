import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ResizeHandleProps } from '~/Components/ResizeHandle.js'
import { useLocalStorage } from './useLocalStorage.js'
import { useResizeObserver } from './useResizeObserver.js'

/**
 * How the two panels are laid out: `horizontal` side by side (the divide drags left/right), `vertical`
 * stacked (the divide drags up/down).
 */
export type SplitOrientation = 'horizontal' | 'vertical'

// The keyboard range for the first panel; the px minimums still apply on top through the grid template.
const KEYBOARD_MIN_PERCENT = 20
const KEYBOARD_MAX_PERCENT = 80

/**
 * Clamp a desired first-panel size to the two panels' minimums and return it as a percentage of the
 * available size (the two panels together, excluding the gap). Pure so it can be unit-tested without a DOM.
 */
export function clampFirstPercent(
	desiredFirstPx: number,
	availablePx: number,
	minFirstPx: number,
	minSecondPx: number
): number {
	const maxFirstPx = availablePx - minSecondPx
	const clampedPx = Math.min(Math.max(desiredFirstPx, minFirstPx), maxFirstPx)
	return (clampedPx / availablePx) * 100
}

/** The grid tracks for the split: the px minimums are always enforced, the fr ratio splits by the percent. */
export function splitTemplateFor(minFirstPx: number, minSecondPx: number, firstPercent: number): string {
	// `minmax` keeps the px minimums enforced by the browser even if a stored percent no longer fits.
	return `minmax(${minFirstPx}px, ${firstPercent}fr) minmax(${minSecondPx}px, ${100 - firstPercent}fr)`
}

export interface UseSplitResizeOptions {
	orientation: SplitOrientation
	/** Whether the divide is draggable right now. While false the hook leaves the root's layout alone. */
	enabled: boolean
	/** The full localStorage key the chosen split is remembered under. */
	storageKey: string
	/** Selectors (relative to the root) for the first and second panel. */
	panelSelectors: [first: string, second: string]
	minFirstPx: number
	minSecondPx: number
	/** The first panel's size as a percentage of the pair before the user drags. */
	defaultFirstPercent: number
}

export interface UseSplitResizeResult {
	/** Attach to the split's root: a grid, `position: relative`, with a gap between the panels for the handle. */
	rootRef: React.RefObject<HTMLDivElement | null>
	/** The root's `gridTemplateColumns`/`gridTemplateRows` (by orientation), or undefined while not enabled. */
	rootStyle: React.CSSProperties | undefined
	/** Spread onto a `ResizeHandle` inside the root. */
	handleProps: ResizeHandleProps
}

/**
 * A draggable divide between two grid panels, remembered per browser. The handle is positioned over the
 * gap between the panels by measuring them, so the gap and padding never have to be reproduced in CSS.
 */
export function useSplitResize({
	orientation,
	enabled,
	storageKey,
	panelSelectors,
	minFirstPx,
	minSecondPx,
	defaultFirstPercent,
}: UseSplitResizeOptions): UseSplitResizeResult {
	const horizontal = orientation === 'horizontal'
	const [firstSelector, secondSelector] = panelSelectors

	const [storedPercent, setPercent] = useLocalStorage<number>(storageKey, defaultFirstPercent)
	const percent = Number.isFinite(storedPercent) ? storedPercent : defaultFirstPercent

	const [dragging, setDragging] = useState(false)

	const rootRef = useRef<HTMLDivElement | null>(null)
	const handleRef = useRef<HTMLDivElement | null>(null)

	const getPanels = useCallback((): [HTMLDivElement, Element, Element] | null => {
		const root = rootRef.current
		if (!root) return null
		const first = root.querySelector(`:scope > ${firstSelector}`)
		const second = root.querySelector(`:scope > ${secondSelector}`)
		if (!first || !second) return null
		return [root, first, second]
	}, [firstSelector, secondSelector])

	const applyTemplate = useCallback(
		(root: HTMLElement, template: string) => {
			if (horizontal) root.style.gridTemplateColumns = template
			else root.style.gridTemplateRows = template
		},
		[horizontal]
	)

	// Sit the handle centred in the gap between the panels.
	const positionHandle = useCallback(() => {
		const handle = handleRef.current
		const panels = getPanels()
		if (!handle || !panels) return
		const [root, first, second] = panels
		const rootRect = root.getBoundingClientRect()
		const firstRect = first.getBoundingClientRect()
		const secondRect = second.getBoundingClientRect()
		if (horizontal) {
			handle.style.left = `${(firstRect.right + secondRect.left) / 2 - rootRect.left}px`
		} else {
			handle.style.top = `${(firstRect.bottom + secondRect.top) / 2 - rootRect.top}px`
		}
	}, [getPanels, horizontal])

	useLayoutEffect(() => {
		if (enabled) positionHandle()
	}, [enabled, percent, positionHandle])

	useResizeObserver({ ref: rootRef, onResize: () => enabled && positionHandle() })

	const onPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const panels = getPanels()
			if (!panels) return
			const [root, first, second] = panels

			e.preventDefault()

			const firstRect = first.getBoundingClientRect()
			const secondRect = second.getBoundingClientRect()
			const available = horizontal ? firstRect.width + secondRect.width : firstRect.height + secondRect.height
			const startPos = horizontal ? e.clientX : e.clientY
			const startFirstSize = horizontal ? firstRect.width : firstRect.height
			const handleEl = e.currentTarget
			let latestPercent = percent

			// Drive the layout directly while dragging, so nothing re-renders until the drag ends.
			const onMove = (ev: PointerEvent) => {
				const pos = horizontal ? ev.clientX : ev.clientY
				latestPercent = clampFirstPercent(startFirstSize + (pos - startPos), available, minFirstPx, minSecondPx)
				applyTemplate(root, splitTemplateFor(minFirstPx, minSecondPx, latestPercent))
				positionHandle()
			}
			const onUp = () => {
				setDragging(false)
				if (handleEl.hasPointerCapture(e.pointerId)) handleEl.releasePointerCapture(e.pointerId)
				handleEl.removeEventListener('pointermove', onMove)
				handleEl.removeEventListener('pointerup', onUp)
				handleEl.removeEventListener('pointercancel', onUp)
				setPercent(latestPercent)
			}

			setDragging(true)
			handleEl.setPointerCapture(e.pointerId)
			handleEl.addEventListener('pointermove', onMove)
			handleEl.addEventListener('pointerup', onUp)
			handleEl.addEventListener('pointercancel', onUp)
		},
		[getPanels, horizontal, percent, minFirstPx, minSecondPx, applyTemplate, positionHandle, setPercent]
	)

	const onDoubleClick = useCallback(() => {
		setPercent(defaultFirstPercent)
	}, [defaultFirstPercent, setPercent])

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			// Towards the start of the split shrinks the first panel; the cross-axis arrows follow suit.
			const shrinkKeys = horizontal ? ['ArrowLeft', 'ArrowDown'] : ['ArrowUp', 'ArrowLeft']
			const growKeys = horizontal ? ['ArrowRight', 'ArrowUp'] : ['ArrowDown', 'ArrowRight']

			let delta = 0
			if (shrinkKeys.includes(e.key)) {
				delta = e.shiftKey ? -10 : -2
			} else if (growKeys.includes(e.key)) {
				delta = e.shiftKey ? 10 : 2
			} else if (e.key === 'Home') {
				e.preventDefault()
				setPercent(KEYBOARD_MIN_PERCENT)
				return
			} else if (e.key === 'End') {
				e.preventDefault()
				setPercent(KEYBOARD_MAX_PERCENT)
				return
			} else if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				setPercent(defaultFirstPercent)
				return
			} else {
				return
			}

			e.preventDefault()
			setPercent(Math.min(KEYBOARD_MAX_PERCENT, Math.max(KEYBOARD_MIN_PERCENT, percent + delta)))
		},
		[horizontal, percent, defaultFirstPercent, setPercent]
	)

	const template = splitTemplateFor(minFirstPx, minSecondPx, percent)
	const rootStyle = enabled
		? horizontal
			? { gridTemplateColumns: template }
			: { gridTemplateRows: template }
		: undefined

	return {
		rootRef,
		rootStyle,
		handleProps: {
			ref: handleRef,
			orientation,
			valuePercent: percent,
			valueMin: KEYBOARD_MIN_PERCENT,
			valueMax: KEYBOARD_MAX_PERCENT,
			dragging,
			onPointerDown,
			onDoubleClick,
			onKeyDown,
		},
	}
}
