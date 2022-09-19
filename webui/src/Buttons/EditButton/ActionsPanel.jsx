import { CButton, CForm, CInputGroup, CInputGroupAppend, CInputGroupText, CButtonGroup } from '@coreui/react'
import { faSort, faTrash, faExpandArrowsAlt, faCompressArrowsAlt, faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { NumberInputField } from '../../Components'
import {
	ActionsContext,
	InstancesContext,
	MyErrorBoundary,
	socketEmitPromise,
	sandbox,
	useMountEffect,
	SocketContext,
} from '../../util'
import Select, { createFilter } from 'react-select'
import { ActionTableRowOption } from './Table'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'
import { AddActionsModal } from './AddModal'
import { usePanelCollapseHelper } from './CollapseHelper'

export function ActionsPanel({ controlId, set, actions, dragId, addPlaceholder, heading, headingActions }) {
	const socket = useContext(SocketContext)

	const confirmModal = useRef()

	const emitUpdateOption = useCallback(
		(actionId, key, val) => {
			socketEmitPromise(socket, 'controls:action:set-option', [controlId, set, actionId, key, val]).catch((e) => {
				console.error('Failed to set bank action option', e)
			})
		},
		[socket, controlId, set]
	)
	const emitSetDelay = useCallback(
		(actionId, delay) => {
			socketEmitPromise(socket, 'controls:action:set-delay', [controlId, set, actionId, delay]).catch((e) => {
				console.error('Failed to set bank action delay', e)
			})
		},
		[socket, controlId, set]
	)

	const emitDelete = useCallback(
		(actionId) => {
			socketEmitPromise(socket, 'controls:action:remove', [controlId, set, actionId]).catch((e) => {
				console.error('Failed to remove bank action', e)
			})
		},
		[socket, controlId, set]
	)
	const emitDuplicate = useCallback(
		(actionId) => {
			socketEmitPromise(socket, 'controls:action:duplicate', [controlId, set, actionId]).catch((e) => {
				console.error('Failed to duplicate bank action', e)
			})
		},
		[socket, controlId, set]
	)

	const emitLearn = useCallback(
		(actionId) => {
			socketEmitPromise(socket, 'controls:action:learn', [controlId, set, actionId]).catch((e) => {
				console.error('Failed to learn bank action values', e)
			})
		},
		[socket, controlId, set]
	)

	const emitOrder = useCallback(
		(dragSetId, dragIndex, dropSetId, dropIndex) => {
			socketEmitPromise(socket, 'controls:action:reorder', [
				controlId,
				dragSetId,
				dragIndex,
				dropSetId,
				dropIndex,
			]).catch((e) => {
				console.error('Failed to reorder bank actions', e)
			})
		},
		[socket, controlId]
	)

	const addAction = useCallback(
		(actionType) => {
			const [instanceId, actionId] = actionType.split(':', 2)
			socketEmitPromise(socket, 'controls:action:add', [controlId, set, instanceId, actionId]).catch((e) => {
				console.error('Failed to add bank action', e)
			})
		},
		[socket, controlId, set]
	)

	const actionIds = useMemo(() => actions.map((act) => act.id), [actions])
	const { setPanelCollapsed, isPanelCollapsed, setAllCollapsed, setAllExpanded, canExpandAll, canCollapseAll } =
		usePanelCollapseHelper(`actions_${controlId}_${set}`, actionIds)

	return (
		<>
			<h4 className="mt-3">
				{heading}
				<CButtonGroup className="right">
					<CButtonGroup>
						<CButton
							color="info"
							size="sm"
							onClick={setAllExpanded}
							title="Expand all actions"
							disabled={!canExpandAll}
						>
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>{' '}
						<CButton
							color="info"
							size="sm"
							onClick={setAllCollapsed}
							title="Collapse all actions"
							disabled={!canCollapseAll}
						>
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</CButton>
					</CButtonGroup>

					{headingActions || ''}
				</CButtonGroup>
			</h4>
			<GenericConfirmModal ref={confirmModal} />
			<ActionsPanelInner
				isOnBank={true}
				dragId={`${controlId}_actions`}
				setId={set}
				addPlaceholder={addPlaceholder}
				confirmModal={confirmModal}
				actions={actions}
				doSetValue={emitUpdateOption}
				doSetDelay={emitSetDelay}
				doDelete={emitDelete}
				doDuplicate={emitDuplicate}
				doReorder={emitOrder}
				emitLearn={emitLearn}
				addAction={addAction}
				setPanelCollapsed={setPanelCollapsed}
				isPanelCollapsed={isPanelCollapsed}
			/>
		</>
	)
}

export function ActionsPanelInner({
	isOnBank,
	dragId,
	setId,
	addPlaceholder,
	confirmModal,
	actions,
	doSetValue,
	doSetDelay,
	doDelete,
	doDuplicate,
	doReorder,
	emitLearn,
	addAction,
	setPanelCollapsed,
	isPanelCollapsed,
}) {
	const addActionsRef = useRef(null)
	const showAddModal = useCallback(() => {
		if (addActionsRef.current) {
			addActionsRef.current.show()
		}
	}, [])

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

	const [recentActions, setRecentActions] = useState([])
	useMountEffect(() => {
		try {
			// Load from localStorage at startup
			const recent = JSON.parse(window.localStorage.getItem('recent_actions') || '[]')
			if (Array.isArray(recent)) {
				setRecentActions(recent)
			}
		} catch (e) {
			setRecentActions([])
		}
	})

	const addAction2 = useCallback(
		(actionType) => {
			setRecentActions((existing) => {
				const newActions = [actionType, ...existing.filter((v) => v !== actionType)].slice(0, 20)

				window.localStorage.setItem('recent_actions', JSON.stringify(newActions))

				return newActions
			})

			addAction(actionType)
		},
		[addAction]
	)

	return (
		<>
			<MyErrorBoundary>
				<AddActionsModal ref={addActionsRef} addAction={addAction2} />
			</MyErrorBoundary>

			<table className="table action-table">
				<tbody>
					{actions.map((a, i) => (
						<MyErrorBoundary>
							<ActionTableRow
								key={a?.id ?? i}
								isOnBank={isOnBank}
								action={a}
								index={i}
								setId={setId}
								dragId={dragId}
								setValue={doSetValue}
								doDelete={doDelete2}
								doDuplicate={doDuplicate}
								doDelay={doSetDelay}
								moveCard={doReorder}
								doLearn={emitLearn}
								setCollapsed={setPanelCollapsed}
								isCollapsed={isPanelCollapsed(a.id)}
							/>
						</MyErrorBoundary>
					))}
					<ActionRowDropPlaceholder dragId={dragId} actionCount={actions.length} setId={setId} moveCard={doReorder} />
				</tbody>
			</table>

			<div className="add-dropdown-wrapper">
				<AddActionDropdown onSelect={addAction2} placeholder={addPlaceholder} recentActions={recentActions} />
				<CButton color="primary" variant="outline" onClick={showAddModal}>
					Browse
				</CButton>
			</div>
		</>
	)
}

function ActionRowDropPlaceholder({ dragId, setId, actionCount, moveCard }) {
	const [isDragging, drop] = useDrop({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, monitor) {
			console.log('hover', item)

			moveCard(item.setId, item.index, setId, 0)
		},
	})

	if (!isDragging || actionCount > 0) return ''

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
	setId,
	isOnBank,
	index,
	dragId,
	setValue,
	doDelete,
	doDuplicate,
	doDelay,
	moveCard,
	doLearn,
	isCollapsed,
	setCollapsed,
}) {
	const instancesContext = useContext(InstancesContext)
	const actionsContext = useContext(ActionsContext)

	const innerDelete = useCallback(() => doDelete(action.id), [action.id, doDelete])
	const innerDuplicate = useCallback(() => doDuplicate(action.id), [action.id, doDuplicate])
	const innerDelay = useCallback((delay) => doDelay(action.id, delay), [doDelay, action.id])
	const innerLearn = useCallback(() => doLearn(action.id), [doLearn, action.id])

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
			if (dragIndex === hoverIndex && item.setId === setId) {
				return
			}

			// Time to actually perform the action
			moveCard(item.setId, item.index, setId, index)

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
		item: {
			actionId: action.id,
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
					visibility[option.id] = option.isVisible(action.options)
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
			<td>
				<div className="editor-grid">
					<div className="cell-name">{name}</div>

					<div className="cell-controls">
						<CButtonGroup>
							{isCollapsed ? (
								<CButton color="info" size="sm" onClick={doExpand} title="Expand action view">
									<FontAwesomeIcon icon={faExpandArrowsAlt} />
								</CButton>
							) : (
								<CButton color="info" size="sm" onClick={doCollapse} title="Collapse action view">
									<FontAwesomeIcon icon={faCompressArrowsAlt} />
								</CButton>
							)}
							<CButton color="warning" size="sm" onClick={innerDuplicate} title="Duplicate action">
								<FontAwesomeIcon icon={faCopy} />
							</CButton>
							<CButton color="danger" size="sm" onClick={innerDelete} title="Remove action">
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
						</CButtonGroup>
					</div>

					{!isCollapsed ? (
						<>
							<div className="cell-description">{actionSpec?.description || ''}</div>

							<div className="cell-delay">
								<CForm>
									<label>Delay</label>
									<CInputGroup>
										<NumberInputField definition={{ default: 0 }} value={action.delay} setValue={innerDelay} />
										<CInputGroupAppend>
											<CInputGroupText>ms</CInputGroupText>
										</CInputGroupAppend>
									</CInputGroup>
								</CForm>
							</div>

							<div className="cell-actions">
								{actionSpec?.hasLearn ? (
									<CButton
										color="info"
										size="sm"
										onClick={innerLearn}
										title="Capture the current values from the device"
									>
										Learn
									</CButton>
								) : (
									''
								)}
							</div>

							<div className="cell-option">
								<CForm>
									{options.map((opt, i) => (
										<MyErrorBoundary key={i}>
											<ActionTableRowOption
												isOnBank={isOnBank}
												instanceId={action.instance}
												option={opt}
												actionId={action.id}
												value={(action.options || {})[opt.id]}
												setValue={setValue}
												visibility={optionVisibility[opt.id]}
											/>
										</MyErrorBoundary>
									))}
									{options.length === 0 ? 'Nothing to configure' : ''}
								</CForm>
							</div>
						</>
					) : (
						''
					)}
				</div>
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

function AddActionDropdown({ onSelect, placeholder, recentActions }) {
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
		for (const actionType of recentActions) {
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
		options.push({
			label: 'Recently Used',
			options: recents,
		})

		return options
	}, [actionsContext, instancesContext, recentActions])

	const innerChange = useCallback(
		(e) => {
			if (e.value) {
				onSelect(e.value)
			}
		},
		[onSelect]
	)

	return (
		<Select
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
