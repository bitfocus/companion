import { CButton, CForm, CInputGroup, CInputGroupAppend, CInputGroupText } from '@coreui/react'
import { faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { NumberInputField } from '../../Components'
import {
	ActionsContext,
	StaticContext,
	InstancesContext,
	MyErrorBoundary,
	socketEmit,
	sandbox,
	useMountEffect,
} from '../../util'
import update from 'immutability-helper'
import Select, { createFilter } from 'react-select'
import { ActionTableRowOption } from './Table'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'
import { AddActionsModal } from './AddModal'

export function ActionsPanel({
	page,
	bank,
	dragId,
	addCommand,
	getCommand,
	updateOption,
	orderCommand,
	setDelay,
	deleteCommand,
	addPlaceholder,
	setLoadStatus,
	loadStatusKey,
	reloadToken,
}) {
	const context = useContext(StaticContext)

	const confirmModal = useRef()

	const [actions, setActions] = useState([])

	// Ensure the correct data is loaded
	useEffect(() => {
		setLoadStatus(loadStatusKey, false)
		socketEmit(context.socket, getCommand, [page, bank])
			.then(([page, bank, actions]) => {
				setActions(actions || [])
				setLoadStatus(loadStatusKey, true)
			})
			.catch((e) => {
				setLoadStatus(loadStatusKey, `Failed to load ${loadStatusKey}`)
				console.error('Failed to load bank actions', e)
			})
	}, [context.socket, getCommand, setLoadStatus, loadStatusKey, page, bank, reloadToken])

	const emitUpdateOption = useCallback(
		(actionId, key, val) => {
			context.socket.emit(updateOption, page, bank, actionId, key, val)
		},
		[context.socket, updateOption, page, bank]
	)
	const emitSetDelay = useCallback(
		(actionId, delay) => {
			context.socket.emit(setDelay, page, bank, actionId, delay)
		},
		[context.socket, setDelay, page, bank]
	)

	const emitDelete = useCallback(
		(actionId) => {
			context.socket.emit(deleteCommand, page, bank, actionId)
		},
		[context.socket, deleteCommand, page, bank]
	)

	const emitOrder = useCallback(
		(dragIndex, hoverIndex) => {
			context.socket.emit(orderCommand, page, bank, dragIndex, hoverIndex)
		},
		[context.socket, orderCommand, page, bank]
	)

	const addAction = useCallback(
		(actionType) => {
			socketEmit(context.socket, addCommand, [page, bank, actionType])
				.then(([page, bank, actions]) => {
					setActions(actions || [])
				})
				.catch((e) => {
					console.error('Failed to add bank action', e)
				})
		},
		[context.socket, addCommand, page, bank]
	)

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />
			<ActionsPanelInner
				isOnBank={true}
				dragId={dragId}
				addPlaceholder={addPlaceholder}
				confirmModal={confirmModal}
				actions={actions}
				setActions={setActions}
				emitUpdateOption={emitUpdateOption}
				emitSetDelay={emitSetDelay}
				emitDelete={emitDelete}
				emitOrder={emitOrder}
				addAction={addAction}
			/>
		</>
	)
}

export function ActionsPanelInner({
	isOnBank,
	dragId,
	addPlaceholder,
	confirmModal,
	actions,
	setActions,
	emitUpdateOption,
	emitSetDelay,
	emitDelete,
	emitOrder,
	addAction,
}) {
	const addActionsRef = useRef(null)
	const showAddModal = useCallback(() => {
		if (addActionsRef.current) {
			addActionsRef.current.show()
		}
	}, [])

	const setValue = useCallback(
		(actionId, key, val) => {
			// The server doesn't repond to our change, so we assume it was ok
			setActions((oldActions) => {
				const actionIndex = oldActions.findIndex((a) => a.id === actionId)

				const oldValue = (oldActions[actionIndex].options || {})[key]
				if (oldValue !== val) {
					if (emitUpdateOption) {
						emitUpdateOption(actionId, key, val)
					}

					return update(oldActions, {
						[actionIndex]: {
							options: {
								[key]: { $set: val },
							},
						},
					})
				} else {
					return oldActions
				}
			})
		},
		[emitUpdateOption, setActions]
	)

	const doDelay = useCallback(
		(actionId, delay) => {
			// The server doesn't repond to our change, so we assume it was ok
			setActions((oldActions) => {
				const actionIndex = oldActions.findIndex((a) => a.id === actionId)

				const oldValue = oldActions[actionIndex].options?.delay
				if (oldValue !== delay) {
					if (emitSetDelay) {
						emitSetDelay(actionId, delay)
					}

					return update(oldActions, {
						[actionIndex]: {
							delay: { $set: delay },
						},
					})
				} else {
					return oldActions
				}
			})
		},
		[emitSetDelay, setActions]
	)

	const doDelete = useCallback(
		(actionId) => {
			if (confirmModal) {
				confirmModal.current.show('Delete action', 'Delete action?', 'Delete', () => {
					if (emitDelete) {
						emitDelete(actionId)
					}
					setActions((oldActions) => oldActions.filter((a) => a.id !== actionId))
				})
			} else {
				if (emitDelete) {
					emitDelete(actionId)
				}
				setActions((oldActions) => oldActions.filter((a) => a.id !== actionId))
			}
		},
		[emitDelete, setActions, confirmModal]
	)

	const moveCard = useCallback(
		(dragIndex, hoverIndex) => {
			// The server doesn't repond to our change, so we assume it was ok
			if (emitOrder) {
				emitOrder(dragIndex, hoverIndex)
			}

			setActions((actions) => {
				const dragCard = actions[dragIndex]
				return update(actions, {
					$splice: [
						[dragIndex, 1],
						[hoverIndex, 0, dragCard],
					],
				})
			})
		},
		[emitOrder, setActions]
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
			<AddActionsModal ref={addActionsRef} addAction={addAction2} />

			<table className="table action-table">
				<tbody>
					{actions.map((a, i) => (
						<ActionTableRow
							key={a?.id ?? i}
							isOnBank={isOnBank}
							action={a}
							index={i}
							dragId={dragId}
							setValue={setValue}
							doDelete={doDelete}
							doDelay={doDelay}
							moveCard={moveCard}
						/>
					))}
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

function ActionTableRow({ action, isOnBank, index, dragId, setValue, doDelete, doDelay, moveCard }) {
	const instancesContext = useContext(InstancesContext)
	const actionsContext = useContext(ActionsContext)

	const innerDelete = useCallback(() => doDelete(action.id), [action.id, doDelete])
	const innerDelay = useCallback((delay) => doDelay(action.id, delay), [doDelay, action.id])

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
			if (dragIndex === hoverIndex) {
				return
			}
			// Determine rectangle on screen
			const hoverBoundingRect = ref.current?.getBoundingClientRect()
			// Get vertical middle
			const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
			// Determine mouse position
			const clientOffset = monitor.getClientOffset()
			// Get pixels to the top
			const hoverClientY = clientOffset.y - hoverBoundingRect.top
			// Only perform the move when the mouse has crossed half of the items height
			// When dragging downwards, only move when the cursor is below 50%
			// When dragging upwards, only move when the cursor is above 50%
			// Dragging downwards
			if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
				return
			}
			// Dragging upwards
			if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
				return
			}
			// Time to actually perform the action
			moveCard(dragIndex, hoverIndex)
			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
		},
	})
	const [{ isDragging }, drag, preview] = useDrag({
		item: {
			type: dragId,
			actionId: action.id,
			index: index,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	useEffect(() => {
		const options = actionSpec?.options ?? []

		for (const option of options) {
			if (typeof option.isVisibleFn === 'string' && typeof option.isVisible !== 'function') {
				option.isVisible = sandbox(option.isVisibleFn)
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
			if (typeof option.isVisible === 'function') {
				visibility[option.id] = option.isVisible(action)
			}
		}

		setOptionVisibility(visibility)

		return () => {
			setOptionVisibility({})
		}
	}, [actionSpec, action])

	if (!action) {
		// Invalid action, so skip
		return ''
	}

	const instance = instancesContext[action.instance]
	// const module = instance ? context.modules[instance.instance_type] : undefined
	const instanceLabel = instance?.label ?? action.instance

	const options = actionSpec?.options ?? []

	let name = ''
	if (actionSpec) {
		name = `${instanceLabel}: ${actionSpec.label}`
	} else {
		const actionId = action.label.split(/:/)[1]
		name = `${instanceLabel}: ${actionId} (undefined)`
	}

	return (
		<tr ref={ref} className={isDragging ? 'actionlist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>
				<div className="editor-grid">
					<div className="cell-name">{name}</div>

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
						<CButton color="danger" size="sm" onClick={innerDelete} title="Remove action">
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
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
