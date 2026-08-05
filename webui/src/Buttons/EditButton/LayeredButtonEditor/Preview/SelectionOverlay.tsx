import { observer } from 'mobx-react-lite'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveMarkerTransform } from '@companion-app/shared/Graphics/Geometry.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import {
	buildOptionValues,
	getDraggableBoundsFields,
	MIN_FRACTION_SIZE,
	ROUND_STEP,
	roundFields,
	type BoundsFractions,
	type BoundsKey,
} from './boundsFields.js'
import { netRotation, type ElementRect, type PixelRect } from './elementHitTest.js'
import { SnapGuide } from './SnapGuide.js'
import { collectSnapTargets, snapAxis, thresholdFractionFor } from './snapping.js'

type Corner = 'nw' | 'ne' | 'sw' | 'se'

interface SelectionOverlayProps {
	controlId: string
	canvas: HTMLCanvasElement
	selectedElement: SomeButtonGraphicsElement
	/** The selection as the renderer drew it, used to outline selections the overlay can't edit */
	selectedElementRect: ElementRect | null
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

/** Rotate a vector clockwise by `degrees` (matching the canvas' positive rotation direction) */
function rotateVector(x: number, y: number, degrees: number): [number, number] {
	const rad = (degrees * Math.PI) / 180
	const cos = Math.cos(rad)
	const sin = Math.sin(rad)
	return [x * cos - y * sin, x * sin + y * cos]
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

	// The rotation the renderer actually drew the element at, so the overlay lines up with the canvas even
	// when the element's `rotation` is expression-driven. Interactive selections are always top-level, so
	// this is just the element's own rotation - there is no parent frame to compose with.
	const angle = selectedElementRect ? netRotation(selectedElementRect.rotations) : 0

	// Only top-level elements with plain (non-expression) bounds can be dragged. Anything else still gets an
	// outline so the selection is visible, rather than the overlay silently disappearing.
	const isInteractive = isTopLevelSelection && !!boundsFields

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
				.mutateAsync({ controlId, elementId: targetElementId, values: buildOptionValues(fields, changedKeys) })
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
			let dxPx = (e.clientX - state.startClientX) * scaleX
			let dyPx = (e.clientY - state.startClientY) * scaleY

			// A resize handle sits in the element's rotated frame, so undo the rotation to get the movement
			// along the element's own axes. A move needs no such correction: rotation is about the element's
			// own centre, so a screen-space translation is the same translation unrotated.
			if (state.mode === 'resize' && angle) [dxPx, dyPx] = rotateVector(dxPx, dyPx, -angle)

			// Done after the rotation, which has to happen in pixel space - the two axes of fraction space are
			// scaled differently whenever the content bounds aren't square
			let dxFraction = dxPx / contentBoundsPx.width
			let dyFraction = dyPx / contentBoundsPx.height

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
			// (shift is axis-lock, alt is duplicate). Snapping is off entirely for a rotated element: its
			// unrotated edges aren't where the user sees them, so the guides would land somewhere other than
			// the element (collectSnapTargets skips rotated elements as targets for the same reason).
			const lines: SnapLines = { x: null, y: null }
			const snapActive = !angle && (e.ctrlKey || e.metaKey ? !snapEnabledRef.current : snapEnabledRef.current)
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

			// Resizing anchors the opposite edges in the element's own coordinates, but the element rotates about
			// its centre - so moving that centre swings the anchored corner away on screen. Translate the result
			// by however much the rotation displaced it. `d - R(d)` is zero at zero rotation.
			if (state.mode === 'resize' && angle) {
				const centreShiftX = state.startFields.x + state.startFields.width / 2 - (next.x + next.width / 2)
				const centreShiftY = state.startFields.y + state.startFields.height / 2 - (next.y + next.height / 2)

				// The rotation is a screen-space one, so the displacement has to be rotated in pixel space -
				// fraction space scales its two axes differently unless the content bounds are square
				const dx = centreShiftX * contentBoundsPx.width
				const dy = centreShiftY * contentBoundsPx.height
				const [rx, ry] = rotateVector(dx, dy, angle)

				next.x += (dx - rx) / contentBoundsPx.width
				next.y += (dy - ry) / contentBoundsPx.height
			}

			setSnapLines(lines)
			liveFieldsRef.current = next
			setLiveFields(next)
		},
		[canvas, contentBoundsPx, linkedRef, snapEnabledRef, angle]
	)

	const onPointerUp = useCallback(() => {
		const state = dragState.current
		dragState.current = null
		detachListenersRef.current?.()
		detachListenersRef.current = null
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
	}, [commit])

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
			detachListenersRef.current = () => {
				window.removeEventListener('pointermove', onPointerMove)
				window.removeEventListener('pointerup', onPointerUp)
			}
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

	// A selection the overlay can't drag still gets an outline, so it's clear what's selected. The reason why
	// is carried by the quick-actions toolbar's tooltip - this outline is click-through, so it can't be hovered.
	if (!isInteractive || !boundsFields) {
		if (!selectedElementRect) return null

		// The element may sit inside rotated groups, so place its box at the rotated centre and let one CSS
		// rotation carry the whole chain (see resolveMarkerTransform)
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
		// Rotating the box carries the resize handles round with it, since they're its children
		transform: angle ? `rotate(${angle}deg)` : undefined,
		border: isDragging ? '1px dashed #2276d2' : '1px solid transparent',
		cursor: 'move',
		pointerEvents: 'auto',
		boxSizing: 'border-box',
	}

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
			<div style={style} onPointerDown={(e) => startDrag('move', undefined, e)}>
				{(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
					<ResizeHandle key={corner} corner={corner} onPointerDown={(e) => startDrag('resize', corner, e)} />
				))}
			</div>
		</>
	)
})

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
