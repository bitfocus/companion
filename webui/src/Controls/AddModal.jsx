import {
	CAlert,
	CButton,
	CCard,
	CCardBody,
	CCollapse,
	CInput,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useMemo, useState } from 'react'
import {
	ActionsContext,
	FeedbacksContext,
	ConnectionsContext,
	RecentActionsContext,
	RecentFeedbacksContext,
} from '../util'

export const AddActionsModal = forwardRef(function AddActionsModal({ addAction }, ref) {
	const recentActionsContext = useContext(RecentActionsContext)
	const actions = useContext(ActionsContext)
	const connections = useContext(ConnectionsContext)

	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setFilter('')
	}, [])

	useImperativeHandle(
		ref,
		() => ({
			show() {
				setShow(true)
				setFilter('')
			},
		}),
		[]
	)

	const [expanded, setExpanded] = useState({})
	const toggle = useCallback((id) => {
		setExpanded((oldVal) => {
			return {
				...oldVal,
				[id]: !oldVal[id],
			}
		})
	}, [])
	const [filter, setFilter] = useState('')

	const addAction2 = useCallback(
		(actionType) => {
			recentActionsContext.trackRecentAction(actionType)

			addAction(actionType)
		},
		[recentActionsContext, addAction]
	)

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
			<CModalHeader closeButton>
				<h5>Browse Actions</h5>
			</CModalHeader>
			<CModalHeader>
				<CInput
					type="text"
					placeholder="Search..."
					onChange={(e) => setFilter(e.currentTarget.value)}
					value={filter}
					autoFocus={true}
					style={{ fontSize: '1.5em' }}
				/>
			</CModalHeader>
			<CModalBody className="shadow-inset">
				{Object.entries(actions).map(([connectionId, items]) => (
					<ConnectionCollapse
						key={connectionId}
						connectionId={connectionId}
						connectionInfo={connections[connectionId]}
						items={items}
						itemName="actions"
						expanded={!!filter || expanded[connectionId]}
						filter={filter}
						doToggle={toggle}
						doAdd={addAction2}
					/>
				))}
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Done
				</CButton>
			</CModalFooter>
		</CModal>
	)
})

export const AddFeedbacksModal = forwardRef(function AddFeedbacksModal({ addFeedback, booleanOnly }, ref) {
	const recentFeedbacksContext = useContext(RecentFeedbacksContext)
	const feedbacks = useContext(FeedbacksContext)
	const connections = useContext(ConnectionsContext)

	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setFilter('')
	}, [])

	useImperativeHandle(
		ref,
		() => ({
			show() {
				setShow(true)
				setFilter('')
			},
		}),
		[]
	)

	const [expanded, setExpanded] = useState({})
	const toggle = useCallback((id) => {
		setExpanded((oldVal) => {
			return {
				...oldVal,
				[id]: !oldVal[id],
			}
		})
	}, [])
	const [filter, setFilter] = useState('')

	const addFeedback2 = useCallback(
		(feedbackType) => {
			recentFeedbacksContext.trackRecentFeedback(feedbackType)

			addFeedback(feedbackType)
		},
		[recentFeedbacksContext, addFeedback]
	)

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
			<CModalHeader closeButton>
				<h5>Browse Feedbacks</h5>
			</CModalHeader>
			<CModalHeader>
				<CInput
					type="text"
					placeholder="Search ..."
					onChange={(e) => setFilter(e.currentTarget.value)}
					value={filter}
					style={{ fontSize: '1.2em' }}
				/>
			</CModalHeader>
			<CModalBody>
				{Object.entries(feedbacks).map(([connectionId, items]) => (
					<ConnectionCollapse
						key={connectionId}
						connectionId={connectionId}
						connectionInfo={connections[connectionId]}
						items={items}
						itemName="feedbacks"
						expanded={!!filter || expanded[connectionId]}
						filter={filter}
						booleanOnly={booleanOnly}
						doToggle={toggle}
						doAdd={addFeedback2}
					/>
				))}
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Done
				</CButton>
			</CModalFooter>
		</CModal>
	)
})

function ConnectionCollapse({
	connectionId,
	connectionInfo,
	items,
	itemName,
	expanded,
	filter,
	booleanOnly,
	doToggle,
	doAdd,
}) {
	const doToggle2 = useCallback(() => doToggle(connectionId), [doToggle, connectionId])

	const candidates = useMemo(() => {
		try {
			const regexp = new RegExp(filter, 'i')

			const res = []
			for (const [id, info] of Object.entries(items)) {
				if (booleanOnly && info.type !== 'boolean') continue

				if (info.label?.match(regexp)) {
					const fullId = `${connectionId}:${id}`
					res.push({
						...info,
						fullId: fullId,
					})
				}
			}

			// Sort by label
			res.sort((a, b) => a.label.localeCompare(b.label))

			return res
		} catch (e) {
			console.error('Failed to compile candidates list:', e)

			return (
				<CAlert color="warning" role="alert">
					Failed to build list of {itemName}:
					<br />
					{e}
				</CAlert>
			)
		}
	}, [items, filter, connectionId, itemName, booleanOnly])

	if (Object.keys(items).length === 0) {
		// Hide card if there are no actions which match
		return ''
	} else {
		return (
			<CCard className={'add-browse-card'}>
				<div className="header" onClick={doToggle2}>
					{connectionInfo?.label || connectionId}
				</div>
				<CCollapse show={expanded}>
					<CCardBody>
						{!Array.isArray(candidates) ? (
							candidates
						) : candidates.length > 0 ? (
							<table className="table">
								<tbody>
									{candidates.map((info) => (
										<AddRow key={info.fullId} info={info} id={info.fullId} doAdd={doAdd} />
									))}
								</tbody>
							</table>
						) : (
							<p className="no-entries">No {itemName} match the search</p>
						)}
					</CCardBody>
				</CCollapse>
			</CCard>
		)
	}
}

function AddRow({ info, id, doAdd }) {
	const doAdd2 = useCallback(() => doAdd(id), [doAdd, id])

	return (
		<tr onClick={doAdd2} className="clickable-add-item">
			<td>
				<span className="item-label">{info.label}</span>
				<br />
				{info.description || ''}
			</td>
		</tr>
	)
}
