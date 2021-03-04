import { CButton, CForm } from '@coreui/react'
import { faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CompanionContext, MyErrorBoundary, socketEmit } from '../../util'
import update from 'immutability-helper'
import Select from 'react-select'
import { ActionTableRowOption } from './Table'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'

export const FeedbacksPanel = function ({
	page,
	bank,
	dragId,
	addCommand,
	getCommand,
	updateOption,
	orderCommand,
	deleteCommand,
	setLoadStatus,
	loadStatusKey,
	reloadToken,
}) {
	const context = useContext(CompanionContext)
	const [feedbacks, setFeedbacks] = useState([])

	const confirmModal = useRef()

	// Ensure the correct data is loaded
	useEffect(() => {
		setLoadStatus(loadStatusKey, false)
		socketEmit(context.socket, getCommand, [page, bank])
			.then(([page, bank, feedbacks]) => {
				setFeedbacks(feedbacks || [])
				setLoadStatus(loadStatusKey, true)
			})
			.catch((e) => {
				setLoadStatus(loadStatusKey, 'Failed to load feedbacks')
				console.error('Failed to load bank feedbacks', e)
			})
	}, [context.socket, getCommand, setLoadStatus, loadStatusKey, page, bank, reloadToken])

	const setValue = useCallback(
		(feedbackId, key, val) => {
			// The server doesn't repond to our change, so we assume it was ok
			setFeedbacks((oldFeedbacks) => {
				const feedbackIndex = oldFeedbacks.findIndex((a) => a.id === feedbackId)

				const oldValue = (oldFeedbacks[feedbackIndex].options || {})[key]
				if (oldValue !== val) {
					context.socket.emit(updateOption, page, bank, feedbackId, key, val)

					return update(oldFeedbacks, {
						[feedbackIndex]: {
							options: {
								[key]: { $set: val },
							},
						},
					})
				} else {
					return oldFeedbacks
				}
			})
		},
		[context.socket, page, bank, updateOption]
	)

	const deleteFeedback = useCallback((feedbackId) => {
		setFeedbacks((oldFeedbacks) => oldFeedbacks.filter((a) => a.id !== feedbackId))
	}, [])
	const doDelete = useCallback(
		(feedbackId) => {
			confirmModal.current.show('Delete feedback', 'Delete feedback?', 'Delete', () => {
				context.socket.emit(deleteCommand, page, bank, feedbackId)
				deleteFeedback(feedbackId)
			})
		},
		[context.socket, page, bank, deleteCommand, deleteFeedback]
	)

	const addFeedback = useCallback(
		(feedackTypr) => {
			socketEmit(context.socket, addCommand, [page, bank, feedackTypr])
				.then(([page, bank, feedbacks]) => {
					setFeedbacks(feedbacks || [])
				})
				.catch((e) => {
					console.error('Failed to add bank feedback', e)
				})
		},
		[context.socket, addCommand, bank, page]
	)

	const moveCard = useCallback(
		(dragIndex, hoverIndex) => {
			// The server doesn't repond to our change, so we assume it was ok
			context.socket.emit(orderCommand, page, bank, dragIndex, hoverIndex)

			setFeedbacks((feedbacks) => {
				const dragCard = feedbacks[dragIndex]
				return update(feedbacks, {
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

			<table className="table feedback-table">
				<tbody>
					{feedbacks.map((a, i) => (
						<FeedbackTableRow
							key={a?.id ?? i}
							index={i}
							feedback={a}
							setValue={setValue}
							doDelete={doDelete}
							dragId={dragId}
							moveCard={moveCard}
						/>
					))}
				</tbody>
			</table>

			<AddFeedbackDropdown onSelect={addFeedback} />
		</>
	)
}

function FeedbackTableRow({ feedback, index, dragId, moveCard, setValue, doDelete }) {
	const context = useContext(CompanionContext)

	const innerDelete = useCallback(() => doDelete(feedback.id), [feedback.id, doDelete])

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
			actionId: feedback.id,
			index: index,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	if (!feedback) {
		// Invalid feedback, so skip
		return ''
	}

	const instance = context.instances[feedback.instance_id]
	// const module = instance ? context.modules[instance.instance_type] : undefined
	const instanceLabel = instance?.label ?? feedback.instance_id

	const feedbackSpec = (context.feedbacks[feedback.instance_id] || {})[feedback.type]
	const options = feedbackSpec?.options ?? []

	let name = ''
	if (feedbackSpec) {
		name = `${instanceLabel}: ${feedbackSpec.label}`
	} else {
		name = `${instanceLabel}: ${feedback.type} (undefined)`
	}

	return (
		<tr ref={ref} className={isDragging ? 'feedbacklist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>
				<div className="editor-grid">
					<div className="cell-name">{name}</div>

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
										actionId={feedback.id}
										value={(feedback.options || {})[opt.id]}
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

function AddFeedbackDropdown({ onSelect }) {
	const context = useContext(CompanionContext)

	const options = useMemo(() => {
		const options = []
		for (const [instanceId, feedbacks] of Object.entries(context.feedbacks)) {
			for (const [feedbackId, feedback] of Object.entries(feedbacks)) {
				const instanceLabel = context.instances[instanceId]?.label ?? instanceId
				options.push({ value: `${instanceId}:${feedbackId}`, label: `${instanceLabel}: ${feedback.label}` })
			}
		}
		return options
	}, [context.feedbacks, context.instances])

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
			menuPlacement="top"
			isClearable={false}
			isSearchable={true}
			isMulti={false}
			options={options}
			placeholder="+ Add feedback"
			value={null}
			onChange={innerChange}
		/>
	)
}
