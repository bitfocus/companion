import { pointerIntersection } from '@dnd-kit/collision'
import { useDroppable } from '@dnd-kit/react'
import { faCodeBranch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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

	const labelLower = (groupInfo.label || '').toLowerCase()
	const isIf = groupInfo.groupId === 'if' || labelLower.startsWith('if')
	const isElse = groupInfo.groupId === 'else' || labelLower.startsWith('else')

	return (
		<div className="mt-2">
			<EntityNestingLevelContext.Provider value={parentNestingLevel + 1}>
				<EditableEntityList
					heading={
						groupInfo.label ? (
							<div className="flex items-center gap-1.5">
								<span
									className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold uppercase tracking-wider ${
										isIf
											? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
											: isElse
												? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
												: 'bg-primary/10 text-primary border border-primary/20'
									}`}
								>
									<FontAwesomeIcon icon={faCodeBranch} className="text-3xs" />
									{groupInfo.label}
								</span>
								{groupInfo.hint ? <InlineHelpIcon className="ms-1">{groupInfo.hint}</InlineHelpIcon> : null}
							</div>
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
