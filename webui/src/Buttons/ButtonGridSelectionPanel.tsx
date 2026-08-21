import { useMemo } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { useButtonImageForLocation } from '~/Hooks/useButtonImageForLocation.js'
import './ButtonGridSelectionPanel.css'
import { ButtonGridSelectionActions } from './ButtonGridSelectionActions.js'
import { useGridSelectedLocations } from './ButtonGridViewContext.js'

/**
 * Beyond this many cells in the region, drawing each button costs a live image subscription apiece
 * for something nobody can read anyway, so fall back to a plain summary.
 */
const MAX_PREVIEW_CELLS = 120

interface SelectionBounds {
	minRow: number
	maxRow: number
	minColumn: number
	maxColumn: number
	pageNumber: number
}

/**
 * What is selected, drawn as the shape it actually is.
 *
 * A list of coordinates tells you nothing about whether you grabbed the right block; the region with
 * its gaps left as holes tells you at a glance.
 */
export function ButtonGridSelectionPanel(): React.JSX.Element {
	const selectedLocations = useGridSelectedLocations()

	const bounds = useMemo((): SelectionBounds | null => {
		if (selectedLocations.length === 0) return null

		return {
			minRow: Math.min(...selectedLocations.map((l) => l.row)),
			maxRow: Math.max(...selectedLocations.map((l) => l.row)),
			minColumn: Math.min(...selectedLocations.map((l) => l.column)),
			maxColumn: Math.max(...selectedLocations.map((l) => l.column)),
			pageNumber: selectedLocations[0].pageNumber,
		}
	}, [selectedLocations])

	const selectedKeys = useMemo(() => new Set(selectedLocations.map(formatLocation)), [selectedLocations])

	if (!bounds) {
		return <div className="button-grid-selection-panel">Nothing selected</div>
	}

	const rows = bounds.maxRow - bounds.minRow + 1
	const columns = bounds.maxColumn - bounds.minColumn + 1
	const cellCount = rows * columns

	return (
		<div className="button-grid-selection-panel">
			<h5>{selectedLocations.length} buttons selected</h5>
			<p className="button-grid-selection-summary">
				Page {bounds.pageNumber} &middot; {rows}&times;{columns} region
			</p>

			{cellCount <= MAX_PREVIEW_CELLS ? (
				<div
					className="button-grid-selection-preview"
					// Columns share the width available, but the whole thing is capped so a tile never grows
					// past twice the size the grid draws at - beyond that the previews are being upscaled
					// well past the size they were rendered for, and look it. Capping the container rather
					// than each column means it can never need a scrollbar either.
					style={{ '--selection-columns': columns } as React.CSSProperties}
				>
					{Array.from({ length: cellCount }, (_, index) => {
						const location: ControlLocation = {
							pageNumber: bounds.pageNumber,
							row: bounds.minRow + Math.floor(index / columns),
							column: bounds.minColumn + (index % columns),
						}
						const key = formatLocation(location)

						return selectedKeys.has(key) ? (
							<SelectionPreviewCell key={key} location={location} />
						) : (
							// A cell inside the region that was not picked, so the shape reads correctly
							<div key={key} className="button-grid-selection-hole" />
						)
					})}
				</div>
			) : (
				<p className="button-grid-selection-summary">Too many buttons to preview.</p>
			)}

			<div className="button-grid-selection-actions">
				<ButtonGridSelectionActions />
			</div>
		</div>
	)
}

function SelectionPreviewCell({ location }: { location: ControlLocation }): React.JSX.Element {
	const { image, isUsed } = useButtonImageForLocation(location)

	return (
		<ButtonPreviewBase
			preview={isUsed ? image : null}
			title={formatLocation(location)}
			placeholder={`${location.row}/${location.column}`}
		/>
	)
}
