import { CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'
import { elementSchemas } from '../../Buttons/EditButton/LayeredButtonEditor/ElementPropertiesSchemas.js'
import { ElementPicker } from './ElementPicker.js'
import { FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'

interface AddElementPickerModalProps {
	isOpen: boolean
	onClose: () => void
	onSave: (elementId: string, properties: string[]) => void
	feedbackType: FeedbackEntitySubType | null | undefined
}

export function AddElementPickerModal({
	isOpen,
	onClose,
	onSave,
	feedbackType,
}: AddElementPickerModalProps): React.JSX.Element {
	const { styleStore } = useLayeredStyleElementsContext()
	const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
	const [selectedProperties, setSelectedProperties] = useState<string[]>([])

	const selectedElement = selectedElementId ? styleStore.findElementById(selectedElementId) : null
	let selectedSchema = selectedElement?.type ? elementSchemas[selectedElement.type] : null

	if (selectedSchema && selectedElement?.type === 'image' && feedbackType === FeedbackEntitySubType.Advanced) {
		selectedSchema = [
			...selectedSchema,
			{
				type: 'checkbox',
				default: false,
				id: 'imageBuffers',
				label: 'Image Buffers (Deprecated)',
			},
		]
	}

	const handleSave = useCallback(() => {
		if (selectedElementId && selectedProperties.length > 0) {
			onSave(selectedElementId, selectedProperties)
		}
	}, [selectedElementId, selectedProperties, onSave])

	const handleClose = useCallback(() => {
		// Clear values when canceling
		setSelectedElementId(null)
		setSelectedProperties([])
		onClose()
	}, [onClose])

	const handleElementSelect = useCallback((elementId: string) => {
		setSelectedElementId(elementId)
		// Clear selected properties when element changes
		setSelectedProperties([])
	}, [])

	const handlePropertySelect = useCallback((propertyId: string) => {
		setSelectedProperties((prev) => {
			if (prev.includes(propertyId)) {
				// Remove property if already selected
				return prev.filter((id) => id !== propertyId)
			} else {
				// Add property if not selected
				return [...prev, propertyId]
			}
		})
	}, [])

	const canSave =
		!!selectedElement && selectedProperties.filter((propId) => selectedSchema?.find((p) => p.id === propId)).length > 0

	return (
		<CModal visible={isOpen} onClose={handleClose} size="lg" className="layered-style-element-picker-modal">
			<CModalHeader>
				<CModalTitle>Add Element Properties</CModalTitle>
			</CModalHeader>
			<CModalBody>
				<ElementPicker
					selectedElementId={selectedElementId}
					selectedSchema={selectedSchema}
					selectedProperties={selectedProperties}
					onElementSelect={handleElementSelect}
					onPropertySelect={handlePropertySelect}
					allowMultipleProperties={true}
				/>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={handleClose}>
					<FontAwesomeIcon icon={faTimes} /> Cancel
				</CButton>
				<CButton color="primary" onClick={handleSave} disabled={!canSave}>
					<FontAwesomeIcon icon={faCheck} /> Add Properties
				</CButton>
			</CModalFooter>
		</CModal>
	)
}
