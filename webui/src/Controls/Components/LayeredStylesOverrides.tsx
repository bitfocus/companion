import {
	EntityModelType,
	FeedbackEntityModel,
	FeedbackEntityStyleOverride,
	FeedbackEntitySubType,
} from '@companion-app/shared/Model/EntityModel.js'
import { ButtonStyleProperties } from '@companion-app/shared/Style.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CButton } from '@coreui/react'
import { faPlus, faTrash, faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { nanoid } from 'nanoid'
import React, { useCallback, useState } from 'react'
import { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'
import { ElementPickerModal } from './ElementPickerModal.js'
import { AddElementPickerModal } from './AddElementPickerModal.js'
import { elementSchemas } from '~/Buttons/EditButton/LayeredButtonEditor/ElementPropertiesSchemas.js'
import { OptionsInputControl } from '../OptionsInputField.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { ExpressionFieldControl } from './ExpressionFieldControl.js'
import { LocalVariablesStore } from '../LocalVariablesStore.js'
import { useComputed } from '~/Resources/util.js'
import { assertNever } from '@companion-app/shared/Util.js'

interface LayeredStylesOverridesProps {
	feedback: FeedbackEntityModel
	feedbackType: FeedbackEntitySubType | null | undefined
	service: IEntityEditorActionService
	localVariablesStore: LocalVariablesStore | null
}

export const LayeredStylesOverrides = observer(function LayeredStylesOverrides({
	feedback,
	feedbackType,
	service,
	localVariablesStore,
}: LayeredStylesOverridesProps) {
	const { styleStore } = useLayeredStyleElementsContext()
	const [isAddModalOpen, setIsAddModalOpen] = useState(false)

	// Create a flat list of element IDs in their visual order (depth-first traversal)
	const elementOrderMap = useComputed(() => {
		const orderMap = new Map<string, number>()
		let index = 0

		const traverse = (elements: SomeButtonGraphicsElement[]) => {
			for (const element of elements) {
				orderMap.set(element.id, index++)
				if (element.type === 'group' && element.children) {
					traverse(element.children)
				}
			}
		}

		traverse(styleStore.elements)
		return orderMap
	}, [styleStore.elements])

	// Sort overrides by element order, then by property name
	const overrides = useComputed(() => {
		const rawOverrides = feedback.styleOverrides || []
		return [...rawOverrides].sort((a, b) => {
			// Primary sort: element order
			const aOrder = elementOrderMap.get(a.elementId) ?? Infinity
			const bOrder = elementOrderMap.get(b.elementId) ?? Infinity

			if (aOrder !== bOrder) {
				// Reverse order
				return bOrder - aOrder
			}

			// Secondary sort: property name
			const selectedElementA = styleStore.findElementById(a.elementId)
			const selectedElementB = styleStore.findElementById(b.elementId)
			const selectedSchemaA = selectedElementA?.type ? elementSchemas[selectedElementA.type] : null
			const selectedSchemaB = selectedElementB?.type ? elementSchemas[selectedElementB.type] : null
			const selectedPropertyA = selectedSchemaA?.find((prop) => prop.id === a.elementProperty)
			const selectedPropertyB = selectedSchemaB?.find((prop) => prop.id === b.elementProperty)

			const propertyNameA = selectedPropertyA?.label || a.elementProperty
			const propertyNameB = selectedPropertyB?.label || b.elementProperty

			return propertyNameA.localeCompare(propertyNameB)
		})
	}, [feedback.styleOverrides, elementOrderMap, styleStore])

	const deleteRow = useCallback((id: string) => service.removeStyleOverride(id), [service])
	const updateRow = useCallback(
		(override: FeedbackEntityStyleOverride) => service.replaceStyleOverride(override),
		[service]
	)

	const handleAddModalSave = useCallback(
		(elementId: string, properties: string[]) => {
			console.log('AddElementPickerModal save:', { elementId, properties })

			// Create multiple overrides, one for each selected property
			properties.forEach((propertyId) => {
				const newOverride: FeedbackEntityStyleOverride = {
					overrideId: nanoid(),
					elementId,
					elementProperty: propertyId,
					override: { isExpression: false, value: '' },
				}
				service.replaceStyleOverride(newOverride)
			})

			setIsAddModalOpen(false)
		},
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
							<CButton color="white" size="sm" title="Add override" onClick={() => setIsAddModalOpen(true)}>
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
						<LayeredStylesOverridesRow
							key={row.overrideId}
							row={row}
							updateRow={updateRow}
							deleteRow={deleteRow}
							localVariablesStore={localVariablesStore}
							feedbackType={feedbackType}
						/>
					))}
				</tbody>
			</table>

			<AddElementPickerModal
				isOpen={isAddModalOpen}
				onClose={() => setIsAddModalOpen(false)}
				onSave={handleAddModalSave}
			/>
		</>
	)
})

interface LayeredStylesOverridesRowProps {
	row: FeedbackEntityStyleOverride
	updateRow: (override: FeedbackEntityStyleOverride) => void
	deleteRow: (id: string) => void
	localVariablesStore: LocalVariablesStore | null
	feedbackType: FeedbackEntitySubType | null | undefined
}
const LayeredStylesOverridesRow = observer(function LayeredStylesOverridesRow({
	row,
	updateRow,
	deleteRow,
	localVariablesStore,
	feedbackType,
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
					<PropertyValueInput
						row={row}
						updateRow={updateRow}
						localVariablesStore={localVariablesStore}
						feedbackType={feedbackType}
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

	if (!row.elementId || !row.elementProperty) return <div className="text-muted">No element selected</div>

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

const PropertyValueInput = observer(function PropertyValueInput({
	row,
	updateRow,
	localVariablesStore,
	feedbackType,
}: {
	row: FeedbackEntityStyleOverride
	updateRow: (override: FeedbackEntityStyleOverride) => void
	localVariablesStore: LocalVariablesStore | null
	feedbackType: FeedbackEntitySubType | null | undefined
}) {
	const { styleStore } = useLayeredStyleElementsContext()

	const selectedElement = row.elementId ? styleStore.findElementById(row.elementId) : null
	const selectedSchema = selectedElement?.type ? elementSchemas[selectedElement.type] : null
	const selectedProperty = selectedSchema?.find((prop) => prop.id === row.elementProperty)

	const setValue = useCallback(
		(value: any) => {
			updateRow({ ...row, override: { ...row.override, value } })
		},
		[row, updateRow]
	)

	const setIsExpression = useCallback(
		(isExpression: boolean) => {
			updateRow({ ...row, override: { ...row.override, isExpression } })
		},
		[row, updateRow]
	)

	// If no property is selected, return null
	if (!selectedProperty) {
		return null
	}

	// For advanced feedbacks, show a dropdown with ButtonStyleProperties instead of freeform input
	switch (feedbackType) {
		case FeedbackEntitySubType.Advanced:
			return <DropdownInputField choices={ButtonStyleProperties} value={row.override.value} setValue={setValue} />
		case FeedbackEntitySubType.Boolean:
			// For boolean feedbacks, show a dropdown with "true" and "false"
			return (
				<ExpressionFieldControl
					value={row.override}
					setValue={setValue}
					setIsExpression={setIsExpression}
					localVariablesStore={localVariablesStore}
				>
					{(value, setValue) => (
						<OptionsInputControl
							allowInternalFields={true}
							isLocatedInGrid={false}
							entityType={EntityModelType.Feedback}
							option={selectedProperty}
							value={value}
							setValue={(_key: string, val: any) => setValue(val)}
							readonly={false}
							localVariablesStore={localVariablesStore}
						/>
					)}
				</ExpressionFieldControl>
			)
		case FeedbackEntitySubType.StyleOverride:
		case FeedbackEntitySubType.Value:
		case undefined:
		case null:
			return <p>Unsupported feedback type</p>
		default:
			assertNever(feedbackType)
			return <p>Unsupported feedback type</p>
	}
})
