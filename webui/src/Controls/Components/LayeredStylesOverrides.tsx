import { FeedbackEntityModel, FeedbackEntityStyleOverride } from '@companion-app/shared/Model/EntityModel.js'
import { ExpressionOrValue } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CButton, CFormSelect } from '@coreui/react'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { nanoid } from 'nanoid'
import React, { useCallback, useMemo } from 'react'
import { TextInputField } from '~/Components'
import { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'

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
						<th>Element & Property</th>
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
	const elementsContext = useLayeredStyleElementsContext()

	const elementOptions = useMemo(() => {
		const buildElementOptions = (elements: any[], prefix = ''): Array<{ value: string; label: string }> => {
			const options: Array<{ value: string; label: string }> = []

			for (const element of elements) {
				const label = prefix ? `${prefix} > ${element.name || element.id}` : element.name || element.id
				options.push({
					value: element.id,
					label: `${label} (${element.type})`,
				})

				if (element.type === 'group' && element.children) {
					options.push(...buildElementOptions(element.children, label))
				}
			}

			return options
		}

		const elements = elementsContext.styleStore.elements
		return [{ value: '', label: 'Select element...' }, ...buildElementOptions(elements.slice())]
	}, [elementsContext])

	return (
		<tr key={row.overrideId}>
			<td>
				<CFormSelect value={row.elementId} onChange={(e) => updateRow({ ...row, elementId: e.target.value })}>
					{elementOptions.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</CFormSelect>
				<div className="mt-2">
					<TextInputField
						value={row.elementProperty}
						setValue={(v) => updateRow({ ...row, elementProperty: v })}
						placeholder="e.g. color"
					/>
				</div>
			</td>
			<td>
				<TextInputField
					value={row.override.value}
					setValue={(v) => updateRow({ ...row, override: { ...row.override, value: v } })}
				/>
			</td>
			<td>
				<CButton color="white" size="sm" title="Delete override" onClick={() => deleteRow(row.overrideId)}>
					<FontAwesomeIcon icon={faTrash} />
				</CButton>
			</td>
		</tr>
	)
})
