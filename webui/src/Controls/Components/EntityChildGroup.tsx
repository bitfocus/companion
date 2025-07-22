import {
	EntitySupportedChildGroupDefinition,
	SomeEntityModel,
	EntityOwner,
	EntityModelType,
} from '@companion-app/shared/Model/EntityModel.js'
import { CForm } from '@coreui/react'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { observer } from 'mobx-react-lite'
import { EditableEntityList } from './EntityList.js'

interface EntityManageChildGroupsProps {
	entity: SomeEntityModel
	entityDefinition: ClientEntityDefinition | undefined
}

export const EntityManageChildGroups = observer(function EntityManageChildGroups({
	entity,
	entityDefinition,
}: EntityManageChildGroupsProps) {
	if (entity.connectionId !== 'internal') return null

	return (
		!!entityDefinition?.supportsChildGroups &&
		entityDefinition.supportsChildGroups.length > 0 && (
			<div className="cell-children">
				{entityDefinition.supportsChildGroups.map((groupInfo) => (
					<EntityManageChildGroup
						key={groupInfo.groupId}
						groupInfo={groupInfo}
						entities={entity.children?.[groupInfo.groupId]}
						parentId={entity.id}
					/>
				))}
			</div>
		)
	)
})

interface EntityManageChildGroupProps {
	groupInfo: EntitySupportedChildGroupDefinition
	entities: SomeEntityModel[] | undefined
	parentId: string
}

const EntityManageChildGroup = observer(function EntityManageChildGroup({
	groupInfo,
	entities,
	parentId,
}: EntityManageChildGroupProps) {
	const groupId: EntityOwner = { parentId, childGroup: groupInfo.groupId }

	return (
		<CForm onSubmit={PreventDefaultHandler}>
			<EditableEntityList
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
				feedbackListType={(groupInfo.type === EntityModelType.Feedback && groupInfo.feedbackListType) || null}
				ownerId={groupId}
			/>
		</CForm>
	)
})
