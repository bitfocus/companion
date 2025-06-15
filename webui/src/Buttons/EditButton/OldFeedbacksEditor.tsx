import React from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ControlEntitiesEditor } from '../../Controls/EntitiesEditor.js'
import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { CAlert } from '@coreui/react'
import { LocalVariablesStore } from '../../Controls/LocalVariablesStore.js'

interface OldFeedbacksEditorProps {
	controlId: string
	location: ControlLocation | undefined
	feedbacks: SomeEntityModel[]
	localVariablesStore: LocalVariablesStore
}
export function OldFeedbacksEditor({
	controlId,
	location,
	feedbacks,
	localVariablesStore,
}: OldFeedbacksEditorProps): React.JSX.Element {
	return (
		<ControlEntitiesEditor
			heading="Old Feedbacks"
			headingSummary={
				<CAlert color="warning" className="mb-2 ">
					Using feedbacks like this is deprecated and is no longer recommended.
					<br />
					Since Companion 4.x, feedbacks should be defined through 'Local Variables', and bound to elements through
					expressions. This old approach has been kept for compatibility with older buttons and modules that have not
					updated their feedbacks.
				</CAlert>
			}
			controlId={controlId}
			entities={feedbacks}
			location={location}
			listId="feedbacks"
			entityType={EntityModelType.Feedback}
			entityTypeLabel="feedback"
			feedbackListType={null}
			localVariablesStore={localVariablesStore}
			isLocalVariablesList={false}
		/>
	)
}
