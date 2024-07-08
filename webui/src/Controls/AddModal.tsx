import { CButton, CCard, CCardBody, CCollapse, CFormInput, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { ConnectionsContext, useComputed } from '../util.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ConnectionActionDefinitions } from '../Stores/ActionDefinitionsStore.js'
import { ConnectionFeedbackDefinitions } from '../Stores/FeedbackDefinitionsStore.js'
import { capitalize } from 'lodash-es'
import { CModalExt } from '../Components/CModalExt.js'
import { go as fuzzySearch } from 'fuzzysort'

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
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
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
			</CModalExt>
		)
	})
)

interface AddFeedbacksModalProps {
	addFeedback: (feedbackType: string) => void
	booleanOnly: boolean
	entityType: string
}
export interface AddFeedbacksModalRef {
	show(): void
}

export const AddFeedbacksModal = observer(
	forwardRef<AddFeedbacksModalRef, AddFeedbacksModalProps>(function AddFeedbacksModal(
		{ addFeedback, booleanOnly, entityType },
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
			(feedbackType: string) => {
				recentlyAddedFeedbacks.trackId(feedbackType)

				addFeedback(feedbackType)
			},
			[recentlyAddedFeedbacks, addFeedback]
		)

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
				<CModalHeader closeButton>
					<h5>Browse {capitalize(entityType)}s</h5>
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
			</CModalExt>
		)
	})
)

interface ConnectionItem {
	fullId: string
	label: string
	description: string | undefined
}

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

	const allValues: ConnectionItem[] = useComputed(() => {
		if (!items) return []

		return Array.from(items.entries())
			.map(([id, info]) => {
				if (!info || (booleanOnly && (!('type' in info) || info.type !== 'boolean'))) return null

				const fullId = `${connectionId}:${id}`
				return {
					fullId: fullId,
					label: info.label,
					description: info.description,
				}
			})
			.filter((v): v is ConnectionItem => !!v)
	}, [items, booleanOnly])

	const searchResults = filter
		? fuzzySearch(filter, allValues, {
				keys: ['label'],
				threshold: -10_000,
			}).map((x) => x.obj)
		: allValues

	searchResults.sort((a, b) => a.label.localeCompare(b.label))

	if (!items || Object.keys(items).length === 0) {
		// Hide card if there are no actions which match
		return null
	} else {
		return (
			<CCard className={'add-browse-card'}>
				<div className="header" onClick={doToggle2}>
					{connectionInfo?.label || connectionId}
				</div>
				<CCollapse visible={expanded}>
					<CCardBody>
						{searchResults.length > 0 ? (
							<table className="table">
								<tbody>
									{searchResults.map((info) => (
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
	info: ConnectionItem
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
