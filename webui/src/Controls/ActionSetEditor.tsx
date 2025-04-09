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
import { ActionInstance, ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible.js'
import { LearnButton } from '../Components/LearnButton.js'
import { AddActionDropdown } from './AddActionDropdown.js'
import {
	IActionEditorService,
	useControlActionService,
	useControlActionsEditorService,
} from '../Services/Controls/ControlActionsService.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import classNames from 'classnames'

function findAllActionIdsDeep(actions: ActionInstance[]): string[] {
	const result: string[] = actions.map((f) => f.id)

	for (const action of actions) {
		if (!action.children) continue
		for (const actionGroup of Object.values(action.children)) {
			if (!actionGroup) continue
			result.push(...findAllActionIdsDeep(actionGroup))
		}
	}

	return result
}

interface ControlActionSetEditorProps {
	controlId: string
	location: ControlLocation | undefined
	stepId: string
	setId: ActionSetId
	actions: ActionInstance[] | undefined
	addPlaceholder: string
	heading: JSX.Element | string
	headingActions?: JSX.Element[]
}

export const ControlActionSetEditor = observer(function ControlActionSetEditor({
	controlId,
	location,
	stepId,
	setId,
	actions,
	addPlaceholder,
	heading,
	headingActions,
}: ControlActionSetEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const actionsService = useControlActionsEditorService(controlId, stepId, setId, confirmModal)

	const actionIds = useMemo(() => findAllActionIdsDeep(actions ?? []), [actions])
	const panelCollapseHelper = usePanelCollapseHelper(`actions_${controlId}_${stepId}_${setId}`, actionIds)

	return (
		<div className="action-category">
			<GenericConfirmModal ref={confirmModal} />

			<InlineActionList
				controlId={controlId}
				heading={heading}
				headingActions={headingActions}
				actions={actions}
				location={location}
				stepId={stepId}
				setId={setId}
				addPlaceholder={addPlaceholder}
				actionsService={actionsService}
				parentId={null}
				panelCollapseHelper={panelCollapseHelper}
			/>
		</div>
	)
})

interface InlineActionListProps {
	controlId: string
	heading: JSX.Element | string | null
	headingActions?: JSX.Element[]
	actions: ActionInstance[] | undefined
	location: ControlLocation | undefined
	stepId: string
	setId: ActionSetId
	addPlaceholder: string
	actionsService: IActionEditorService
	parentId: string | null
	panelCollapseHelper: PanelCollapseHelper
}
const InlineActionList = observer(function InlineActionList({
	controlId,
	heading,
	headingActions,
	actions,
	location,
	stepId,
	setId,
	addPlaceholder,
	actionsService,
	parentId,
	panelCollapseHelper,
}: InlineActionListProps) {
	const addAction = useCallback(
		(actionType: string) => actionsService.addAction(actionType, parentId),
		[actionsService, parentId]
	)

	const childActionIds = actions?.map((f) => f.id) ?? []

	return (
		<>
			<h5>
				{heading}

				<CButtonGroup className="right">
					{actions && actions.length >= 1 && panelCollapseHelper.canExpandAll(parentId, childActionIds) && (
						<CButton
							color="white"
							size="sm"
							onClick={() => panelCollapseHelper.setAllExpanded(parentId, childActionIds)}
							title="Expand all"
						>
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>
					)}
					{actions && actions.length >= 1 && panelCollapseHelper.canCollapseAll(parentId, childActionIds) && (
						<CButton
							color="white"
							size="sm"
							onClick={() => panelCollapseHelper.setAllCollapsed(parentId, childActionIds)}
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
				parentId={parentId}
				dragId={`${controlId}_actions`}
				stepId={stepId}
				setId={setId}
				actions={actions}
				actionsService={actionsService}
				panelCollapseHelper={panelCollapseHelper}
			/>
			<AddActionsPanel addPlaceholder={addPlaceholder} addAction={addAction} />
		</>
	)
})

interface AddActionsPanelProps {
	addPlaceholder: string
	addAction: (actionType: string) => void
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
	parentId: string | null
	dragId: string
	stepId: string
	setId: ActionSetId
	actions: ActionInstance[] | undefined
	actionsService: IActionEditorService
	readonly?: boolean
	panelCollapseHelper: PanelCollapseHelper
}

export function ActionsList({
	location,
	controlId,
	parentId,
	dragId,
	stepId,
	setId,
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
								parentId={parentId}
								location={location}
								action={a}
								index={i}
								stepId={stepId}
								setId={setId}
								dragId={dragId}
								serviceFactory={actionsService}
								readonly={readonly ?? false}
								panelCollapseHelper={panelCollapseHelper}
							/>
						</MyErrorBoundary>
					))}

				<ActionRowDropPlaceholder
					dragId={dragId}
					parentId={parentId}
					setId={setId}
					actionCount={actions ? actions.length : 0}
					moveCard={actionsService.moveCard}
				/>
			</tbody>
		</table>
	)
}

interface ActionRowDropPlaceholderProps {
	setId: ActionSetId
	parentId: string | null
	dragId: string
	actionCount: number
	moveCard: (stepId: string, setId: ActionSetId, actionId: string, parentId: string | null, targetIndex: number) => void
}

function ActionRowDropPlaceholder({ setId, parentId, dragId, actionCount, moveCard }: ActionRowDropPlaceholderProps) {
	const [isDragging, drop] = useDrop<ActionTableRowDragItem, unknown, boolean>({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, _monitor) {
			// Can't move into itself
			if (item.actionId === parentId) return

			moveCard(item.stepId, item.setId, item.actionId, parentId, 0)

			item.setId = setId
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
	stepId: string
	setId: ActionSetId
	index: number
	parentId: string | null
	dragState: DragState | null
}
interface ActionTableRowDragStatus {
	isDragging: boolean
}

interface ActionTableRowProps {
	action: ActionInstance
	controlId: string
	parentId: string | null
	stepId: string
	setId: ActionSetId
	location: ControlLocation | undefined
	index: number
	dragId: string
	serviceFactory: IActionEditorService

	readonly: boolean
	panelCollapseHelper: PanelCollapseHelper
}

const ActionTableRow = observer(function ActionTableRow({
	action,
	controlId,
	parentId,
	stepId,
	setId,
	location,
	index,
	dragId,
	serviceFactory,
	readonly,
	panelCollapseHelper,
}: ActionTableRowProps): JSX.Element | null {
	const { actionDefinitions, connections } = useContext(RootAppStoreContext)

	const service = useControlActionService(serviceFactory, action)

	const innerSetEnabled = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => service.setEnabled && service.setEnabled(e.target.checked),
		[service.setEnabled]
	)

	const actionSpec = actionDefinitions.connections.get(action.instance)?.get(action.action)

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

			const dragParentId = item.parentId
			const dragIndex = item.index

			const hoverParentId = parentId
			const hoverIndex = index
			const hoverId = action.id

			if (!checkDragState(item, monitor, hoverId)) return

			// Don't replace items with themselves
			if (
				item.actionId === hoverId ||
				(dragIndex === hoverIndex && dragParentId === hoverParentId && item.setId === setId && item.stepId === stepId)
			) {
				return
			}

			// Can't move into itself
			if (item.actionId === hoverParentId) return

			// Time to actually perform the action
			serviceFactory.moveCard(item.stepId, item.setId, item.actionId, hoverParentId, index)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
			item.setId = setId
			item.parentId = hoverParentId
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
			stepId: stepId,
			setId: setId,
			index: index,
			parentId: parentId,
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
	const isCollapsed = panelCollapseHelper.isPanelCollapsed(parentId, action.id)

	const canSetHeadline = !!service.setHeadline
	const headline = action.headline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

	if (!action) {
		// Invalid action, so skip
		return null
	}

	const connectionInfo = connections.getInfo(action.instance)
	// const module = instance ? modules[instance.instance_type] : undefined
	const connectionLabel = connectionInfo?.label ?? action.instance
	const connectionsWithSameType = connectionInfo ? connections.getAllOfType(connectionInfo.instance_type) : []

	const showButtonPreview = action?.instance === 'internal' && actionSpec?.showButtonPreview

	const name = actionSpec
		? `${connectionLabel}: ${actionSpec.label}`
		: `${connectionLabel}: ${action.action} (undefined)`

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
										value={action.instance}
										setValue={service.setConnection}
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
											connectionId={action.instance}
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

						{action.instance === 'internal' && actionSpec?.supportsChildActionGroups.includes('default') && (
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
										stepId={stepId}
										setId={setId}
										addPlaceholder="+ Add action"
										actionsService={serviceFactory}
										parentId={action.id}
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
