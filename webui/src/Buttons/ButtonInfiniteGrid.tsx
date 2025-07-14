import { formatLocation } from '@companion-app/shared/ControlId.js'
import { ButtonPreview } from '~/Components/ButtonPreview.js'
import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useDrop } from 'react-dnd'
import classNames from 'classnames'
import useScrollPosition from '~/Hooks/useScrollPosition.js'
import useElementInnerSize from '~/Hooks/useElementInnerSize.js'
import { useButtonImageForLocation } from '~/Hooks/useButtonImageForLocation.js'
import { CButton, CFormInput } from '@coreui/react'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { PresetDragItem } from './Presets/PresetDragItem.js'
import { trpc, useMutationExt } from '~/TRPC.js'

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
	doGrow?: (direction: 'left' | 'right' | 'top' | 'bottom', amount: number) => void
	buttonIconFactory: React.ClassType<ButtonInfiniteGridButtonProps, any, any>
	drawScale: number
}

export const ButtonInfiniteGrid = forwardRef<ButtonInfiniteGridRef, ButtonInfiniteGridProps>(
	function ButtonInfiniteGrid(
		{ isHot, pageNumber, buttonClick, selectedButton, gridSize, doGrow, buttonIconFactory, drawScale },
		ref
	) {
		const { minColumn, maxColumn, minRow, maxRow } = gridSize
		const countColumns = maxColumn - minColumn + 1
		const countRows = maxRow - minRow + 1

		const tileInnerSize = 72 * (drawScale ?? 1)
		const tilePadding = Math.min(6, tileInnerSize * 0.05)
		const tileSize = tileInnerSize + tilePadding * 2
		const growWidth = doGrow ? 90 : 0
		const growHeight = doGrow ? 60 : 0

		const [setSizeElement, windowSize] = useElementInnerSize()
		const { scrollX, scrollY, setRef: setScrollRef } = useScrollPosition<HTMLDivElement>()

		// Reposition the window to have 0/0 in the top left
		const [scrollerRef, setScrollerRef] = useState<HTMLDivElement | null>(null)
		const resetScrollPosition = useCallback(() => {
			if (scrollerRef) {
				scrollerRef.scrollTop = -minRow * tileSize + growHeight
				scrollerRef.scrollLeft = -minColumn * tileSize + growWidth
			}
		}, [scrollerRef, minColumn, minRow, tileSize, growWidth, growHeight])

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
					React.createElement(buttonIconFactory, {
						key: `${column}_${row}`,

						fixedSize: true,
						row,
						column,
						pageNumber,
						onClick: buttonClick,
						selected:
							selectedButton?.pageNumber === pageNumber &&
							selectedButton?.column === column &&
							selectedButton?.row === row,
						left: (column - minColumn) * tileSize + growWidth,
						top: (row - minRow) * tileSize + growHeight,
					})
				)
			}
		}

		const growTopRef = useRef<HTMLInputElement>(null)
		const growBottomRef = useRef<HTMLInputElement>(null)
		const growLeftRef = useRef<HTMLInputElement>(null)
		const growRightRef = useRef<HTMLInputElement>(null)

		const doGrowLeft = useCallback(() => {
			if (!doGrow || !growLeftRef.current) return

			const amount = Number(growLeftRef.current.value)
			if (isNaN(amount)) return

			doGrow('left', amount)
		}, [doGrow])
		const doGrowRight = useCallback(() => {
			if (!doGrow || !growRightRef.current) return

			const amount = Number(growRightRef.current.value)
			if (isNaN(amount)) return

			doGrow('right', amount)
		}, [doGrow])
		const doGrowTop = useCallback(() => {
			if (!doGrow || !growTopRef.current) return

			const amount = Number(growTopRef.current.value)
			if (isNaN(amount)) return

			doGrow('top', amount)
		}, [doGrow])
		const doGrowBottom = useCallback(() => {
			if (!doGrow || !growBottomRef.current) return

			const amount = Number(growBottomRef.current.value)
			if (isNaN(amount)) return

			doGrow('bottom', amount)
		}, [doGrow])

		const gridCanvasStyle = useMemo(
			() => ({
				width: Math.max(countColumns * tileSize, windowSize.width) + growWidth * 2,
				height: Math.max(countRows * tileSize, windowSize.height) + growHeight * 2,
				'--tile-inner-size': tileInnerSize,
				'--grid-scale': drawScale,
			}),
			[countColumns, countRows, tileSize, windowSize, growWidth, growHeight, tileInnerSize, drawScale]
		)

		return (
			<div
				ref={setRef}
				className={classNames('button-infinite-grid', {
					'button-armed': isHot,
				})}
			>
				<div className="button-grid-canvas" style={gridCanvasStyle}>
					{doGrow && (
						<>
							<div className="expand left">
								<div className="sticky-center">
									<CButton onClick={doGrowLeft}>Add</CButton>
									<CFormInput ref={growLeftRef} type="number" min={1} defaultValue={2} />
									&nbsp;&nbsp;columns
								</div>
							</div>
							<div className="expand right">
								<div className="sticky-center">
									<CButton onClick={doGrowRight}>Add</CButton>
									<CFormInput ref={growRightRef} type="number" min={1} defaultValue={2} />
									&nbsp;&nbsp;columns
								</div>
							</div>
							<div className="expand top">
								<div className="sticky-center">
									<CButton onClick={doGrowTop}>Add</CButton>
									<CFormInput ref={growTopRef} type="number" min={1} defaultValue={2} />
									&nbsp;&nbsp;rows
								</div>
							</div>
							<div className="expand bottom">
								<div className="sticky-center">
									<CButton onClick={doGrowBottom}>Add</CButton>
									<CFormInput ref={growBottomRef} type="number" min={1} defaultValue={2} />
									&nbsp;&nbsp;rows
								</div>
							</div>
						</>
					)}

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
