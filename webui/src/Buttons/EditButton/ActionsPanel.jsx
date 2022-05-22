import { CButton, CForm, CInputGroup, CInputGroupAppend, CInputGroupText } from '@coreui/react'
import { faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { NumberInputField } from '../../Components'
import { ActionsContext, StaticContext, InstancesContext, MyErrorBoundary, sandbox, socketEmit2 } from '../../util'
import Select from 'react-select'
import { ActionTableRowOption } from './Table'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'

export function ActionsPanel({ page, bank, set, actions, dragId, addPlaceholder }) {
	const context = useContext(StaticContext)

	const confirmModal = useRef()

	const emitUpdateOption = useCallback(
		(actionId, key, val) => {
			socketEmit2(context.socket, 'controls:action:set-option', [page, bank, set, actionId, key, val]).catch((e) => {
				console.error('Failed to set bank action option', e)
			})
		},
		[context.socket, page, bank, set]
	)
	const emitSetDelay = useCallback(
		(actionId, delay) => {
			socketEmit2(context.socket, 'controls:action:set-delay', [page, bank, set, actionId, delay]).catch((e) => {
				console.error('Failed to set bank action delay', e)
			})
		},
		[context.socket, page, bank, set]
	)

	const emitDelete = useCallback(
		(actionId) => {
			socketEmit2(context.socket, 'controls:action:remove', [page, bank, set, actionId]).catch((e) => {
				console.error('Failed to remove bank action', e)
			})
		},
		[context.socket, page, bank, set]
	)

	const emitOrder = useCallback(
		(dragIndex, hoverIndex) => {
			socketEmit2(context.socket, 'controls:action:reorder', [page, bank, set, dragIndex, hoverIndex]).catch((e) => {
				console.error('Failed to reorder bank actions', e)
			})
		},
		[context.socket, page, bank, set]
	)

	const addAction = useCallback(
		(actionType) => {
			const [instanceId, actionId] = actionType.split(':', 2)
			socketEmit2(context.socket, 'controls:action:add', [page, bank, set, instanceId, actionId]).catch((e) => {
				console.error('Failed to add bank action', e)
			})
		},
		[context.socket, page, bank, set]
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
				doSetValue={emitUpdateOption}
				doSetDelay={emitSetDelay}
				doDelete={emitDelete}
				doReorder={emitOrder}
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
	doSetValue,
	doSetDelay,
	doDelete,
	doReorder,
	addAction,
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
		<>
			<table className="table action-table">
				<tbody>
					{actions.map((a, i) => (
						<ActionTableRow
							key={a?.id ?? i}
							isOnBank={isOnBank}
							action={a}
							index={i}
							dragId={dragId}
							setValue={doSetValue}
							doDelete={doDelete2}
							doDelay={doSetDelay}
							moveCard={doReorder}
						/>
					))}
				</tbody>
			</table>

			<AddActionDropdown onSelect={addAction} placeholder={addPlaceholder} />
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

function AddActionDropdown({ onSelect, placeholder }) {
	const instancesContext = useContext(InstancesContext)
	const actionsContext = useContext(ActionsContext)

	const options = useMemo(() => {
		const options = []
		for (const [instanceId, instanceActions] of Object.entries(actionsContext)) {
			for (const [actionId, action] of Object.entries(instanceActions || {})) {
				const instanceLabel = instancesContext[instanceId]?.label ?? instanceId
				options.push({ value: `${instanceId}:${actionId}`, label: `${instanceLabel}: ${action.label}` })
			}
		}
		return options
	}, [actionsContext, instancesContext])

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
