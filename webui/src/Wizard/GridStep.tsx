import React, { useCallback, useState } from 'react'
import { CInput } from '@coreui/react'
import type { UserConfigGridSize, UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

interface GridStepProps {
	gridSize: UserConfigGridSize
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function GridStep({ gridSize, setValue }: GridStepProps) {
	const [newGridSize, setNewGridSize] = useState<UserConfigGridSize | null>(gridSize)

	const setMinColumn = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		const changedGrid = newGridSize
			? {
					...newGridSize,
					minColumn: newValue,
				}
			: null

		setNewGridSize(changedGrid)
		setValue('gridSize', changedGrid)
	}, [])
	const setMaxColumn = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		const changedGrid = newGridSize
			? {
					...newGridSize,
					maxColumn: newValue,
				}
			: null

		setNewGridSize(changedGrid)
		setValue('gridSize', changedGrid)
	}, [])
	const setMinRow = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		const changedGrid = newGridSize
			? {
					...newGridSize,
					minRow: newValue,
				}
			: null

		setNewGridSize(changedGrid)
		setValue('gridSize', changedGrid)
	}, [])
	const setMaxRow = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		const changedGrid = newGridSize
			? {
					...newGridSize,
					maxRow: newValue,
				}
			: null

		setNewGridSize(changedGrid)
		setValue('gridSize', changedGrid)
	}, [])

	return (
		<div>
			<h5>Button Grid Size</h5>
			<p>
				By default Companion makes a grid of buttons sized for the Stream Deck XL. This can be made larger (or smaller)
				to accomodate larger surfaces, such as an X-Keys XKE-128, or to group multiple control surfaces together to
				create a larger control surface.
			</p>
			<p>
				This is configured using a coordinates system starting at 0/0, although the grid can be expanded in any
				direction. For example, a 4 x 16 grid to accomodate two Stream Deck XL's side-by-side could be configured as
				[-7/0 - 3/7] or [0/0 - 3/15].
			</p>
			<p className="indent3">Min Row</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInput type="number" value={newGridSize?.minRow} max={0} step={1} onChange={setMinRow} />
				</div>
			</div>
			<p className="indent3">Max Row</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInput type="number" value={newGridSize?.maxRow} min={0} step={1} onChange={setMaxRow} />
				</div>
			</div>
			<p className="indent3">Min Column</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInput type="number" value={newGridSize?.minColumn} max={0} step={1} onChange={setMinColumn} />
				</div>
			</div>
			<p className="indent3">Max Column</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInput type="number" value={newGridSize?.maxColumn} min={0} step={1} onChange={setMaxColumn} />
				</div>
			</div>
		</div>
	)
}
