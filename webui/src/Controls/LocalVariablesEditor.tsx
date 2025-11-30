import React from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ControlEntitiesEditor } from './EntitiesEditor.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { CAlert } from '@coreui/react'
import type { LocalVariablesStore } from './LocalVariablesStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe } from '@fortawesome/free-solid-svg-icons'

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
}: LocalVariablesEditorProps): React.JSX.Element {
	return (
		<>
			<ControlEntitiesEditor
				heading="Local Variables"
				subheading={
					<CAlert color="info" className="mb-2 py-2">
						Local variables are not yet supported by all modules or fields. Fields which support local variables can be
						identified by the <FontAwesomeIcon icon={faGlobe} /> icon.
					</CAlert>
				}
				controlId={controlId}
				entities={variables}
				location={location}
				listId="local-variables"
				entityType={EntityModelType.Feedback}
				entityTypeLabel="variable"
				feedbackListType={FeedbackEntitySubType.Value}
				localVariablesStore={localVariablesStore}
				localVariablePrefix="local"
			/>
		</>
	)
}
