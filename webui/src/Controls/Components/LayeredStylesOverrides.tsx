import { FeedbackEntityModel, FeedbackEntityStyleOverride } from '@companion-app/shared/Model/EntityModel.js'
import { CButton } from '@coreui/react'
import { faPlus, faTrash, faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { nanoid } from 'nanoid'
import React, { useCallback, useState } from 'react'
import { TextInputField } from '~/Components'
import { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'
import { ElementPickerModal } from './ElementPickerModal.js'
import { elementSchemas } from '~/Buttons/EditButton/LayeredButtonEditor/ElementPropertiesSchemas.js'

function makeEmptyOverride(): FeedbackEntityStyleOverride {
	return {
		overrideId: nanoid(),
		elementId: '',
		elementProperty: '',
		override: { isExpression: false, value: '' },
	}
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
	const [isModalOpen, setIsModalOpen] = useState(false)

	const handleModalSave = useCallback(
		(override: FeedbackEntityStyleOverride) => {
			updateRow(override)
			setIsModalOpen(false)
		},
		[updateRow]
	)

	return (
		<>
			<tr key={row.overrideId}>
				<td>
					<div className="d-flex align-items-center cursor-pointer" onClick={() => setIsModalOpen(true)}>
						<div className="flex-grow-1">
							<SelectedElementProperty row={row} />
						</div>
						<CButton color="white" size="sm" title="Edit element and property">
							<FontAwesomeIcon icon={faPencil} />
						</CButton>
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

			<ElementPickerModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSave={handleModalSave}
				currentOverride={row}
			/>
		</>
	)
})

const SelectedElementProperty = observer(function SelectedElementProperty({
	row,
}: {
	row: FeedbackEntityStyleOverride
}) {
	const { styleStore } = useLayeredStyleElementsContext()

	if (!row.elementId || !row.elementProperty)
		return <div className="text-muted">Click to select element and property</div>

	const selectedElement = row.elementId ? styleStore.findElementById(row.elementId) : null
	const selectedSchema = selectedElement?.type ? elementSchemas[selectedElement.type] : null
	const selectedProperty = selectedSchema?.find((prop) => prop.id === row.elementProperty)

	return (
		<>
			<div className="fw-semibold">{selectedElement?.name || row.elementId}</div>
			<div className="text-muted small">{selectedProperty?.label || row.elementProperty}</div>
		</>
	)
})
