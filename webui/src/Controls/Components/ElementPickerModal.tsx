import React, { useCallback, useState } from 'react'
import { elementSchemas } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type { FeedbackEntityStyleOverride } from '@companion-app/shared/Model/EntityModel.js'
import { Button } from '~/Components/Button.js'
import { Modal } from '~/Components/Modal.js'
import { ElementPicker } from './ElementPicker.js'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'

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

	const onOpenChange = useCallback(
		(open: boolean) => {
			if (!open) onClose()
		},
		[onClose]
	)
	const onOpenChangeComplete = useCallback((open: boolean) => {
		if (!open) {
			// Clear values when canceling
			setSelectedElementId(null)
			setSelectedProperty(null)
		}
	}, [])

	const handleElementSelect = useCallback((elementId: string) => setSelectedElementId(elementId), [])

	const handlePropertySelect = useCallback((propertyId: string) => {
		setSelectedProperty(propertyId)
	}, [])

	const canSave = !!selectedElement && !!selectedSchema?.find((p) => p.id === selectedProperty2)

	return (
		<Modal.Root open={isOpen} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" className="layered-style-element-picker-modal">
						<Modal.Header closeButton>
							<Modal.Title>Select Override Element and Property</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<ElementPicker
								selectedElementId={selectedElementId2}
								selectedSchema={selectedSchema}
								selectedProperties={selectedProperty2 ? [selectedProperty2] : []}
								onElementSelect={handleElementSelect}
								onPropertySelect={handlePropertySelect}
								allowMultipleProperties={false}
							/>
						</Modal.Body>
						<Modal.Footer>
							<Modal.Close>Cancel</Modal.Close>

							<Button color="primary" onClick={handleSave} disabled={!canSave}>
								Save
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
