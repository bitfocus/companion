import React, { useMemo, useRef } from 'react'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider } from '../Helpers/CollapseHelper.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import {
	EntityModelType,
	SomeEntityModel,
	SomeSocketEntityLocation,
	stringifySocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { findAllEntityIdsDeep } from './Util.js'
import { useControlEntitiesEditorService } from '../Services/Controls/ControlEntitiesService.js'
import { EditableEntityList } from './Components/EntityList.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { LocalVariablesStore } from './LocalVariablesStore.js'

interface ControlEntitiesEditorProps {
	controlId: string
	location: ControlLocation | undefined
	listId: SomeSocketEntityLocation
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
	entities: SomeEntityModel[] | undefined
	heading: JSX.Element | string
	headingActions?: JSX.Element[]
	localVariablesStore: LocalVariablesStore | null
	isLocalVariablesList: boolean
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
	headingActions,
	localVariablesStore,
	isLocalVariablesList,
}: ControlEntitiesEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const serviceFactory = useControlEntitiesEditorService(controlId, listId, entityTypeLabel, entityType, confirmModal)

	const entityIds = useMemo(() => findAllEntityIdsDeep(entities ?? []), [entities])

	return (
		<div className="entity-category">
			<PanelCollapseHelperProvider
				storageId={`${entityType}_${controlId}_${stringifySocketEntityLocation(listId)}`}
				knownPanelIds={entityIds}
			>
				<GenericConfirmModal ref={confirmModal} />

				<EditableEntityList
					controlId={controlId}
					heading={heading}
					headingActions={headingActions}
					entities={entities}
					location={location}
					serviceFactory={serviceFactory}
					ownerId={null}
					entityType={entityType}
					entityTypeLabel={entityTypeLabel}
					feedbackListType={feedbackListType}
					readonly={false}
					localVariablesStore={localVariablesStore}
					isLocalVariablesList={isLocalVariablesList}
				/>
			</PanelCollapseHelperProvider>
		</div>
	)
})
