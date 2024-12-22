import { ControlLocation } from '@companion-app/shared/Model/Common.js'
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
import {
	IEntityEditorService,
	useControlEntitiesEditorService,
} from '../../Services/Controls/ControlEntitiesService.js'
import { assertNever, PreventDefaultHandler } from '../../util.js'
import { InlineFeedbacksEditor } from '../FeedbackEditor.js'
import { InlineActionList } from '../ActionSetEditor.js'
import classNames from 'classnames'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'

interface EntityManageChildGroupsProps {
	entity: SomeEntityModel
	entityDefinition: ClientEntityDefinition | undefined
	controlId: string
	location: ControlLocation | undefined
	serviceFactory: IEntityEditorService
}

export function EntityManageChildGroups({
	entity,
	entityDefinition,
	controlId,
	location,
	serviceFactory,
}: EntityManageChildGroupsProps) {
	if (entity.connectionId !== 'internal') return null

	return (
		!!entityDefinition?.supportsChildGroups.find(
			(grp) => grp.type === EntityModelType.Action && grp.groupId === 'default'
		) && (
			<div
				className={classNames('cell-children', {
					// 'hide-top-gap': actionOptions.length > 0 && (action.children ?? []).length > 0,
				})}
			>
				{entityDefinition.supportsChildGroups.map((groupInfo) => (
					<EntityManageChildGroup
						key={groupInfo.groupId}
						controlId={controlId}
						location={location}
						groupInfo={groupInfo}
						entities={entity.children?.[groupInfo.groupId]}
						parentId={entity.id}
						serviceFactory={serviceFactory}
					/>
				))}
			</div>
		)
	)
}

interface EntityManageChildGroupProps {
	controlId: string
	location: ControlLocation | undefined
	groupInfo: EntitySupportedChildGroupDefinition
	entities: SomeEntityModel[] | undefined
	parentId: string
	serviceFactory: IEntityEditorService
}

function EntityManageChildGroup({
	controlId,
	location,
	groupInfo,
	entities,
	parentId,
	serviceFactory: serviceFactory0,
}: EntityManageChildGroupProps) {
	const groupId: EntityOwner = { parentId, childGroup: groupInfo.groupId }

	const serviceFactory = useControlEntitiesEditorService(
		controlId,
		serviceFactory0.listId,
		groupInfo.entityTypeLabel,
		groupInfo.type,
		serviceFactory0.confirmModal
	)

	switch (groupInfo.type) {
		case EntityModelType.Feedback:
			return (
				<CForm onSubmit={PreventDefaultHandler}>
					<InlineFeedbacksEditor
						controlId={controlId}
						heading={
							groupInfo.label ? (
								<>
									{groupInfo.label}&nbsp;
									{groupInfo.hint ? <FontAwesomeIcon icon={faQuestionCircle} title={groupInfo.hint} /> : null}
								</>
							) : null
						}
						feedbacks={entities ?? []}
						entityTypeLabel={groupInfo.entityTypeLabel}
						onlyType={groupInfo.booleanFeedbacksOnly ? 'boolean' : null}
						location={location}
						feedbacksService={serviceFactory}
						ownerId={groupId}
					/>
				</CForm>
			)
		case EntityModelType.Action:
			return (
				<CForm onSubmit={PreventDefaultHandler}>
					<InlineActionList
						controlId={controlId}
						heading={
							groupInfo.label ? (
								<>
									{groupInfo.label}&nbsp;
									{groupInfo.hint ? <FontAwesomeIcon icon={faQuestionCircle} title={groupInfo.hint} /> : null}
								</>
							) : null
						}
						actions={entities ?? []}
						// entityTypeLabel={groupInfo.entityTypeLabel}
						// onlyType={groupInfo.booleanFeedbacksOnly ? 'boolean' : null}
						location={location}
						actionsService={serviceFactory}
						ownerId={groupId}
					/>
				</CForm>
			)
		default:
			assertNever(groupInfo.type)
			throw new Error(`Unsupported group type ${groupInfo.type}`)
	}
}
