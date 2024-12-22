import React, { useCallback, useMemo, useRef } from 'react'
import { MyErrorBoundary } from '../util.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider } from '../Helpers/CollapseHelper.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import { findAllEntityIdsDeep } from './Util.js'
import { EntityModelType, EntityOwner, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { useControlEntitiesEditorService, IEntityEditorService } from '../Services/Controls/ControlEntitiesService.js'
import { EntityDropPlaceholderZone } from './Components/EntityListDropZone.js'
import { AddEntityPanel } from './Components/AddEntityPanel.js'
import { EntityEditorHeading } from './Components/EntityEditorHeadingProps.js'
import { EntityTableRow } from './Components/EntityEditorRow.js'

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

			<table className="table entity-table">
				<tbody>
					{feedbacks.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<EntityTableRow
								key={a?.id ?? i}
								controlId={controlId}
								ownerId={ownerId}
								index={i}
								entity={a}
								dragId={`feedbacks_${controlId}`}
								serviceFactory={feedbacksService}
								entityType={EntityModelType.Feedback}
								entityTypeLabel={entityTypeLabel}
								onlyFeedbackType={onlyType}
								location={location}
								readonly={false}
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
