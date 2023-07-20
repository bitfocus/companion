import { formatLocation } from '@companion/shared/ControlId'
import { ButtonPreview } from '../Components/ButtonPreview'
import { forwardRef, memo, useCallback, useContext, useImperativeHandle, useMemo, useRef } from 'react'
import { useDrop } from 'react-dnd'
import { SocketContext, UserConfigContext } from '../util'
import classNames from 'classnames'
import useScrollPosition from '../Hooks/useScrollPosition'
import useElementInnerSize from '../Hooks/useElementInnerSize'
import { useButtonRenderCache } from '../Hooks/useSharedRenderCache2'

export const ButtonInfiniteGrid = forwardRef(function ButtonInfiniteGrid(
	{ isHot, pageNumber, bankClick, selectedButton },
	ref
) {
	const userConfig = useContext(UserConfigContext)

	const minColumn = userConfig.grid_min_column
	const maxColumn = userConfig.grid_max_column
	const minRow = userConfig.grid_min_row
	const maxRow = userConfig.grid_max_row
	const countColumns = maxColumn - minColumn
	const countRows = maxRow - minRow

	const tileSize = 84

	const [setSizeElement, windowSize] = useElementInnerSize()
	const { scrollX, scrollY, setRef: setScrollRef } = useScrollPosition()

	const scrollerRef = useRef(null)

	const resetScrollPosition = useCallback(() => {
		console.log(scrollerRef.current, -minRow * tileSize, -minColumn * tileSize)
		if (scrollerRef.current) {
			scrollerRef.current.scrollTop = -minRow * tileSize
			scrollerRef.current.scrollLeft = -minColumn * tileSize
		}
	}, [minColumn, minRow, tileSize])

	const setRef = useCallback(
		(ref) => {
			setSizeElement(ref)
			setScrollRef(ref)

			scrollerRef.current = ref
			resetScrollPosition()
		},
		[setSizeElement, setScrollRef, resetScrollPosition]
	)

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
				<ButtonGridIcon
					key={`${column}_${row}`}
					fixedSize
					row={row}
					column={column}
					pageNumber={pageNumber}
					onClick={bankClick}
					selected={
						selectedButton?.pageNumber === pageNumber &&
						selectedButton?.column === column &&
						selectedButton?.row === row
					}
					style={{
						left: (column - minColumn) * tileSize,
						top: (row - minRow) * tileSize,
					}}
				/>
			)
		}
	}

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
					width: countColumns * tileSize,
					height: countRows * tileSize,
				}}
			>
				{visibleButtons}
			</div>
		</div>
	)
})

const ButtonGridIcon = memo(function ButtonGridIcon({ pageNumber, column, row, ...props }) {
	const socket = useContext(SocketContext)

	const location = useMemo(() => ({ pageNumber, column, row }), [pageNumber, column, row])

	const { image, isUsed } = useButtonRenderCache(location)

	const [{ isOver, canDrop }, drop] = useDrop({
		accept: 'preset',
		drop: (dropData) => {
			console.log('preset drop', dropData)
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

	const title = formatLocation(location)
	return (
		<ButtonPreview
			{...props}
			location={location}
			dropRef={drop}
			dropHover={isOver}
			canDrop={canDrop}
			alt={title}
			title={title}
			placeholder={`${location.row}/${location.column}`}
			preview={isUsed ? image : null}
		/>
	)
})
