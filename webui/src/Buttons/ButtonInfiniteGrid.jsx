import { formatLocation } from '@companion/shared/ControlId'
import { ButtonPreview } from '../Components/ButtonPreview'
import { memo, useContext, useMemo } from 'react'
import { useDrop } from 'react-dnd'
import { SocketContext } from '../util'
import classNames from 'classnames'

export function ButtonInfiniteGrid({ isHot, pageNumber, bankClick, selectedButton }) {
	const minX = -10
	const maxX = 20
	const minY = -10
	const maxY = 15
	const countX = maxX - minX
	const countY = maxY - minY

	const tileSize = 84

	const visibleButtons = []
	for (let row = minY; row <= maxY; row++) {
		for (let column = minX; column <= maxX; column++) {
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
