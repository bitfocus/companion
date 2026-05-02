import classNames from 'classnames'
import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useDrop } from 'react-dnd'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { ButtonPreview } from '~/Components/ButtonPreview.js'
import { useButtonImageForLocation } from '~/Hooks/useButtonImageForLocation.js'
import useElementInnerSize from '~/Hooks/useElementClientSize.js'
import useScrollPosition from '~/Hooks/useScrollPosition.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { PresetDragItem } from './Presets/PresetDragItem.js'

export interface ButtonInfiniteGridRef {
	resetPosition(): void
}

export interface ButtonInfiniteGridButtonProps {
	pageNumber: number
	column: number
	row: number

	image: string | null
	left: number
	top: number
	style: React.CSSProperties
}

interface ButtonInfiniteGridProps {
	isHot?: boolean
	pageNumber: number
	buttonClick?: (location: ControlLocation, pressed: boolean) => void
	selectedButton?: ControlLocation | null
	gridSize: UserConfigGridSize
	ButtonIconFactory: React.ClassType<ButtonInfiniteGridButtonProps, any, any> // TODO - this type is flawed
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
			gridSize,
			ButtonIconFactory,
			drawScale,
			maxHeightToMatchCanvas,
			setViewportMinHeight,
		},
		ref
	) {
		const { minColumn, maxColumn, minRow, maxRow } = gridSize
		const countColumns = maxColumn - minColumn + 1
		const countRows = maxRow - minRow + 1

		const tileInnerSize = 72 * (drawScale ?? 1)
		const tilePadding = Math.min(6, tileInnerSize * 0.05)
		const tileSize = tileInnerSize + tilePadding * 2
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
		const tmpScrollerPosition = useRef<{ left: number; top: number }>()
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
			}),
			[resetScrollPosition]
		)

		const visibleColumns = windowSize.width / tileSize
		const visibleRows = windowSize.height / tileSize

		// Calculate the extents of what is visible
		const scrollColumn = scrollX / tileSize
		const scrollRow = scrollY / tileSize
		const visibleMinX = minColumn + scrollColumn
		const visibleMaxX = visibleMinX + visibleColumns
		const visibleMinY = minRow + scrollRow
		const visibleMaxY = visibleMinY + visibleRows

		// Calculate the bounds of what to draw in the DOM
		// Include some spill to make scrolling smoother, but not too much to avoid being a performance drain
		const drawMinColumn = Math.max(Math.floor(visibleMinX - visibleColumns / 2), minColumn)
		const drawMaxColumn = Math.min(Math.ceil(visibleMaxX + visibleColumns / 2), maxColumn)
		const drawMinRow = Math.max(Math.floor(visibleMinY - visibleRows / 2), minRow)
		const drawMaxRow = Math.min(Math.ceil(visibleMaxY + visibleRows / 2), maxRow)

		const visibleButtons: JSX.Element[] = []
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
						selected={
							selectedButton?.pageNumber === pageNumber &&
							selectedButton?.column === column &&
							selectedButton?.row === row
						}
						left={(column - minColumn) * tileSize}
						top={(row - minRow) * tileSize}
					/>
				)
			}
		}

		const canvasWidth = countColumns * tileSize
		const canvasHeight = countRows * tileSize

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
				})}
				style={gridWrapperStyle}
			>
				<div className="button-grid-canvas" style={gridCanvasStyle}>
					{visibleButtons}
				</div>
			</div>
		)
	}
)

interface PresetDragState {
	isOver: boolean
	canDrop: boolean
}

export const PrimaryButtonGridIcon = memo(function PrimaryButtonGridIcon({ ...props }: ButtonInfiniteGridButtonProps) {
	const importPresetMutation = useMutationExt(trpc.controls.importPreset.mutationOptions())

	const [{ isOver, canDrop }, drop] = useDrop<PresetDragItem, unknown, PresetDragState>({
		accept: 'preset',
		drop: (dropData) => {
			console.log('preset drop', dropData)
			importPresetMutation
				.mutateAsync({
					connectionId: dropData.connectionId,
					presetId: dropData.presetId,
					location: { pageNumber: props.pageNumber, column: props.column, row: props.row },
					variableValues: dropData.variableValues,
				})
				.catch(() => {
					console.error('Preset import failed')
				})
		},
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop(),
		}),
	})

	return <ButtonGridIcon {...props} dropRef={drop} dropHover={isOver} canDrop={canDrop} />
})

type ButtonGridIconProps = ButtonGridIconBaseProps

export const ButtonGridIcon = memo(function ButtonGridIcon({ ...props }: ButtonGridIconProps) {
	const { image, isUsed } = useButtonImageForLocation({
		pageNumber: Number(props.pageNumber),
		column: props.column,
		row: props.row,
	})

	return <ButtonGridIconBase {...props} image={isUsed ? image : null} />
})

interface ButtonGridIconBaseProps {
	pageNumber: number
	column: number
	row: number
	image: string | null
	left: number
	top: number
	style: React.CSSProperties

	dropRef?: React.RefCallback<HTMLDivElement>
	dropHover?: boolean
	canDrop?: boolean
}

export const ButtonGridIconBase = memo(function ButtonGridIcon({
	pageNumber,
	column,
	row,
	image,
	left,
	top,
	style,
	...props
}: ButtonGridIconBaseProps) {
	const location: ControlLocation = useMemo(() => ({ pageNumber, column, row }), [pageNumber, column, row])

	const title = formatLocation(location)
	return (
		<ButtonPreview
			{...props}
			style={{
				...style,
				left,
				top,
			}}
			location={location}
			title={title}
			placeholder={`${location.row}/${location.column}`}
			preview={image}
		/>
	)
})
