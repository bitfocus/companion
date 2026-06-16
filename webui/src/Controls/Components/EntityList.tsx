import { observer } from 'mobx-react-lite'
import { useRef } from 'react'
import { useDragLayer } from 'react-dnd'
import { useResizeObserver } from 'usehooks-ts'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { EntityModelType, EntityOwner, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { AddEntityPanel } from './AddEntityPanel.js'
import { useEntityEditorContext } from './EntityEditorContext.js'
import { EntityEditorHeading } from './EntityEditorHeadingProps.js'
import { EntityTableRow, EntityTableRowContent } from './EntityEditorRow.js'
import { EntityDropPlaceholderZone, type EntityListDragItem } from './EntityListDropZone.js'
import { EntityListHeightCacheProvider, useEntityListHeightCache } from './EntityListHeightCacheContext.js'

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

export const MinimalEntityList = observer(function MinimalEntityList(props: MinimalEntityListProps) {
	return (
		<EntityListHeightCacheProvider>
			<MinimalEntityListContents {...props} />
		</EntityListHeightCacheProvider>
	)
})

const MinimalEntityListContents = observer(function MinimalEntityListContents({
	ownerId,
	entities,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: MinimalEntityListProps) {
	const { controlId } = useEntityEditorContext()
	const dragId = `${controlId}_${entityType}`

	// Cached row heights become stale when the list width changes (option fields reflow), so drop
	// them on a width change. Mounted rows re-measure immediately; placeholders correct on scroll-in.
	const heightCache = useEntityListHeightCache()
	const listRef = useRef<HTMLDivElement>(null)
	const lastWidthRef = useRef<number | undefined>(undefined)
	useResizeObserver({
		ref: listRef,
		box: 'border-box',
		onResize: ({ width }) => {
			if (width == null) return
			if (lastWidthRef.current != null && Math.abs(lastWidthRef.current - width) > 1) {
				heightCache.clear()
			}
			lastWidthRef.current = width
		},
	})

	return (
		<>
			<EntityListDragLayer
				entities={entities}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				feedbackListType={feedbackListType}
			/>
			<div className="entity-list" ref={listRef}>
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
			</div>
		</>
	)
})

interface EntityListDragLayerProps {
	entities: SomeEntityModel[] | undefined
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
}

const EntityListDragLayer = observer(function EntityListDragLayer({
	entities,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: EntityListDragLayerProps): JSX.Element | null {
	const { isDragging, item, currentOffset } = useDragLayer<{
		isDragging: boolean
		item: EntityListDragItem | null
		currentOffset: { x: number; y: number } | null
	}>((monitor) => ({
		isDragging: monitor.isDragging(),
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
			<EntityTableRowContent
				entity={entity}
				ownerId={item.ownerId}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				feedbackListType={feedbackListType}
				isDragging={true}
				rowRef={null}
				dragRef={null}
				disableLazyMount={true}
			/>
		</div>
	)
})
