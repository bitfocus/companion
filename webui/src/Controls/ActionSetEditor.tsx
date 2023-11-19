import { CButton, CForm, CInputGroup, CInputGroupAppend, CInputGroupText, CButtonGroup } from '@coreui/react'
import {
	faSort,
	faTrash,
	faExpandArrowsAlt,
	faCompressArrowsAlt,
	faCopy,
	faFolderOpen,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { RefObject, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { NumberInputField } from '../Components'
import {
	ActionsContext,
	ConnectionsContext,
	MyErrorBoundary,
	socketEmitPromise,
	sandbox,
	SocketContext,
	PreventDefaultHandler,
	RecentActionsContext,
} from '../util'
import Select, { createFilter } from 'react-select'
import { OptionsInputField } from './OptionsInputField'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal'
import { AddActionsModal, AddActionsModalRef } from './AddModal'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper'
import CSwitch from '../CSwitch'
import { OptionButtonPreview } from './OptionButtonPreview'
import { MenuPortalContext } from '../Components/DropdownInputField'
import type { FilterOptionOption } from 'react-select/dist/declarations/src/filters'
import { ActionInstance } from '@companion/shared/Model/ActionModel'
import { ControlLocation } from '@companion/shared/Model/Common'

interface ControlActionSetEditorProps {
	controlId: string
	location: ControlLocation
	stepId: string
	setId: string
	actions: ActionInstance[]
	addPlaceholder: string
	heading: JSX.Element | string
	headingActions?: JSX.Element
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
	const socket = useContext(SocketContext)

	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const emitUpdateOption = useCallback(
		(actionId: string, key: string, val: any) => {
			socketEmitPromise(socket, 'controls:action:set-option', [controlId, stepId, setId, actionId, key, val]).catch(
				(e) => {
					console.error('Failed to set control action option', e)
				}
			)
		},
		[socket, controlId, stepId, setId]
	)
	const emitSetDelay = useCallback(
		(actionId: string, delay: number) => {
			socketEmitPromise(socket, 'controls:action:set-delay', [controlId, stepId, setId, actionId, delay]).catch((e) => {
				console.error('Failed to set control action delay', e)
			})
		},
		[socket, controlId, stepId, setId]
	)

	const emitDelete = useCallback(
		(actionId: string) => {
			socketEmitPromise(socket, 'controls:action:remove', [controlId, stepId, setId, actionId]).catch((e) => {
				console.error('Failed to remove control action', e)
			})
		},
		[socket, controlId, stepId, setId]
	)
	const emitDuplicate = useCallback(
		(actionId: string) => {
			socketEmitPromise(socket, 'controls:action:duplicate', [controlId, stepId, setId, actionId]).catch((e) => {
				console.error('Failed to duplicate control action', e)
			})
		},
		[socket, controlId, stepId, setId]
	)

	const emitLearn = useCallback(
		(actionId: string) => {
			socketEmitPromise(socket, 'controls:action:learn', [controlId, stepId, setId, actionId]).catch((e) => {
				console.error('Failed to learn control action values', e)
			})
		},
		[socket, controlId, stepId, setId]
	)

	const emitOrder = useCallback(
		(
			dragStepId: string,
			dragSetId: string,
			dragIndex: number,
			dropStepId: string,
			dropSetId: string,
			dropIndex: number
		) => {
			socketEmitPromise(socket, 'controls:action:reorder', [
				controlId,
				dragStepId,
				dragSetId,
				dragIndex,
				dropStepId,
				dropSetId,
				dropIndex,
			]).catch((e) => {
				console.error('Failed to reorder control actions', e)
			})
		},
		[socket, controlId]
	)

	const emitEnabled = useCallback(
		(actionId: string, enabled: boolean) => {
			socketEmitPromise(socket, 'controls:action:enabled', [controlId, stepId, setId, actionId, enabled]).catch((e) => {
				console.error('Failed to enable/disable action', e)
			})
		},
		[socket, controlId, stepId, setId]
	)

	const addAction = useCallback(
		(actionType: string) => {
			const [connectionId, actionId] = actionType.split(':', 2)
			socketEmitPromise(socket, 'controls:action:add', [controlId, stepId, setId, connectionId, actionId]).catch(
				(e) => {
					console.error('Failed to add control action', e)
				}
			)
		},
		[socket, controlId, stepId, setId]
	)

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
				controlId={controlId}
				dragId={`${controlId}_actions`}
				stepId={stepId}
				setId={setId}
				confirmModal={confirmModal}
				actions={actions}
				doSetValue={emitUpdateOption}
				doSetDelay={emitSetDelay}
				doDelete={emitDelete}
				doDuplicate={emitDuplicate}
				doReorder={emitOrder}
				doEnabled={emitEnabled}
				emitLearn={emitLearn}
				setPanelCollapsed={setPanelCollapsed}
				isPanelCollapsed={isPanelCollapsed}
			/>
			<AddActionsPanel addPlaceholder={addPlaceholder} addAction={addAction} />
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
	location: ControlLocation
	controlId: string
	dragId: string
	stepId: string
	setId: string
	confirmModal: RefObject<GenericConfirmModalRef>
	actions: ActionInstance[]
	doSetValue: (actionId: string, key: string, val: any) => void
	doSetDelay: (actionId: string, delay: number) => void
	doDelete: (actionId: string) => void
	doDuplicate: (actionId: string) => void
	doEnabled: (actionId: string, enabled: boolean) => void
	doReorder: (
		stepId: string,
		setId: string,
		index: number,
		targetStepId: string,
		targetSetId: string,
		targetIndex: number
	) => void
	emitLearn: (actionId: string) => void
	readonly?: boolean
	setPanelCollapsed: (panelId: string, collapsed: boolean) => void
	isPanelCollapsed: (panelId: string) => boolean
}

export function ActionsList({
	location,
	controlId,
	dragId,
	stepId,
	setId,
	confirmModal,
	actions,
	doSetValue,
	doSetDelay,
	doDelete,
	doDuplicate,
	doEnabled,
	doReorder,
	emitLearn,
	readonly,
	setPanelCollapsed,
	isPanelCollapsed,
}: ActionsListProps) {
	const doDelete2 = useCallback(
		(actionId) => {
			if (confirmModal) {
				confirmModal.current?.show('Delete action', 'Delete action?', 'Delete', () => {
					doDelete(actionId)
				})
			} else {
				doDelete(actionId)
			}
		},
		[doDelete, confirmModal]
	)

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
								controlId={controlId}
								dragId={dragId}
								setValue={doSetValue}
								doDelete={doDelete2}
								doDuplicate={doDuplicate}
								doDelay={doSetDelay}
								doEnabled={doEnabled}
								moveCard={doReorder}
								doLearn={emitLearn}
								readonly={readonly ?? false}
								setCollapsed={setPanelCollapsed}
								isCollapsed={isPanelCollapsed(a.id)}
							/>
						</MyErrorBoundary>
					))}
				<ActionRowDropPlaceholder
					dragId={dragId}
					actionCount={actions ? actions.length : 0}
					stepId={stepId}
					setId={setId}
					moveCard={doReorder}
				/>
			</tbody>
		</table>
	)
}

interface ActionRowDropPlaceholderProps {
	stepId: string
	setId: string
	dragId: string
	actionCount: number
	moveCard: (
		stepId: string,
		setId: string,
		index: number,
		targetStepId: string,
		targetSetId: string,
		targetIndex: number
	) => void
}

function ActionRowDropPlaceholder({ dragId, stepId, setId, actionCount, moveCard }: ActionRowDropPlaceholderProps) {
	const [isDragging, drop] = useDrop<ActionTableRowDragItem, unknown, boolean>({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, _monitor) {
			moveCard(item.stepId, item.setId, item.index, stepId, setId, 0)
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
	setId: string
	index: number
}
interface ActionTableRowDragStatus {
	isDragging: boolean
}

interface ActionTableRowProps {
	action: ActionInstance
	stepId: string
	setId: string
	location: ControlLocation
	index: number
	dragId: string
	controlId: string
	setValue: (actionId: string, key: string, val: any) => void
	doDelete: (actionId: string) => void
	doDuplicate: (actionId: string) => void
	doDelay: (actionId: string, delay: number) => void
	moveCard: (
		stepId: string,
		setId: string,
		index: number,
		targetStepId: string,
		targetSetId: string,
		targetIndex: number
	) => void
	doLearn: (actionId: string) => void
	doEnabled: (actionId: string, enabled: boolean) => void
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
	// controlId,
	setValue,
	doDelete,
	doDuplicate,
	doDelay,
	moveCard,
	doLearn,
	doEnabled,
	readonly,
	isCollapsed,
	setCollapsed,
}: ActionTableRowProps): JSX.Element | null {
	const connectionsContext = useContext(ConnectionsContext)
	const actionsContext = useContext(ActionsContext)

	const innerDelete = useCallback(() => doDelete(action.id), [action.id, doDelete])
	const innerDuplicate = useCallback(() => doDuplicate(action.id), [action.id, doDuplicate])
	const innerDelay = useCallback((delay) => doDelay(action.id, delay), [doDelay, action.id])
	const innerLearn = useCallback(() => doLearn(action.id), [doLearn, action.id])
	const innerSetEnabled = useCallback((e) => doEnabled(action.id, e.target.checked), [doEnabled, action.id])

	const [optionVisibility, setOptionVisibility] = useState<Record<string, boolean>>({})

	const actionSpec = (actionsContext[action.instance] || {})[action.action]

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
			moveCard(item.stepId, item.setId, item.index, stepId, setId, index)

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

	const actionOptions = useMemo(() => {
		const options = actionSpec?.options ?? []

		return options.map((option) => {
			try {
				if (typeof option.isVisibleFn === 'string' && typeof option.isVisible !== 'function') {
					return {
						...option,
						isVisible: sandbox(option.isVisibleFn),
					}
				}
			} catch (e) {
				console.error('Failed to process isVisibleFn', e)
			}
			return option
		})
	}, [actionSpec])

	useEffect(() => {
		const visibility: Record<string, boolean> = {}
		const options = actionOptions ?? []

		if (options === null || action === null) {
			return
		}

		for (const option of options) {
			try {
				if (typeof option.isVisible === 'function') {
					visibility[option.id] = option.isVisible(action.options, option.isVisibleData)
				}
			} catch (e) {
				console.error('Failed to check visibility', e)
			}
		}

		setOptionVisibility(visibility)

		return () => {
			setOptionVisibility({})
		}
	}, [actionOptions, action])

	const doCollapse = useCallback(() => {
		setCollapsed(action.id, true)
	}, [setCollapsed, action.id])
	const doExpand = useCallback(() => {
		setCollapsed(action.id, false)
	}, [setCollapsed, action.id])

	if (!action) {
		// Invalid action, so skip
		return null
	}

	const connectionInfo = connectionsContext[action.instance]
	// const module = instance ? modules[instance.instance_type] : undefined
	const connectionLabel = connectionInfo?.label ?? action.instance

	const showButtonPreview = action?.instance === 'internal' && actionSpec?.showButtonPreview

	let name = ''
	if (actionSpec) {
		name = `${connectionLabel}: ${actionSpec.label}`
	} else {
		name = `${connectionLabel}: ${action.action} (undefined)`
	}

	return (
		<tr ref={ref} className={isDragging ? 'actionlist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td style={{ paddingRight: 0 }}>
				<div className="editor-grid-header">
					<div className="cell-name">{name}</div>

					<div className="cell-controls">
						<CButtonGroup>
							{isCollapsed ? (
								<CButton size="sm" onClick={doExpand} title="Expand action view">
									<FontAwesomeIcon icon={faExpandArrowsAlt} />
								</CButton>
							) : (
								<CButton size="sm" onClick={doCollapse} title="Collapse action view">
									<FontAwesomeIcon icon={faCompressArrowsAlt} />
								</CButton>
							)}
							<CButton disabled={readonly} size="sm" onClick={innerDuplicate} title="Duplicate action">
								<FontAwesomeIcon icon={faCopy} />
							</CButton>
							<CButton disabled={readonly} size="sm" onClick={innerDelete} title="Remove action">
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
							{!!doEnabled && (
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
						<div className="cell-description">{actionSpec?.description || ''}</div>

						{location && showButtonPreview && (
							<div className="cell-button-preview">
								<OptionButtonPreview location={location} options={action.options} />
							</div>
						)}

						<div className="cell-delay">
							<CForm onSubmit={PreventDefaultHandler}>
								<label>Delay</label>
								<CInputGroup>
									<NumberInputField min={0} step={10} disabled={readonly} value={action.delay} setValue={innerDelay} />
									<CInputGroupAppend>
										<CInputGroupText>ms</CInputGroupText>
									</CInputGroupAppend>
								</CInputGroup>
							</CForm>
						</div>

						<div className="cell-actions">
							{actionSpec?.hasLearn && (
								<CButton
									disabled={readonly}
									color="info"
									size="sm"
									onClick={innerLearn}
									title="Capture the current values from the device"
								>
									Learn
								</CButton>
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
											actionId={action.id}
											value={(action.options || {})[opt.id]}
											setValue={setValue}
											visibility={optionVisibility[opt.id]}
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

const baseFilter = createFilter<AddActionOption>()
const filterOptions = (candidate: FilterOptionOption<AddActionOption>, input: string): boolean => {
	if (input) {
		return !candidate.data.isRecent && baseFilter(candidate, input)
	} else {
		return candidate.data.isRecent
	}
}

const noOptionsMessage = ({ inputValue }: { inputValue: string }) => {
	if (inputValue) {
		return 'No actions found'
	} else {
		return 'No recently used actions'
	}
}

interface AddActionOption {
	isRecent: boolean
	value: string
	label: string
}
interface AddActionGroup {
	label: string
	options: AddActionOption[]
}

interface AddActionDropdownProps {
	onSelect: (actionType: string) => void
	placeholder: string
}

function AddActionDropdown({ onSelect, placeholder }: AddActionDropdownProps) {
	const recentActionsContext = useContext(RecentActionsContext)
	const menuPortal = useContext(MenuPortalContext)
	const connectionsContext = useContext(ConnectionsContext)
	const actionsContext = useContext(ActionsContext)

	const options = useMemo(() => {
		const options: Array<AddActionOption | AddActionGroup> = []
		for (const [connectionId, connectionActions] of Object.entries(actionsContext)) {
			for (const [actionId, action] of Object.entries(connectionActions || {})) {
				if (!action) continue
				const connectionLabel = connectionsContext[connectionId]?.label ?? connectionId
				options.push({
					isRecent: false,
					value: `${connectionId}:${actionId}`,
					label: `${connectionLabel}: ${action.label}`,
				})
			}
		}

		const recents: AddActionOption[] = []
		for (const actionType of recentActionsContext?.recentActions ?? []) {
			if (actionType) {
				const [connectionId, actionId] = actionType.split(':', 2)
				const actionInfo = actionsContext[connectionId]?.[actionId]
				if (actionInfo) {
					const connectionLabel = connectionsContext[connectionId]?.label ?? connectionId
					recents.push({
						isRecent: true,
						value: `${connectionId}:${actionId}`,
						label: `${connectionLabel}: ${actionInfo.label}`,
					})
				}
			}
		}
		options.push({
			label: 'Recently Used',
			options: recents,
		})

		return options
	}, [actionsContext, connectionsContext, recentActionsContext?.recentActions])

	const innerChange = useCallback(
		(e) => {
			if (e.value) {
				recentActionsContext?.trackRecentAction(e.value)

				onSelect(e.value)
			}
		},
		[onSelect, recentActionsContext]
	)

	return (
		<Select
			menuShouldBlockScroll={!!menuPortal} // The dropdown doesn't follow scroll when in a modal
			menuPortalTarget={menuPortal || document.body}
			menuPosition={'fixed'}
			classNamePrefix="select-control"
			menuPlacement="auto"
			isClearable={false}
			isSearchable={true}
			isMulti={false}
			options={options}
			placeholder={placeholder}
			value={null}
			onChange={innerChange}
			filterOption={filterOptions}
			noOptionsMessage={noOptionsMessage}
		/>
	)
}
