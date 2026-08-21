import classnames from 'classnames'
import { memo, useCallback, useRef } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useImagePreloader } from '~/Components/ButtonPreview.js'

/**
 * How far (px) a pointer may travel before the gesture stops counting as a tap. Touch scrolling is
 * handled by the browser (see `touch-action` below) which fires pointercancel, so this mainly covers
 * mice and pens, where no such cancellation happens.
 */
const TAP_MOVE_THRESHOLD = 6

export interface GridButtonModifiers {
	/** Shift - extend a selection */
	range: boolean
	/** Ctrl (or Cmd on mac) - toggle one cell in/out of a selection */
	toggle: boolean
}

export interface GridButtonPreviewProps {
	location: ControlLocation
	image: string | null
	style: React.CSSProperties
	title: string
	placeholder: string

	/**
	 * When set, a pointer down/up fires the button for real rather than being interpreted as a tap.
	 * Presses must not wait for the release to be classified, and must not be stolen by a scroll.
	 */
	pressMode: boolean
	onPress: (location: ControlLocation, isDown: boolean) => void
	onTap: (location: ControlLocation, modifiers: GridButtonModifiers) => void
	onContextMenu: (location: ControlLocation, x: number, y: number) => void

	selected: boolean
	copySource: boolean
	contextMenuOpen: boolean
	canDrop: boolean
	dropHover: boolean
	/** Marked as a landing spot, but releasing here would be refused */
	dropInvalid: boolean
	dropRef: React.RefCallback<HTMLDivElement>
	dragRef: React.RefCallback<HTMLDivElement>
	isDragSource: boolean
}

/**
 * A button on the main editing grid.
 *
 * This deliberately does not reuse `ButtonPreview`: that component exists to emulate a physical
 * surface (emulator, tablet view), where a touch is always a press and must never be reinterpreted.
 * The editing grid needs the opposite - a touch is usually a scroll or a tap, and only becomes a
 * press when the grid is explicitly in press mode. The markup and CSS are shared; the gestures are
 * not.
 */
export const GridButtonPreview = memo(function GridButtonPreview({
	location,
	image,
	style,
	title,
	placeholder,
	pressMode,
	onPress,
	onTap,
	onContextMenu,
	selected,
	copySource,
	contextMenuOpen,
	canDrop,
	dropHover,
	dropInvalid,
	dropRef,
	dragRef,
	isDragSource,
}: GridButtonPreviewProps) {
	const preloadedImage = useImagePreloader(image)

	// Tracks the in-flight gesture. Null between gestures.
	const gestureRef = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null)
	// Whether a real press is outstanding, so we can guarantee a matching release
	const isPressedRef = useRef(false)

	const releaseIfPressed = useCallback(() => {
		if (!isPressedRef.current) return
		isPressedRef.current = false
		onPress(location, false)
	}, [onPress, location])

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			// Right-click is for the context menu only
			if (e.button === 2) return

			gestureRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false }

			if (pressMode) {
				// Capture so the release still reaches us if the finger slides off the button
				e.currentTarget.setPointerCapture?.(e.pointerId)
				isPressedRef.current = true
				onPress(location, true)
			}
		},
		[pressMode, onPress, location]
	)

	const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		const gesture = gestureRef.current
		if (!gesture || gesture.pointerId !== e.pointerId || gesture.moved) return

		const distance = Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY)
		if (distance > TAP_MOVE_THRESHOLD) gesture.moved = true
	}, [])

	const handlePointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const gesture = gestureRef.current
			gestureRef.current = null

			if (pressMode) {
				releaseIfPressed()
				return
			}

			// Only a gesture that started here and stayed put is a tap; anything else was a scroll or a drag
			if (!gesture || gesture.pointerId !== e.pointerId || gesture.moved) return

			onTap(location, { range: e.shiftKey, toggle: e.ctrlKey || e.metaKey })
		},
		[pressMode, releaseIfPressed, onTap, location]
	)

	const handlePointerCancel = useCallback(() => {
		// The browser has taken the gesture over (usually to scroll the grid)
		gestureRef.current = null
		releaseIfPressed()
	}, [releaseIfPressed])

	const handleContextMenu = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			// Let the browser menu through when a modifier is held, matching ButtonPreview
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
			e.preventDefault()
			e.stopPropagation()

			// A long-press on touch starts a press first; release it before opening the menu
			gestureRef.current = null
			releaseIfPressed()

			onContextMenu(location, e.clientX, e.clientY)
		},
		[releaseIfPressed, onContextMenu, location]
	)

	// dnd-kit clones the element holding the drag ref as the drag feedback, so both refs go on the
	// same outer element - it is the one carrying the sizing the clone needs
	const setRefs = useCallback(
		(el: HTMLDivElement | null) => {
			dropRef(el)
			dragRef(el)
		},
		[dropRef, dragRef]
	)

	return (
		<div
			ref={setRefs}
			className={classnames('button-control', 'clickable', 'fixed-72', {
				// Let the browser scroll the grid, except in press mode where a scroll must not steal the press
				'grid-pannable': !pressMode,
				selected,
				'copy-source': copySource,
				'context-menu-open': contextMenuOpen,
				drophere: canDrop,
				drophover: dropHover && !dropInvalid,
				dropinvalid: dropInvalid,
				'grid-drag-source': isDragSource,
			})}
			style={style}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onContextMenu={handleContextMenu}
		>
			<div
				className="button-border"
				style={{ backgroundImage: preloadedImage ? `url(${preloadedImage})` : undefined }}
				title={title}
			>
				{!preloadedImage && <div className="button-placeholder">{placeholder}</div>}
			</div>
		</div>
	)
})
