import { CButton, CForm, CInputGroup, CInputGroupAppend, CInputGroupText, CButtonGroup } from '@coreui/react'
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
import { NumberInputField, TextInputField } from '../Components'
import { ActionsContext, ConnectionsContext, MyErrorBoundary, PreventDefaultHandler } from '../util'
import { OptionsInputField } from './OptionsInputField'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal'
import { AddActionsModal, AddActionsModalRef } from './AddModal'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper'
import CSwitch from '../CSwitch'
import { OptionButtonPreview } from './OptionButtonPreview'
import { ActionInstance } from '@companion/shared/Model/ActionModel'
import { ControlLocation } from '@companion/shared/Model/Common'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible'
import { LearnButton } from '../Components/LearnButton'
import { AddActionDropdown } from './AddActionDropdown'
import {
	IActionEditorService,
	useControlActionService,
	useControlActionsEditorService,
} from '../Services/Controls/ControlActionsService'

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

export const ControlActionSetEditor = memo(function ControlActionSetEditor({
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
	const { setPanelCollapsed, isPanelCollapsed, setAllCollapsed, setAllExpanded, canExpandAll, canCollapseAll } =
		usePanelCollapseHelper(`actions_${controlId}_${stepId}_${setId}`, actionIds)

	return (
		<div className="action-category">
			<h4>
				{heading}
				<CButtonGroup className="right">
					{actions && actions.length > 1 && canExpandAll && (
						<CButton color="white" size="sm" onClick={setAllExpanded} title="Expand all">
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>
					)}
					{actions && actions.length > 1 && canCollapseAll && (
						<CButton color="white" size="sm" onClick={setAllCollapsed} title="Collapse all">
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</CButton>
					)}
					{headingActions || ''}
				</CButtonGroup>
			</h4>
			<GenericConfirmModal ref={confirmModal} />
			<ActionsList
				location={location}
				dragId={`${controlId}_actions`}
				stepId={stepId}
				setId={setId}
				actions={actions}
				actionsService={actionsService}
				setPanelCollapsed={setPanelCollapsed}
				isPanelCollapsed={isPanelCollapsed}
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
	setPanelCollapsed: (panelId: string, collapsed: boolean) => void
	isPanelCollapsed: (panelId: string) => boolean
}

export function ActionsList({
	location,
	dragId,
	stepId,
	setId,
	actions,
	actionsService,
	readonly,
	setPanelCollapsed,
	isPanelCollapsed,
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
								setCollapsed={setPanelCollapsed}
								isCollapsed={isPanelCollapsed(a.id)}
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
	isCollapsed: boolean
	setCollapsed: (actionId: string, collapsed: boolean) => void
}

function ActionTableRow({
	action,
	stepId,
	setId,
	location,
	index,
	dragId,
	serviceFactory,
	readonly,
	isCollapsed,
	setCollapsed,
}: ActionTableRowProps): JSX.Element | null {
	const connectionsContext = useContext(ConnectionsContext)
	const actionsContext = useContext(ActionsContext)

	const service = useControlActionService(serviceFactory, action)

	const innerSetEnabled = useCallback(
		(e) => service.setEnabled && service.setEnabled(e.target.checked),
		[service.setEnabled]
	)

	const actionSpec = (actionsContext[action.instance] || {})[action.action]

	const [actionOptions, optionVisibility] = useOptionsAndIsVisible(actionSpec, action)

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<ActionTableRowDragItem>({
		accept: dragId,
		hover(item, _monitor) {
			if (!ref.current) {
				return
			}
			const dragIndex = item.index
			const hoverIndex = index
			// Don't replace items with themselves
			if (dragIndex === hoverIndex && item.setId === setId && item.stepId === stepId) {
				return
			}

			// Time to actually perform the action
			serviceFactory.moveCard(item.stepId, item.setId, item.index, index)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
			item.setId = setId
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
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	const doCollapse = useCallback(() => setCollapsed(action.id, true), [setCollapsed, action.id])
	const doExpand = useCallback(() => setCollapsed(action.id, false), [setCollapsed, action.id])

	if (!action) {
		// Invalid action, so skip
		return null
	}

	const connectionInfo = connectionsContext[action.instance]
	// const module = instance ? modules[instance.instance_type] : undefined
	const connectionLabel = connectionInfo?.label ?? action.instance

	const showButtonPreview = action?.instance === 'internal' && actionSpec?.showButtonPreview

	const name = actionSpec
		? `${connectionLabel}: ${actionSpec.label}`
		: `${connectionLabel}: ${action.action} (undefined)`

	const canSetHeadline = !!service.setHeadline
	const headline = action.headline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

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
							{canSetHeadline && !headlineExpanded && (
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
									<CSwitch
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
						<div className="cell-description">
							{headlineExpanded && <p className="name">{name}</p>}
							{actionSpec?.description}
						</div>

						{location && showButtonPreview && (
							<div className="cell-button-preview">
								<OptionButtonPreview location={location} options={action.options} />
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
									<CInputGroupAppend>
										<CInputGroupText>ms</CInputGroupText>
									</CInputGroupAppend>
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
											isOnControl={!!location}
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
}
