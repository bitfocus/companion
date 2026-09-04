import { useDraggable, useDragOperation, useDroppable } from '@dnd-kit/react'
import classNames from 'classnames'
import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { DEFAULT_PREVIEW_RENDER_SIZE } from '@companion-app/shared/Model/Preview.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { useButtonImageForLocation } from '~/Hooks/useButtonImageForLocation.js'
import useElementInnerSize from '~/Hooks/useElementClientSize.js'
import useScrollPosition from '~/Hooks/useScrollPosition.js'
import {
	useButtonGridView,
	useGridDragAnyButton,
	useGridDragPreviewValid,
	useGridDropGhostSource,
	useGridIsSelected,
	useGridIsTransferSource,
	useGridPendingChange,
	useGridPressMode,
} from './ButtonGridViewContext.js'
import { GRID_BUTTON_DRAG_TYPE, type GridButtonDragItem } from './GridButtonDragItem.js'
import { makeGridButtonDroppableId } from './GridButtonDroppableId.js'
import { GridButtonPreview, type GridButtonModifiers } from './GridButtonPreview.js'
import {
	locationAtCanvasPoint as cellAtCanvasPoint,
	drawnCellRange,
	gridTileGeometry,
	MARQUEE_START_THRESHOLD,
	revealScrollOffset,
} from './GridCanvasGeometry.js'

export interface ButtonInfiniteGridRef {
	resetPosition(): void
	/** Scroll the smallest amount that brings this cell fully into view */
	revealLocation(location: ControlLocation): void
}

export interface GridMarqueeHandling {
	/**
	 * Whether a box drawn with these modifiers held means anything right now.
	 *
	 * Asked as the drag begins, because what a box is worth depends on which tool is active and
	 * where it has got to - so one that would mean nothing is never drawn in the first place.
	 */
	canStart: (additive: boolean) => boolean
	onSelect: (from: ControlLocation, to: ControlLocation, additive: boolean) => void
}

/** Nothing is being held down - the pointer has simply gone */
const NO_MODIFIERS: GridButtonModifiers = { range: false, toggle: false }

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

/** The props `ButtonInfiniteGrid` gives to whichever component is rendering each cell */
export interface ButtonInfiniteGridButtonProps {
	pageNumber: number
	column: number
	row: number

	left: number
	top: number
	fixedSize: boolean
	onClick: ((location: ControlLocation, pressed: boolean) => void) | undefined
	onContextMenu: ((location: ControlLocation, x: number, y: number) => void) | undefined
	selected: boolean
	copySource: boolean
	contextMenuOpen: boolean
}

interface ButtonInfiniteGridProps {
	isHot?: boolean
	pageNumber: number
	buttonClick?: (location: ControlLocation, pressed: boolean) => void
	selectedButton?: ControlLocation | null
	copySourceButton?: ControlLocation | null
	contextMenuButton?: ControlLocation | null
	onButtonContextMenu?: (location: ControlLocation, x: number, y: number) => void
	gridSize: UserConfigGridSize
	ButtonIconFactory: React.ClassType<ButtonInfiniteGridButtonProps, any, any> // TODO - this type is flawed
	/** How a rectangle dragged out across the grid is handled. Null for grids that are only picked from. */
	marquee: GridMarqueeHandling | null
	/**
	 * Called with the cell the pointer is over, or null once it leaves the grid. Null for grids that
	 * have nothing to show under the cursor.
	 */
	onHoverLocation: ((location: ControlLocation | null, modifiers: GridButtonModifiers) => void) | null
	drawScale: number
	maxHeightToMatchCanvas?: boolean
	setViewportMinHeight?: React.Dispatch<React.SetStateAction<number>>
}

export const ButtonInfiniteGrid = forwardRef<ButtonInfiniteGridRef, ButtonInfiniteGridProps>(
	function ButtonInfiniteGrid(
		{
			isHot,
			pageNumber,
			buttonClick,
			selectedButton,
			copySourceButton,
			contextMenuButton,
			onButtonContextMenu,
			gridSize,
			ButtonIconFactory,
			marquee: marqueeHandling,
			onHoverLocation,
			drawScale,
			maxHeightToMatchCanvas,
			setViewportMinHeight,
		},
		ref
	) {
		const { minColumn, maxColumn, minRow, maxRow } = gridSize
		const countColumns = maxColumn - minColumn + 1
		const countRows = maxRow - minRow + 1

		const { inner: tileInnerSize, size: tileSize } = gridTileGeometry(drawScale ?? 1)
		const SCROLLBAR_PADDING = 15

		const [setSizeElement, windowSizeRaw] = useElementInnerSize()
		const { scrollX: scrollXRaw, scrollY: scrollYRaw, setRef: setScrollRef } = useScrollPosition<HTMLDivElement>()

		// Freeze visible area when hidden: keep last known valid (non-zero) size/scroll
		// This prevents visible buttons from being unmounted when the grid is hidden (e.g., tab switch)
		const lastValidWindowSize = useRef<{ width: number; height: number } | null>(null)
		const lastValidScroll = useRef<{ x: number; y: number } | null>(null)

		useEffect(() => {
			if (setViewportMinHeight) {
				setViewportMinHeight(2 * tileSize + SCROLLBAR_PADDING)
			}
		}, [setViewportMinHeight, tileSize])

		// Update last valid values only when we have non-trivial sizes (grid is actually visible)
		useEffect(() => {
			if (windowSizeRaw.width > 10 && windowSizeRaw.height > 10) {
				lastValidWindowSize.current = windowSizeRaw
			}
		}, [windowSizeRaw])

		useEffect(() => {
			if (
				lastValidWindowSize.current &&
				lastValidWindowSize.current.width > 10 &&
				lastValidWindowSize.current.height > 10
			) {
				lastValidScroll.current = { x: scrollXRaw, y: scrollYRaw }
			}
		}, [scrollXRaw, scrollYRaw])

		// Use frozen values if current size is zero/tiny (grid is hidden), otherwise use live values
		const isHidden = windowSizeRaw.width <= 10 || windowSizeRaw.height <= 10
		const windowSize = isHidden && lastValidWindowSize.current ? lastValidWindowSize.current : windowSizeRaw
		const scrollX = isHidden && lastValidScroll.current ? lastValidScroll.current.x : scrollXRaw
		const scrollY = isHidden && lastValidScroll.current ? lastValidScroll.current.y : scrollYRaw

		// Reposition the window to have 0/0 in the top left
		const [scrollerRef, setScrollerRef] = useState<HTMLDivElement | null>(null)
		const resetScrollPosition = useCallback(() => {
			if (scrollerRef) {
				scrollerRef.scrollTop = -minRow * tileSize
				scrollerRef.scrollLeft = -minColumn * tileSize
			}
		}, [scrollerRef, minColumn, minRow, tileSize])

		// Make the scroll position sticky when zooming
		const tmpScrollerPosition = useRef<{ left: number; top: number }>({ left: 0, top: 0 })
		useEffect(() => {
			if (!scrollerRef) return
			const scrollerRef2 = scrollerRef
			const drawScale2 = drawScale ?? 1

			// The maths isn't 100% pixel accurate, but its only a slight shift so is acceptable

			if (tmpScrollerPosition.current) {
				scrollerRef2.scrollLeft = tmpScrollerPosition.current.left * drawScale2
				scrollerRef2.scrollTop = tmpScrollerPosition.current.top * drawScale2
			}

			return () => {
				tmpScrollerPosition.current = {
					left: scrollerRef2.scrollLeft / drawScale2,
					top: scrollerRef2.scrollTop / drawScale2,
				}
			}
		}, [drawScale, scrollerRef])

		const setRef = useCallback(
			(ref: HTMLDivElement) => {
				setSizeElement(ref)
				setScrollRef(ref)

				setScrollerRef(ref)
			},
			[setSizeElement, setScrollRef]
		)

		// Reset the position when the element changes
		// eslint-disable-next-line react-hooks/exhaustive-deps
		useEffect(() => resetScrollPosition(), [scrollerRef])

		// Expose reload to the parent
		useImperativeHandle(
			ref,
			() => ({
				resetPosition() {
					resetScrollPosition()
				},
				revealLocation(location) {
					if (!scrollerRef) return

					scrollerRef.scrollLeft = revealScrollOffset(
						scrollerRef.scrollLeft,
						scrollerRef.clientWidth,
						(location.column - minColumn) * tileSize,
						tileSize
					)
					scrollerRef.scrollTop = revealScrollOffset(
						scrollerRef.scrollTop,
						scrollerRef.clientHeight,
						(location.row - minRow) * tileSize,
						tileSize
					)
				},
			}),
			[resetScrollPosition, scrollerRef, minColumn, minRow, tileSize]
		)

		// ---- dragging out a selection ----

		const canvasRef = useRef<HTMLDivElement | null>(null)
		const [marquee, setMarquee] = useState<MarqueeState | null>(null)

		// A drag of a button starts from the same pointerdown as a marquee would, so without this both
		// happen at once: the button moves and a region gets selected behind it
		const { source: dragSource } = useDragOperation()
		useEffect(() => {
			if (dragSource) setMarquee(null)
		}, [dragSource])

		const canvasPoint = useCallback((clientX: number, clientY: number) => {
			const rect = canvasRef.current?.getBoundingClientRect()
			if (!rect) return null
			return { x: clientX - rect.left, y: clientY - rect.top }
		}, [])

		const locationAtCanvasPoint = useCallback(
			(x: number, y: number): ControlLocation => cellAtCanvasPoint({ x, y }, gridSize, tileSize, pageNumber),
			[pageNumber, gridSize, tileSize]
		)

		// ---- panning with the middle button ----

		const panRef = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null)
		// Mirrors whether panRef is set, for the `grabbing` cursor: a ref mutation does not re-render, so
		// the class would otherwise only follow the ref on some later unrelated render
		const [isPanning, setIsPanning] = useState(false)

		const handlePanDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
			if (e.button !== 1) return false

			// Otherwise the browser starts its own autoscroll widget
			e.preventDefault()
			panRef.current = { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY }
			setIsPanning(true)
			e.currentTarget.setPointerCapture?.(e.pointerId)
			return true
		}, [])

		const handlePanMove = useCallback(
			(e: React.PointerEvent<HTMLDivElement>) => {
				const pan = panRef.current
				if (!pan || pan.pointerId !== e.pointerId || !scrollerRef) return false

				scrollerRef.scrollLeft -= e.clientX - pan.clientX
				scrollerRef.scrollTop -= e.clientY - pan.clientY
				panRef.current = { ...pan, clientX: e.clientX, clientY: e.clientY }
				return true
			},
			[scrollerRef]
		)

		const handlePanUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
			if (panRef.current?.pointerId !== e.pointerId) return false

			panRef.current = null
			setIsPanning(false)
			return true
		}, [])

		const handleMarqueeDown = useCallback(
			(e: React.PointerEvent<HTMLDivElement>) => {
				// Touch belongs to the browser here - a drag scrolls the grid, which matters far more than
				// being able to rubber-band with a finger
				if (!marqueeHandling || e.pointerType === 'touch' || e.button !== 0) return

				const additive = e.shiftKey || e.ctrlKey || e.metaKey
				if (!marqueeHandling.canStart(additive)) return

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
			[marqueeHandling, canvasPoint]
		)

		const handleMarqueeMove = useCallback(
			(e: React.PointerEvent<HTMLDivElement>) => {
				if (!marquee || marquee.pointerId !== e.pointerId || dragSource) return

				// The release can happen somewhere this element never sees it: outside the grid before the
				// box was dragged far enough to capture the pointer, or outside the window entirely, where
				// no pointerup is delivered at all. A move from the same pointer with nothing held is proof
				// it has already happened - and a mouse keeps its pointer id between gestures, so without
				// this the box would wake up on the next hover and rubber-band with no button pressed.
				if (e.buttons === 0) {
					setMarquee(null)
					return
				}

				const point = canvasPoint(e.clientX, e.clientY)
				if (!point) return

				const travelled = Math.hypot(point.x - marquee.startX, point.y - marquee.startY)
				const active = marquee.active || travelled > MARQUEE_START_THRESHOLD
				if (!active) return

				// Capture only once a box is actually being dragged, so a box dragged out past the edge of the
				// grid still delivers its move and up here - capturing on pointerdown instead would swallow the
				// pointerup a plain click on a button needs
				if (!marquee.active) e.currentTarget.setPointerCapture?.(e.pointerId)

				setMarquee({ ...marquee, currentX: point.x, currentY: point.y, active })
			},
			[marquee, canvasPoint, dragSource]
		)

		const handleMarqueeUp = useCallback(
			(e: React.PointerEvent<HTMLDivElement>) => {
				if (!marquee || marquee.pointerId !== e.pointerId) {
					setMarquee(null)
					return
				}
				setMarquee(null)

				// A pointer that never travelled was a click on a button, which the cell has already handled
				if (!marquee.active || !marqueeHandling) return

				marqueeHandling.onSelect(
					locationAtCanvasPoint(marquee.startX, marquee.startY),
					locationAtCanvasPoint(marquee.currentX, marquee.currentY),
					marquee.additive
				)
			},
			[marquee, marqueeHandling, locationAtCanvasPoint]
		)

		// Only what is on screen, plus enough spill to make scrolling smooth
		const drawColumns = drawnCellRange(minColumn, maxColumn, scrollX, windowSize.width, tileSize)
		const drawRows = drawnCellRange(minRow, maxRow, scrollY, windowSize.height, tileSize)
		const { first: drawMinColumn, last: drawMaxColumn } = drawColumns
		const { first: drawMinRow, last: drawMaxRow } = drawRows

		const visibleButtons: React.JSX.Element[] = []
		for (let row = drawMinRow; row <= drawMaxRow; row++) {
			for (let column = drawMinColumn; column <= drawMaxColumn; column++) {
				visibleButtons.push(
					<ButtonIconFactory
						key={`${column}_${row}`}
						fixedSize={true}
						row={row}
						column={column}
						pageNumber={pageNumber}
						onClick={buttonClick}
						onContextMenu={onButtonContextMenu}
						selected={
							selectedButton?.pageNumber === pageNumber &&
							selectedButton?.column === column &&
							selectedButton?.row === row
						}
						copySource={
							copySourceButton?.pageNumber === pageNumber &&
							copySourceButton?.column === column &&
							copySourceButton?.row === row
						}
						contextMenuOpen={
							contextMenuButton?.pageNumber === pageNumber &&
							contextMenuButton?.column === column &&
							contextMenuButton?.row === row
						}
						left={(column - minColumn) * tileSize}
						top={(row - minRow) * tileSize}
					/>
				)
			}
		}

		const canvasWidth = countColumns * tileSize
		const canvasHeight = countRows * tileSize

		// A tool that is about to place something ghosts it under the cursor, so hovering has to be
		// reported. Touch has no hover, and the padding around the canvas is not a cell, so both report
		// nothing rather than the nearest edge.
		const handleHoverMove = useCallback(
			(e: React.PointerEvent<HTMLDivElement>) => {
				// A drag in flight draws its own preview from where it is being dropped, which is the same
				// state the hover ghost uses
				if (!onHoverLocation || e.pointerType === 'touch' || dragSource) return

				const point = canvasPoint(e.clientX, e.clientY)
				const inside = !!point && point.x >= 0 && point.y >= 0 && point.x < canvasWidth && point.y < canvasHeight

				onHoverLocation(inside ? locationAtCanvasPoint(point.x, point.y) : null, {
					range: e.shiftKey,
					toggle: e.ctrlKey || e.metaKey,
				})
			},
			[onHoverLocation, canvasPoint, canvasWidth, canvasHeight, locationAtCanvasPoint, dragSource]
		)

		const gridCanvasStyle = useMemo(
			() => ({
				width: canvasWidth,
				height: canvasHeight,
				'--tile-inner-size': tileInnerSize,
				'--grid-scale': drawScale,
			}),
			[canvasWidth, canvasHeight, tileInnerSize, drawScale]
		)
		const gridWrapperStyle = useMemo(
			() => ({
				maxHeight: maxHeightToMatchCanvas ? countRows * tileSize + 2 * SCROLLBAR_PADDING : 'none', // Pad for possible scrollbar
				maxWidth: canvasWidth + SCROLLBAR_PADDING,
			}),
			[maxHeightToMatchCanvas, countRows, tileSize, canvasWidth]
		)

		return (
			<div
				ref={setRef}
				className={classNames('button-infinite-grid', {
					'button-armed': isHot,
					'button-grid-panning': isPanning,
				})}
				style={gridWrapperStyle}
				onPointerDown={(e) => {
					if (!handlePanDown(e)) handleMarqueeDown(e)
				}}
				onPointerMove={(e) => {
					handleHoverMove(e)
					if (!handlePanMove(e)) handleMarqueeMove(e)
				}}
				onPointerLeave={() => onHoverLocation?.(null, NO_MODIFIERS)}
				onPointerUp={(e) => {
					if (!handlePanUp(e)) handleMarqueeUp(e)
				}}
				onPointerCancel={(e) => {
					if (!handlePanUp(e)) handleMarqueeUp(e)
				}}
			>
				<div className="button-grid-canvas" style={gridCanvasStyle} ref={canvasRef}>
					{visibleButtons}
					{marquee?.active && (
						<div
							className="button-grid-marquee"
							style={{
								left: Math.min(marquee.startX, marquee.currentX),
								top: Math.min(marquee.startY, marquee.currentY),
								width: Math.abs(marquee.currentX - marquee.startX),
								height: Math.abs(marquee.currentY - marquee.startY),
							}}
						/>
					)}
				</div>
			</div>
		)
	}
)

export const PrimaryButtonGridIcon = memo(function PrimaryButtonGridIcon({
	pageNumber,
	column,
	row,
	left,
	top,
	contextMenuOpen,
}: ButtonInfiniteGridButtonProps) {
	const { store, actions, onContextMenu } = useButtonGridView()

	const { ref: drop, isDropTarget } = useDroppable({
		id: makeGridButtonDroppableId(pageNumber, column, row),
		accept: ['preset', GRID_BUTTON_DRAG_TYPE],
	})

	// A preset can go on any button, which is worth saying while one is in flight. Dragging a button
	// around the grid can also land anywhere, so marking every cell says nothing - what matters there
	// is the landing region, which lights up on its own.
	const { source } = useDragOperation()
	const canDrop = source?.type === 'preset'

	const location: ControlLocation = useMemo(() => ({ pageNumber, column, row }), [pageNumber, column, row])
	const locationKey = formatLocation(location)

	// Read straight from the store rather than taking these as props, so a selection change re-renders
	// only the cells whose own answer changed
	const selected = useGridIsSelected(locationKey)
	const isTransferSource = useGridIsTransferSource(locationKey)
	const pressMode = useGridPressMode()
	const dragAnyButton = useGridDragAnyButton()

	// Which button would end up here if the drag were released, so the cell can ghost it. Seeing the
	// buttons themselves is what makes it possible to check a large block has lined up.
	const pendingChange = useGridPendingChange(locationKey)
	const ghostSource = useGridDropGhostSource(locationKey)
	const dropWouldWork = useGridDragPreviewValid()

	// Already subscribed by the cell the button actually lives on, and subscriptions are shared
	const ghost = useButtonImageForLocation(ghostSource ?? location, DEFAULT_PREVIEW_RENDER_SIZE, !ghostSource)

	const { image, isUsed } = useButtonImageForLocation(location, DEFAULT_PREVIEW_RENDER_SIZE)

	// An empty cell has nothing to pick up, so dragging one is a gesture that can only end in nothing
	// happening. In select mode only an already-selected button drags, so dragging anywhere else can
	// still rubber-band. Arrange lets any button drag. Press mode lets none - a drag must never
	// swallow a press that is about to fire real actions.
	const dragData: GridButtonDragItem = useMemo(() => ({ location }), [location])
	const dragDisabled = pressMode || !isUsed || !(dragAnyButton || selected)
	const { ref: dragRef, isDragSource } = useDraggable<GridButtonDragItem>({
		id: `griddrag:${locationKey}`,
		type: GRID_BUTTON_DRAG_TYPE,
		data: dragData,
		disabled: dragDisabled,
	})

	const onTap = useCallback(
		(tapLocation: ControlLocation, modifiers: GridButtonModifiers) => store.handleTap(tapLocation, modifiers, actions),
		[store, actions]
	)
	const onPress = useCallback(
		(pressLocation: ControlLocation, isDown: boolean) => store.handlePress(pressLocation, isDown, actions),
		[store, actions]
	)

	const style = useMemo(() => ({ left, top }), [left, top])

	return (
		<GridButtonPreview
			location={location}
			image={isUsed ? image : null}
			style={style}
			title={locationKey}
			placeholder={`${row}/${column}`}
			pressMode={pressMode}
			onPress={onPress}
			onTap={onTap}
			onContextMenu={onContextMenu}
			selected={selected}
			copySource={isTransferSource}
			pendingChange={pendingChange}
			contextMenuOpen={contextMenuOpen}
			canDrop={canDrop}
			dropHover={isDropTarget}
			ghostImage={ghostSource && ghost.isUsed ? ghost.image : null}
			dropDestination={!!ghostSource}
			dropInvalid={!!ghostSource && !dropWouldWork}
			// Withheld rather than passed disabled: dnd-kit marks whatever holds this ref as a draggable,
			// and a disabled one as `aria-disabled`. A cell you cannot drag is still a cell you can click,
			// so saying otherwise is wrong for anything reading the page rather than looking at it.
			dragRef={dragDisabled ? null : dragRef}
			dropRef={drop}
			isDragSource={isDragSource}
		/>
	)
})
