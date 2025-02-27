import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	EntitySupportedChildGroupDefinition,
	SomeEntityModel,
	EntityOwner,
	EntityModelType,
	FeedbackEntitySubType,
} from '@companion-app/shared/Model/EntityModel.js'
import { CForm } from '@coreui/react'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import {
	IEntityEditorService,
	useControlEntitiesEditorService,
} from '../../Services/Controls/ControlEntitiesService.js'
import { PreventDefaultHandler } from '../../util.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { observer } from 'mobx-react-lite'
import { EditableEntityList } from './EntityList.js'
import { LocalVariablesStore } from '../LocalVariablesStore.js'

interface EntityManageChildGroupsProps {
	entity: SomeEntityModel
	entityDefinition: ClientEntityDefinition | undefined
	controlId: string
	location: ControlLocation | undefined
	serviceFactory: IEntityEditorService
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
}

export const EntityManageChildGroups = observer(function EntityManageChildGroups({
	entity,
	entityDefinition,
	controlId,
	location,
	serviceFactory,
	readonly,
	localVariablesStore,
}: EntityManageChildGroupsProps) {
	if (entity.connectionId !== 'internal') return null

	return (
		!!entityDefinition?.supportsChildGroups &&
		entityDefinition.supportsChildGroups.length > 0 && (
			<div className="cell-children">
				{entityDefinition.supportsChildGroups.map((groupInfo) => (
					<EntityManageChildGroup
						key={groupInfo.groupId}
						controlId={controlId}
						location={location}
						groupInfo={groupInfo}
						entities={entity.children?.[groupInfo.groupId]}
						parentId={entity.id}
						parentServiceFactory={serviceFactory}
						readonly={readonly}
						localVariablesStore={localVariablesStore}
					/>
				))}
			</div>
		)
	)
})

interface EntityManageChildGroupProps {
	controlId: string
	location: ControlLocation | undefined
	groupInfo: EntitySupportedChildGroupDefinition
	entities: SomeEntityModel[] | undefined
	parentId: string
	parentServiceFactory: IEntityEditorService
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
}

const EntityManageChildGroup = observer(function EntityManageChildGroup({
	controlId,
	location,
	groupInfo,
	entities,
	parentId,
	parentServiceFactory,
	readonly,
	localVariablesStore,
}: EntityManageChildGroupProps) {
	const groupId: EntityOwner = { parentId, childGroup: groupInfo.groupId }

	const serviceFactory = useControlEntitiesEditorService(
		controlId,
		parentServiceFactory.listId,
		groupInfo.entityTypeLabel,
		groupInfo.type,
		parentServiceFactory.confirmModal
	)

	return (
		<CForm onSubmit={PreventDefaultHandler}>
			<EditableEntityList
				controlId={controlId}
				heading={
					groupInfo.label ? (
						<>
							{groupInfo.label}&nbsp;
							{groupInfo.hint ? <FontAwesomeIcon icon={faQuestionCircle} title={groupInfo.hint} /> : null}
						</>
					) : null
				}
				entities={entities}
				entityType={groupInfo.type}
				entityTypeLabel={groupInfo.entityTypeLabel}
				onlyFeedbackType={
					groupInfo.type === EntityModelType.Feedback && groupInfo.booleanFeedbacksOnly
						? FeedbackEntitySubType.Boolean
						: null
				}
				location={location}
				serviceFactory={serviceFactory}
				ownerId={groupId}
				readonly={readonly}
				localVariablesStore={localVariablesStore}
			/>
		</CForm>
	)
})
