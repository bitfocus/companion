import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { useButtonImageForControlId } from '~/Hooks/useButtonImageForControlId.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface ButtonGridProps {
	pageNumber: number
	gridSize: { minRow: number; maxRow: number; minColumn: number; maxColumn: number }
	selectedLocation: ControlLocation | null
	onSelect: (location: ControlLocation) => void
}

const Cell = observer(function Cell({
	location,
	selected,
	onSelect,
}: {
	location: ControlLocation
	selected: boolean
	onSelect: (location: ControlLocation) => void
}) {
	const { pages } = useContext(RootAppStoreContext)
	const controlId = pages.getControlIdAtLocation(location)
	const image = useButtonImageForControlId(controlId ?? '', !controlId)

	return (
		<ButtonPreviewBase
			fixedSize
			preview={image}
			selected={selected}
			title={`Row ${location.row} · Col ${location.column}`}
			onClick={() => onSelect(location)}
		/>
	)
})

export const TimelineButtonGrid = observer(function TimelineButtonGrid({
	pageNumber,
	gridSize,
	selectedLocation,
	onSelect,
}: ButtonGridProps) {
	const rows: number[] = []
	for (let r = gridSize.minRow; r <= gridSize.maxRow; r++) rows.push(r)
	const cols: number[] = []
	for (let c = gridSize.minColumn; c <= gridSize.maxColumn; c++) cols.push(c)

	return (
		<div className="ct-button-grid">
			{rows.map((row) => (
				<div key={row} className="ct-button-grid-row">
					{cols.map((column) => {
						const location: ControlLocation = { pageNumber, row, column }
						const selected =
							!!selectedLocation &&
							selectedLocation.pageNumber === pageNumber &&
							selectedLocation.row === row &&
							selectedLocation.column === column
						return <Cell key={column} location={location} selected={selected} onSelect={onSelect} />
					})}
				</div>
			))}
		</div>
	)
})
