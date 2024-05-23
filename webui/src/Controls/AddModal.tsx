import {
	CAlert,
	CButton,
	CCard,
	CCardBody,
	CCollapse,
	CFormInput,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { ConnectionsContext, useComputed } from '../util.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ConnectionActionDefinitions } from '../Stores/ActionDefinitionsStore.js'
import { ConnectionFeedbackDefinitions } from '../Stores/FeedbackDefinitionsStore.js'

interface AddActionsModalProps {
	addAction: (actionType: string) => void
}
export interface AddActionsModalRef {
	show(): void
}

export const AddActionsModal = observer(
	forwardRef<AddActionsModalRef, AddActionsModalProps>(function AddActionsModal({ addAction }, ref) {
		const { recentlyAddedActions, actionDefinitions } = useContext(RootAppStoreContext)
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

		const [expanded, setExpanded] = useState<Record<string, boolean>>({})
		const toggleExpanded = useCallback((id: string) => {
			setExpanded((oldVal) => {
				return {
					...oldVal,
					[id]: !oldVal[id],
				}
			})
		}, [])
		const [filter, setFilter] = useState('')

		const addAction2 = useCallback(
			(actionType: string) => {
				recentlyAddedActions.trackId(actionType)

				addAction(actionType)
			},
			[recentlyAddedActions, addAction]
		)

		return (
			<CModal visible={show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
				<CModalHeader closeButton>
					<h5>Browse Actions</h5>
				</CModalHeader>
				<CModalHeader>
					<CFormInput
						type="text"
						placeholder="Search..."
						onChange={(e) => setFilter(e.currentTarget.value)}
						value={filter}
						autoFocus={true}
						style={{ fontSize: '1.5em' }}
					/>
				</CModalHeader>
				<CModalBody className="shadow-inset">
					{Array.from(actionDefinitions.connections.entries()).map(([connectionId, actions]) => (
						<ConnectionCollapse
							key={connectionId}
							connectionId={connectionId}
							connectionInfo={connections[connectionId]}
							items={actions}
							itemName="actions"
							expanded={!!filter || expanded[connectionId]}
							filter={filter}
							doToggle={toggleExpanded}
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
)

interface AddFeedbacksModalProps {
	addFeedback: (feedbackType: string) => void
	booleanOnly: boolean
}
export interface AddFeedbacksModalRef {
	show(): void
}

export const AddFeedbacksModal = observer(
	forwardRef<AddFeedbacksModalRef, AddFeedbacksModalProps>(function AddFeedbacksModal(
		{ addFeedback, booleanOnly },
		ref
	) {
		const { feedbackDefinitions, recentlyAddedFeedbacks } = useContext(RootAppStoreContext)
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

		const [expanded, setExpanded] = useState<Record<string, boolean>>({})
		const toggleExpanded = useCallback((id: string) => {
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
				recentlyAddedFeedbacks.trackId(feedbackType)

				addFeedback(feedbackType)
			},
			[recentlyAddedFeedbacks, addFeedback]
		)

		return (
			<CModal visible={show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
				<CModalHeader closeButton>
					<h5>Browse Feedbacks</h5>
				</CModalHeader>
				<CModalHeader>
					<CFormInput
						type="text"
						placeholder="Search ..."
						onChange={(e) => setFilter(e.currentTarget.value)}
						value={filter}
						style={{ fontSize: '1.2em' }}
					/>
				</CModalHeader>
				<CModalBody>
					{Array.from(feedbackDefinitions.connections.entries()).map(([connectionId, items]) => (
						<ConnectionCollapse
							key={connectionId}
							connectionId={connectionId}
							connectionInfo={connections[connectionId]}
							items={items}
							itemName="feedbacks"
							expanded={!!filter || expanded[connectionId]}
							filter={filter}
							booleanOnly={booleanOnly}
							doToggle={toggleExpanded}
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
)

interface ConnectionCollapseProps {
	connectionId: string
	connectionInfo: ClientConnectionConfig | undefined
	items: ConnectionActionDefinitions | ConnectionFeedbackDefinitions | undefined
	itemName: string
	expanded: boolean
	filter: string
	booleanOnly?: boolean
	doToggle: (connectionId: string) => void
	doAdd: (itemId: string) => void
}

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
}: ConnectionCollapseProps) {
	const doToggle2 = useCallback(() => doToggle(connectionId), [doToggle, connectionId])

	const candidates = useComputed(() => {
		try {
			const regexp = new RegExp(filter, 'i')

			const res = []
			if (items) {
				for (const [id, info] of items.entries()) {
					if (!info || (booleanOnly && (!('type' in info) || info.type !== 'boolean'))) continue

					if (info.label?.match(regexp)) {
						const fullId = `${connectionId}:${id}`
						res.push({
							...info,
							fullId: fullId,
						})
					}
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

	if (!items || Object.keys(items).length === 0) {
		// Hide card if there are no actions which match
		return null
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

interface AddRowProps {
	info: { label: string; description?: string }
	id: string
	doAdd: (itemId: string) => void
}
function AddRow({ info, id, doAdd }: AddRowProps) {
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
