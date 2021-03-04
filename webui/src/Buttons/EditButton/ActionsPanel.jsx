import { CButton, CForm, CInputGroup, CInputGroupAppend, CInputGroupText } from '@coreui/react'
import { faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { NumberInputField } from '../../Components'
import { CompanionContext, MyErrorBoundary, socketEmit } from '../../util'
import update from 'immutability-helper'
import Select from 'react-select'
import { ActionTableRowOption } from './Table'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'

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
	const context = useContext(CompanionContext)
	const [actions, setActions] = useState([])

	const confirmModal = useRef()

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

	const setValue = useCallback(
		(actionId, key, val) => {
			// The server doesn't repond to our change, so we assume it was ok
			setActions((oldActions) => {
				const actionIndex = oldActions.findIndex((a) => a.id === actionId)

				const oldValue = (oldActions[actionIndex].options || {})[key]
				if (oldValue !== val) {
					context.socket.emit(updateOption, page, bank, actionId, key, val)

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
		[context.socket, page, bank, updateOption]
	)

	const doDelay = useCallback(
		(actionId, delay) => {
			// The server doesn't repond to our change, so we assume it was ok
			setActions((oldActions) => {
				const actionIndex = oldActions.findIndex((a) => a.id === actionId)

				const oldValue = oldActions[actionIndex].options?.delay
				if (oldValue !== delay) {
					context.socket.emit(setDelay, page, bank, actionId, delay)

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
		[context.socket, page, bank, setDelay]
	)

	const deleteAction = useCallback((actionId) => {
		setActions((oldActions) => oldActions.filter((a) => a.id !== actionId))
	}, [])
	const doDelete = useCallback(
		(actionId) => {
			confirmModal.current.show('Delete action', 'Delete action?', 'Delete', () => {
				context.socket.emit(deleteCommand, page, bank, actionId)
				deleteAction(actionId)
			})
		},
		[context.socket, page, bank, deleteCommand, deleteAction]
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
		[context.socket, addCommand, bank, page]
	)

	const moveCard = useCallback(
		(dragIndex, hoverIndex) => {
			// The server doesn't repond to our change, so we assume it was ok
			context.socket.emit(orderCommand, page, bank, dragIndex, hoverIndex)

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
		[context.socket, page, bank, orderCommand]
	)

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			<table className="table action-table">
				<tbody>
					{actions.map((a, i) => (
						<ActionTableRow
							key={a?.id ?? i}
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

			<AddActionDropdown onSelect={addAction} placeholder={addPlaceholder} />
		</>
	)
}

function ActionTableRow({ action, index, dragId, setValue, doDelete, doDelay, moveCard }) {
	const context = useContext(CompanionContext)

	const innerDelete = useCallback(() => doDelete(action.id), [action.id, doDelete])
	const innerDelay = useCallback((delay) => doDelay(action.id, delay), [doDelay, action.id])

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

	if (!action) {
		// Invalid action, so skip
		return ''
	}

	const instance = context.instances[action.instance]
	// const module = instance ? context.modules[instance.instance_type] : undefined
	const instanceLabel = instance?.label ?? action.instance

	const actionSpec = context.actions[action.label]
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
										option={opt}
										actionId={action.id}
										value={(action.options || {})[opt.id]}
										setValue={setValue}
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

function AddActionDropdown({ onSelect, placeholder }) {
	const context = useContext(CompanionContext)

	const options = useMemo(() => {
		return Object.entries(context.actions || {}).map(([id, act]) => {
			const instanceId = id.split(/:/)[0]
			const instanceLabel = context.instances[instanceId]?.label ?? instanceId
			return { value: id, label: `${instanceLabel}: ${act.label}` }
		})
	}, [context.actions, context.instances])

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
		/>
	)
}
