import { CButton, CForm, CButtonGroup, CFormSwitch } from '@coreui/react'
import {
	faSort,
	faTrash,
	faExpandArrowsAlt,
	faCompressArrowsAlt,
	faCopy,
	faFolderOpen,
	faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { memo, useCallback, useContext, useDeferredValue, useMemo, useRef, useState } from 'react'
import { DropdownInputField, TextInputField } from '../Components/index.js'
import { DragState, MyErrorBoundary, PreventDefaultHandler, checkDragState } from '../util.js'
import { OptionsInputField } from './OptionsInputField.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { AddActionsModal, AddActionsModalRef } from './AddModal.js'
import { PanelCollapseHelper, usePanelCollapseHelper } from '../Helpers/CollapseHelper.js'
import { OptionButtonPreview } from './OptionButtonPreview.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible.js'
import { LearnButton } from '../Components/LearnButton.js'
import { AddActionDropdown } from './AddActionDropdown.js'
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

interface ControlActionSetEditorProps {
	controlId: string
	location: ControlLocation | undefined
	listId: SomeSocketEntityLocation
	actions: SomeEntityModel[] | undefined
	addPlaceholder: string
	heading: JSX.Element | string
	headingActions?: JSX.Element[]
}

export const ControlActionSetEditor = observer(function ControlActionSetEditor({
	controlId,
	location,
	listId,
	actions,
	addPlaceholder,
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
	const panelCollapseHelper = usePanelCollapseHelper(
		`actions_${controlId}_${stringifySocketEntityLocation(listId)}`,
		actionIds
	)

	return (
		<div className="action-category">
			<GenericConfirmModal ref={confirmModal} />

			<InlineActionList
				controlId={controlId}
				heading={heading}
				headingActions={headingActions}
				actions={actions}
				location={location}
				listId={listId}
				addPlaceholder={addPlaceholder}
				actionsService={actionsService}
				ownerId={null}
				panelCollapseHelper={panelCollapseHelper}
			/>
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
	addPlaceholder: string
	actionsService: IEntityEditorService
	ownerId: EntityOwner | null
	panelCollapseHelper: PanelCollapseHelper
}
function InlineActionList({
	controlId,
	heading,
	headingActions,
	actions,
	location,
	listId,
	addPlaceholder,
	actionsService,
	ownerId,
	panelCollapseHelper,
}: InlineActionListProps) {
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
				panelCollapseHelper={panelCollapseHelper}
			/>
			<AddActionsPanel addPlaceholder={addPlaceholder} addAction={addAction} />
		</>
	)
}

interface AddActionsPanelProps {
	addPlaceholder: string
	addAction: (connectionId: string, definitionId: string) => void
}

const AddActionsPanel = memo(function AddActionsPanel({ addPlaceholder, addAction }: AddActionsPanelProps) {
	const addActionsRef = useRef<AddActionsModalRef>(null)
	const showAddModal = useCallback(() => {
		addActionsRef.current?.show()
	}, [])

	return (
		<div className="add-dropdown-wrapper">
			<AddActionDropdown onSelect={addAction} placeholder={addPlaceholder} />
			<CButton color="primary" onClick={showAddModal} style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
				<FontAwesomeIcon icon={faFolderOpen} />
			</CButton>

			<MyErrorBoundary>
				<AddActionsModal ref={addActionsRef} addAction={addAction} />
			</MyErrorBoundary>
		</div>
	)
})

interface ActionsListProps {
	location: ControlLocation | undefined
	controlId: string
	ownerId: EntityOwner | null
	dragId: string
	listId: SomeSocketEntityLocation
	actions: SomeEntityModel[] | undefined
	actionsService: IEntityEditorService
	readonly?: boolean
	panelCollapseHelper: PanelCollapseHelper
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
	panelCollapseHelper,
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
								panelCollapseHelper={panelCollapseHelper}
							/>
						</MyErrorBoundary>
					))}

				<ActionRowDropPlaceholder
					dragId={dragId}
					ownerId={ownerId}
					listId={listId}
					actionCount={actions ? actions.length : 0}
					moveCard={actionsService.moveCard}
				/>
			</tbody>
		</table>
	)
}

interface ActionRowDropPlaceholderProps {
	listId: SomeSocketEntityLocation
	ownerId: EntityOwner | null
	dragId: string
	actionCount: number
	moveCard: (
		listId: SomeSocketEntityLocation,
		actionId: string,
		ownerId: EntityOwner | null,
		targetIndex: number
	) => void
}

function ActionRowDropPlaceholder({ listId, ownerId, dragId, actionCount, moveCard }: ActionRowDropPlaceholderProps) {
	const [isDragging, drop] = useDrop<ActionTableRowDragItem, unknown, boolean>({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, _monitor) {
			moveCard(item.listId, item.actionId, ownerId, 0)

			item.listId = listId
			item.index = 0
		},
	})

	// Defer the isDragging value to ensure dragend doesn't fire prematurely
	// See https://github.com/bitfocus/companion/issues/3115
	// https://bugs.webkit.org/show_bug.cgi?id=134212
	// https://issues.chromium.org/issues/41150279
	const isDraggingDeferred = useDeferredValue(isDragging)

	if (!isDraggingDeferred || actionCount > 0) return null

	return (
		<tr ref={drop} className={'actionlist-dropzone'}>
			<td colSpan={3}>
				<p>Drop action here</p>
			</td>
		</tr>
	)
}

interface ActionTableRowDragItem {
	actionId: string
	listId: SomeSocketEntityLocation
	index: number
	ownerId: EntityOwner | null
	dragState: DragState | null
}
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
	panelCollapseHelper: PanelCollapseHelper
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
	panelCollapseHelper,
}: ActionTableRowProps): JSX.Element | null {
	const { actionDefinitions, connections } = useContext(RootAppStoreContext)

	const service = useControlEntityService(serviceFactory, action)

	const innerSetEnabled = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => service.setEnabled && service.setEnabled(e.target.checked),
		[service.setEnabled]
	)

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
				item.actionId === hoverId ||
				(dragIndex === hoverIndex &&
					stringifyEntityOwnerId(dragParentId) === stringifyEntityOwnerId(hoverOwnerId) &&
					stringifySocketEntityLocation(item.listId) === stringifySocketEntityLocation(listId))
			) {
				return
			}

			// Time to actually perform the action
			serviceFactory.moveCard(item.listId, item.actionId, hoverOwnerId, index)

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
			actionId: action.id,
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

	const doCollapse = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(action.id, true),
		[panelCollapseHelper, action.id]
	)
	const doExpand = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(action.id, false),
		[panelCollapseHelper, action.id]
	)
	const isCollapsed = panelCollapseHelper.isPanelCollapsed(stringifyEntityOwnerId(ownerId), action.id)

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
	const connectionsWithSameType = connectionInfo ? connections.getAllOfType(connectionInfo.instance_type) : []

	const showButtonPreview = action?.connectionId === 'internal' && actionSpec?.showButtonPreview

	const name = actionSpec
		? `${connectionLabel}: ${actionSpec.label}`
		: `${connectionLabel}: ${action.definitionId} (undefined)`

	return (
		<tr ref={ref} className={isDragging ? 'actionlist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td style={{ paddingRight: 0 }}>
				<div className="editor-grid-header">
					<div className="cell-name">
						{!service.setHeadline || !headlineExpanded || isCollapsed ? (
							headline || name
						) : (
							<TextInputField
								value={headline ?? ''}
								placeholder={'Describe the intent of the action'}
								setValue={service.setHeadline}
							/>
						)}
					</div>

					<div className="cell-controls">
						<CButtonGroup>
							{canSetHeadline && !headlineExpanded && !isCollapsed && (
								<CButton size="sm" onClick={doEditHeadline} title="Set headline">
									<FontAwesomeIcon icon={faPencil} />
								</CButton>
							)}
							{isCollapsed ? (
								<CButton size="sm" onClick={doExpand} title="Expand action view">
									<FontAwesomeIcon icon={faExpandArrowsAlt} />
								</CButton>
							) : (
								<CButton size="sm" onClick={doCollapse} title="Collapse action view">
									<FontAwesomeIcon icon={faCompressArrowsAlt} />
								</CButton>
							)}
							<CButton disabled={readonly} size="sm" onClick={service.performDuplicate} title="Duplicate action">
								<FontAwesomeIcon icon={faCopy} />
							</CButton>
							<CButton disabled={readonly} size="sm" onClick={service.performDelete} title="Remove action">
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
							{!!service.setEnabled && (
								<>
									&nbsp;
									<CFormSwitch
										color="success"
										checked={!action.disabled}
										title={action.disabled ? 'Enable action' : 'Disable action'}
										onChange={innerSetEnabled}
									/>
								</>
							)}
						</CButtonGroup>
					</div>
				</div>

				{!isCollapsed && (
					<div className="editor-grid">
						<div
							className={classNames('cell-description', {
								'no-options': actionOptions.length === 0,
							})}
						>
							{headlineExpanded && <p className="name">{name}</p>}
							<div className="description">{actionSpec?.description}</div>
						</div>

						{showButtonPreview && (
							<div className="cell-button-preview">
								<OptionButtonPreview location={location} options={action.options} />
							</div>
						)}

						<div className="cell-left-main">
							{connectionsWithSameType.length > 1 && (
								<div className="option-field">
									<DropdownInputField
										label="Connection"
										choices={connectionsWithSameType
											.sort((connectionA, connectionB) => connectionA[1].sortOrder - connectionB[1].sortOrder)
											.map((connection) => {
												const [id, info] = connection
												return { id, label: info.label }
											})}
										multiple={false}
										value={action.connectionId}
										setValue={(val) => service.setConnection(`${val}`)}
									/>
								</div>
							)}
						</div>

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
											addPlaceholder="+ Add action"
											actionsService={serviceFactory}
											ownerId={{ parentId: action.id, childGroup: 'default' }}
											panelCollapseHelper={panelCollapseHelper}
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
