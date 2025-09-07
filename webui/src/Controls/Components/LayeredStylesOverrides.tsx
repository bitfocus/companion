import { FeedbackEntityModel, FeedbackEntityStyleOverride } from '@companion-app/shared/Model/EntityModel.js'
import { ExpressionOrValue } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CButton } from '@coreui/react'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { nanoid } from 'nanoid'
import React, { useCallback, useMemo } from 'react'
import { TextInputField } from '~/Components'
import { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService'

function makeEmptyOverride(): FeedbackEntityStyleOverride {
	return {
		overrideId: nanoid(),
		elementId: '',
		elementProperty: '',
		override: { isExpression: false, value: '' },
	}
}

// Very small value editor designed to be replaced later with a FormPropertyField-like control.
// For now it supports a simple text input and exposes a generic onChange with the raw value.
function ValueEditor({
	value,
	onChange,
}: {
	value: ExpressionOrValue<any> | string | null
	onChange: (v: ExpressionOrValue<any> | string | null) => void
}) {
	const stringified = useMemo(() => {
		if (value === null || value === undefined) return ''
		if (typeof value === 'string') return value
		try {
			return JSON.stringify(value)
		} catch {
			// Avoid default Object stringification; return an empty string for unknown values
			return ''
		}
	}, [value])

	return <input type="text" value={stringified} onChange={(e) => onChange(e.target.value)} style={{ width: '100%' }} />
}

interface LayeredStylesOverridesProps {
	feedback: FeedbackEntityModel
	service: IEntityEditorActionService
}

export const LayeredStylesOverrides = observer(function LayeredStylesOverrides({
	feedback,
	service,
}: LayeredStylesOverridesProps) {
	const overrides = feedback.styleOverrides || []

	const addRow = useCallback(() => service.replaceStyleOverride(makeEmptyOverride()), [service])
	const deleteRow = useCallback((id: string) => service.removeStyleOverride(id), [service])
	const updateRow = useCallback(
		(override: FeedbackEntityStyleOverride) => service.replaceStyleOverride(override),
		[service]
	)

	return (
		<>
			<hr />

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
				<strong>Layered Styles Overrides</strong>
				<div></div>
			</div>

			<table className="table table-responsive-sm width-100">
				<thead>
					<tr>
						<th>Path</th>
						<th>Value</th>
						<th className="fit">
							<CButton color="white" size="sm" title="Add override" onClick={addRow}>
								<FontAwesomeIcon icon={faPlus} />
							</CButton>
						</th>
					</tr>
				</thead>
				<tbody>
					{overrides.length === 0 && (
						<tr>
							<td colSpan={3} className="text-center p-2">
								This feedback has no effect. Try adding an override
							</td>
						</tr>
					)}
					{overrides.map((row) => (
						<LayeredStylesOverridesRow key={row.overrideId} row={row} updateRow={updateRow} deleteRow={deleteRow} />
					))}
				</tbody>
			</table>
		</>
	)
})

interface LayeredStylesOverridesRowProps {
	row: FeedbackEntityStyleOverride
	updateRow: (override: FeedbackEntityStyleOverride) => void
	deleteRow: (id: string) => void
}
const LayeredStylesOverridesRow = observer(function LayeredStylesOverridesRow({
	row,
	updateRow,
	deleteRow,
}: LayeredStylesOverridesRowProps) {
	return (
		<tr key={row.overrideId}>
			<td>
				<TextInputField
					value={row.elementId}
					setValue={(v) => updateRow({ ...row, elementId: v })}
					placeholder="e.g. layer"
				/>
				<TextInputField
					value={row.elementProperty}
					setValue={(v) => updateRow({ ...row, elementProperty: v })}
					placeholder="e.g. color"
				/>
			</td>
			<td>
				<TextInputField
					value={row.override.value}
					setValue={(v) => updateRow({ ...row, override: { ...row.override, value: v } })}
				/>
				{/* <ValueEditor value={row.value} onChange={(v) => updateRow({ ...row, value: v })} /> */}
			</td>
			<td>
				<CButton color="white" size="sm" title="Delete override" onClick={() => deleteRow(row.overrideId)}>
					<FontAwesomeIcon icon={faTrash} />
				</CButton>
			</td>
		</tr>
	)
})
