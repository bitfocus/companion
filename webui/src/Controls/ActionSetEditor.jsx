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
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { NumberInputField } from '../Components'
import {
	ActionsContext,
	InstancesContext,
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
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { AddActionsModal } from './AddModal'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper'
import CSwitch from '../CSwitch'
import { OptionButtonPreview } from './OptionButtonPreview'
import { MenuPortalContext } from '../Components/DropdownInputField'

export function ControlActionSetEditor({
	controlId,
	location,
	stepId,
	setId,
	actions,
	addPlaceholder,
	heading,
	headingActions,
}) {
	const socket = useContext(SocketContext)

	const confirmModal = useRef()

	const emitUpdateOption = useCallback(
		(actionId, key, val) => {
			socketEmitPromise(socket, 'controls:action:set-option', [controlId, stepId, setId, actionId, key, val]).catch(
				(e) => {
					console.error('Failed to set bank action option', e)
				}
			)
		},
		[socket, controlId, stepId, setId]
	)
	const emitSetDelay = useCallback(
		(actionId, delay) => {
			socketEmitPromise(socket, 'controls:action:set-delay', [controlId, stepId, setId, actionId, delay]).catch((e) => {
				console.error('Failed to set bank action delay', e)
			})
		},
		[socket, controlId, stepId, setId]
	)

	const emitDelete = useCallback(
		(actionId) => {
			socketEmitPromise(socket, 'controls:action:remove', [controlId, stepId, setId, actionId]).catch((e) => {
				console.error('Failed to remove bank action', e)
			})
		},
		[socket, controlId, stepId, setId]
	)
	const emitDuplicate = useCallback(
		(actionId) => {
			socketEmitPromise(socket, 'controls:action:duplicate', [controlId, stepId, setId, actionId]).catch((e) => {
				console.error('Failed to duplicate bank action', e)
			})
		},
		[socket, controlId, stepId, setId]
	)

	const emitLearn = useCallback(
		(actionId) => {
			socketEmitPromise(socket, 'controls:action:learn', [controlId, stepId, setId, actionId]).catch((e) => {
				console.error('Failed to learn bank action values', e)
			})
		},
		[socket, controlId, stepId, setId]
	)

	const emitOrder = useCallback(
		(dragStepId, dragSetId, dragIndex, dropStepId, dropSetId, dropIndex) => {
			socketEmitPromise(socket, 'controls:action:reorder', [
				controlId,
				dragStepId,
				dragSetId,
				dragIndex,
				dropStepId,
				dropSetId,
				dropIndex,
			]).catch((e) => {
				console.error('Failed to reorder bank actions', e)
			})
		},
		[socket, controlId]
	)

	const emitEnabled = useCallback(
		(actionId, enabled) => {
			socketEmitPromise(socket, 'controls:action:enabled', [controlId, stepId, setId, actionId, enabled]).catch((e) => {
				console.error('Failed to enable/disable action', e)
			})
		},
		[socket, controlId, stepId, setId]
	)

	const addAction = useCallback(
		(actionType) => {
			const [instanceId, actionId] = actionType.split(':', 2)
			socketEmitPromise(socket, 'controls:action:add', [controlId, stepId, setId, instanceId, actionId]).catch((e) => {
				console.error('Failed to add bank action', e)
			})
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
}

function AddActionsPanel({ addPlaceholder, addAction }) {
	const addActionsRef = useRef(null)
	const showAddModal = useCallback(() => {
		if (addActionsRef.current) {
			addActionsRef.current.show()
		}
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
}) {
	const doDelete2 = useCallback(
		(actionId) => {
			if (confirmModal) {
				confirmModal.current.show('Delete action', 'Delete action?', 'Delete', () => {
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

function ActionRowDropPlaceholder({ dragId, stepId, setId, actionCount, moveCard }) {
	const [isDragging, drop] = useDrop({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, monitor) {
			moveCard(item.stepId, item.setId, item.index, stepId, setId, 0)
		},
	})

	if (!isDragging || actionCount > 0) return <></>

	return (
		<tr ref={drop} className={'actionlist-dropzone'}>
			<td colSpan={3}>
				<p>Drop action here</p>
			</td>
		</tr>
	)
}

function ActionTableRow({
	action,
	stepId,
	setId,
	location,
	index,
	dragId,
	controlId,
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
}) {
	const instancesContext = useContext(InstancesContext)
	const actionsContext = useContext(ActionsContext)

	const innerDelete = useCallback(() => doDelete(action.id), [action.id, doDelete])
	const innerDuplicate = useCallback(() => doDuplicate(action.id), [action.id, doDuplicate])
	const innerDelay = useCallback((delay) => doDelay(action.id, delay), [doDelay, action.id])
	const innerLearn = useCallback(() => doLearn(action.id), [doLearn, action.id])
	const innerSetEnabled = useCallback((e) => doEnabled(action.id, e.target.checked), [doEnabled, action.id])

	const [optionVisibility, setOptionVisibility] = useState({})

	const actionSpec = (actionsContext[action.instance] || {})[action.action]

	const ref = useRef(null)
	const [, drop] = useDrop({
		accept: dragId,
		hover(item, monitor) {
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
	const [{ isDragging }, drag, preview] = useDrag({
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

	useEffect(() => {
		const options = actionSpec?.options ?? []

		for (const option of options) {
			try {
				if (typeof option.isVisibleFn === 'string' && typeof option.isVisible !== 'function') {
					option.isVisible = sandbox(option.isVisibleFn)
				}
			} catch (e) {
				console.error('Failed to process isVisibleFn', e)
			}
		}
	}, [actionSpec])

	useEffect(() => {
		const visibility = {}
		const options = actionSpec?.options ?? []

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
	}, [actionSpec, action])

	const doCollapse = useCallback(() => {
		setCollapsed(action.id, true)
	}, [setCollapsed, action.id])
	const doExpand = useCallback(() => {
		setCollapsed(action.id, false)
	}, [setCollapsed, action.id])

	if (!action) {
		// Invalid action, so skip
		return ''
	}

	const instance = instancesContext[action.instance]
	// const module = instance ? modules[instance.instance_type] : undefined
	const instanceLabel = instance?.label ?? action.instance

	const options = actionSpec?.options ?? []

	const showButtonPreview = action?.instance === 'internal' && actionSpec?.showButtonPreview

	let name = ''
	if (actionSpec) {
		name = `${instanceLabel}: ${actionSpec.label}`
	} else {
		name = `${instanceLabel}: ${action.action} (undefined)`
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
							{doEnabled && (
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
							<div className="cell-bank-preview">
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
								{options.map((opt, i) => (
									<MyErrorBoundary key={i}>
										<OptionsInputField
											key={i}
											isOnControl={!!location}
											isAction={true}
											instanceId={action.instance}
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

const baseFilter = createFilter()
const filterOptions = (candidate, input) => {
	if (input) {
		return !candidate.data.isRecent && baseFilter(candidate, input)
	} else {
		return candidate.data.isRecent
	}
}

const noOptionsMessage = ({ inputValue }) => {
	if (inputValue) {
		return 'No actions found'
	} else {
		return 'No recently used actions'
	}
}

function AddActionDropdown({ onSelect, placeholder }) {
	const recentActionsContext = useContext(RecentActionsContext)
	const menuPortal = useContext(MenuPortalContext)
	const instancesContext = useContext(InstancesContext)
	const actionsContext = useContext(ActionsContext)

	const options = useMemo(() => {
		const options = []
		for (const [instanceId, instanceActions] of Object.entries(actionsContext)) {
			for (const [actionId, action] of Object.entries(instanceActions || {})) {
				const instanceLabel = instancesContext[instanceId]?.label ?? instanceId
				options.push({
					isRecent: false,
					value: `${instanceId}:${actionId}`,
					label: `${instanceLabel}: ${action.label}`,
				})
			}
		}

		const recents = []
		for (const actionType of recentActionsContext.recentActions) {
			if (actionType) {
				const [instanceId, actionId] = actionType.split(':', 2)
				const actionInfo = actionsContext[instanceId]?.[actionId]
				if (actionInfo) {
					const instanceLabel = instancesContext[instanceId]?.label ?? instanceId
					recents.push({
						isRecent: true,
						value: `${instanceId}:${actionId}`,
						label: `${instanceLabel}: ${actionInfo.label}`,
					})
				}
			}
		}
		options.push({
			label: 'Recently Used',
			options: recents,
		})

		return options
	}, [actionsContext, instancesContext, recentActionsContext.recentActions])

	const innerChange = useCallback(
		(e) => {
			if (e.value) {
				recentActionsContext.trackRecentAction(e.value)

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
