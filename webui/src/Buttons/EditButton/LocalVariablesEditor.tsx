import React from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ControlEntitiesEditor } from '../../Controls/EntitiesEditor.js'
import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'

interface LocalVariablesEditorProps {
	controlId: string
	location: ControlLocation | undefined
	variables: SomeEntityModel[]
}
export function LocalVariablesEditor({ controlId, location, variables }: LocalVariablesEditorProps) {
	// return <p>TEST {controlId}</p>
	return (
		<ControlEntitiesEditor
			heading="Local Variables"
			controlId={controlId}
			entities={variables}
			location={location}
			listId="local-variables"
			entityType={EntityModelType.LocalVariable}
			entityTypeLabel="variable"
			onlyFeedbackType={null}
		/>
	)
}
