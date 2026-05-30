import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { elementSchemas } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import { Button } from '~/Components/Button.js'
import { Modal } from '~/Components/Modal.js'
import { ElementPicker } from './ElementPicker.js'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'

interface AddElementPickerModalProps {
	onSave: (elementId: string, properties: string[]) => void
}

export function AddElementPickerModal({ onSave }: AddElementPickerModalProps): React.JSX.Element {
	const { styleStore } = useLayeredStyleElementsContext()
	const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
	const [selectedProperties, setSelectedProperties] = useState<string[]>([])

	const [isOpen, setIsOpen] = useState(false)

	const selectedElement = selectedElementId ? styleStore.findElementById(selectedElementId) : null
	const selectedSchema = selectedElement?.type ? elementSchemas[selectedElement.type]?.flatMap((s) => s.fields) : null

	const handleSave = useCallback(() => {
		if (selectedElementId && selectedProperties.length > 0) {
			onSave(selectedElementId, selectedProperties)
		}

		setIsOpen(false)
	}, [selectedElementId, selectedProperties, onSave])

	const onOpenChangeComplete = useCallback((open: boolean) => {
		if (!open) {
			// Clear values when canceling
			setSelectedElementId(null)
			setSelectedProperties([])
		}
	}, [])

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
		<Modal.Root open={isOpen} onOpenChange={setIsOpen} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Trigger size="sm" title="Add override" className="py-0" color={null}>
				<FontAwesomeIcon icon={faPlus} />
			</Modal.Trigger>

			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" className="layered-style-element-picker-modal">
						<Modal.Header closeButton>
							<Modal.Title>Add Element Properties</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<ElementPicker
								selectedElementId={selectedElementId}
								selectedSchema={selectedSchema}
								selectedProperties={selectedProperties}
								onElementSelect={handleElementSelect}
								onPropertySelect={handlePropertySelect}
								allowMultipleProperties={true}
							/>
						</Modal.Body>
						<Modal.Footer>
							<Modal.Close>Cancel</Modal.Close>

							<Button color="primary" onClick={handleSave} disabled={!canSave}>
								Add Properties
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
