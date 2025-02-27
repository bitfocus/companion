import React, { memo, useCallback, useContext, useMemo } from 'react'
import { SocketContext } from '../util.js'
import { ButtonPreview } from '../Components/ButtonPreview.js'
import { useInView } from 'react-intersection-observer'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { useButtonRenderCache } from '../Hooks/useSharedRenderCache.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'

export interface TabletGridSize extends UserConfigGridSize {
	columnCount: number
	rowCount: number
	buttonCount: number
}

interface SectionOfButtonsProps {
	pageNumber: number
	displayColumns: number
	gridSize: TabletGridSize
	buttonSize: number
}

export function SectionOfButtons({ pageNumber, displayColumns, gridSize, buttonSize }: SectionOfButtonsProps) {
	const socket = useContext(SocketContext)

	const buttonClick = useCallback(
		(location: ControlLocation, pressed: boolean) => {
			socket
				.emitPromise('controls:hot-press', [location, pressed, 'tablet'])
				.catch((e) => console.error(`Hot press failed: ${e}`))
		},
		[socket]
	)

	const { ref: inViewRef, inView } = useInView({
		rootMargin: '200%',
		/* Optional options */
		threshold: 0,
	})

	const buttonRows = Math.ceil(gridSize.buttonCount / displayColumns)
	const inViewStyle = useMemo(
		() => ({
			height: `${buttonRows * buttonSize}px`,
			top: `${buttonSize}px`,
		}),
		[buttonSize, buttonRows]
	)

	const buttonElements: JSX.Element[] = []
	if (inView) {
		let indexCount = 0
		for (let y = gridSize.minRow; y <= gridSize.maxRow; y++) {
			for (let x = gridSize.minColumn; x <= gridSize.maxColumn; x++) {
				const index = indexCount++

				const displayColumn = index % displayColumns
				const displayRow = Math.floor(index / displayColumns)
				buttonElements.push(
					<ButtonWrapper
						key={`${pageNumber}_${x}_${y}`}
						pageNumber={pageNumber}
						column={x}
						row={y}
						buttonSize={buttonSize}
						displayColumn={displayColumn}
						displayRow={displayRow}
						buttonClick={buttonClick}
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

interface ButtonsBlockProps {
	displayRows: number
	firstRowIndex: number
	buttonSize: number
}

export function ButtonsBlock({
	displayRows,
	firstRowIndex,
	buttonSize,
	children,
}: React.PropsWithChildren<ButtonsBlockProps>) {
	const { ref: inViewRef, inView } = useInView({
		rootMargin: '200%',
		/* Optional options */
		threshold: 0,
	})

	const inViewStyle = useMemo(
		() => ({
			height: `${displayRows * buttonSize}px`,
			top: `${firstRowIndex * buttonSize}px`,
		}),
		[buttonSize, displayRows, firstRowIndex]
	)

	return (
		<>
			<div ref={inViewRef} className="page-in-view-tester" style={inViewStyle}></div>
			{inView && children}
		</>
	)
}

interface ButtonWrapperProps {
	pageNumber: number
	column: number
	row: number
	buttonSize: number
	displayColumn: number
	displayRow: number
	buttonClick: (location: ControlLocation, pressed: boolean) => void
}
export const ButtonWrapper = memo(function ButtonWrapper({
	pageNumber,
	column,
	row,
	buttonSize,
	displayColumn,
	displayRow,
	buttonClick,
}: ButtonWrapperProps) {
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
			location={location}
			preview={image}
			onClick={buttonClick}
			title={`Button ${formatLocation(location)}`}
			selected={false}
			style={buttonStyle}
		/>
	)
})
