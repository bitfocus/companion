import './SurfaceCanvas.css'
import classNames from 'classnames'
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ResolvedSurfaceView } from '@companion-app/shared/SurfaceLayout.js'
import { useButtonGridView } from '../ButtonGridViewContext.js'
import { GridButtonCell } from '../GridButtonCell.js'
import type { GridButtonModifiers } from '../GridButtonPreview.js'
import { MARQUEE_START_THRESHOLD } from '../GridCanvasGeometry.js'
import {
	controlAtPoint,
	controlCanvasBox,
	controlLocation,
	controlsInBox,
	surfaceUnitScale,
} from './surfaceGeometry.js'

export interface SurfaceCanvasRef {
	/** Scroll a button into view, when something elsewhere has moved the focus onto it */
	revealLocation(location: ControlLocation): void
}

interface SurfaceCanvasProps {
	view: ResolvedSurfaceView
	pageNumber: number
	drawScale: number
	contextMenuButton: ControlLocation | null
	isHot: boolean
}

/** A rectangle being dragged out, in canvas pixels */
interface MarqueeState {
	pointerId: number
	startX: number
	startY: number
	currentX: number
	currentY: number
	active: boolean
	additive: boolean
}

/**
 * The grid drawn as the face of a surface.
 *
 * Deliberately not the infinite grid with some cells hidden. It draws each control where the surface has it and at
 * the size the surface draws it, so a Stream Deck + shows a row of half-height strip segments under full-height
 * keys, and the space between a +XL's encoders is simply space rather than a cell pretending to be missing. There
 * is no lattice here at all: positions come from the resolved layout, and hit-testing asks which control a point
 * is inside rather than dividing by a cell size.
 */
export const SurfaceCanvas = forwardRef<SurfaceCanvasRef, SurfaceCanvasProps>(function SurfaceCanvas(
	{ view, pageNumber, drawScale, contextMenuButton, isHot },
	ref
) {
	const { store, actions } = useButtonGridView()

	const unitScale = useMemo(() => surfaceUnitScale(view, drawScale), [view, drawScale])

	const canvasRef = useRef<HTMLDivElement | null>(null)
	const [scrollerRef, setScrollerRef] = useState<HTMLDivElement | null>(null)

	useImperativeHandle(
		ref,
		() => ({
			revealLocation(location) {
				if (!scrollerRef) return

				const control = view.controls.find(
					(control) => control.cell.row === location.row && control.cell.column === location.column
				)
				if (!control) return

				const box = controlCanvasBox(control, unitScale)
				if (box.left < scrollerRef.scrollLeft) scrollerRef.scrollLeft = box.left
				else if (box.left + box.width > scrollerRef.scrollLeft + scrollerRef.clientWidth) {
					scrollerRef.scrollLeft = box.left + box.width - scrollerRef.clientWidth
				}

				if (box.top < scrollerRef.scrollTop) scrollerRef.scrollTop = box.top
				else if (box.top + box.height > scrollerRef.scrollTop + scrollerRef.clientHeight) {
					scrollerRef.scrollTop = box.top + box.height - scrollerRef.clientHeight
				}
			},
		}),
		[scrollerRef, view, unitScale]
	)

	const canvasPoint = useCallback((clientX: number, clientY: number) => {
		const rect = canvasRef.current?.getBoundingClientRect()
		if (!rect) return null

		return { x: clientX - rect.left, y: clientY - rect.top }
	}, [])

	// ---- dragging out a selection ----

	const [marquee, setMarquee] = useState<MarqueeState | null>(null)

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			// Touch belongs to the browser here - a drag scrolls, which matters more than rubber-banding
			if (e.pointerType === 'touch' || e.button !== 0) return

			const additive = e.shiftKey || e.ctrlKey || e.metaKey
			if (!store.allowsMarquee(additive)) return

			const point = canvasPoint(e.clientX, e.clientY)
			if (!point) return

			setMarquee({
				pointerId: e.pointerId,
				startX: point.x,
				startY: point.y,
				currentX: point.x,
				currentY: point.y,
				active: false,
				additive,
			})
		},
		[store, canvasPoint]
	)

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			// A tool that is about to place something ghosts it under the cursor, so hovering is reported
			if (e.pointerType !== 'touch') {
				const point = canvasPoint(e.clientX, e.clientY)
				const control = point ? controlAtPoint(view, unitScale, point.x, point.y) : null
				const modifiers: GridButtonModifiers = { range: e.shiftKey, toggle: e.ctrlKey || e.metaKey }
				store.handleHover(control ? controlLocation(control, pageNumber) : null, modifiers, actions)
			}

			if (!marquee || marquee.pointerId !== e.pointerId) return

			// The release can happen somewhere this element never sees it; a move with nothing held is proof
			if (e.buttons === 0) {
				setMarquee(null)
				return
			}

			const point = canvasPoint(e.clientX, e.clientY)
			if (!point) return

			const travelled = Math.hypot(point.x - marquee.startX, point.y - marquee.startY)
			const active = marquee.active || travelled > MARQUEE_START_THRESHOLD
			if (!active) return

			if (!marquee.active) e.currentTarget.setPointerCapture?.(e.pointerId)

			setMarquee({ ...marquee, currentX: point.x, currentY: point.y, active })
		},
		[marquee, canvasPoint, view, unitScale, store, actions, pageNumber]
	)

	const handlePointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!marquee || marquee.pointerId !== e.pointerId) {
				setMarquee(null)
				return
			}
			setMarquee(null)

			// A pointer that never travelled was a click on a control, which the control has already handled
			if (!marquee.active) return

			const box = marqueeBox(marquee)
			const covered = controlsInBox(view, unitScale, box)
			if (covered.length === 0) return

			store.handleMarquee(
				covered.map((control) => controlLocation(control, pageNumber)),
				controlLocation(covered[0], pageNumber),
				marquee.additive,
				actions
			)
		},
		[marquee, view, unitScale, store, actions, pageNumber]
	)

	const canvasStyle = useMemo(
		() => ({
			width: view.extent.width * unitScale,
			height: view.extent.height * unitScale,
			'--grid-scale': drawScale,
		}),
		[view.extent.width, view.extent.height, unitScale, drawScale]
	)

	return (
		<div
			ref={setScrollerRef}
			className={classNames('button-grid-scroller', 'surface-canvas-viewport', { 'button-armed': isHot })}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerLeave={() => store.handleHover(null, { range: false, toggle: false }, actions)}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
		>
			<div className="surface-canvas" style={canvasStyle} ref={canvasRef}>
				{view.controls.map((control) => {
					const box = controlCanvasBox(control, unitScale)
					const location = controlLocation(control, pageNumber)

					return (
						<GridButtonCell
							key={control.id}
							location={location}
							renderSize={control.renderSize}
							style={
								{
									left: box.left,
									top: box.top,
									width: box.width,
									height: box.height,
									'--control-radius': `${Math.min(box.width, box.height) * control.shape.cornerRadiusRatio}px`,
								} as React.CSSProperties
							}
							contextMenuOpen={
								contextMenuButton?.row === control.cell.row &&
								contextMenuButton?.column === control.cell.column &&
								contextMenuButton?.pageNumber === pageNumber
							}
						/>
					)
				})}

				{marquee?.active && <div className="surface-canvas-marquee" style={marqueeBox(marquee)} />}
			</div>
		</div>
	)
})

function marqueeBox(marquee: MarqueeState) {
	return {
		left: Math.min(marquee.startX, marquee.currentX),
		top: Math.min(marquee.startY, marquee.currentY),
		width: Math.abs(marquee.currentX - marquee.startX),
		height: Math.abs(marquee.currentY - marquee.startY),
	}
}
