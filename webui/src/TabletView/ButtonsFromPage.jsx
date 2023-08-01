import { useCallback, useContext, useMemo } from 'react'
import { SocketContext, socketEmitPromise } from '../util'
import { ButtonPreview } from '../Components/ButtonPreview'
import { useInView } from 'react-intersection-observer'
import { formatLocation } from '@companion/shared/ControlId'
import { useButtonRenderCache } from '../Hooks/useSharedRenderCache'

export function ButtonsFromPage({ pageNumber, displayColumns, gridSize, buttonSize, indexOffset }) {
	const socket = useContext(SocketContext)

	const bankClick = useCallback(
		(location, pressed) => {
			socketEmitPromise(socket, 'controls:hot-press', [location, pressed, 'tablet']).catch((e) =>
				console.error(`Hot press failed: ${e}`)
			)
		},
		[socket]
	)

	const { ref: inViewRef, inView } = useInView({
		rootMargin: '200%',
		/* Optional options */
		threshold: 0,
	})

	const buttonRows = Math.ceil(gridSize.buttonCount / displayColumns)
	const firstRowIndex = Math.floor(indexOffset / displayColumns)
	const inViewStyle = useMemo(
		() => ({
			height: `${buttonRows * buttonSize}px`,
			top: `${firstRowIndex * buttonSize}px`,
		}),
		[buttonSize, buttonRows, firstRowIndex]
	)

	const buttonElements = []
	if (inView) {
		let indexCount = indexOffset
		for (let y = gridSize.minRow; y <= gridSize.maxRow; y++) {
			for (let x = gridSize.minColumn; x <= gridSize.maxColumn; x++) {
				const index = indexCount++

				const displayColumn = index % displayColumns
				const displayRow = Math.floor(index / displayColumns)
				buttonElements.push(
					<ButtonWrapper
						key={`${x}_${y}`}
						pageNumber={pageNumber}
						column={x}
						row={y}
						buttonSize={buttonSize}
						displayColumn={displayColumn}
						displayRow={displayRow}
						bankClick={bankClick}
					/>
				)
			}
		}
	}

	return (
		<>
			<div ref={inViewRef} className="page-in-view-tester" style={inViewStyle}></div>
			{buttonElements}
		</>
	)
}
function ButtonWrapper({ pageNumber, column, row, buttonSize, displayColumn, displayRow, bankClick }) {
	const location = useMemo(() => ({ pageNumber, column, row }), [pageNumber, column, row])

	const { image } = useButtonRenderCache(location)

	const buttonStyle = useMemo(
		() => ({
			width: `${buttonSize}px`,
			height: `${buttonSize}px`,
			left: `${displayColumn * buttonSize}px`,
			top: `${displayRow * buttonSize}px`,
		}),
		[buttonSize, displayColumn, displayRow]
	)

	return (
		<ButtonPreview
			page={pageNumber}
			location={location}
			preview={image}
			onClick={bankClick}
			alt={`Button ${formatLocation(location)}`}
			selected={false}
			style={buttonStyle}
		/>
	)
}
