import { observer } from 'mobx-react-lite'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveMarkerTransform } from '@companion-app/shared/Graphics/Geometry.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import {
	buildOptionValues,
	getDraggableLineFields,
	LINE_KEYS,
	ROUND_STEP,
	roundFields,
	type LineFractions,
	type LineKey,
} from './boundsFields.js'
import type { ElementRect, PixelRect } from './elementHitTest.js'
import { SnapGuide } from './SnapGuide.js'
import { collectSnapTargets, snapAxis, thresholdFractionFor } from './snapping.js'

/** Which end is being dragged, or the whole line */
type LineDragMode = 'move' | 'from' | 'to'

interface LineSelectionOverlayProps {
	controlId: string
	canvas: HTMLCanvasElement
	selectedElement: SomeButtonGraphicsElement
	/** Absolute rect of the selection, used to outline a line the overlay can't edit */
	selectedElementRect: ElementRect | null
	isTopLevelSelection: boolean
	/** Every element's absolute rect, used as snap targets */
	elementRects: readonly ElementRect[]
	/** The pixel rect the element's fractions are relative to */
	contentBoundsPx: PixelRect
	/** The full canvas backing-pixel size, used to convert pixel positions into percentages of the overlay box */
	canvasSizePx: { width: number; height: number }
	/** Owned by the toolbar; read during a drag to gate snapping */
	snapEnabledRef: React.RefObject<boolean>
}

interface LineDragState {
	mode: LineDragMode
	startClientX: number
	startClientY: number
	startFields: LineFractions
	snapTargetsX: number[]
	snapTargetsY: number[]
}

interface SnapLines {
	x: number | null
	y: number | null
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Keys each drag mode writes back */
const CHANGED_KEYS: Record<LineDragMode, readonly LineKey[]> = {
	move: LINE_KEYS,
	from: ['fromX', 'fromY'],
	to: ['toX', 'toY'],
}

/**
 * Direct manipulation for line elements. They carry two endpoints rather than the x/y/width/height every
 * other element type has, so they get their own overlay: a handle on each end, plus the line itself as a
 * drag target for moving both at once.
 */
export const LineSelectionOverlay = observer(function LineSelectionOverlay({
	controlId,
	canvas,
	selectedElement,
	selectedElementRect,
	isTopLevelSelection,
	elementRects,
	contentBoundsPx,
	canvasSizePx,
	snapEnabledRef,
}: LineSelectionOverlayProps) {
	const updateOptionsMutation = useMutationExt(trpc.controls.styles.updateOptions.mutationOptions())

	const elementId = selectedElement.id
	const lineFields = getDraggableLineFields(selectedElement)

	const isInteractive = isTopLevelSelection && !!lineFields

	const [liveFields, setLiveFields] = useState<LineFractions | null>(null)
	// Mirrors `liveFields` synchronously so onPointerUp can read the final drag value without a setState
	// updater - `commit` is a side effect, and React may invoke an updater more than once.
	const liveFieldsRef = useRef<LineFractions | null>(null)
	const dragState = useRef<LineDragState | null>(null)
	const [snapLines, setSnapLines] = useState<SnapLines>({ x: null, y: null })

	// Held until the server round-trips a matching value, so the overlay doesn't flick back to the pre-drag
	// position for a frame on drop. Mirrors SelectionOverlay's pendingCommitRef.
	const pendingCommitRef = useRef<LineFractions | null>(null)

	// Detaches whichever listeners are actually attached. Held in a ref rather than removed by identity so a
	// re-render that changes the handler identities mid-drag can't detach the wrong pair (or none).
	const detachListenersRef = useRef<(() => void) | null>(null)

	// Nothing else drops the listeners if the overlay unmounts mid-drag (selection cleared, panel closed),
	// which would otherwise leave a stray pointerup committing a mutation for a component that's gone.
	useEffect(() => {
		return () => {
			dragState.current = null
			detachListenersRef.current?.()
			detachListenersRef.current = null
		}
	}, [])

	useEffect(() => {
		if (dragState.current) return
		pendingCommitRef.current = null
		liveFieldsRef.current = null
		setLiveFields(null)
	}, [elementId])

	const onPointerMove = useCallback(
		(e: PointerEvent) => {
			const state = dragState.current
			if (!state) return

			const rect = canvas.getBoundingClientRect()
			const scaleX = canvas.width / rect.width
			const scaleY = canvas.height / rect.height
			let dxFraction = ((e.clientX - state.startClientX) * scaleX) / contentBoundsPx.width
			let dyFraction = ((e.clientY - state.startClientY) * scaleY) / contentBoundsPx.height

			// Shift locks to whichever axis the pointer has travelled further along, which is how a line is
			// made exactly horizontal or vertical
			if (e.shiftKey) {
				if (Math.abs(dxFraction) >= Math.abs(dyFraction)) {
					dyFraction = 0
				} else {
					dxFraction = 0
				}
			}

			const next: LineFractions = { ...state.startFields }
			if (state.mode === 'move' || state.mode === 'from') {
				next.fromX = state.startFields.fromX + dxFraction
				next.fromY = state.startFields.fromY + dyFraction
			}
			if (state.mode === 'move' || state.mode === 'to') {
				next.toX = state.startFields.toX + dxFraction
				next.toY = state.startFields.toY + dyFraction
			}

			// Ctrl/cmd inverts the toolbar's snap-enabled setting for the duration of the drag
			const lines: SnapLines = { x: null, y: null }
			const snapActive = e.ctrlKey || e.metaKey ? !snapEnabledRef.current : snapEnabledRef.current
			if (snapActive) {
				for (const axis of ['x', 'y'] as const) {
					const fromKey = axis === 'x' ? 'fromX' : 'fromY'
					const toKey = axis === 'x' ? 'toX' : 'toY'
					const targets = axis === 'x' ? state.snapTargetsX : state.snapTargetsY
					const threshold = thresholdFractionFor(axis === 'x' ? contentBoundsPx.width : contentBoundsPx.height)

					// Moving the whole line can snap on either end; dragging one end only snaps that end
					const candidates =
						state.mode === 'move'
							? [next[fromKey], next[toKey]]
							: state.mode === 'from'
								? [next[fromKey]]
								: [next[toKey]]

					const snap = snapAxis(candidates, targets, threshold)
					if (!snap) continue

					lines[axis] = snap.line
					if (state.mode === 'move' || state.mode === 'from') next[fromKey] += snap.delta
					if (state.mode === 'move' || state.mode === 'to') next[toKey] += snap.delta
				}
			}

			// The schema caps the endpoint fields at 0-100%, so keep drags inside the same range rather than
			// producing values the properties panel would reject
			if (state.mode === 'move') {
				for (const axis of ['x', 'y'] as const) {
					const fromKey = axis === 'x' ? 'fromX' : 'fromY'
					const toKey = axis === 'x' ? 'toX' : 'toY'
					const start = state.startFields

					const lowEnd = Math.min(start[fromKey], start[toKey])
					const highEnd = Math.max(start[fromKey], start[toKey])
					const shift = Math.min(Math.max(next[fromKey] - start[fromKey], -lowEnd), 1 - highEnd)

					next[fromKey] = start[fromKey] + shift
					next[toKey] = start[toKey] + shift
				}
			} else {
				for (const key of LINE_KEYS) next[key] = clamp01(next[key])
			}

			setSnapLines(lines)
			liveFieldsRef.current = next
			setLiveFields(next)
		},
		[canvas, contentBoundsPx, snapEnabledRef]
	)

	const onPointerUp = useCallback(() => {
		const state = dragState.current
		dragState.current = null
		detachListenersRef.current?.()
		detachListenersRef.current = null
		setSnapLines({ x: null, y: null })

		if (!state) return

		const finalFields = liveFieldsRef.current
		if (!finalFields) {
			liveFieldsRef.current = null
			setLiveFields(null)
			return
		}

		const rounded = roundFields(finalFields)
		liveFieldsRef.current = rounded
		setLiveFields(rounded)
		pendingCommitRef.current = rounded

		// One mutation, so the line is never persisted or redrawn with only one end updated
		updateOptionsMutation
			.mutateAsync({ controlId, elementId, values: buildOptionValues(rounded, CHANGED_KEYS[state.mode]) })
			.catch((e) => console.error('Failed to update line endpoints', e))
	}, [updateOptionsMutation, controlId, elementId])

	// Once the props round-trip what was committed, drop back to tracking them directly
	useEffect(() => {
		const pending = pendingCommitRef.current
		if (!pending || !lineFields || dragState.current) return

		if (LINE_KEYS.every((key) => Math.abs(lineFields[key] - pending[key]) < ROUND_STEP / 2)) {
			pendingCommitRef.current = null
			liveFieldsRef.current = null
			setLiveFields(null)
		}
	}, [lineFields])

	const startDrag = useCallback(
		(mode: LineDragMode, e: React.PointerEvent) => {
			if (!lineFields) return
			e.preventDefault()
			e.stopPropagation()

			dragState.current = {
				mode,
				startClientX: e.clientX,
				startClientY: e.clientY,
				startFields: lineFields,
				snapTargetsX: collectSnapTargets(elementRects, contentBoundsPx, elementId, 'x'),
				snapTargetsY: collectSnapTargets(elementRects, contentBoundsPx, elementId, 'y'),
			}

			window.addEventListener('pointermove', onPointerMove)
			window.addEventListener('pointerup', onPointerUp)
			detachListenersRef.current = () => {
				window.removeEventListener('pointermove', onPointerMove)
				window.removeEventListener('pointerup', onPointerUp)
			}
		},
		[lineFields, onPointerMove, onPointerUp, elementId, elementRects, contentBoundsPx]
	)

	const percentOf = (value: number, total: number) => `${(value / total) * 100}%`

	// A line the overlay can't edit still gets an outline, so the selection stays visible. The reason why is
	// carried by the quick-actions toolbar's tooltip - this outline is click-through, so it can't be hovered.
	if (!isInteractive || !lineFields) {
		if (!selectedElementRect) return null

		// A line has no rotation of its own, but it can sit inside rotated groups - place the box at the
		// rotated centre and let one CSS rotation carry the whole chain.
		const transform = resolveMarkerTransform({
			bounds: selectedElementRect.rect,
			rotations: selectedElementRect.rotations,
		})

		const readonlyStyle: React.CSSProperties = {
			position: 'absolute',
			left: percentOf(transform.centerX - transform.width / 2, canvasSizePx.width),
			top: percentOf(transform.centerY - transform.height / 2, canvasSizePx.height),
			width: percentOf(transform.width, canvasSizePx.width),
			height: percentOf(transform.height, canvasSizePx.height),
			transform: transform.angle ? `rotate(${transform.angle}deg)` : undefined,
			border: '1px dashed rgba(255, 255, 255, 0.6)',
			outline: '1px dashed rgba(0, 0, 0, 0.4)',
			boxSizing: 'border-box',
			pointerEvents: 'none',
		}

		return <div style={readonlyStyle} />
	}

	const displayFields = liveFields ?? lineFields
	const isDragging = liveFields !== null

	const toPx = (fraction: number, axis: 'x' | 'y') =>
		axis === 'x'
			? contentBoundsPx.x + fraction * contentBoundsPx.width
			: contentBoundsPx.y + fraction * contentBoundsPx.height

	const fromXPx = toPx(displayFields.fromX, 'x')
	const fromYPx = toPx(displayFields.fromY, 'y')
	const toXPx = toPx(displayFields.toX, 'x')
	const toYPx = toPx(displayFields.toY, 'y')

	return (
		<>
			{snapLines.x !== null && (
				<SnapGuide
					orientation="vertical"
					positionPercent={percentOf(contentBoundsPx.x + snapLines.x * contentBoundsPx.width, canvasSizePx.width)}
				/>
			)}
			{snapLines.y !== null && (
				<SnapGuide
					orientation="horizontal"
					positionPercent={percentOf(contentBoundsPx.y + snapLines.y * contentBoundsPx.height, canvasSizePx.height)}
				/>
			)}

			{/* SVG rather than a div: only a stroke can be a hit target that follows a diagonal. The viewBox is
			    the canvas backing-pixel space, which is what all the maths above is already in. */}
			<svg
				className="absolute left-0 top-0 w-full h-full pointer-events-none"
				viewBox={`0 0 ${canvasSizePx.width} ${canvasSizePx.height}`}
				preserveAspectRatio="none"
			>
				<line
					x1={fromXPx}
					y1={fromYPx}
					x2={toXPx}
					y2={toYPx}
					stroke="transparent"
					strokeWidth={14}
					strokeLinecap="round"
					vectorEffect="non-scaling-stroke"
					style={{ pointerEvents: 'stroke', cursor: 'move' }}
					onPointerDown={(e) => startDrag('move', e)}
				/>
				{isDragging && (
					<line
						x1={fromXPx}
						y1={fromYPx}
						x2={toXPx}
						y2={toYPx}
						stroke="#2276d2"
						strokeWidth={1}
						strokeDasharray="4 3"
						vectorEffect="non-scaling-stroke"
					/>
				)}
			</svg>

			<EndpointHandle
				leftPercent={percentOf(fromXPx, canvasSizePx.width)}
				topPercent={percentOf(fromYPx, canvasSizePx.height)}
				title="Drag to move the start of the line"
				onPointerDown={(e) => startDrag('from', e)}
			/>
			<EndpointHandle
				leftPercent={percentOf(toXPx, canvasSizePx.width)}
				topPercent={percentOf(toYPx, canvasSizePx.height)}
				title="Drag to move the end of the line"
				onPointerDown={(e) => startDrag('to', e)}
			/>
		</>
	)
})

function EndpointHandle({
	leftPercent,
	topPercent,
	title,
	onPointerDown,
}: {
	leftPercent: string
	topPercent: string
	title: string
	onPointerDown: (e: React.PointerEvent) => void
}) {
	// Round, to read as an endpoint rather than one of the square corner handles a box selection gets
	const style: React.CSSProperties = {
		position: 'absolute',
		left: leftPercent,
		top: topPercent,
		width: 10,
		height: 10,
		background: '#2276d2',
		border: '1px solid #fff',
		borderRadius: '50%',
		transform: 'translate(-50%, -50%)',
		cursor: 'move',
		pointerEvents: 'auto',
	}

	return <div style={style} title={title} onPointerDown={onPointerDown} />
}
