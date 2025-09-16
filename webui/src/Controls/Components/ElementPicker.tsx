import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'
import { elementSchemas } from '../../Buttons/EditButton/LayeredButtonEditor/ElementPropertiesSchemas.js'
import classNames from 'classnames'
import { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'

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

interface ElementPickerProps {
	selectedElementId: string | null
	selectedProperties: string[]
	onElementSelect: (elementId: string) => void
	onPropertySelect: (propertyId: string) => void
	allowMultipleProperties?: boolean
}

export function ElementPicker({
	selectedElementId,
	selectedProperties,
	onElementSelect,
	onPropertySelect,
	allowMultipleProperties = false,
}: ElementPickerProps): React.JSX.Element {
	const { styleStore } = useLayeredStyleElementsContext()

	const selectedElement = selectedElementId ? styleStore.findElementById(selectedElementId) : null
	const selectedSchema = selectedElement?.type ? elementSchemas[selectedElement.type] : null

	const isPropertySelected = useCallback(
		(propertyId: string) => {
			return selectedProperties.includes(propertyId)
		},
		[selectedProperties]
	)

	return (
		<>
			<div className="element-modal-col">
				<label className="form-label">Element</label>
				<div className="element-picker-list border rounded">
					{styleStore.elements
						.map((element) => (
							<ElementTreeItem
								key={element.id}
								element={element}
								depth={0}
								selectedElementId={selectedElementId || ''}
								onElementSelect={onElementSelect}
							/>
						))
						.toReversed()}
				</div>
			</div>

			<div className="element-modal-col">
				<label className="form-label">{allowMultipleProperties ? 'Properties (select multiple)' : 'Property'}</label>
				<div className="element-picker-list border rounded">
					{!selectedElementId && <div className="text-muted text-center p-3">Select an element first</div>}
					{selectedElementId && (!selectedSchema || selectedSchema.length === 0) && (
						<div className="text-muted text-center p-3">No properties available for this element</div>
					)}
					{selectedSchema?.map((option) => (
						<PropertyListItem
							key={option.id}
							option={option}
							isSelected={isPropertySelected(option.id)}
							onSelect={onPropertySelect}
						/>
					))}
				</div>
			</div>
		</>
	)
}
