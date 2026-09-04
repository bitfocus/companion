import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useMemo, useRef } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	stringifySocketEntityLocation,
	type SomeEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { useControlEntitiesEditorService } from '~/Services/Controls/ControlEntitiesService.js'
import { EntityEditorContextProvider } from './Components/EntityEditorContext.js'
import { EditableEntityList } from './Components/EntityList.js'
import { useEntityListReorderMonitor } from './Components/useEntityListReorderMonitor.js'
import { EntityListActionContext, type LocalVariablesStore } from './LocalVariablesStore.js'
import { findAllEntityIdsDeep } from './Util.js'

interface ControlEntitiesEditorProps {
	className?: string
	controlId: string
	location: ControlLocation | undefined
	listId: SomeSocketEntityLocation
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
	entities: SomeEntityModel[] | undefined
	heading: React.JSX.Element | string | null
	headingActions?: React.JSX.Element[]
	subheading?: React.JSX.Element | string | null
	localVariablesStore: LocalVariablesStore | null
	localVariablePrefix: string | null
}

export const ControlEntitiesEditor = observer(function ControlEntitiesEditor({
	className,
	controlId,
	location,
	listId,
	entityType,
	entityTypeLabel,
	feedbackListType,
	entities,
	heading,
	headingActions,
	subheading,
	localVariablesStore,
	localVariablePrefix,
}: ControlEntitiesEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const serviceFactory = useControlEntitiesEditorService(controlId, listId, confirmModal)

	const entityIds = useMemo(() => findAllEntityIdsDeep(entities ?? []), [entities])

	// Classify this list's relationship to an action set, which gates the `this:*` execution-context
	// variables (surface_id for any action, delta only for rotary). Propagated via context to feedbacks
	// nested under these actions too.
	const actionContext = useMemo((): EntityListActionContext => {
		if (entityType !== EntityModelType.Action) return EntityListActionContext.NotActions
		if (typeof listId === 'object' && (listId.setId === 'rotate_left' || listId.setId === 'rotate_right'))
			return EntityListActionContext.RotaryActions
		return EntityListActionContext.Actions
	}, [entityType, listId])

	useEntityListReorderMonitor(controlId, entityType, serviceFactory)

	return (
		<div className={classNames('entity-category', className)}>
			<EntityEditorContextProvider
				controlId={controlId}
				location={location}
				serviceFactory={serviceFactory}
				readonly={false}
				localVariablesStore={localVariablesStore}
				localVariablePrefix={localVariablePrefix}
				actionContext={actionContext}
			>
				<PanelCollapseHelperProvider
					storageId={`${entityType}_${controlId}_${stringifySocketEntityLocation(listId)}`}
					knownPanelIds={entityIds}
					evictionOwner={{ kind: 'control', id: controlId }}
				>
					<GenericConfirmModal ref={confirmModal} />

					<EditableEntityList
						heading={heading}
						headingActions={headingActions}
						subheading={subheading}
						entities={entities}
						ownerId={null}
						entityType={entityType}
						entityTypeLabel={entityTypeLabel}
						feedbackListType={feedbackListType}
					/>
				</PanelCollapseHelperProvider>
			</EntityEditorContextProvider>
		</div>
	)
})
