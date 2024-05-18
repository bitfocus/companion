import React, { useCallback, useState } from 'react'
import { CInput } from '@coreui/react'
import type { UserConfigGridSize, UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

interface GridStepProps {
	rows: number
	columns: number
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function GridStep({ rows, columns, setValue }: GridStepProps) {
	const [totalRows, setTotalRows] = useState(rows)
	const [totalColumns, setTotalColumns] = useState(columns)

	const setMaxColumn = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		const grid: UserConfigGridSize = {
			minRow: 0,
			maxRow: totalRows - 1,
			minColumn: 0,
			maxColumn: newValue - 1,
		}

		setTotalColumns(newValue)
		setValue('gridSize', grid)
	}, [])
	const setMaxRow = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		const grid: UserConfigGridSize = {
			minRow: 0,
			maxRow: newValue - 1,
			minColumn: 0,
			maxColumn: totalColumns - 1,
		}

		setTotalRows(newValue)
		setValue('gridSize', grid)
	}, [])

	return (
		<div>
			<h5>Button Grid Size</h5>
			<p>
				By default Companion makes a grid of buttons sized for the Stream Deck XL. This can be made larger (or smaller)
				to accomodate individual surfaces of any size, such as an X-Keys XKE-128 (8 rows x 16 columns).
			</p>
			<p>
				The grid can also be enlarged to group multiple control surfaces together to create a larger control surface.
				For example, to accomodate two Stream Deck XL's side-by-side you can set the grid size as 4 rows x 16 columns.
			</p>
			<p className="indent3">Rows</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInput type="number" value={totalRows} min={0} step={1} onChange={setMaxRow} />
				</div>
			</div>
			<p className="indent3">Columns</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInput type="number" value={totalColumns} min={0} step={1} onChange={setMaxColumn} />
				</div>
			</div>
		</div>
	)
}
