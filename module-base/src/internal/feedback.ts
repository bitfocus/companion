import { CompanionFeedbackDefinition, CompanionFeedbackInfo } from '../module-api/feedback'
import { FeedbackInstance } from '../host-api/api'

export function convertFeedbackInstanceToEvent(
	type: 'boolean' | 'advanced',
	feedback: FeedbackInstance
): CompanionFeedbackInfo {
	return {
		type: type,
		id: feedback.id,
		feedbackId: feedback.feedbackId,
		controlId: feedback.controlId,
		options: feedback.options,
	}
}

export function callFeedbackOnDefinition(definition: CompanionFeedbackDefinition, feedback: FeedbackInstance) {
	if (definition.type === 'boolean') {
		return definition.callback({
			...convertFeedbackInstanceToEvent('boolean', feedback),
			type: 'boolean',
			rawBank: feedback.rawBank,
		})
	} else {
		return definition.callback({
			...convertFeedbackInstanceToEvent('advanced', feedback),
			type: 'advanced',
			image: feedback.image,
			page: feedback.page,
			bank: feedback.bank,
			rawBank: feedback.rawBank,
		})
	}
}
