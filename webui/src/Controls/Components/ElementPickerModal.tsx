import { FeedbackEntityStyleOverride } from '@companion-app/shared/Model/EntityModel.js'
import { CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'
import { elementSchemas } from '../../Buttons/EditButton/LayeredButtonEditor/ElementPropertiesSchemas.js'
import classNames from 'classnames'
import { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'

interface ElementPickerModalProps {
	isOpen: boolean
	onClose: () => void
	onSave: (override: FeedbackEntityStyleOverride) => void
	currentOverride: FeedbackEntityStyleOverride
}

interface PropertyListItemProps {
	option: SomeCompanionInputField
	isSelected: boolean
	onSelect: (value: string) => void
}

function PropertyListItem({ option, isSelected, onSelect }: PropertyListItemProps): React.JSX.Element {
	return (
		<div
			className={classNames(`element-picker-item`, {
				selected: isSelected,
			})}
			onClick={() => onSelect(option.id)}
		>
			<div className="element-name">{option.label || option.id}</div>
			<div className="element-icon">{isSelected && <FontAwesomeIcon icon={faCheck} />}</div>
		</div>
	)
}

interface ElementTreeItemProps {
	element: any
	depth: number
	selectedElementId: string
	onElementSelect: (elementId: string) => void
}

function ElementTreeItem({
	element,
	depth,
	selectedElementId,
	onElementSelect,
}: ElementTreeItemProps): React.JSX.Element {
	const isSelected = element.id === selectedElementId

	return (
		<>
			<div
				className={classNames(`element-picker-item`, {
					selected: isSelected,
				})}
				style={{
					// @ts-expect-error custom variable
					'--elementlist-depth': depth,
				}}
				onClick={() => onElementSelect(element.id)}
			>
				<div className="element-name">{element.name || element.id}</div>
				<div className="element-icon">{isSelected && <FontAwesomeIcon icon={faCheck} />}</div>
			</div>
			{element.type === 'group' &&
				element.children &&
				element.children
					.map((child: any) => (
						<ElementTreeItem
							key={child.id}
							element={child}
							depth={depth + 1}
							selectedElementId={selectedElementId}
							onElementSelect={onElementSelect}
						/>
					))
					.toReversed()}
		</>
	)
}

export function ElementPickerModal({
	isOpen,
	onClose,
	onSave,
	currentOverride,
}: ElementPickerModalProps): React.JSX.Element {
	const { styleStore } = useLayeredStyleElementsContext()
	const [selectedElementId, setSelectedElementId] = useState(currentOverride.elementId)
	const [selectedProperty, setSelectedProperty] = useState(currentOverride.elementProperty)

	const selectedElement = selectedElementId ? styleStore.findElementById(selectedElementId) : null
	const selectedSchema = selectedElement?.type ? elementSchemas[selectedElement.type] : null

	const handleSave = useCallback(() => {
		if (selectedElementId && selectedProperty) {
			onSave({
				...currentOverride,
				elementId: selectedElementId,
				elementProperty: selectedProperty,
			})
		}
	}, [selectedElementId, selectedProperty, currentOverride, onSave])

	const handleClose = useCallback(() => {
		// Reset to current values when canceling
		setSelectedElementId(currentOverride.elementId)
		setSelectedProperty(currentOverride.elementProperty)
		onClose()
	}, [currentOverride, onClose])

	const handleElementSelect = useCallback((elementId: string) => setSelectedElementId(elementId), [])

	const canSave = !!selectedElement && !!selectedSchema?.find((p) => p.id === selectedProperty)

	return (
		<CModal visible={isOpen} onClose={handleClose} size="lg" className="layered-style-element-picker-modal">
			<CModalHeader>
				<CModalTitle>Select Element and Property</CModalTitle>
			</CModalHeader>
			<CModalBody>
				<div className="row">
					<div className="col-md-6">
						<label className="form-label">Element</label>
						<div className="element-picker-list border rounded">
							{styleStore.elements
								.map((element) => (
									<ElementTreeItem
										key={element.id}
										element={element}
										depth={0}
										selectedElementId={selectedElementId}
										onElementSelect={handleElementSelect}
									/>
								))
								.toReversed()}
						</div>
					</div>

					<div className="col-md-6">
						<label className="form-label">Property</label>
						<div className="element-picker-list border rounded">
							{!selectedElementId && <div className="text-muted text-center p-3">Select an element first</div>}
							{selectedElementId && (!selectedSchema || selectedSchema.length === 0) && (
								<div className="text-muted text-center p-3">No properties available for this element</div>
							)}
							{selectedSchema?.map((option) => (
								<PropertyListItem
									key={option.id}
									option={option}
									isSelected={selectedProperty === option.id}
									onSelect={setSelectedProperty}
								/>
							))}
						</div>
					</div>
				</div>
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
