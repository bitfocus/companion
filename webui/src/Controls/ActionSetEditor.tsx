import { CButton, CForm, CInputGroup, CInputGroupText, CButtonGroup, CFormSwitch } from '@coreui/react'
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
import React, { memo, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { DropdownInputField, NumberInputField, TextInputField } from '../Components/index.js'
import { DragState, MyErrorBoundary, PreventDefaultHandler, checkDragState } from '../util.js'
import { OptionsInputField } from './OptionsInputField.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { AddActionsModal, AddActionsModalRef } from './AddModal.js'
import { PanelCollapseHelperLite, usePanelCollapseHelperLite } from '../Helpers/CollapseHelper.js'
import { OptionButtonPreview } from './OptionButtonPreview.js'
import { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
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

interface ControlActionSetEditorProps {
	controlId: string
	location: ControlLocation | undefined
	stepId: string
	setId: string | number
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

	const actionIds = useMemo(() => (actions ? actions.map((act) => act.id) : []), [actions])
	const panelCollapseHelper = usePanelCollapseHelperLite(`actions_${controlId}_${stepId}_${setId}`, actionIds)

	return (
		<div className="action-category">
			<h5>
				{heading}
				<CButtonGroup className="right">
					{actions && actions.length > 1 && panelCollapseHelper.canExpandAll() && (
						<CButton color="white" size="sm" onClick={panelCollapseHelper.setAllExpanded} title="Expand all">
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>
					)}
					{actions && actions.length > 1 && panelCollapseHelper.canCollapseAll() && (
						<CButton color="white" size="sm" onClick={panelCollapseHelper.setAllCollapsed} title="Collapse all">
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</CButton>
					)}
					{headingActions || ''}
				</CButtonGroup>
			</h5>
			<GenericConfirmModal ref={confirmModal} />
			<ActionsList
				location={location}
				dragId={`${controlId}_actions`}
				stepId={stepId}
				setId={setId}
				actions={actions}
				actionsService={actionsService}
				panelCollapseHelper={panelCollapseHelper}
			/>
			<AddActionsPanel addPlaceholder={addPlaceholder} addAction={actionsService.addAction} />
		</div>
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
	dragId: string
	stepId: string
	setId: string | number
	actions: ActionInstance[] | undefined
	actionsService: IActionEditorService
	readonly?: boolean
	panelCollapseHelper: PanelCollapseHelperLite
}

export function ActionsList({
	location,
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
					actionCount={actions ? actions.length : 0}
					moveCard={actionsService.moveCard}
				/>
			</tbody>
		</table>
	)
}

interface ActionRowDropPlaceholderProps {
	dragId: string
	actionCount: number
	moveCard: (stepId: string, setId: string | number, index: number, targetIndex: number) => void
}

function ActionRowDropPlaceholder({ dragId, actionCount, moveCard }: ActionRowDropPlaceholderProps) {
	const [isDragging, drop] = useDrop<ActionTableRowDragItem, unknown, boolean>({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, _monitor) {
			moveCard(item.stepId, item.setId, item.index, 0)
		},
	})

	if (!isDragging || actionCount > 0) return null

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
	setId: string | number
	index: number
	dragState: DragState | null
}
interface ActionTableRowDragStatus {
	isDragging: boolean
}

interface ActionTableRowProps {
	action: ActionInstance
	stepId: string
	setId: string | number
	location: ControlLocation | undefined
	index: number
	dragId: string
	serviceFactory: IActionEditorService

	readonly: boolean
	panelCollapseHelper: PanelCollapseHelperLite
}

const ActionTableRow = observer(function ActionTableRow({
	action,
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

			const dragIndex = item.index
			const hoverIndex = index
			const hoverId = action.id
			// Don't replace items with themselves
			if (item.actionId === hoverId || (dragIndex === hoverIndex && item.setId === setId && item.stepId === stepId)) {
				return
			}

			if (!checkDragState(item, monitor, hoverId)) return

			// Time to actually perform the action
			serviceFactory.moveCard(item.stepId, item.setId, item.index, index)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
			item.setId = setId
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
	const isCollapsed = panelCollapseHelper.isPanelCollapsed(action.id)

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
							{actionSpec?.description}
						</div>

						{showButtonPreview && (
							<div className="cell-button-preview">
								<OptionButtonPreview location={location} options={action.options} />
							</div>
						)}

						{connectionsWithSameType.length > 1 && (
							<div className="cell-connection">
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
								></DropdownInputField>
							</div>
						)}

						<div className="cell-delay">
							<CForm onSubmit={PreventDefaultHandler}>
								<label>Delay</label>
								<CInputGroup>
									<NumberInputField
										min={0}
										step={10}
										disabled={readonly}
										value={action.delay}
										setValue={service.setDelay}
									/>
									<CInputGroupText>ms</CInputGroupText>
								</CInputGroup>
							</CForm>
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
					</div>
				)}
			</td>
		</tr>
	)
})
