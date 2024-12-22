import React, { useCallback, useMemo, useRef } from 'react'
import { MyErrorBoundary } from '../util.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider } from '../Helpers/CollapseHelper.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import {
	EntityModelType,
	EntityOwner,
	SomeEntityModel,
	SomeSocketEntityLocation,
	stringifySocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { findAllEntityIdsDeep } from './Util.js'
import { IEntityEditorService, useControlEntitiesEditorService } from '../Services/Controls/ControlEntitiesService.js'
import { EntityDropPlaceholderZone } from './Components/EntityListDropZone.js'
import { AddEntityPanel } from './Components/AddEntityPanel.js'
import { EntityEditorHeading } from './Components/EntityEditorHeadingProps.js'
import { EntityTableRow } from './Components/EntityEditorRow.js'

interface ControlActionSetEditorProps {
	controlId: string
	location: ControlLocation | undefined
	listId: SomeSocketEntityLocation
	actions: SomeEntityModel[] | undefined
	heading: JSX.Element | string
	headingActions?: JSX.Element[]
}

export const ControlActionSetEditor = observer(function ControlActionSetEditor({
	controlId,
	location,
	listId,
	actions,
	heading,
	headingActions,
}: ControlActionSetEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const actionsService = useControlEntitiesEditorService(
		controlId,
		listId,
		'action',
		EntityModelType.Action,
		confirmModal
	)

	const actionIds = useMemo(() => findAllEntityIdsDeep(actions ?? []), [actions])

	return (
		<div className="action-category">
			<PanelCollapseHelperProvider
				storageId={`actions_${controlId}_${stringifySocketEntityLocation(listId)}`}
				knownPanelIds={actionIds}
			>
				<GenericConfirmModal ref={confirmModal} />

				<InlineActionList
					controlId={controlId}
					heading={heading}
					headingActions={headingActions}
					actions={actions}
					location={location}
					actionsService={actionsService}
					ownerId={null}
				/>
			</PanelCollapseHelperProvider>
		</div>
	)
})

interface InlineActionListProps {
	controlId: string
	heading: JSX.Element | string | null
	headingActions?: JSX.Element[]
	actions: SomeEntityModel[] | undefined
	location: ControlLocation | undefined
	actionsService: IEntityEditorService
	ownerId: EntityOwner | null
}
export function InlineActionList({
	controlId,
	heading,
	headingActions,
	actions,
	location,
	actionsService,
	ownerId,
}: InlineActionListProps) {
	const addEntity = useCallback(
		(connectionId: string, definitionId: string) => actionsService.addEntity(connectionId, definitionId, ownerId),
		[actionsService, ownerId]
	)

	return (
		<>
			<EntityEditorHeading
				heading={heading}
				ownerId={ownerId}
				childEntityIds={actions?.map((f) => f.id) ?? []}
				headingActions={headingActions}
			/>

			<ActionsList
				location={location}
				controlId={controlId}
				ownerId={ownerId}
				dragId={`${controlId}_actions`}
				actions={actions}
				actionsService={actionsService}
			/>
			<AddEntityPanel
				addEntity={addEntity}
				entityType={EntityModelType.Action}
				onlyFeedbackType={null}
				entityTypeLabel={'action'}
			/>
		</>
	)
}

interface ActionsListProps {
	location: ControlLocation | undefined
	controlId: string
	ownerId: EntityOwner | null
	dragId: string
	actions: SomeEntityModel[] | undefined
	actionsService: IEntityEditorService
	readonly?: boolean
}

export function ActionsList({
	location,
	controlId,
	ownerId,
	dragId,
	actions,
	actionsService,
	readonly,
}: ActionsListProps) {
	return (
		<table className="table entity-table">
			<tbody>
				{actions &&
					actions.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<EntityTableRow
								key={a?.id ?? i}
								controlId={controlId}
								ownerId={ownerId}
								location={location}
								entity={a}
								index={i}
								dragId={dragId}
								serviceFactory={actionsService}
								entityType={EntityModelType.Action}
								entityTypeLabel="action"
								onlyFeedbackType={null}
								readonly={readonly ?? false}
							/>
						</MyErrorBoundary>
					))}

				<EntityDropPlaceholderZone
					dragId={dragId}
					ownerId={ownerId}
					listId={actionsService.listId}
					entityCount={actions ? actions.length : 0}
					entityTypeLabel="action"
					moveCard={actionsService.moveCard}
				/>
			</tbody>
		</table>
	)
}
