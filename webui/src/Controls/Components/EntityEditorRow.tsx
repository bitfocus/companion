import {
	EntityOwner,
	EntityModelType,
	SomeEntityModel,
	stringifySocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { observer } from 'mobx-react-lite'
import React, { useContext, useState, useCallback, useRef } from 'react'
import { usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import { useControlEntityService } from '~/Services/Controls/ControlEntitiesService.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { stringifyEntityOwnerId } from '../Util.js'
import { EntityRowHeader } from './EntityCellControls.js'
import { EntityManageChildGroups } from './EntityChildGroup.js'
import { EntityCommonCells } from './EntityCommonCells.js'
import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useDrop, useDrag } from 'react-dnd'
import { checkDragState } from '~/util.js'
import { EntityListDragItem } from './EntityListDropZone.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { useEntityEditorContext } from './EntityEditorContext.js'

interface EntityTableRowDragStatus {
	isDragging: boolean
}

interface EntityTableRowProps {
	entity: SomeEntityModel
	ownerId: EntityOwner | null
	index: number
	dragId: string

	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
}

export const EntityTableRow = observer(function EntityTableRow({
	entity,
	ownerId,
	index,
	dragId,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: EntityTableRowProps): JSX.Element | null {
	const { serviceFactory, readonly } = useEntityEditorContext()

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<EntityListDragItem>({
		accept: dragId,
		hover(item, monitor) {
			if (!ref.current) {
				return
			}

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			const dragParentId = item.ownerId
			const dragIndex = item.index

			const hoverOwnerId = ownerId
			const hoverIndex = index
			const hoverId = entity.id

			if (!checkDragState(item, monitor, hoverId)) return

			// Don't replace items with themselves
			if (
				item.entityId === hoverId ||
				(dragIndex === hoverIndex &&
					stringifyEntityOwnerId(dragParentId) === stringifyEntityOwnerId(hoverOwnerId) &&
					stringifySocketEntityLocation(item.listId) === stringifySocketEntityLocation(serviceFactory.listId))
			) {
				return
			}

			// Time to actually perform the entity
			serviceFactory.moveCard(item.listId, item.entityId, hoverOwnerId, index)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
			item.listId = serviceFactory.listId
			item.ownerId = hoverOwnerId
		},
		drop(item, _monitor) {
			item.dragState = null
		},
	})
	const [{ isDragging }, drag, preview] = useDrag<EntityListDragItem, unknown, EntityTableRowDragStatus>({
		type: dragId,
		canDrag: !readonly,
		item: {
			entityId: entity.id,
			listId: serviceFactory.listId,
			index: index,
			ownerId: ownerId,
			// ref: ref,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	if (!entity) {
		// Invalid entity, so skip
		return null
	}

	return (
		<tr ref={ref} className={isDragging ? 'entitylist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>
				{entity.type === entityType ? (
					<EntityEditorRowContent
						ownerId={ownerId}
						entityTypeLabel={entityTypeLabel}
						entity={entity}
						feedbackListType={feedbackListType}
					/>
				) : (
					<p>Entity is not a {entityTypeLabel}!</p>
				)}
			</td>
		</tr>
	)
})

interface EntityEditorRowContentProps {
	ownerId: EntityOwner | null
	entityTypeLabel: string
	entity: SomeEntityModel
	feedbackListType: ClientEntityDefinition['feedbackType']
}

export const EntityEditorRowContent = observer(function EntityEditorRowContent({
	ownerId,
	entityTypeLabel,
	entity,
	feedbackListType,
}: EntityEditorRowContentProps) {
	const { serviceFactory, readonly, isLocalVariablesList } = useEntityEditorContext()
	const entityService = useControlEntityService(serviceFactory, entity, entityTypeLabel)

	const { connections, entityDefinitions } = useContext(RootAppStoreContext)

	const connectionInfo = connections.getInfo(entity.connectionId)
	const connectionLabel = connectionInfo?.label ?? entity.connectionId

	const entityDefinition = entityDefinitions.getEntityDefinition(entity.type, entity.connectionId, entity.definitionId)

	const definitionName = entityDefinition
		? `${connectionLabel}: ${entityDefinition.label}`
		: `${connectionLabel}: ${entity.definitionId} (undefined)`

	const canSetHeadline = !!entityService.setHeadline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!entity.headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

	const { isCollapsed, setCollapsed } = usePanelCollapseHelperContextForPanel(
		stringifyEntityOwnerId(ownerId),
		entity.id
	)

	return (
		<>
			<EntityRowHeader
				service={entityService}
				entityTypeLabel={entityTypeLabel}
				entity={entity}
				isPanelCollapsed={isCollapsed}
				setPanelCollapsed={setCollapsed}
				definitionName={definitionName}
				canSetHeadline={canSetHeadline}
				headlineExpanded={headlineExpanded}
				setHeadlineExpanded={doEditHeadline}
				readonly={readonly}
				isLocalVariablesList={isLocalVariablesList}
			/>

			{!isCollapsed && (
				<div className="editor-grid">
					<EntityCommonCells
						entity={entity}
						feedbackListType={feedbackListType}
						entityDefinition={entityDefinition}
						service={entityService}
						headlineExpanded={headlineExpanded}
						definitionName={definitionName}
					/>

					<EntityManageChildGroups entity={entity} entityDefinition={entityDefinition} />
				</div>
			)}
		</>
	)
})
