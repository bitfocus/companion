import {
	CAlert,
	CButton,
	CCard,
	CCardBody,
	CCardHeader,
	CCollapse,
	CInput,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useMemo, useState } from 'react'
import { ActionsContext, FeedbacksContext, InstancesContext } from '../util'

export const AddActionsModal = forwardRef(function AddActionsModal({ addAction }, ref) {
	const actions = useContext(ActionsContext)
	const instances = useContext(InstancesContext)

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

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
			<CModalHeader closeButton>
				<h5>Browse Actions</h5>
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
				{Object.entries(actions).map(([instanceId, items]) => (
					<InstanceCollapse
						key={instanceId}
						instanceId={instanceId}
						instanceInfo={instances[instanceId]}
						items={items}
						itemName="actions"
						expanded={!!filter || expanded[instanceId]}
						filter={filter}
						doToggle={toggle}
						doAdd={addAction}
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
	const feedbacks = useContext(FeedbacksContext)
	const instances = useContext(InstancesContext)

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
				{Object.entries(feedbacks).map(([instanceId, items]) => (
					<InstanceCollapse
						key={instanceId}
						instanceId={instanceId}
						instanceInfo={instances[instanceId]}
						items={items}
						itemName="feedbacks"
						expanded={!!filter || expanded[instanceId]}
						filter={filter}
						booleanOnly={booleanOnly}
						doToggle={toggle}
						doAdd={addFeedback}
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

function InstanceCollapse({
	instanceId,
	instanceInfo,
	items,
	itemName,
	expanded,
	filter,
	booleanOnly,
	doToggle,
	doAdd,
}) {
	const doToggle2 = useCallback(() => doToggle(instanceId), [doToggle, instanceId])

	const candidates = useMemo(() => {
		try {
			const regexp = new RegExp(filter, 'i')

			const res = []
			for (const [id, info] of Object.entries(items)) {
				if (booleanOnly && info.type !== 'boolean') continue

				if (info.label?.match(regexp)) {
					const fullId = `${instanceId}:${id}`
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
	}, [items, filter, instanceId, itemName, booleanOnly])

	if (Object.keys(items).length === 0) {
		// Hide card if there are no actions which match
		return ''
	} else {
		return (
			<CCard className={'add-browse-card'}>
				<CCardHeader onClick={doToggle2}>{instanceInfo?.label || instanceId}</CCardHeader>
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
		<tr>
			{/* <p>{id}</p> */}
			<td>
				<span className="item-label">{info.label}</span>
				<br />
				{info.description || ''}
			</td>
			<td>
				<CButton color="primary" onClick={doAdd2}>
					Add
				</CButton>
			</td>
		</tr>
	)
}
