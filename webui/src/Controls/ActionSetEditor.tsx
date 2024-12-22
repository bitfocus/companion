import { CButton, CForm, CButtonGroup } from '@coreui/react'
import { faSort, faExpandArrowsAlt, faCompressArrowsAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { MyErrorBoundary, PreventDefaultHandler, checkDragState } from '../util.js'
import { OptionsInputField } from './OptionsInputField.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import {
	PanelCollapseHelperProvider,
	usePanelCollapseHelperContext,
	usePanelCollapseHelperContextForPanel,
} from '../Helpers/CollapseHelper.js'
import { OptionButtonPreview } from './OptionButtonPreview.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible.js'
import { LearnButton } from '../Components/LearnButton.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import classNames from 'classnames'
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
import { EntityCellLeftMain } from './Components/EntityCellLeftMain.js'

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
					listId={listId}
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
	listId: SomeSocketEntityLocation
	actionsService: IEntityEditorService
	ownerId: EntityOwner | null
}
function InlineActionList({
	controlId,
	heading,
	headingActions,
	actions,
	location,
	listId,
	actionsService,
	ownerId,
}: InlineActionListProps) {
	const panelCollapseHelper = usePanelCollapseHelperContext()

	const addAction = useCallback(
		(connectionId: string, definitionId: string) => actionsService.addEntity(connectionId, definitionId, ownerId),
		[actionsService, ownerId]
	)

	const childActionIds = actions?.map((f) => f.id) ?? []

	const ownerIdString = stringifyEntityOwnerId(ownerId)

	return (
		<>
			<h5>
				{heading}

				<CButtonGroup className="right">
					{actions && actions.length >= 1 && panelCollapseHelper.canExpandAll(ownerIdString, childActionIds) && (
						<CButton
							color="white"
							size="sm"
							onClick={() => panelCollapseHelper.setAllExpanded(ownerIdString, childActionIds)}
							title="Expand all"
						>
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>
					)}
					{actions && actions.length >= 1 && panelCollapseHelper.canCollapseAll(ownerIdString, childActionIds) && (
						<CButton
							color="white"
							size="sm"
							onClick={() => panelCollapseHelper.setAllCollapsed(ownerIdString, childActionIds)}
							title="Collapse all"
						>
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</CButton>
					)}
					{headingActions || ''}
				</CButtonGroup>
			</h5>

			<ActionsList
				location={location}
				controlId={controlId}
				ownerId={ownerId}
				dragId={`${controlId}_actions`}
				listId={listId}
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
	listId: SomeSocketEntityLocation
	actions: SomeEntityModel[] | undefined
	actionsService: IEntityEditorService
	readonly?: boolean
}

export function ActionsList({
	location,
	controlId,
	ownerId,
	dragId,
	listId,
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
								listId={listId}
								dragId={dragId}
								serviceFactory={actionsService}
								readonly={readonly ?? false}
							/>
						</MyErrorBoundary>
					))}

				<EntityDropPlaceholderZone
					dragId={dragId}
					ownerId={ownerId}
					listId={listId}
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
	listId: SomeSocketEntityLocation
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
	listId,
	location,
	index,
	dragId,
	serviceFactory,
	readonly,
}: ActionTableRowProps): JSX.Element | null {
	const { actionDefinitions, connections } = useContext(RootAppStoreContext)

	const service = useControlEntityService(serviceFactory, action)

	const actionSpec = actionDefinitions.connections.get(action.connectionId)?.get(action.definitionId)

	const [actionOptions, optionVisibility] = useOptionsAndIsVisible(actionSpec?.options, action?.options)

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
					stringifySocketEntityLocation(item.listId) === stringifySocketEntityLocation(listId))
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
			item.listId = listId
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
			listId: listId,
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

	const showButtonPreview = action?.connectionId === 'internal' && actionSpec?.showButtonPreview

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
						<div
							className={classNames('cell-description', {
								'no-options': actionOptions.length === 0,
							})}
						>
							{headlineExpanded && <p className="name">{definitionName}</p>}
							<div className="description">{actionSpec?.description}</div>
						</div>

						{showButtonPreview && (
							<div className="cell-button-preview">
								<OptionButtonPreview location={location} options={action.options} />
							</div>
						)}

						<EntityCellLeftMain entityConnectionId={action.connectionId} setConnectionId={service.setConnection} />

						<div className="cell-actions">
							{actionSpec?.hasLearn && service.performLearn && (
								<LearnButton id={action.id} disabled={readonly} doLearn={service.performLearn} />
							)}
						</div>

						<div className="cell-option">
							<CForm onSubmit={PreventDefaultHandler}>
								{actionOptions.map((opt, i) => (
									<MyErrorBoundary key={i}>
										<OptionsInputField
											key={i}
											isLocatedInGrid={!!location}
											isAction={true}
											connectionId={action.connectionId}
											option={opt}
											value={(action.options || {})[opt.id]}
											setValue={service.setValue}
											visibility={optionVisibility[opt.id] ?? true}
											readonly={readonly}
										/>
									</MyErrorBoundary>
								))}
							</CForm>
						</div>

						{action.connectionId === 'internal' &&
							!!actionSpec?.supportsChildGroups.find(
								(grp) => grp.type === EntityModelType.Action && grp.groupId === 'default'
							) && (
								<div
									className={classNames('cell-children', {
										// 'hide-top-gap': actionOptions.length > 0 && (action.children ?? []).length > 0,
									})}
								>
									<CForm onSubmit={PreventDefaultHandler}>
										<InlineActionList
											controlId={controlId}
											heading={null}
											actions={action.children?.['default'] ?? []}
											location={location}
											listId={listId}
											actionsService={serviceFactory}
											ownerId={{ parentId: action.id, childGroup: 'default' }}
										/>
									</CForm>
								</div>
							)}
					</div>
				)}
			</td>
		</tr>
	)
})
