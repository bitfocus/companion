import { CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'
import { elementSchemas } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import { ElementPicker } from './ElementPicker.js'

interface AddElementPickerModalProps {
	isOpen: boolean
	onClose: () => void
	onSave: (elementId: string, properties: string[]) => void
}

export function AddElementPickerModal({ isOpen, onClose, onSave }: AddElementPickerModalProps): React.JSX.Element {
	const { styleStore } = useLayeredStyleElementsContext()
	const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
	const [selectedProperties, setSelectedProperties] = useState<string[]>([])

	const selectedElement = selectedElementId ? styleStore.findElementById(selectedElementId) : null
	const selectedSchema = selectedElement?.type ? elementSchemas[selectedElement.type] : null

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
