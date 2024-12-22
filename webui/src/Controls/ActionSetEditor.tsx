import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { MyErrorBoundary, checkDragState } from '../util.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider, usePanelCollapseHelperContextForPanel } from '../Helpers/CollapseHelper.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import {
	EntityModelType,
	EntityOwner,
	SomeEntityModel,
	SomeSocketEntityLocation,
	stringifySocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { findAllEntityIdsDeep, stringifyEntityOwnerId } from './Util.js'
import {
	IEntityEditorService,
	useControlEntitiesEditorService,
	useControlEntityService,
} from '../Services/Controls/ControlEntitiesService.js'
import { EntityDropPlaceholderZone, EntityListDragItem } from './Components/EntityListDropZone.js'
import { EntityRowHeader } from './Components/EntityCellControls.js'
import { AddEntityPanel } from './Components/AddEntityPanel.js'
import { EntityCommonCells } from './Components/EntityCommonCells.js'
import { EntityEditorHeading } from './Components/EntityEditorHeadingProps.js'
import { EntityManageChildGroups } from './Components/EntityChildGroup.js'

interface ControlActionSetEditorProps {
	controlId: string
	location: ControlLocation | undefined
	listId: SomeSocketEntityLocation
	actions: SomeEntityModel[] | undefined
	heading: JSX.Element | string
	headingActions?: JSX.Element[]
}

export const ControlActionSetEditor = observer(function ControlActionSetEditor({
	controlId,
	location,
	listId,
	actions,
	heading,
	headingActions,
}: ControlActionSetEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const actionsService = useControlEntitiesEditorService(
		controlId,
		listId,
		'action',
		EntityModelType.Action,
		confirmModal
	)

	const actionIds = useMemo(() => findAllEntityIdsDeep(actions ?? []), [actions])

	return (
		<div className="action-category">
			<PanelCollapseHelperProvider
				storageId={`actions_${controlId}_${stringifySocketEntityLocation(listId)}`}
				knownPanelIds={actionIds}
			>
				<GenericConfirmModal ref={confirmModal} />

				<InlineActionList
					controlId={controlId}
					heading={heading}
					headingActions={headingActions}
					actions={actions}
					location={location}
					actionsService={actionsService}
					ownerId={null}
				/>
			</PanelCollapseHelperProvider>
		</div>
	)
})

interface InlineActionListProps {
	controlId: string
	heading: JSX.Element | string | null
	headingActions?: JSX.Element[]
	actions: SomeEntityModel[] | undefined
	location: ControlLocation | undefined
	actionsService: IEntityEditorService
	ownerId: EntityOwner | null
}
export function InlineActionList({
	controlId,
	heading,
	headingActions,
	actions,
	location,
	actionsService,
	ownerId,
}: InlineActionListProps) {
	const addAction = useCallback(
		(connectionId: string, definitionId: string) => actionsService.addEntity(connectionId, definitionId, ownerId),
		[actionsService, ownerId]
	)

	return (
		<>
			<EntityEditorHeading
				heading={heading}
				ownerId={ownerId}
				childEntityIds={actions?.map((f) => f.id) ?? []}
				headingActions={headingActions}
			/>

			<ActionsList
				location={location}
				controlId={controlId}
				ownerId={ownerId}
				dragId={`${controlId}_actions`}
				actions={actions}
				actionsService={actionsService}
			/>
			<AddEntityPanel
				addEntity={addAction}
				entityType={EntityModelType.Action}
				onlyFeedbackType={null}
				entityTypeLabel={'action'}
			/>
		</>
	)
}

interface ActionsListProps {
	location: ControlLocation | undefined
	controlId: string
	ownerId: EntityOwner | null
	dragId: string
	actions: SomeEntityModel[] | undefined
	actionsService: IEntityEditorService
	readonly?: boolean
}

export function ActionsList({
	location,
	controlId,
	ownerId,
	dragId,
	actions,
	actionsService,
	readonly,
}: ActionsListProps) {
	return (
		<table className="table action-table">
			<tbody>
				{actions &&
					actions.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<ActionTableRow
								key={a?.id ?? i}
								controlId={controlId}
								ownerId={ownerId}
								location={location}
								action={a}
								index={i}
								dragId={dragId}
								serviceFactory={actionsService}
								readonly={readonly ?? false}
							/>
						</MyErrorBoundary>
					))}

				<EntityDropPlaceholderZone
					dragId={dragId}
					ownerId={ownerId}
					listId={actionsService.listId}
					entityCount={actions ? actions.length : 0}
					entityTypeLabel="action"
					moveCard={actionsService.moveCard}
				/>
			</tbody>
		</table>
	)
}

interface ActionTableRowDragItem extends EntityListDragItem {}
interface ActionTableRowDragStatus {
	isDragging: boolean
}

interface ActionTableRowProps {
	action: SomeEntityModel
	controlId: string
	ownerId: EntityOwner | null
	location: ControlLocation | undefined
	index: number
	dragId: string
	serviceFactory: IEntityEditorService

	readonly: boolean
}

const ActionTableRow = observer(function ActionTableRow({
	action,
	controlId,
	ownerId,
	location,
	index,
	dragId,
	serviceFactory,
	readonly,
}: ActionTableRowProps): JSX.Element | null {
	const { actionDefinitions, connections } = useContext(RootAppStoreContext)

	const service = useControlEntityService(serviceFactory, action)

	const actionSpec = actionDefinitions.connections.get(action.connectionId)?.get(action.definitionId)

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<ActionTableRowDragItem>({
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
			const hoverId = action.id

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

			// Time to actually perform the action
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
	const [{ isDragging }, drag, preview] = useDrag<ActionTableRowDragItem, unknown, ActionTableRowDragStatus>({
		type: dragId,
		canDrag: !readonly,
		item: {
			entityId: action.id,
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

	const { isCollapsed, setCollapsed } = usePanelCollapseHelperContextForPanel(
		stringifyEntityOwnerId(ownerId),
		action.id
	)

	const canSetHeadline = !!service.setHeadline
	const headline = action.headline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

	if (!action) {
		// Invalid action, so skip
		return null
	}

	const connectionInfo = connections.getInfo(action.connectionId)
	// const module = instance ? modules[instance.instance_type] : undefined
	const connectionLabel = connectionInfo?.label ?? action.connectionId

	const definitionName = actionSpec
		? `${connectionLabel}: ${actionSpec.label}`
		: `${connectionLabel}: ${action.definitionId} (undefined)`

	return (
		<tr ref={ref} className={isDragging ? 'actionlist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td style={{ paddingRight: 0 }}>
				<EntityRowHeader
					service={service}
					entityTypeLabel="action"
					entity={action}
					isPanelCollapsed={isCollapsed}
					setPanelCollapsed={setCollapsed}
					definitionName={definitionName}
					canSetHeadline={canSetHeadline}
					headlineExpanded={headlineExpanded}
					setHeadlineExpanded={doEditHeadline}
					readonly={readonly}
				/>

				{!isCollapsed && (
					<div className="editor-grid">
						<EntityCommonCells
							entity={action}
							entityType={EntityModelType.Action}
							onlyFeedbackType={null}
							entityDefinition={actionSpec}
							service={service}
							headlineExpanded={headlineExpanded}
							definitionName={definitionName}
							location={location}
						/>

						<EntityManageChildGroups
							entity={action}
							entityDefinition={actionSpec}
							controlId={controlId}
							location={location}
							serviceFactory={serviceFactory}
						/>
					</div>
				)}
			</td>
		</tr>
	)
})
