import React from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { ControlEntitiesEditor } from '../../Controls/EntitiesEditor.js'
import type { LocalVariablesStore } from '../../Controls/LocalVariablesStore.js'

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
			heading="Feedbacks"
			subheading={
				<span className="text-xs text-muted">
					Here you can use feedbacks to override properties of the elements you have setup.
					<br />
					Alternatively, you can use expressions directly in the element properties with local variables.
				</span>
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
