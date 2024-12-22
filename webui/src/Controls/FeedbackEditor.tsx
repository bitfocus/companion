import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { MyErrorBoundary, checkDragState } from '../util.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider, usePanelCollapseHelperContextForPanel } from '../Helpers/CollapseHelper.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { isEqual } from 'lodash-es'
import { findAllEntityIdsDeep, stringifyEntityOwnerId } from './Util.js'
import {
	EntityModelType,
	EntityOwner,
	FeedbackEntityModel,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import {
	useControlEntityService,
	useControlEntitiesEditorService,
	IEntityEditorService,
} from '../Services/Controls/ControlEntitiesService.js'
import { EntityDropPlaceholderZone, EntityListDragItem } from './Components/EntityListDropZone.js'
import { EntityRowHeader } from './Components/EntityCellControls.js'
import { AddEntityPanel } from './Components/AddEntityPanel.js'
import { EntityCommonCells } from './Components/EntityCommonCells.js'
import { EntityEditorHeading } from './Components/EntityEditorHeadingProps.js'
import { EntityManageChildGroups } from './Components/EntityChildGroup.js'

interface ControlFeedbacksEditorProps {
	controlId: string
	feedbacks: SomeEntityModel[]
	heading: JSX.Element | string
	entityTypeLabel: string
	onlyType: 'boolean' | 'advanced' | null
	location: ControlLocation | undefined
}

export function ControlFeedbacksEditor({
	controlId,
	feedbacks,
	heading,
	entityTypeLabel,
	onlyType,
	location,
}: ControlFeedbacksEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const feedbacksService = useControlEntitiesEditorService(
		controlId,
		'feedbacks',
		entityTypeLabel,
		EntityModelType.Feedback,
		confirmModal
	)

	const feedbackIds = useMemo(() => findAllEntityIdsDeep(feedbacks), [feedbacks])

	return (
		<PanelCollapseHelperProvider storageId={`feedbacks_${controlId}`} knownPanelIds={feedbackIds}>
			<GenericConfirmModal ref={confirmModal} />

			<InlineFeedbacksEditor
				controlId={controlId}
				heading={heading}
				feedbacks={feedbacks}
				entityTypeLabel={entityTypeLabel}
				onlyType={onlyType}
				location={location}
				feedbacksService={feedbacksService}
				ownerId={null}
			/>
		</PanelCollapseHelperProvider>
	)
}

interface InlineFeedbacksEditorProps {
	controlId: string
	heading: JSX.Element | string | null
	feedbacks: SomeEntityModel[]
	entityTypeLabel: string
	onlyType: 'boolean' | 'advanced' | null
	location: ControlLocation | undefined
	feedbacksService: IEntityEditorService
	ownerId: EntityOwner | null
}

export const InlineFeedbacksEditor = observer(function InlineFeedbacksEditor({
	controlId,
	heading,
	feedbacks,
	entityTypeLabel,
	onlyType,
	location,
	feedbacksService,
	ownerId,
}: InlineFeedbacksEditorProps) {
	const addFeedback = useCallback(
		(connectionId: string, definitionId: string) => feedbacksService.addEntity(connectionId, definitionId, ownerId),
		[feedbacksService, ownerId]
	)

	return (
		<>
			<EntityEditorHeading heading={heading} ownerId={ownerId} childEntityIds={feedbacks.map((f) => f.id)} />

			<table className="table feedback-table">
				<tbody>
					{feedbacks.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<FeedbackTableRow
								key={a?.id ?? i}
								controlId={controlId}
								ownerId={ownerId}
								entityTypeLabel={entityTypeLabel}
								index={i}
								feedback={a}
								dragId={`feedbacks_${controlId}`}
								serviceFactory={feedbacksService}
								onlyType={onlyType}
								location={location}
							/>
						</MyErrorBoundary>
					))}
					{!!ownerId && (
						<EntityDropPlaceholderZone
							dragId={`feedbacks_${controlId}`}
							ownerId={ownerId}
							listId={feedbacksService.listId}
							entityCount={feedbacks ? feedbacks.length : 0}
							entityTypeLabel={entityTypeLabel}
							moveCard={feedbacksService.moveCard}
						/>
					)}
				</tbody>
			</table>

			<AddEntityPanel
				addEntity={addFeedback}
				entityType={EntityModelType.Feedback}
				onlyFeedbackType={onlyType}
				entityTypeLabel={entityTypeLabel}
			/>
		</>
	)
})

interface FeedbackTableRowDragItem extends EntityListDragItem {}
interface FeedbackTableRowDragStatus {
	isDragging: boolean
}

interface FeedbackTableRowProps {
	controlId: string
	entityTypeLabel: string
	feedback: SomeEntityModel
	serviceFactory: IEntityEditorService
	index: number
	ownerId: EntityOwner | null
	dragId: string
	onlyType: 'boolean' | 'advanced' | null
	location: ControlLocation | undefined
}

function FeedbackTableRow({
	controlId,
	entityTypeLabel,
	feedback,
	serviceFactory,
	index,
	ownerId,
	dragId,
	onlyType,
	location,
}: FeedbackTableRowProps) {
	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<FeedbackTableRowDragItem>({
		accept: dragId,
		hover(item, monitor) {
			if (!ref.current) {
				return
			}

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			const dragOwnerId = item.ownerId
			const dragIndex = item.index

			const hoverOwnerId = ownerId
			const hoverIndex = index
			const hoverId = feedback.id

			if (!checkDragState(item, monitor, hoverId)) return

			// Don't replace items with themselves
			if (item.entityId === hoverId || (dragIndex === hoverIndex && isEqual(dragOwnerId, hoverOwnerId))) {
				return
			}
			// Can't move into itself
			if (hoverOwnerId && item.entityId === hoverOwnerId.parentId) return

			// Time to actually perform the action
			serviceFactory.moveCard(serviceFactory.listId, item.entityId, hoverOwnerId, hoverIndex)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
			item.ownerId = hoverOwnerId
		},
		drop(item, _monitor) {
			item.dragState = null
		},
	})
	const [{ isDragging }, drag, preview] = useDrag<FeedbackTableRowDragItem, unknown, FeedbackTableRowDragStatus>({
		type: dragId,
		item: {
			entityId: feedback.id,
			listId: serviceFactory.listId,
			index: index,
			ownerId: ownerId,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	if (!feedback) {
		// Invalid feedback, so skip
		return null
	}

	return (
		<tr ref={ref} className={isDragging ? 'feedbacklist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>
				{feedback.type === EntityModelType.Feedback ? (
					<FeedbackEditor
						controlId={controlId}
						ownerId={ownerId}
						entityTypeLabel={entityTypeLabel}
						location={location}
						feedback={feedback}
						serviceFactory={serviceFactory}
						onlyType={onlyType}
					/>
				) : (
					<p>Entity is not a feedback!</p>
				)}
			</td>
		</tr>
	)
}

interface FeedbackEditorProps {
	controlId: string
	ownerId: EntityOwner | null
	entityTypeLabel: string
	feedback: FeedbackEntityModel
	location: ControlLocation | undefined
	serviceFactory: IEntityEditorService
	onlyType: 'boolean' | 'advanced' | null
}

const FeedbackEditor = observer(function FeedbackEditor({
	controlId,
	ownerId,
	entityTypeLabel,
	feedback,
	location,
	serviceFactory,
	onlyType,
}: FeedbackEditorProps) {
	const service = useControlEntityService(serviceFactory, feedback)

	const { connections, entityDefinitions } = useContext(RootAppStoreContext)

	const connectionInfo = connections.getInfo(feedback.connectionId)
	const connectionLabel = connectionInfo?.label ?? feedback.connectionId

	const feedbackSpec = entityDefinitions.feedbacks.connections.get(feedback.connectionId)?.get(feedback.type)

	const definitionName = feedbackSpec
		? `${connectionLabel}: ${feedbackSpec.label}`
		: `${connectionLabel}: ${feedback.type} (undefined)`

	const canSetHeadline = !!service.setHeadline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!feedback.headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

	const { isCollapsed, setCollapsed } = usePanelCollapseHelperContextForPanel(
		stringifyEntityOwnerId(ownerId),
		feedback.id
	)

	return (
		<>
			<EntityRowHeader
				service={service}
				entityTypeLabel={entityTypeLabel}
				entity={feedback}
				isPanelCollapsed={isCollapsed}
				setPanelCollapsed={setCollapsed}
				definitionName={definitionName}
				canSetHeadline={canSetHeadline}
				headlineExpanded={headlineExpanded}
				setHeadlineExpanded={doEditHeadline}
				readonly={false}
			/>

			{!isCollapsed && (
				<div className="editor-grid remove075right">
					<EntityCommonCells
						entity={feedback}
						entityType={EntityModelType.Feedback}
						onlyFeedbackType={onlyType}
						entityDefinition={feedbackSpec}
						service={service}
						headlineExpanded={headlineExpanded}
						definitionName={definitionName}
						location={location}
					/>

					<EntityManageChildGroups
						entity={feedback}
						entityDefinition={feedbackSpec}
						controlId={controlId}
						location={location}
						serviceFactory={serviceFactory}
					/>
				</div>
			)}
		</>
	)
})
