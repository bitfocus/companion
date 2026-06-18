import { pointerIntersection } from '@dnd-kit/collision'
import { useSortable } from '@dnd-kit/react/sortable'
import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	type EntityModelType,
	type EntityOwner,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { LearnButton } from '~/Components/LearnButton.js'
import { usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import { useLazyMountWithHeight } from '~/Hooks/useLazyMountWithHeight.js'
import { useControlEntityService } from '~/Services/Controls/ControlEntitiesService.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { stringifyEntityOwnerId } from '../Util.js'
import { EntityRowHeader } from './EntityCellControls.js'
import { EntityManageChildGroups } from './EntityChildGroup.js'
import { EntityCommonCells } from './EntityCommonCells.js'
import { useEntityEditorContext } from './EntityEditorContext.js'
import { entityGroupKey, EntityNestingLevelContext, type EntityDragData } from './EntityListDnd.js'

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
	const nestingLevel = useContext(EntityNestingLevelContext)

	// The sortable `group` is the list+owner this entity belongs to, so dnd-kit can move entities
	// between nested groups and between action lists (which share the `dragId` type). The actual
	// move is applied on hover in useEntityListReorderMonitor.
	//
	// TODO: entities use a deliberately limited dnd setup. Their nested lists render as separate DOM
	// containers, and dnd-kit's optimistic sorting physically moves nodes between containers, which
	// corrupts React's tree (duplicated rows / "removeChild" errors) once the async mobx update lands.
	// OptimisticSortingPlugin is registered globally and can't be removed per-sortable, so it is blocked
	// for entity drags in SortableHysteresis instead; the move is applied on hover via
	// useEntityListReorderMonitor, and the drag preview comes from a <DragOverlay> (EntityDragLayer)
	// rather than a clone of the source row - so dnd-kit never clones/moves the source and React stays
	// in control. A proper fix is to rebuild the entity editor as a single flat container (like the
	// layered ElementsList) so optimistic sorting + drop animations can be re-enabled. See also the
	// matching TODO in useEntityListReorderMonitor.ts. The `data` is read by EntityDragLayer.
	const dragData: EntityDragData = { kind: 'entity', entity, entityTypeLabel }
	const { ref, handleRef, isDragging } = useSortable({
		id: entity.id,
		index,
		type: dragId,
		accept: dragId,
		group: entityGroupKey(serviceFactory.listId, ownerId),
		data: dragData,
		disabled: readonly,
		// Pointer-based collision (not the default area/shape detector) so the target is exactly the row
		// under the cursor: lets the cursor reach the last row (to drop at the end) and hit the small
		// nested child-group rows/dropzones, which the area detector skips in favour of bigger targets.
		collisionDetector: pointerIntersection,
		// A nested child row sits inside its parent row's droppable, so both collide when the pointer is
		// over the child. Deeper rows get a higher priority so the innermost one wins. Spaced by 2 to
		// leave room for the children-area shield in between (see EntityNestingLevelContext).
		collisionPriority: nestingLevel * 2,
	})

	if (!entity) {
		// Invalid entity, so skip
		return null
	}

	return (
		<EntityTableRowContent
			entity={entity}
			ownerId={ownerId}
			entityType={entityType}
			entityTypeLabel={entityTypeLabel}
			feedbackListType={feedbackListType}
			isDragging={isDragging}
			rowRef={ref}
			dragRef={handleRef}
			disableLazyMount={false}
		/>
	)
})

interface EntityTableRowContentProps {
	entity: SomeEntityModel
	ownerId: EntityOwner | null

	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']

	isDragging?: boolean
	rowRef: (element: Element | null) => void
	dragRef: (element: Element | null) => void

	/** Force the expanded content to always render (e.g. when used as a drag preview) */
	disableLazyMount: boolean
}

export const EntityTableRowContent = observer(function EntityTableRowContent({
	entity,
	ownerId,
	entityType,
	entityTypeLabel,
	feedbackListType,
	isDragging,
	rowRef,
	dragRef,
	disableLazyMount,
}: EntityTableRowContentProps): React.JSX.Element {
	return (
		<div
			ref={rowRef}
			className={classNames('entity-row', {
				'entity-disabled': !!entity.disabled,
				'entity-row-grabbing': isDragging,
			})}
		>
			<div ref={dragRef} className="entity-row-reorder">
				<FontAwesomeIcon icon={faSort} />
			</div>
			<div className="entity-row-content">
				{entity.type === entityType ? (
					<EntityEditorRowContent
						ownerId={ownerId}
						entityTypeLabel={entityTypeLabel}
						entity={entity}
						feedbackListType={feedbackListType}
						disableLazyMount={disableLazyMount}
					/>
				) : (
					<p>Entity is not a {entityTypeLabel}!</p>
				)}
			</div>
		</div>
	)
})

interface EntityEditorRowContentProps {
	ownerId: EntityOwner | null
	entityTypeLabel: string
	entity: SomeEntityModel
	feedbackListType: ClientEntityDefinition['feedbackType']
	disableLazyMount: boolean
}

export const EntityEditorRowContent = observer(function EntityEditorRowContent({
	ownerId,
	entityTypeLabel,
	entity,
	feedbackListType,
	disableLazyMount,
}: EntityEditorRowContentProps) {
	const { serviceFactory, readonly, localVariablePrefix } = useEntityEditorContext()
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
				ownerId={ownerId}
				isPanelCollapsed={isCollapsed}
				setPanelCollapsed={setCollapsed}
				definitionName={definitionName}
				canSetHeadline={canSetHeadline}
				headlineExpanded={headlineExpanded}
				setHeadlineExpanded={doEditHeadline}
				readonly={readonly}
				localVariablePrefix={localVariablePrefix}
			/>

			{!isCollapsed && (
				<LazyEditorGrid entity={entity} disableLazyMount={disableLazyMount}>
					<div className="cell-description">
						<div className="grow">
							{headlineExpanded && <div className="name">{definitionName}</div>}
							{entityDefinition?.description && <div className="description">{entityDefinition.description || ''}</div>}
						</div>
						{entityDefinition?.hasLearn && !!entityService.performLearn && (
							<div>
								<LearnButton id={entity.id} doLearn={entityService.performLearn} disabled={readonly} />
							</div>
						)}
					</div>

					<EntityCommonCells
						entity={entity}
						entityTypeLabel={entityTypeLabel}
						feedbackListType={feedbackListType}
						entityDefinition={entityDefinition}
						service={entityService}
					/>

					<EntityManageChildGroups entity={entity} entityDefinition={entityDefinition} />
				</LazyEditorGrid>
			)}
		</>
	)
})

interface LazyEditorGridProps {
	entity: SomeEntityModel
	disableLazyMount: boolean
}

/**
 * Wraps the expensive `editor-grid` content (option inputs, expression previews, nested child
 * lists) so it is only mounted while the row is on (or near) screen. When unmounted it reserves
 * the row's last-measured height so scrolling stays stable.
 */
const LazyEditorGrid = observer(function LazyEditorGrid({
	entity,
	disableLazyMount,
	children,
}: React.PropsWithChildren<LazyEditorGridProps>) {
	const defKey = `${entity.connectionId}::${entity.type}::${entity.definitionId}`
	const { setRef, shouldMount, placeholderHeight } = useLazyMountWithHeight(entity.id, defKey, disableLazyMount)

	return (
		<div
			ref={setRef}
			className="editor-grid"
			style={shouldMount ? undefined : { height: placeholderHeight, boxSizing: 'border-box' }}
		>
			{shouldMount ? children : null}
		</div>
	)
})
