import classnames from 'classnames'
import { memo, useCallback, useEffect, useRef } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { SurfaceControlKind } from '@companion-app/shared/SurfaceLayout.js'
import { useImagePreloader } from '~/Components/ButtonPreview.js'
import type { GridPendingChange } from './GridGeometry.js'
import {
	continueRotaryDrag,
	ROTARY_HOLD_MS,
	startRotaryDrag,
	type Point,
	type RotaryDrag,
} from './SurfaceView/rotaryDrag.js'

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
	/** What sort of control this is drawn as - a key, a knob, a slice of a screen */
	kind: SurfaceControlKind
	image: string | null
	/** Fill the button with this colour instead of an image, for a control which shows only a colour */
	color: string | null
	/** Drawn over the button, for what a surface control shows besides it (its leds) */
	overlay: React.ReactNode
	style: React.CSSProperties
	title: string
	placeholder: string

	/**
	 * When set, a pointer down/up fires the button for real rather than being interpreted as a tap.
	 * Presses must not wait for the release to be classified, and must not be stolen by a scroll.
	 */
	pressMode: boolean
	onPress: (location: ControlLocation, isDown: boolean) => void
	/**
	 * For a control which turns (a knob, a jog, a shuttle): in press mode a drag round it turns it, by a signed number
	 * of steps - positive is rightward. Each move sends however far it went as one turn, so a fast spin is a bigger
	 * turn rather than more of them, as an encoder reports it. Null for one which does not turn, where a drag is only
	 * ever a press sliding off.
	 */
	onRotate: ((location: ControlLocation, delta: number) => void) | null
	onTap: (location: ControlLocation, modifiers: GridButtonModifiers) => void
	onContextMenu: (location: ControlLocation, x: number, y: number) => void

	selected: boolean
	copySource: boolean
	/** What a modifier-click here would do to this button, while the modifier is held */
	pendingChange: GridPendingChange | null
	contextMenuOpen: boolean
	canDrop: boolean
	dropHover: boolean
	/** Something is heading for this cell - a button, or the empty half of a swap */
	dropDestination: boolean
	/** Marked as a landing spot, but releasing here would be refused */
	dropInvalid: boolean
	/**
	 * The button that would end up here, drawn over this cell's own so the landing can be checked.
	 * Null when what lands here is nothing, which is drawn as an empty button rather than not at all.
	 */
	ghostImage: string | null
	dropRef: React.RefCallback<HTMLDivElement>
	/** Null when this button cannot be dragged right now, so nothing is marked up as draggable */
	dragRef: React.RefCallback<HTMLDivElement> | null
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
	kind,
	image,
	color,
	overlay,
	style,
	title,
	placeholder,
	pressMode,
	onPress,
	onRotate,
	onTap,
	onContextMenu,
	selected,
	copySource,
	pendingChange,
	contextMenuOpen,
	canDrop,
	dropHover,
	dropDestination,
	dropInvalid,
	ghostImage,
	dropRef,
	dragRef,
	isDragSource,
}: GridButtonPreviewProps) {
	const preloadedImage = useImagePreloader(image)

	// Tracks the in-flight gesture. Null between gestures.
	const gestureRef = useRef<{
		pointerId: number
		startX: number
		startY: number
		moved: boolean
		/** The middle of a control which turns, which a drag goes round; null for one which does not */
		centre: Point | null
		/** The drag turning it, once the pointer has moved off where it went down */
		rotation: RotaryDrag | null
	} | null>(null)
	// Whether a real press is outstanding, so we can guarantee a matching release
	const isPressedRef = useRef(false)
	// The push of a control which turns, waiting to see whether it is held or dragged
	const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const cancelHold = useCallback(() => {
		if (!holdTimerRef.current) return
		clearTimeout(holdTimerRef.current)
		holdTimerRef.current = null
	}, [])

	const pressDown = useCallback(() => {
		isPressedRef.current = true
		onPress(location, true)
	}, [onPress, location])

	const releaseIfPressed = useCallback(() => {
		cancelHold()
		if (!isPressedRef.current) return
		isPressedRef.current = false
		onPress(location, false)
	}, [cancelHold, onPress, location])

	// The pointer events match every press with a release in the normal cases, but two escape them:
	// press mode being turned off mid-press, and this cell unmounting while the finger is still down
	// (the grid virtualises cells, so one can vanish under a held press). Both arrive here as cleanup,
	// so the control is never left stuck down.
	useEffect(() => {
		if (!pressMode) return
		return () => releaseIfPressed()
	}, [pressMode, releaseIfPressed])

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			// Right-click is for the context menu only
			if (e.button === 2) return

			const turns = pressMode && !!onRotate
			const box = turns ? e.currentTarget.getBoundingClientRect() : null

			gestureRef.current = {
				pointerId: e.pointerId,
				startX: e.clientX,
				startY: e.clientY,
				moved: false,
				centre: box && { x: box.left + box.width / 2, y: box.top + box.height / 2 },
				rotation: null,
			}

			if (pressMode) {
				// Capture so the release still reaches us if the finger slides off the button
				e.currentTarget.setPointerCapture?.(e.pointerId)

				if (turns) {
					// Pushed only once held still, as moving first means it is being turned instead
					cancelHold()
					holdTimerRef.current = setTimeout(() => {
						holdTimerRef.current = null
						pressDown()
					}, ROTARY_HOLD_MS)
				} else {
					pressDown()
				}
			}
		},
		[pressMode, onRotate, cancelHold, pressDown]
	)

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const gesture = gestureRef.current
			if (!gesture || gesture.pointerId !== e.pointerId) return

			const point = { x: e.clientX, y: e.clientY }

			if (!gesture.moved) {
				const distance = Math.hypot(point.x - gesture.startX, point.y - gesture.startY)
				if (distance <= TAP_MOVE_THRESHOLD) return
				gesture.moved = true

				// Moved before it was held long enough to push, so it is being turned. Counted from where it went
				// down, so the threshold is not lost from the turn.
				if (gesture.centre && holdTimerRef.current) {
					cancelHold()
					gesture.rotation = startRotaryDrag(gesture.centre, { x: gesture.startX, y: gesture.startY })
				}
			}

			if (!gesture.rotation || !onRotate) return

			const { drag, steps } = continueRotaryDrag(gesture.rotation, point)
			gesture.rotation = drag
			if (steps !== 0) onRotate(location, steps)
		},
		[cancelHold, onRotate, location]
	)

	const handlePointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const gesture = gestureRef.current
			gestureRef.current = null

			if (pressMode) {
				// Let go of a control which turns before it was held or turned: a quick push
				if (holdTimerRef.current && gesture && !gesture.moved) {
					cancelHold()
					onPress(location, true)
					onPress(location, false)
					return
				}

				releaseIfPressed()
				return
			}

			// Only a gesture that started here and stayed put is a tap; anything else was a scroll or a drag
			if (!gesture || gesture.pointerId !== e.pointerId || gesture.moved) return

			onTap(location, { range: e.shiftKey, toggle: e.ctrlKey || e.metaKey })
		},
		[pressMode, cancelHold, releaseIfPressed, onPress, onTap, location]
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

	// Both refs go on the same outer element. Grid buttons suppress dnd-kit's own feedback clone (the
	// overlay draws the ghost instead), so this is about the drop target and the drag handle being
	// one and the same cell.
	const setRefs = useCallback(
		(el: HTMLDivElement | null) => {
			dropRef(el)
			dragRef?.(el)
		},
		[dropRef, dragRef]
	)

	return (
		<div
			ref={setRefs}
			// `grid-button` marks this as the grid's own cell rather than any other ButtonPreview, so a
			// rule can apply to it and not to the preset pool or the emulator
			className={classnames('button-control', 'clickable', 'fixed-72', 'grid-button', `control-kind-${kind}`, {
				// Let the browser scroll the grid, except in press mode where a scroll must not steal the press
				'grid-pannable': !pressMode,
				selected,
				'copy-source': copySource,
				'pending-add': pendingChange === 'add',
				'pending-remove': pendingChange === 'remove',
				'context-menu-open': contextMenuOpen,
				drophere: canDrop,
				drophover: (dropHover || dropDestination) && !dropInvalid,
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
				style={{
					backgroundImage: preloadedImage ? `url(${preloadedImage})` : undefined,
					backgroundColor: color ?? undefined,
				}}
				title={title}
			>
				{!preloadedImage && !color && <div className="button-placeholder">{placeholder}</div>}
				{overlay}
				{/* Drawn for any cell something is heading to, image or not: with no image it paints an
				    empty button, which is how the end of a swap that empties is shown. Without it that
				    cell would still be showing the button that is about to leave it. */}
				{dropDestination && (
					<div
						className="button-drop-ghost"
						style={ghostImage ? { backgroundImage: `url(${ghostImage})` } : undefined}
					/>
				)}
			</div>
		</div>
	)
})
