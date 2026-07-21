import { observer } from 'mobx-react-lite'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import {
	buildBoundsValues,
	getDraggableBoundsFields,
	MIN_FRACTION_SIZE,
	ROUND_STEP,
	roundFields,
	type BoundsFractions,
	type BoundsKey,
} from './boundsFields.js'
import type { ElementRect, PixelRect } from './elementHitTest.js'
import { collectSnapTargets, snapAxis, thresholdFractionFor } from './snapping.js'

type Corner = 'nw' | 'ne' | 'sw' | 'se'

interface SelectionOverlayProps {
	controlId: string
	canvas: HTMLCanvasElement
	selectedElement: SomeButtonGraphicsElement
	/** Absolute rect of the selection, used to outline selections the overlay can't edit */
	selectedElementRect: PixelRect | null
	isTopLevelSelection: boolean
	/** Every element's absolute rect, used as snap targets */
	elementRects: readonly ElementRect[]
	/** The pixel rect (in the canvas's backing-pixel space) that the element's x/y/width/height fractions are relative to */
	contentBoundsPx: PixelRect
	/** The full canvas backing-pixel size, used to convert pixel rects into percentages of the overlay box */
	canvasSizePx: { width: number; height: number }
	/** Owned by the toolbar above; read during a resize to lock the aspect ratio */
	linkedRef: React.RefObject<boolean>
	/** Owned by the toolbar above; read during a drag to gate snapping */
	snapEnabledRef: React.RefObject<boolean>
	onSelectElement: (elementId: string) => void
}

interface DragState {
	mode: 'move' | 'resize'
	corner: Corner | undefined
	startClientX: number
	startClientY: number
	startFields: BoundsFractions
	/** Element the drag commits to. Retargeted to the clone once an alt-drag duplicate resolves. */
	targetId: string
	/** Snap targets per axis, computed once at drag start since the other elements don't move mid-drag */
	snapTargetsX: number[]
	snapTargetsY: number[]
}

/** Guide lines to draw during a drag, in fraction-of-content space */
interface SnapLines {
	x: number | null
	y: number | null
}

export const SelectionOverlay = observer(function SelectionOverlay({
	controlId,
	canvas,
	selectedElement,
	selectedElementRect,
	isTopLevelSelection,
	elementRects,
	contentBoundsPx,
	canvasSizePx,
	linkedRef,
	snapEnabledRef,
	onSelectElement,
}: SelectionOverlayProps) {
	const updateOptionsMutation = useMutationExt(trpc.controls.styles.updateOptions.mutationOptions())
	const duplicateElementMutation = useMutationExt(trpc.controls.styles.duplicateElement.mutationOptions())

	const elementId = selectedElement.id
	const boundsFields = getDraggableBoundsFields(selectedElement)

	// Only top-level elements with plain (non-expression) bounds can be dragged. Anything else still gets an
	// outline so the selection is visible, rather than the overlay silently disappearing.
	const isInteractive = isTopLevelSelection && !!boundsFields
	const readonlyReason = !isTopLevelSelection
		? "Elements inside a group can't be moved on the canvas yet - use the properties below"
		: !boundsFields
			? 'Position is set by an expression - edit it in the properties below'
			: null

	const [liveFields, setLiveFields] = useState<BoundsFractions | null>(null)
	// Mirrors `liveFields` synchronously so onPointerUp can read the final drag value without relying on
	// a setState updater callback (side effects like `commit` must not live inside one - see onPointerUp).
	const liveFieldsRef = useRef<BoundsFractions | null>(null)
	const dragState = useRef<DragState | null>(null)
	const [snapLines, setSnapLines] = useState<SnapLines>({ x: null, y: null })

	// The rounded value just committed to the server, kept in `liveFields` until `boundsFields` (derived
	// from props) round-trips back with a matching value. Without this, clearing `liveFields` on drop makes
	// the overlay snap back to the stale pre-drag position for one render, then jump forward again once the
	// mutation resolves - a visible flicker on every move/resize.
	const pendingCommitRef = useRef<BoundsFractions | null>(null)

	// Discard any in-flight drag/pending-commit state when the selection changes to a different element -
	// otherwise the overlay could keep showing the previous element's held position over the new one.
	useEffect(() => {
		if (dragState.current) return
		dragState.current = null
		pendingCommitRef.current = null
		liveFieldsRef.current = null
		setLiveFields(null)
	}, [elementId])

	// `targetElementId` is passed explicitly rather than closed over: an alt-drag retargets mid-gesture to a
	// clone that didn't exist when the pointer listeners were registered.
	const commit = useCallback(
		(fields: BoundsFractions, changedKeys: readonly BoundsKey[], targetElementId: string) => {
			// Sent as one mutation so the element is never persisted or redrawn half-updated (eg x applied
			// but height not yet), which otherwise shows as a flicker on drop.
			updateOptionsMutation
				.mutateAsync({ controlId, elementId: targetElementId, values: buildBoundsValues(fields, changedKeys) })
				.catch((e) => console.error('Failed to update element bounds', e))
		},
		[updateOptionsMutation, controlId]
	)

	const onPointerMove = useCallback(
		(e: PointerEvent) => {
			const state = dragState.current
			if (!state) return

			const rect = canvas.getBoundingClientRect()
			const scaleX = canvas.width / rect.width
			const scaleY = canvas.height / rect.height
			let dxFraction = ((e.clientX - state.startClientX) * scaleX) / contentBoundsPx.width
			let dyFraction = ((e.clientY - state.startClientY) * scaleY) / contentBoundsPx.height

			// Shift locks a move to whichever axis the pointer has travelled further along
			if (state.mode === 'move' && e.shiftKey) {
				if (Math.abs(dxFraction) >= Math.abs(dyFraction)) {
					dyFraction = 0
				} else {
					dxFraction = 0
				}
			}

			const next: BoundsFractions = { ...state.startFields }

			if (state.mode === 'move') {
				next.x = state.startFields.x + dxFraction
				next.y = state.startFields.y + dyFraction
			} else if (state.corner) {
				const left = state.corner.includes('w')
				const top = state.corner.includes('n')

				if (linkedRef.current) {
					// Locked: scale width and height by the same factor, driven by whichever axis the
					// pointer has moved further along, so the aspect ratio never drifts during the drag.
					const dxOutward = left ? -dxFraction : dxFraction
					const dyOutward = top ? -dyFraction : dyFraction
					const scale =
						Math.abs(dxOutward) >= Math.abs(dyOutward)
							? (state.startFields.width + dxOutward) / state.startFields.width
							: (state.startFields.height + dyOutward) / state.startFields.height

					next.width = Math.max(MIN_FRACTION_SIZE, state.startFields.width * scale)
					next.height = Math.max(MIN_FRACTION_SIZE, state.startFields.height * scale)
					next.x = left ? state.startFields.x + state.startFields.width - next.width : state.startFields.x
					next.y = top ? state.startFields.y + state.startFields.height - next.height : state.startFields.y
				} else {
					if (left) {
						const newX = state.startFields.x + dxFraction
						next.width = Math.max(MIN_FRACTION_SIZE, state.startFields.x + state.startFields.width - newX)
						next.x = state.startFields.x + state.startFields.width - next.width
					} else {
						next.width = Math.max(MIN_FRACTION_SIZE, state.startFields.width + dxFraction)
					}

					if (top) {
						const newY = state.startFields.y + dyFraction
						next.height = Math.max(MIN_FRACTION_SIZE, state.startFields.y + state.startFields.height - newY)
						next.y = state.startFields.y + state.startFields.height - next.height
					} else {
						next.height = Math.max(MIN_FRACTION_SIZE, state.startFields.height + dyFraction)
					}
				}
			}

			// Ctrl/cmd inverts the toolbar's snap-enabled setting for the duration of the drag
			// (shift is axis-lock, alt is duplicate)
			const lines: SnapLines = { x: null, y: null }
			const snapActive = e.ctrlKey || e.metaKey ? !snapEnabledRef.current : snapEnabledRef.current
			if (snapActive) {
				const left = state.corner?.includes('w')
				const top = state.corner?.includes('n')
				const thresholdX = thresholdFractionFor(contentBoundsPx.width)
				const thresholdY = thresholdFractionFor(contentBoundsPx.height)

				if (state.mode === 'resize' && linkedRef.current && state.corner) {
					// Linked resize: snap the dragged corner, then scale both axes by the same factor so the
					// aspect ratio the lock maintains isn't broken.
					const anchorX = left ? state.startFields.x + state.startFields.width : state.startFields.x
					const anchorY = top ? state.startFields.y + state.startFields.height : state.startFields.y
					const snapX = snapAxis([left ? next.x : next.x + next.width], state.snapTargetsX, thresholdX)
					const snapY = snapAxis([top ? next.y : next.y + next.height], state.snapTargetsY, thresholdY)

					// Apply whichever axis snaps closer, deriving a uniform scale from the anchor
					const pick =
						snapX && (!snapY || Math.abs(snapX.delta) <= Math.abs(snapY.delta))
							? {
									axis: 'x' as const,
									line: snapX.line,
									size: Math.abs(snapX.line - anchorX),
									start: state.startFields.width,
								}
							: snapY
								? {
										axis: 'y' as const,
										line: snapY.line,
										size: Math.abs(snapY.line - anchorY),
										start: state.startFields.height,
									}
								: null

					if (pick) {
						const scale = pick.size / pick.start
						next.width = Math.max(MIN_FRACTION_SIZE, state.startFields.width * scale)
						next.height = Math.max(MIN_FRACTION_SIZE, state.startFields.height * scale)
						next.x = left ? anchorX - next.width : anchorX
						next.y = top ? anchorY - next.height : anchorY
						lines[pick.axis] = pick.line
					}
				} else {
					for (const axis of ['x', 'y'] as const) {
						const start = next[axis]
						const size = axis === 'x' ? next.width : next.height
						const targets = axis === 'x' ? state.snapTargetsX : state.snapTargetsY
						const threshold = axis === 'x' ? thresholdX : thresholdY

						// A move can snap on any of its three edges; a resize only on the corner being dragged
						const candidates =
							state.mode === 'move'
								? [start, start + size / 2, start + size]
								: (axis === 'x' ? left : top)
									? [start]
									: [start + size]

						const snap = snapAxis(candidates, targets, threshold)
						if (!snap) continue

						lines[axis] = snap.line
						if (state.mode === 'move') {
							next[axis] = start + snap.delta
						} else if (axis === 'x') {
							// Resizing moves the dragged edge only, so the opposite edge stays put
							if (left) {
								next.x = start + snap.delta
								next.width = Math.max(MIN_FRACTION_SIZE, size - snap.delta)
							} else {
								next.width = Math.max(MIN_FRACTION_SIZE, size + snap.delta)
							}
						} else {
							if (top) {
								next.y = start + snap.delta
								next.height = Math.max(MIN_FRACTION_SIZE, size - snap.delta)
							} else {
								next.height = Math.max(MIN_FRACTION_SIZE, size + snap.delta)
							}
						}
					}
				}
			}

			setSnapLines(lines)
			liveFieldsRef.current = next
			setLiveFields(next)
		},
		[canvas, contentBoundsPx, linkedRef, snapEnabledRef]
	)

	const onPointerUp = useCallback(() => {
		const state = dragState.current
		dragState.current = null
		window.removeEventListener('pointermove', onPointerMove)
		window.removeEventListener('pointerup', onPointerUp)
		setSnapLines({ x: null, y: null })

		if (!state) return

		// Read the final value from the ref rather than a setState updater - `commit` triggers a mutation,
		// and side effects inside a setState updater can be invoked more than once by React and have caused
		// "Maximum update depth exceeded" crashes here.
		const finalFields = liveFieldsRef.current
		if (!finalFields) {
			liveFieldsRef.current = null
			setLiveFields(null)
			return
		}

		// Snap the displayed overlay to the exact rounded value that's being committed, and hold it there
		// (via pendingCommitRef, resolved in the effect below) instead of clearing it - see the comment on
		// pendingCommitRef for why.
		const rounded = roundFields(finalFields)
		liveFieldsRef.current = rounded
		setLiveFields(rounded)
		pendingCommitRef.current = rounded

		const changedKeys = state.mode === 'move' ? (['x', 'y'] as const) : (['x', 'y', 'width', 'height'] as const)
		commit(rounded, changedKeys, state.targetId)
	}, [commit, onPointerMove])

	// Once the server-confirmed bounds (via props) match what was last committed, drop back to tracking
	// `boundsFields` directly so future prop updates (eg from someone else editing) are reflected live.
	useEffect(() => {
		const pending = pendingCommitRef.current
		if (!pending || !boundsFields || dragState.current) return

		const settled = (['x', 'y', 'width', 'height'] as const).every(
			(key) => Math.abs(boundsFields[key] - pending[key]) < ROUND_STEP / 2
		)
		if (settled) {
			pendingCommitRef.current = null
			liveFieldsRef.current = null
			setLiveFields(null)
		}
	}, [boundsFields])

	const startDrag = useCallback(
		(mode: 'move' | 'resize', corner: Corner | undefined, e: React.PointerEvent) => {
			if (!boundsFields) return
			e.preventDefault()
			e.stopPropagation()

			// Latch the drag synchronously so a fast alt-drag isn't dropped while the duplicate is in flight
			const state: DragState = {
				mode,
				corner,
				startClientX: e.clientX,
				startClientY: e.clientY,
				startFields: boundsFields,
				targetId: elementId,
				snapTargetsX: collectSnapTargets(elementRects, contentBoundsPx, elementId, 'x'),
				snapTargetsY: collectSnapTargets(elementRects, contentBoundsPx, elementId, 'y'),
			}
			dragState.current = state

			// Alt-drag leaves the original in place and drags an exact copy instead. The clone is inserted
			// directly above the original, so it starts from the same bounds - no coordinate fixup needed.
			if (mode === 'move' && e.altKey) {
				duplicateElementMutation
					.mutateAsync({ controlId, elementId })
					.then((newId) => {
						if (typeof newId !== 'string') return
						// Ignore a resolve that lands after the drag already ended
						if (dragState.current !== state) return

						state.targetId = newId
						onSelectElement(newId)
					})
					.catch((err) => console.error('Failed to duplicate element', err))
			}

			window.addEventListener('pointermove', onPointerMove)
			window.addEventListener('pointerup', onPointerUp)
		},
		[
			boundsFields,
			onPointerMove,
			onPointerUp,
			elementId,
			controlId,
			duplicateElementMutation,
			onSelectElement,
			elementRects,
			contentBoundsPx,
		]
	)

	const percentOf = (value: number, total: number) => `${(value / total) * 100}%`

	// A selection the overlay can't drag still gets an outline, so it's clear what's selected
	if (!isInteractive || !boundsFields) {
		if (!selectedElementRect) return null

		const readonlyStyle: React.CSSProperties = {
			position: 'absolute',
			left: percentOf(selectedElementRect.x, canvasSizePx.width),
			top: percentOf(selectedElementRect.y, canvasSizePx.height),
			width: percentOf(selectedElementRect.width, canvasSizePx.width),
			height: percentOf(selectedElementRect.height, canvasSizePx.height),
			border: '1px dashed rgba(255, 255, 255, 0.6)',
			outline: '1px dashed rgba(0, 0, 0, 0.4)',
			boxSizing: 'border-box',
			pointerEvents: 'none',
		}

		return <div style={readonlyStyle} title={readonlyReason ?? undefined} />
	}

	const displayFields = liveFields ?? boundsFields
	const isDragging = liveFields !== null

	// Convert the element's fraction-of-contentBounds into a percentage of the full canvas box,
	// since that's the box the overlay is absolutely positioned over
	const xPx = contentBoundsPx.x + displayFields.x * contentBoundsPx.width
	const yPx = contentBoundsPx.y + displayFields.y * contentBoundsPx.height
	const widthPx = displayFields.width * contentBoundsPx.width
	const heightPx = displayFields.height * contentBoundsPx.height

	const style: React.CSSProperties = {
		position: 'absolute',
		left: percentOf(xPx, canvasSizePx.width),
		top: percentOf(yPx, canvasSizePx.height),
		width: percentOf(widthPx, canvasSizePx.width),
		height: percentOf(heightPx, canvasSizePx.height),
		border: isDragging ? '1px dashed #2276d2' : '1px solid transparent',
		cursor: 'move',
		pointerEvents: 'auto',
		boxSizing: 'border-box',
	}

	return (
		<>
			{snapLines.x !== null && (
				<SnapGuide orientation="vertical" positionPx={contentBoundsPx.x + snapLines.x * contentBoundsPx.width} />
			)}
			{snapLines.y !== null && (
				<SnapGuide orientation="horizontal" positionPx={contentBoundsPx.y + snapLines.y * contentBoundsPx.height} />
			)}
			<div style={style} onPointerDown={(e) => startDrag('move', undefined, e)}>
				{(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
					<ResizeHandle key={corner} corner={corner} onPointerDown={(e) => startDrag('resize', corner, e)} />
				))}
			</div>
		</>
	)
})

function SnapGuide({ orientation, positionPx }: { orientation: 'vertical' | 'horizontal'; positionPx: number }) {
	const vertical = orientation === 'vertical'

	const style: React.CSSProperties = {
		// Blue, to stay distinct from the red bounds lines the renderer draws around the selected element
		position: 'absolute',
		background: '#00a3ff',
		pointerEvents: 'none',
		...(vertical
			? { left: positionPx, top: 0, bottom: 0, width: 1 }
			: { top: positionPx, left: 0, right: 0, height: 1 }),
	}

	return <div style={style} />
}

function ResizeHandle({ corner, onPointerDown }: { corner: Corner; onPointerDown: (e: React.PointerEvent) => void }) {
	const style: React.CSSProperties = {
		position: 'absolute',
		width: 10,
		height: 10,
		background: '#2276d2',
		border: '1px solid #fff',
		borderRadius: 2,
		top: corner.includes('n') ? 0 : undefined,
		bottom: corner.includes('s') ? 0 : undefined,
		left: corner.includes('w') ? 0 : undefined,
		right: corner.includes('e') ? 0 : undefined,
		transform: `translate(${corner.includes('w') ? '-50%' : '50%'}, ${corner.includes('n') ? '-50%' : '50%'})`,
		cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
		pointerEvents: 'auto',
	}

	return <div style={style} onPointerDown={onPointerDown} />
}
