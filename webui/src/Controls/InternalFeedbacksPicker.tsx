import React from 'react'
import { IFeedbackEditorService } from '../Services/Controls/ControlFeedbacksService.js'
import { InlineFeedbacksEditor } from './FeedbackEditor.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'

interface InternalFeedbacksPickerProps {
	controlId: string
	serviceFactory: IFeedbackEditorService
	parentId: string
	feedbacks: FeedbackInstance[] | undefined
}

export function InternalFeedbacksPicker({
	controlId,
	serviceFactory,
	parentId,
	feedbacks,
}: InternalFeedbacksPickerProps) {
	return (
		<InlineFeedbacksEditor
			controlId={controlId}
			feedbacks={feedbacks ?? []}
			entityType="condition"
			booleanOnly
			location={undefined}
			addPlaceholder="+ Add condition"
			feedbacksService={serviceFactory}
			parentId={parentId}
		/>
	)
}
