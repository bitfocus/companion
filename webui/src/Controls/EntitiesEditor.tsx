import React, { useMemo, useRef } from 'react'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import {
	EntityModelType,
	SomeEntityModel,
	SomeSocketEntityLocation,
	stringifySocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { findAllEntityIdsDeep } from './Util.js'
import { useControlEntitiesEditorService } from '~/Services/Controls/ControlEntitiesService.js'
import { EditableEntityList } from './Components/EntityList.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { LocalVariablesStore } from './LocalVariablesStore.js'
import { EntityEditorContextProvider } from './Components/EntityEditorContext.js'

interface ControlEntitiesEditorProps {
	controlId: string
	location: ControlLocation | undefined
	listId: SomeSocketEntityLocation
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
	entities: SomeEntityModel[] | undefined
	heading: JSX.Element | string | null
	headingSummary?: JSX.Element
	headingActions?: JSX.Element[]
	subheading?: JSX.Element | string | null
	localVariablesStore: LocalVariablesStore | null
	localVariablePrefix: string | null
}

export const ControlEntitiesEditor = observer(function ControlEntitiesEditor({
	controlId,
	location,
	listId,
	entityType,
	entityTypeLabel,
	feedbackListType,
	entities,
	heading,
	headingSummary,
	headingActions,
	subheading,
	localVariablesStore,
	localVariablePrefix,
}: ControlEntitiesEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const serviceFactory = useControlEntitiesEditorService(controlId, listId, confirmModal)

	const entityIds = useMemo(() => findAllEntityIdsDeep(entities ?? []), [entities])

	return (
		<div className="entity-category">
			<EntityEditorContextProvider
				controlId={controlId}
				location={location}
				serviceFactory={serviceFactory}
				readonly={false}
				localVariablesStore={localVariablesStore}
				localVariablePrefix={localVariablePrefix}
			>
				<PanelCollapseHelperProvider
					storageId={`${entityType}_${controlId}_${stringifySocketEntityLocation(listId)}`}
					knownPanelIds={entityIds}
				>
					<GenericConfirmModal ref={confirmModal} />

					<EditableEntityList
						heading={heading}
						headingSummary={headingSummary}
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
