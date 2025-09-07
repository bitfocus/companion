import React from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ControlEntitiesEditor } from '../../Controls/EntitiesEditor.js'
import { EntityModelType, FeedbackEntitySubType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { LocalVariablesStore } from '../../Controls/LocalVariablesStore.js'

interface FeedbackOverridesTabProps {
	controlId: string
	location: ControlLocation | undefined
	feedbacks: SomeEntityModel[]
	localVariablesStore: LocalVariablesStore
}
export function FeedbackOverridesTab({
	controlId,
	location,
	feedbacks,
	localVariablesStore,
}: FeedbackOverridesTabProps): React.JSX.Element {
	return (
		<ControlEntitiesEditor
			heading="Style Overrides"
			headingSummary={
				<div className="mb-2">
					Here you can override properties of the elements you have setup.
					<br />
					Alternatively, you can use expressions directly in the element properties to use local variables.
				</div>
			}
			controlId={controlId}
			entities={feedbacks}
			location={location}
			listId="feedbacks"
			entityType={EntityModelType.Feedback}
			entityTypeLabel="feedback"
			feedbackListType={FeedbackEntitySubType.StyleOverride}
			localVariablesStore={localVariablesStore}
			localVariablePrefix={null}
		/>
	)
}
