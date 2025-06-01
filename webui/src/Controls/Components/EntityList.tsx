import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EntityOwner, SomeEntityModel, EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import React, { useCallback } from 'react'
import { IEntityEditorService } from '~/Services/Controls/ControlEntitiesService.js'
import { MyErrorBoundary } from '~/util.js'
import { EntityTableRow } from './EntityEditorRow.js'
import { EntityDropPlaceholderZone } from './EntityListDropZone.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityEditorHeading } from './EntityEditorHeadingProps.js'
import { AddEntityPanel } from './AddEntityPanel.js'
import { observer } from 'mobx-react-lite'

interface EditableEntityListProps {
	controlId: string
	heading: JSX.Element | string | null
	headingActions?: JSX.Element[]
	entities: SomeEntityModel[] | undefined
	location: ControlLocation | undefined
	serviceFactory: IEntityEditorService
	ownerId: EntityOwner | null
	entityType: EntityModelType
	entityTypeLabel: string
	onlyFeedbackType: ClientEntityDefinition['feedbackType']
	readonly: boolean
}
export const EditableEntityList = observer(function EditableEntityList({
	controlId,
	heading,
	headingActions,
	entities,
	location,
	serviceFactory,
	ownerId,
	entityType,
	entityTypeLabel,
	onlyFeedbackType,
	readonly,
}: EditableEntityListProps) {
	const addEntity = useCallback(
		(connectionId: string, definitionId: string) => serviceFactory.addEntity(connectionId, definitionId, ownerId),
		[serviceFactory, ownerId]
	)

	return (
		<>
			<EntityEditorHeading
				heading={heading}
				ownerId={ownerId}
				childEntityIds={entities?.map((f) => f.id) ?? []}
				headingActions={headingActions}
			/>

			<MinimalEntityList
				location={location}
				controlId={controlId}
				ownerId={ownerId}
				readonly={readonly}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				onlyFeedbackType={onlyFeedbackType}
				entities={entities}
				serviceFactory={serviceFactory}
			/>
			<AddEntityPanel
				addEntity={addEntity}
				entityType={entityType}
				onlyFeedbackType={onlyFeedbackType}
				entityTypeLabel={entityTypeLabel}
				readonly={readonly}
			/>
		</>
	)
})

interface MinimalEntityListProps {
	location: ControlLocation | undefined
	controlId: string
	ownerId: EntityOwner | null
	entities: SomeEntityModel[] | undefined
	serviceFactory: IEntityEditorService
	entityType: EntityModelType
	entityTypeLabel: string
	onlyFeedbackType: ClientEntityDefinition['feedbackType']
	readonly: boolean
}

export const MinimalEntityList = observer(function MinimalEntityList({
	location,
	controlId,
	ownerId,
	entities,
	serviceFactory,
	entityType,
	entityTypeLabel,
	onlyFeedbackType,
	readonly,
}: MinimalEntityListProps) {
	const dragId = `${controlId}_${entityType}`

	return (
		<table className="table entity-table">
			<tbody>
				{entities &&
					entities.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<EntityTableRow
								key={a?.id ?? i}
								controlId={controlId}
								ownerId={ownerId}
								location={location}
								entity={a}
								index={i}
								dragId={dragId}
								serviceFactory={serviceFactory}
								entityType={entityType}
								entityTypeLabel={entityTypeLabel}
								onlyFeedbackType={onlyFeedbackType}
								readonly={readonly}
							/>
						</MyErrorBoundary>
					))}

				<EntityDropPlaceholderZone
					dragId={dragId}
					ownerId={ownerId}
					listId={serviceFactory.listId}
					entityCount={entities ? entities.length : 0}
					entityTypeLabel={entityTypeLabel}
					moveCard={serviceFactory.moveCard}
				/>
			</tbody>
		</table>
	)
})
