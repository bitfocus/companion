import { observer } from 'mobx-react-lite'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	type EntityOwner,
	type EntitySupportedChildGroupDefinition,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
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

	// don't wrap in a form here as it will cause nested forms (illegal HTML)...and it's not necessary here!
	return (
		<div>
			<EditableEntityList
				heading={
					groupInfo.label ? (
						<>
							{groupInfo.label}
							{groupInfo.hint ? <InlineHelpIcon className="ms-1">{groupInfo.hint}</InlineHelpIcon> : null}
						</>
					) : null
				}
				entities={entities}
				entityType={groupInfo.type}
				entityTypeLabel={groupInfo.entityTypeLabel}
				feedbackListType={(groupInfo.type === EntityModelType.Feedback && groupInfo.feedbackListType) || null}
				ownerId={groupId}
			/>
		</div>
	)
})
