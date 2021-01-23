import { CButton, CForm } from "@coreui/react"
import { faSort, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { CompanionContext, socketEmit } from "../util"
import update from 'immutability-helper';
import Select from "react-select"
import { ActionTableRowOption, ErrorFallback } from './Table'

export const FeedbacksPanel = forwardRef(function ({ page, bank, addCommand, getCommand, updateOption, deleteCommand }, ref) {
	const context = useContext(CompanionContext)
	const [feedbacks, setFeedbacks] = useState([])

	// Define a reusable loadData function
	const loadData = useCallback((page, bank) => {
		socketEmit(context.socket, getCommand, [page, bank]).then(([page, bank, feedbacks]) => {
			setFeedbacks(feedbacks || [])
		}).catch(e => {
			console.error('Failed to load bank feedbacks', e)
		})
	}, [context.socket, getCommand])

	// Ensure the correct data is loaded
	useEffect(() => {
		loadData(page, bank)
	}, [loadData, page, bank])

	// Expose reload to the parent
	useImperativeHandle(ref, () => ({
		reload() {
			loadData(page, bank)
		}
	}), [loadData, page, bank])

	const setValue = useCallback((feedbackId, key, val) => {
		// The server doesn't repond to our change, so we assume it was ok
		setFeedbacks(oldFeedbacks => {
			const feedbackIndex = oldFeedbacks.findIndex(a => a.id === feedbackId)

			const oldValue = (oldFeedbacks[feedbackIndex].options || {})[key]
			if (oldValue !== val) {
				context.socket.emit(updateOption, page, bank, feedbackId, key, val);

				return update(oldFeedbacks, {
					[feedbackIndex]: {
						options: {
							[key]: { $set: val }
						}
					}
				})
			} else {
				return oldFeedbacks
			}
		})
	}, [context.socket, page, bank, updateOption])

	const doDelete = useCallback((feedbackId) => {
		if (window.confirm('Delete feedback?')) {
			socketEmit(context.socket, deleteCommand, [page, bank, feedbackId]).then(([page, bank, feedbacks]) => {
				setFeedbacks(feedbacks || [])
			}).catch(e => {
				console.error('Failed to load bank feedbacks', e)
			})
		}
	}, [context.socket, page, bank, deleteCommand])

	const addFeedback = useCallback((feedackTypr) => {
		socketEmit(context.socket, addCommand, [page, bank, feedackTypr]).then(([page, bank, feedbacks]) => {
			setFeedbacks(feedbacks || [])
		}).catch(e => {
			console.error('Failed to add bank feedback', e)
		})
	}, [context.socket, addCommand, bank, page])

	return (
		<>
			<table className='table feedback-table'>
				<thead>
					<tr>
						<th></th>
						<th colspan="2">Feedback</th>
						<th>Options</th>
					</tr>
				</thead>
				<tbody>
					{feedbacks.map((a, i) => <FeedbackTableRow key={a?.id ?? i} feedback={a} setValue={setValue} doDelete={doDelete} />)}
				</tbody>
			</table>

			<AddFeedbackDropdown
				onSelect={addFeedback}
			/>
		</>
	)
})

function FeedbackTableRow({ feedback, setValue, doDelete }) {
	const context = useContext(CompanionContext)

	const innerDelete = useCallback(() => doDelete(feedback.id), [feedback.id, doDelete])

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
		name = `${instanceLabel}: ${feedbackSpec.label}`;
	} else {
		const feedbackId = feedback.label.split(/:/)[1]
		name = `${instanceLabel}: ${feedbackId} (undefined)`;
	}

	return (
		<tr>
			<td class='feedbacklist-td-reorder'>
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td class='feedbacklist-td-delete'>
				<CButton color="danger" size="sm" onClick={innerDelete}>
					<FontAwesomeIcon icon={faTrash} />
				</CButton>
			</td>
			<td className='feedbacklist-td-label'>{name}</td>
			<td class='feedbacklist-td-options'>
				<CForm className="feedbacks-options">
					{
						options.map(opt => <ErrorBoundary FallbackComponent={ErrorFallback}>
							<ActionTableRowOption
								option={opt}
								actionId={feedback.id}
								value={(feedback.options || {})[opt.id]}
								setValue={setValue}
							/>
						</ErrorBoundary>)
					}
				</CForm>
			</td>
		</tr>
	)
}


function AddFeedbackDropdown({ onSelect }) {
	const context = useContext(CompanionContext)

	const options = useMemo(() => {
		const options = []
		for (const [instanceId, feedbacks] of Object.entries(context.feedbacks)) {
			console.log(feedbacks)
			for (const [feedbackId, feedback] of Object.entries(feedbacks)) {
				const instanceLabel = context.instances[instanceId]?.label ?? instanceId
				options.push ({ value: `${instanceId}:${feedbackId}`, label: `${instanceLabel}: ${feedback.label}` })
			}
		}
		return options
	}, [context.feedbacks, context.instances])

	const innerChange = useCallback((e) => {
		console.log(e.value)
		if (e.value) {
			onSelect(e.value)
		}
	}, [onSelect])

	return <Select
		isClearable={false}
		isSearchable={true}
		isMulti={false}
		options={options}
		value={null}
		onChange={innerChange}
	/>
}