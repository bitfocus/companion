import type { EntityOwner, SomeEntityModel, EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import React from 'react'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { EntityTableRow, EntityTableRowContent } from './EntityEditorRow.js'
import { EntityDropPlaceholderZone, type EntityListDragItem } from './EntityListDropZone.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityEditorHeading } from './EntityEditorHeadingProps.js'
import { AddEntityPanel } from './AddEntityPanel.js'
import { observer } from 'mobx-react-lite'
import { useEntityEditorContext } from './EntityEditorContext.js'
import { useDragLayer } from 'react-dnd'

interface EditableEntityListProps {
	heading: JSX.Element | string | null
	headingActions?: JSX.Element[]
	subheading?: JSX.Element | string | null
	entities: SomeEntityModel[] | undefined
	ownerId: EntityOwner | null
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
}
export const EditableEntityList = observer(function EditableEntityList({
	heading,
	headingActions,
	subheading,
	entities,
	ownerId,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: EditableEntityListProps) {
	return (
		<>
			<EntityEditorHeading
				heading={heading}
				ownerId={ownerId}
				childEntityIds={entities?.map((f) => f.id) ?? []}
				headingActions={headingActions}
			/>

			{subheading}

			<MinimalEntityList
				ownerId={ownerId}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				feedbackListType={feedbackListType}
				entities={entities}
			/>
			<AddEntityPanel
				ownerId={ownerId}
				entityType={entityType}
				feedbackListType={feedbackListType}
				entityTypeLabel={entityTypeLabel}
			/>
		</>
	)
})

interface MinimalEntityListProps {
	ownerId: EntityOwner | null
	entities: SomeEntityModel[] | undefined
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
}

export const MinimalEntityList = observer(function MinimalEntityList({
	ownerId,
	entities,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: MinimalEntityListProps) {
	const { controlId } = useEntityEditorContext()
	const dragId = `${controlId}_${entityType}`

	return (
		<>
			<EntityListDragLayer
				entities={entities}
				dragId={dragId}
				ownerId={ownerId}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				feedbackListType={feedbackListType}
			/>
			<table className="table entity-table">
				<tbody>
					{entities &&
						entities.map((a, i) => (
							<MyErrorBoundary key={a?.id ?? i}>
								<EntityTableRow
									key={a?.id ?? i}
									ownerId={ownerId}
									entity={a}
									index={i}
									dragId={dragId}
									entityType={entityType}
									entityTypeLabel={entityTypeLabel}
									feedbackListType={feedbackListType}
								/>
							</MyErrorBoundary>
						))}

					<EntityDropPlaceholderZone
						dragId={dragId}
						ownerId={ownerId}
						entityCount={entities ? entities.length : 0}
						entityTypeLabel={entityTypeLabel}
					/>
				</tbody>
			</table>
		</>
	)
})

interface EntityListDragLayerProps {
	entities: SomeEntityModel[] | undefined
	dragId: string
	ownerId: EntityOwner | null
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
}

const EntityListDragLayer = observer(function EntityListDragLayer({
	entities,
	dragId,
	ownerId,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: EntityListDragLayerProps): JSX.Element | null {
	const { isDragging, item, currentOffset } = useDragLayer<{
		isDragging: boolean
		item: EntityListDragItem | null
		currentOffset: { x: number; y: number } | null
	}>((monitor) => ({
		isDragging: monitor.isDragging() && monitor.getItemType() === dragId,
		item: monitor.getItem(),
		currentOffset: monitor.getSourceClientOffset(),
	}))

	if (!isDragging || !item || !currentOffset) {
		return null
	}

	// Find the entity being dragged
	const entity = entities?.find((e) => e.id === item.entityId)
	if (!entity) return null

	return (
		<div
			className="entity-list-drag-layer"
			style={{
				position: 'fixed',
				pointerEvents: 'none',
				zIndex: 100,
				left: 0,
				top: 0,
				transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)`,
				width: item.elementWidth,
			}}
		>
			<table className="table entity-table">
				<tbody>
					<EntityTableRowContent
						ownerId={ownerId}
						entityTypeLabel={entityTypeLabel}
						entity={entity}
						feedbackListType={feedbackListType}
						entityType={entityType}
						isDragging={true}
						rowRef={null}
						dragRef={null}
					/>
				</tbody>
			</table>
		</div>
	)
})
