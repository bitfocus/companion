import type { EntityOwner, SomeEntityModel, EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import React from 'react'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { EntityTableRow } from './EntityEditorRow.js'
import { EntityDropPlaceholderZone } from './EntityListDropZone.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityEditorHeading } from './EntityEditorHeadingProps.js'
import { AddEntityPanel } from './AddEntityPanel.js'
import { observer } from 'mobx-react-lite'
import { useEntityEditorContext } from './EntityEditorContext.js'

interface EditableEntityListProps {
	heading: JSX.Element | string | null
	headingActions?: JSX.Element[]
	subheading?: JSX.Element | string | null
	entities: SomeEntityModel[] | undefined
	ownerId: EntityOwner | null
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
}
export const EditableEntityList = observer(function EditableEntityList({
	heading,
	headingActions,
	subheading,
	entities,
	ownerId,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: EditableEntityListProps) {
	return (
		<>
			<EntityEditorHeading
				heading={heading}
				ownerId={ownerId}
				childEntityIds={entities?.map((f) => f.id) ?? []}
				headingActions={headingActions}
			/>

			{subheading}

			<MinimalEntityList
				ownerId={ownerId}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				feedbackListType={feedbackListType}
				entities={entities}
			/>
			<AddEntityPanel
				ownerId={ownerId}
				entityType={entityType}
				feedbackListType={feedbackListType}
				entityTypeLabel={entityTypeLabel}
			/>
		</>
	)
})

interface MinimalEntityListProps {
	ownerId: EntityOwner | null
	entities: SomeEntityModel[] | undefined
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
}

export const MinimalEntityList = observer(function MinimalEntityList({
	ownerId,
	entities,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: MinimalEntityListProps) {
	const { controlId } = useEntityEditorContext()
	const dragId = `${controlId}_${entityType}`

	return (
		<table className="table entity-table">
			<tbody>
				{entities &&
					entities.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<EntityTableRow
								key={a?.id ?? i}
								ownerId={ownerId}
								entity={a}
								index={i}
								dragId={dragId}
								entityType={entityType}
								entityTypeLabel={entityTypeLabel}
								feedbackListType={feedbackListType}
							/>
						</MyErrorBoundary>
					))}

				<EntityDropPlaceholderZone
					dragId={dragId}
					ownerId={ownerId}
					entityCount={entities ? entities.length : 0}
					entityTypeLabel={entityTypeLabel}
				/>
			</tbody>
		</table>
	)
})
