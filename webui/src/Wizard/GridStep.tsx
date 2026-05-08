import { CCol, CFormLabel, CRow } from '@coreui/react'
import { useCallback, useState } from 'react'
import type { UserConfigGridSize, UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { NumberInputField } from '~/Components/NumberInputField'

interface GridStepProps {
	rows: number
	columns: number
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function GridStep({ rows, columns, setValue }: GridStepProps): React.JSX.Element {
	const [totalRows, setTotalRows] = useState(rows)
	const [totalColumns, setTotalColumns] = useState(columns)

	const setMaxColumn = useCallback(
		(newValue: number) => {
			if (isNaN(newValue)) return
			const grid: UserConfigGridSize = {
				minRow: 0,
				maxRow: totalRows - 1,
				minColumn: 0,
				maxColumn: newValue - 1,
			}

			setTotalColumns(newValue)
			setValue('gridSize', grid)
		},
		[setValue, totalRows]
	)
	const setMaxRow = useCallback(
		(newValue: number) => {
			if (isNaN(newValue)) return
			const grid: UserConfigGridSize = {
				minRow: 0,
				maxRow: newValue - 1,
				minColumn: 0,
				maxColumn: totalColumns - 1,
			}

			setTotalRows(newValue)
			setValue('gridSize', grid)
		},
		[setValue, totalColumns]
	)

	return (
		<CRow>
			<CCol sm={12}>
				<h5>Button Grid Size</h5>
				<p>
					By default Companion makes a grid of buttons sized for the Stream Deck XL. This can be made larger (or
					smaller) to accommodate individual surfaces of any size, such as an X-Keys XKE-128 (8 rows x 16 columns).
				</p>
				<p>
					The grid can also be enlarged to group multiple control surfaces together to create a larger control surface.
					For example, to accommodate two Stream Deck XL's side-by-side you can set the grid size as 4 rows x 16
					columns.
				</p>
			</CCol>

			<CFormLabel htmlFor="colFormRows" className="col-sm-4 col-form-label col-form-label-sm mb-2">
				Rows
			</CFormLabel>
			<CCol sm={5} className="mb-2">
				<NumberInputField id="colFormRows" value={totalRows} min={0} step={1} setValue={setMaxRow} />
			</CCol>
			<CCol sm={3}></CCol>

			<CFormLabel htmlFor="colFormCols" className="col-sm-4 col-form-label col-form-label-sm mb-2">
				Columns
			</CFormLabel>
			<CCol sm={5} className="mb-2">
				<NumberInputField id="colFormCols" value={totalColumns} min={0} step={1} setValue={setMaxColumn} />
			</CCol>
			<CCol sm={3}></CCol>

			<CCol sm={12}>
				<p>You can change this at any time on the 'Settings' tab in the GUI.</p>
			</CCol>
		</CRow>
	)
}
