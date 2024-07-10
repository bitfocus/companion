import React, { useMemo } from 'react'
import { IFeedbackEditorService } from '../Services/Controls/ControlFeedbacksService.js'
import { InlineFeedbacksEditor } from './FeedbackEditor.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'

interface InternalFeedbacksPickerProps {
	serviceFactory: IFeedbackEditorService
	parentId: string
	feedbacks: FeedbackInstance[] | undefined
}

export function InternalFeedbacksPicker({ serviceFactory, parentId, feedbacks }: InternalFeedbacksPickerProps) {
	const feedbacksService = useMemo(() => serviceFactory.createChildService(parentId), [serviceFactory, parentId])

	return (
		<InlineFeedbacksEditor
			feedbacks={feedbacks ?? []}
			entityType="condition"
			booleanOnly
			location={undefined}
			addPlaceholder="+ Add condition"
			feedbacksService={feedbacksService}
		/>
	)
}
