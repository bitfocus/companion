import { pointerIntersection } from '@dnd-kit/collision'
import { useDroppable } from '@dnd-kit/react'
import { observer } from 'mobx-react-lite'
import { useContext, useMemo } from 'react'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	type EntityOwner,
	type EntitySupportedChildGroupDefinition,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { useEntityEditorContext } from './EntityEditorContext.js'
import { EditableEntityList } from './EntityList.js'
import { childrenShieldDroppableId, EntityNestingLevelContext } from './EntityListDnd.js'

interface EntityManageChildGroupsProps {
	entity: SomeEntityModel
	entityDefinition: ClientEntityDefinition | undefined
}

export const EntityManageChildGroups = observer(function EntityManageChildGroups({
	entity,
	entityDefinition,
}: EntityManageChildGroupsProps) {
	const { controlId } = useEntityEditorContext()
	const nestingLevel = useContext(EntityNestingLevelContext)

	// The drag types this entity's child lists accept. When a child group shares the parent's type, the
	// parent row would otherwise be a valid drop target across the whole children area (see the shield).
	const childDragIds = useMemo(
		() => (entityDefinition?.supportsChildGroups ?? []).map((groupInfo) => `${controlId}_${groupInfo.type}`),
		[controlId, entityDefinition]
	)

	// Shield droppable over the whole children area: sits above the parent row but below the child lists
	// in collision priority, and the reorder monitor treats it as a no-op, so dead-space hovers between
	// the child lists no longer fall through to the parent row (which would make the entity jump out and
	// back). See EntityNestingLevelContext for the `level * 2` priority spacing.
	const { ref: shieldRef } = useDroppable({
		id: childrenShieldDroppableId(entity.id),
		accept: childDragIds,
		collisionDetector: pointerIntersection,
		collisionPriority: nestingLevel * 2 + 1,
		disabled: childDragIds.length === 0,
	})

	if (entity.connectionId !== 'internal') return null
	if (!entityDefinition?.supportsChildGroups || entityDefinition.supportsChildGroups.length === 0) return null

	return (
		<div className="cell-children" ref={shieldRef}>
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

	// Entities inside this child group are one level deeper, so bump the dnd collision priority for them.
	const parentNestingLevel = useContext(EntityNestingLevelContext)

	// don't wrap in a form here as it will cause nested forms (illegal HTML)...and it's not necessary here!
	return (
		<div>
			<EntityNestingLevelContext.Provider value={parentNestingLevel + 1}>
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
			</EntityNestingLevelContext.Provider>
		</div>
	)
})
