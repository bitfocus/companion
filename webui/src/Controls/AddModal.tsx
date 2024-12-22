import { CButton, CCard, CCardBody, CCollapse, CFormInput, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { assertNever, useComputed } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { capitalize } from 'lodash-es'
import { CModalExt } from '../Components/CModalExt.js'
import { go as fuzzySearch } from 'fuzzysort'
import { ObservableMap } from 'mobx'
import { ClientActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import { ClientFeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import { RecentlyUsedIdsStore } from '../Stores/RecentlyUsedIdsStore.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

interface AddEntitiesModalProps {
	addEntity: (connectionId: string, definitionId: string) => void
	onlyFeedbackType: 'boolean' | 'advanced' | null
	entityType: EntityModelType
	entityTypeLabel: string
}
export interface AddEntitiesModalRef {
	show(): void
}

export const AddEntitiesModal = observer(
	forwardRef<AddEntitiesModalRef, AddEntitiesModalProps>(function AddFeedbacksModal(
		{ addEntity, onlyFeedbackType, entityType, entityTypeLabel },
		ref
	) {
		const { feedbackDefinitions, actionDefinitions, recentlyAddedFeedbacks, recentlyAddedActions } =
			useContext(RootAppStoreContext)

		let recentlyUsed: RecentlyUsedIdsStore

		switch (entityType) {
			case EntityModelType.Action:
				recentlyUsed = recentlyAddedActions
				break
			case EntityModelType.Feedback:
				recentlyUsed = recentlyAddedFeedbacks
				break
			default:
				assertNever(entityType)
				throw new Error(`Invalid entity type: ${entityType}`)
		}

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

		const addAndTrackRecentUsage = useCallback(
			(connectionAndDefinitionId: string) => {
				recentlyUsed.trackId(connectionAndDefinitionId)

				const [connectionId, definitionId] = connectionAndDefinitionId.split(':', 2)
				addEntity(connectionId, definitionId)
			},
			[recentlyUsed, addEntity]
		)

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
				<CModalHeader closeButton>
					<h5>Browse {capitalize(entityTypeLabel)}s</h5>
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
					{entityType === EntityModelType.Feedback &&
						Array.from(feedbackDefinitions.connections.entries()).map(([connectionId, items]) => (
							<ConnectionCollapse
								key={connectionId}
								connectionId={connectionId}
								items={items}
								itemName={`${entityTypeLabel}s`}
								expanded={!!filter || expanded[connectionId]}
								filter={filter}
								onlyFeedbackType={onlyFeedbackType}
								doToggle={toggleExpanded}
								doAdd={addAndTrackRecentUsage}
							/>
						))}
					{entityType === EntityModelType.Action &&
						Array.from(actionDefinitions.connections.entries()).map(([connectionId, items]) => (
							<ConnectionCollapse
								key={connectionId}
								connectionId={connectionId}
								items={items}
								itemName={`${entityTypeLabel}s`}
								expanded={!!filter || expanded[connectionId]}
								filter={filter}
								onlyFeedbackType={null}
								doToggle={toggleExpanded}
								doAdd={addAndTrackRecentUsage}
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

type TDefBase = ClientActionDefinition | ClientFeedbackDefinition

interface ConnectionCollapseProps<TDef> {
	connectionId: string
	items: ObservableMap<string, TDef> | undefined
	itemName: string
	expanded: boolean
	filter: string
	onlyFeedbackType: string | null
	doToggle: (connectionId: string) => void
	doAdd: (itemId: string) => void
}

const ConnectionCollapse = observer(function ConnectionCollapse<TDef extends TDefBase>({
	connectionId,
	items,
	itemName,
	expanded,
	filter,
	onlyFeedbackType: onlyType,
	doToggle,
	doAdd,
}: ConnectionCollapseProps<TDef>) {
	const { connections } = useContext(RootAppStoreContext)

	const connectionInfo = connections.getInfo(connectionId)

	const doToggleClick = useCallback(() => doToggle(connectionId), [doToggle, connectionId])

	const allValues: ConnectionItem[] = useComputed(() => {
		if (!items) return []

		return Array.from(items.entries())
			.map(([id, info]) => {
				if (!info || !info.label) return null
				if (onlyType && (!('type' in info) || info.type !== onlyType)) return null

				return {
					fullId: `${connectionId}:${id}`,
					label: info.label,
					description: info.description,
				}
			})
			.filter((v): v is ConnectionItem => !!v)
	}, [items, onlyType])

	const searchResults = filter
		? fuzzySearch(filter, allValues, {
				keys: ['label'],
				threshold: -10_000,
			}).map((x) => x.obj)
		: allValues

	searchResults.sort((a, b) => a.label.localeCompare(b.label))

	if (!items || items.size === 0) {
		// Hide card if there are no actions which match
		return null
	} else {
		return (
			<CCard className={'add-browse-card'}>
				<div className="header" onClick={doToggleClick}>
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
})

interface AddRowProps {
	info: ConnectionItem
	id: string
	doAdd: (itemId: string) => void
}
function AddRow({ info, id, doAdd }: AddRowProps) {
	const doAddClick = useCallback(() => doAdd(id), [doAdd, id])

	return (
		<tr onClick={doAddClick} className="clickable-add-item">
			<td>
				<span className="item-label">{info.label}</span>
				<br />
				{info.description || ''}
			</td>
		</tr>
	)
}
