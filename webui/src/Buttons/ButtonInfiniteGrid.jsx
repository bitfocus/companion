import { formatLocation } from '@companion/shared/ControlId'
import { ButtonPreview } from '../Components/ButtonPreview'
import React, {
	forwardRef,
	memo,
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useMemo,
	useState,
} from 'react'
import { useDrop } from 'react-dnd'
import { SocketContext, socketEmitPromise } from '../util'
import classNames from 'classnames'
import useScrollPosition from '../Hooks/useScrollPosition'
import useElementInnerSize from '../Hooks/useElementInnerSize'
import { useButtonRenderCache } from '../Hooks/useSharedRenderCache2'
import { CButton } from '@coreui/react'

export const ButtonInfiniteGrid = forwardRef(function ButtonInfiniteGrid(
	{ isHot, pageNumber, bankClick, selectedButton, gridSize, doGrow, buttonIconFactory },
	ref
) {
	const { minColumn, maxColumn, minRow, maxRow } = gridSize
	const countColumns = maxColumn - minColumn + 1
	const countRows = maxRow - minRow + 1

	const tileSize = 84
	const growWidth = doGrow ? 80 : 0
	const growHeight = doGrow ? 80 : 0

	const [setSizeElement, windowSize] = useElementInnerSize()
	const { scrollX, scrollY, setRef: setScrollRef } = useScrollPosition()

	// Reposition the window to have 0/0 in the top left
	const [scrollerRef, setScrollerRef] = useState(null)
	const resetScrollPosition = useCallback(() => {
		if (scrollerRef) {
			scrollerRef.scrollTop = -minRow * tileSize + growHeight
			scrollerRef.scrollLeft = -minColumn * tileSize + growWidth
		}
	}, [scrollerRef, minColumn, minRow, tileSize, growWidth, growHeight])

	const setRef = useCallback(
		(ref) => {
			setSizeElement(ref)
			setScrollRef(ref)

			setScrollerRef(ref)
		},
		[setSizeElement, setScrollRef]
	)

	// Reset the position when the element changes
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

	const visibleButtons = []
	for (let row = drawMinRow; row <= drawMaxRow; row++) {
		for (let column = drawMinColumn; column <= drawMaxColumn; column++) {
			visibleButtons.push(
				React.createElement(buttonIconFactory, {
					key: `${column}_${row}`,

					fixedSize: true,
					row,
					column,
					pageNumber,
					onClick: bankClick,
					selected:
						selectedButton?.pageNumber === pageNumber &&
						selectedButton?.column === column &&
						selectedButton?.row === row,
					style: {
						left: (column - minColumn) * tileSize + growWidth,
						top: (row - minRow) * tileSize + growHeight,
					},
				})
			)
		}
	}

	const doGrowLeft = useCallback(() => {
		if (doGrow) doGrow('left', undefined)
	}, [doGrow])
	const doGrowRight = useCallback(() => {
		if (doGrow) doGrow('right', undefined)
	}, [doGrow])
	const doGrowTop = useCallback(() => {
		if (doGrow) doGrow('top', undefined)
	}, [doGrow])
	const doGrowBottom = useCallback(() => {
		if (doGrow) doGrow('bottom', undefined)
	}, [doGrow])

	window.doGrow = doGrow

	return (
		<div
			ref={setRef}
			className={classNames('button-infinite-grid', {
				'bank-armed': isHot,
			})}
		>
			<div
				className="button-grid-canvas"
				style={{
					width: Math.max(countColumns * tileSize, windowSize.width) + growWidth * 2,
					height: Math.max(countRows * tileSize, windowSize.height) + growHeight * 2,
				}}
			>
				{doGrow && (
					<>
						<div className="expand left">
							<div className="sticky-center">
								<CButton color="primary" onClick={doGrowLeft}>
									Grow
								</CButton>
							</div>
						</div>
						<div className="expand right">
							<div className="sticky-center" onClick={doGrowRight}>
								<CButton color="primary">Grow</CButton>
							</div>
						</div>
						<div className="expand top">
							<div className="sticky-center" onClick={doGrowTop}>
								<CButton color="primary">Grow</CButton>
							</div>
						</div>
						<div className="expand bottom">
							<div className="sticky-center" onClick={doGrowBottom}>
								<CButton color="primary">Grow</CButton>
							</div>
						</div>
					</>
				)}

				{visibleButtons}
			</div>
		</div>
	)
})

export const PrimaryButtonGridIcon = memo(function PrimaryButtonGridIcon({ ...props }) {
	const socket = useContext(SocketContext)

	const [{ isOver, canDrop }, drop] = useDrop({
		accept: 'preset',
		drop: (dropData) => {
			console.log('preset drop', dropData)
			const location = { pageNumber: props.pageNumber, column: props.column, row: props.row }
			socketEmitPromise(socket, 'presets:import_to_bank', [dropData.instanceId, dropData.presetId, location]).catch(
				(e) => {
					console.error('Preset import failed')
				}
			)
		},
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop(),
		}),
	})

	return <ButtonGridIcon {...props} dropRef={drop} dropHover={isOver} canDrop={canDrop} />
})

export const ButtonGridIcon = memo(function ButtonGridIcon({ ...props }) {
	const { image, isUsed } = useButtonRenderCache({ pageNumber: props.pageNumber, column: props.column, row: props.row })

	return <ButtonGridIconBase {...props} image={isUsed ? image : null} />
})

export const ButtonGridIconBase = memo(function ButtonGridIcon({ pageNumber, column, row, image, ...props }) {
	const location = useMemo(() => ({ pageNumber, column, row }), [pageNumber, column, row])

	const title = formatLocation(location)
	return (
		<ButtonPreview
			{...props}
			location={location}
			alt={title}
			title={title}
			placeholder={`${location.row}/${location.column}`}
			preview={image}
		/>
	)
})
