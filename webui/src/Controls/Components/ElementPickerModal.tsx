import type { FeedbackEntityStyleOverride } from '@companion-app/shared/Model/EntityModel.js'
import { CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'
import { elementSchemas } from '../../Buttons/EditButton/LayeredButtonEditor/ElementPropertiesSchemas.js'
import { ElementPicker } from './ElementPicker.js'

interface ElementPickerModalProps {
	isOpen: boolean
	onClose: () => void
	onSave: (override: FeedbackEntityStyleOverride) => void
	currentOverride: FeedbackEntityStyleOverride
}

export function ElementPickerModal({
	isOpen,
	onClose,
	onSave,
	currentOverride,
}: ElementPickerModalProps): React.JSX.Element {
	const { styleStore } = useLayeredStyleElementsContext()
	const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
	const [selectedProperty, setSelectedProperty] = useState<string | null>(null)

	const selectedElementId2 = selectedElementId ?? currentOverride.elementId
	const selectedProperty2 = selectedProperty ?? currentOverride.elementProperty

	const selectedElement = selectedElementId2 ? styleStore.findElementById(selectedElementId2) : null
	const selectedSchema = selectedElement?.type ? elementSchemas[selectedElement.type] : null

	const handleSave = useCallback(() => {
		if (selectedElementId2 && selectedProperty2) {
			onSave({
				...currentOverride,
				elementId: selectedElementId2,
				elementProperty: selectedProperty2,
			})
		}
	}, [selectedElementId2, selectedProperty2, currentOverride, onSave])

	const handleClose = useCallback(() => {
		// Clear values when canceling
		setSelectedElementId(null)
		setSelectedProperty(null)
		onClose()
	}, [onClose])

	const handleElementSelect = useCallback((elementId: string) => setSelectedElementId(elementId), [])

	const handlePropertySelect = useCallback((propertyId: string) => {
		setSelectedProperty(propertyId)
	}, [])

	const canSave = !!selectedElement && !!selectedSchema?.find((p) => p.id === selectedProperty2)

	return (
		<CModal visible={isOpen} onClose={handleClose} size="lg" className="layered-style-element-picker-modal">
			<CModalHeader>
				<CModalTitle>Select Override Element and Property</CModalTitle>
			</CModalHeader>
			<CModalBody>
				<ElementPicker
					selectedElementId={selectedElementId2}
					selectedSchema={selectedSchema}
					selectedProperties={selectedProperty2 ? [selectedProperty2] : []}
					onElementSelect={handleElementSelect}
					onPropertySelect={handlePropertySelect}
					allowMultipleProperties={false}
				/>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={handleClose}>
					<FontAwesomeIcon icon={faTimes} /> Cancel
				</CButton>
				<CButton color="primary" onClick={handleSave} disabled={!canSave}>
					<FontAwesomeIcon icon={faCheck} /> Save
				</CButton>
			</CModalFooter>
		</CModal>
	)
}
