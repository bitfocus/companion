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
import { LocalVariablesStore } from '../LocalVariablesStore.js'
import { usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'

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
	feedbackListType: ClientEntityDefinition['feedbackType']
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
	isLocalVariablesList: boolean
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
	feedbackListType,
	readonly,
	localVariablesStore,
	isLocalVariablesList,
}: EditableEntityListProps) {
	const panelCollapseHelper = usePanelCollapseHelperContext()

	const addEntity = useCallback(
		(connectionId: string, definitionId: string) => {
			serviceFactory
				.addEntity(connectionId, definitionId, ownerId)
				.then((newId) => {
					if (newId) {
						// Make sure the panel is open and wont be forgotten on first render
						setTimeout(() => panelCollapseHelper.setPanelCollapsed(newId, false), 10)
					}
				})
				.catch((e) => {
					console.error('Failed to add entity', e)
				})
		},
		[serviceFactory, ownerId, panelCollapseHelper]
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
				feedbackListType={feedbackListType}
				entities={entities}
				serviceFactory={serviceFactory}
				localVariablesStore={localVariablesStore}
				isLocalVariablesList={isLocalVariablesList}
			/>
			<AddEntityPanel
				addEntity={addEntity}
				entityType={entityType}
				feedbackListType={feedbackListType}
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
	feedbackListType: ClientEntityDefinition['feedbackType']
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
	isLocalVariablesList: boolean
}

export const MinimalEntityList = observer(function MinimalEntityList({
	location,
	controlId,
	ownerId,
	entities,
	serviceFactory,
	entityType,
	entityTypeLabel,
	feedbackListType,
	readonly,
	localVariablesStore,
	isLocalVariablesList,
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
								feedbackListType={feedbackListType}
								readonly={readonly}
								localVariablesStore={localVariablesStore}
								isLocalVariablesList={isLocalVariablesList}
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
