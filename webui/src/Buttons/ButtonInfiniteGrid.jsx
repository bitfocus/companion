import { formatLocation } from '@companion/shared/ControlId'
import { ButtonPreview } from '../Components/ButtonPreview'
import { memo, useCallback, useContext, useMemo, useRef } from 'react'
import { useDrop } from 'react-dnd'
import { SocketContext } from '../util'
import classNames from 'classnames'
import useScrollPosition from '../Hooks/useScrollPosition'
import useElementInnerSize from '../Hooks/useElementInnerSize'

export function ButtonInfiniteGrid({ isHot, pageNumber, bankClick, selectedButton }) {
	const minX = -10
	const maxX = 20
	const minY = -10
	const maxY = 15
	const countX = maxX - minX
	const countY = maxY - minY

	const tileSize = 84

	const [setSizeElement, windowSize] = useElementInnerSize()
	const { scrollX, scrollY, setRef: setScrollRef } = useScrollPosition()

	const setRef = useCallback(
		(ref) => {
			setSizeElement(ref)
			setScrollRef(ref)
		},
		[setSizeElement, setScrollRef]
	)

	const visibleColumns = windowSize.width / tileSize
	const visibleRows = windowSize.height / tileSize

	// Calculate the extents of what is visible
	const scrollColumn = scrollX / tileSize
	const scrollRow = scrollY / tileSize
	const visibleMinX = minX + scrollColumn
	const visibleMaxX = visibleMinX + visibleColumns
	const visibleMinY = minY + scrollRow
	const visibleMaxY = visibleMinY + visibleRows

	// Calculate the bounds of what to draw in the DOM
	// Include some spill to make scrolling smoother, but not too much to avoid being a performance drain
	const drawMinColumn = Math.max(Math.floor(visibleMinX - visibleColumns / 2), minX)
	const drawMaxColumn = Math.min(Math.ceil(visibleMaxX + visibleColumns / 2), maxX)
	const drawMinRow = Math.max(Math.floor(visibleMinY - visibleRows / 2), minY)
	const drawMaxRow = Math.min(Math.ceil(visibleMaxY + visibleRows / 2), maxY)

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
						left: (column - minX) * tileSize,
						top: (row - minY) * tileSize,
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
					width: countX * tileSize,
					height: countY * tileSize,
				}}
			>
				{visibleButtons}
			</div>
		</div>
	)
}

const ButtonGridIcon = memo(function ButtonGridIcon({ pageNumber, column, row, ...props }) {
	const socket = useContext(SocketContext)

	const location = useMemo(() => ({ pageNumber, column, row }), [pageNumber, column, row])

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
		/>
	)
})
