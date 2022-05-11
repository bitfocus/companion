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
import { ActionsContext, FeedbacksContext, InstancesContext } from '../../util'

export const AddActionsModal = forwardRef(function AddActionsModal({ addAction }, ref) {
	const actions = useContext(ActionsContext)
	const instances = useContext(InstancesContext)

	const [selected, setSelected] = useState({})
	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setSelected({})
		setFilter('')
	}, [])
	const doAdd = useCallback(() => {
		for (const [id, count] of Object.entries(selected)) {
			for (let i = 0; i < count; i++) {
				addAction(id, i)
			}
		}

		setShow(false)
	}, [selected, addAction])

	useImperativeHandle(
		ref,
		() => ({
			show() {
				setShow(true)
				setSelected({})
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

	const setSelected2 = useCallback(
		(id, val) => {
			setSelected((oldVal) => ({
				...oldVal,
				[id]: val,
			}))
		},
		[setSelected]
	)

	const addEnabled = useMemo(() => {
		return !!Object.values(selected).find((v) => typeof v === 'number' && v > 0)
	}, [selected])

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
						instanceId={instanceId}
						instanceInfo={instances[instanceId]}
						items={items}
						itemName="actions"
						expanded={!!filter || expanded[instanceId]}
						filter={filter}
						doToggle={toggle}
						selected={selected}
						setSelected={setSelected2}
					/>
				))}
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton color="primary" onClick={doAdd} disabled={!addEnabled}>
					Add
				</CButton>
			</CModalFooter>
		</CModal>
	)
})

export const AddFeedbacksModal = forwardRef(function AddFeedbacksModal({ addFeedback }, ref) {
	const feedbacks = useContext(FeedbacksContext)
	const instances = useContext(InstancesContext)

	const [selected, setSelected] = useState({})
	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setSelected({})
		setFilter('')
	}, [])
	const doAdd = useCallback(() => {
		for (const [id, count] of Object.entries(selected)) {
			for (let i = 0; i < count; i++) {
				addFeedback(id, i)
			}
		}

		setShow(false)
	}, [selected, addFeedback])

	useImperativeHandle(
		ref,
		() => ({
			show() {
				setShow(true)
				setSelected({})
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

	const setSelected2 = useCallback(
		(id, val) => {
			setSelected((oldVal) => ({
				...oldVal,
				[id]: val,
			}))
		},
		[setSelected]
	)

	const addEnabled = useMemo(() => {
		return !!Object.values(selected).find((v) => typeof v === 'number' && v > 0)
	}, [selected])

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
						instanceId={instanceId}
						instanceInfo={instances[instanceId]}
						items={items}
						itemName="feedbacks"
						expanded={!!filter || expanded[instanceId]}
						filter={filter}
						doToggle={toggle}
						selected={selected}
						setSelected={setSelected2}
					/>
				))}
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton color="primary" onClick={doAdd} disabled={!addEnabled}>
					Add
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
	doToggle,
	selected,
	setSelected,
}) {
	const doToggle2 = useCallback(() => doToggle(instanceId), [doToggle, instanceId])

	const candidates = useMemo(() => {
		try {
			const regexp = new RegExp(filter, 'i')

			const res = []
			for (const [id, info] of Object.entries(items)) {
				if (info.label.match(regexp)) {
					const fullId = `${instanceId}:${id}`
					res.push({
						...info,
						fullId: fullId,
					})
				}
			}

			return res
		} catch (e) {
			console.error('Failed to compile candidates list:', e)

			return [
				<CAlert color="warning" role="alert">
					Failed to build list of {itemName}:
					<br />
					{e}
				</CAlert>,
			]
		}
	}, [items, filter, instanceId, itemName])

	if (Object.keys(items).length === 0) {
		// Hide card if there are no actions which match
		return ''
	} else {
		return (
			<CCard className={'add-browse-card'}>
				<CCardHeader onClick={doToggle2}>{instanceInfo?.label || instanceId}</CCardHeader>
				<CCollapse show={expanded}>
					<CCardBody>
						{candidates.length > 0 ? (
							<table class="table">
								{candidates.map((info) => (
									<AddRow
										key={info.fullId}
										info={info}
										id={info.fullId}
										selected={selected[info.fullId]}
										setSelected={setSelected}
									/>
								))}
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

function AddRow({ info, selected, id, setSelected }) {
	const setSelected2 = useCallback(
		(e) => {
			setSelected(id, Number(e.currentTarget.value))
		},
		[setSelected, id]
	)
	return (
		<tr>
			{/* <p>{id}</p> */}
			<td>
				<span className="item-label">{info.label}</span>
				<br />
				{info.description || ''}
			</td>
			<td className="add-count">
				<CInput type="number" min={0} step={1} value={selected ?? 0} onChange={setSelected2} />
			</td>
		</tr>
	)
}
