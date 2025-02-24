import React from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ControlEntitiesEditor } from '../../Controls/EntitiesEditor.js'
import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { CAlert } from '@coreui/react'
import { LocalVariablesStore } from '../../Controls/LocalVariablesStore.js'

interface LocalVariablesEditorProps {
	controlId: string
	location: ControlLocation | undefined
	variables: SomeEntityModel[]
	localVariablesStore: LocalVariablesStore
}
export function LocalVariablesEditor({
	controlId,
	location,
	variables,
	localVariablesStore,
}: LocalVariablesEditorProps) {
	return (
		<>
			<CAlert color="info" className="mb-2">
				This is a work in progress. Local variables are not supported in actions or feedbacks yet.
			</CAlert>
			<ControlEntitiesEditor
				heading="Local Variables"
				controlId={controlId}
				entities={variables}
				location={location}
				listId="local-variables"
				entityType={EntityModelType.LocalVariable}
				entityTypeLabel="variable"
				onlyFeedbackType={null}
				localVariablesStore={localVariablesStore}
			/>
		</>
	)
}
