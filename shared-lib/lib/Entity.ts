import type { ClientEntityDefinition } from './Model/EntityDefinitionModel.js'
import { FeedbackEntitySubType } from './Model/EntityModel.js'
import { assertNever } from './Util.js'

export function canAddEntityToFeedbackList(
	feedbackListType: FeedbackEntitySubType | null,
	definition: ClientEntityDefinition
): boolean {
	switch (feedbackListType) {
		case null:
			// For now, match the old behavior
			return definition.feedbackType !== FeedbackEntitySubType.Value
		case FeedbackEntitySubType.Boolean:
			return definition.feedbackType === FeedbackEntitySubType.Boolean
		case FeedbackEntitySubType.Value:
			return (
				definition.feedbackType === FeedbackEntitySubType.Value ||
				definition.feedbackType === FeedbackEntitySubType.Boolean
			)
		case FeedbackEntitySubType.Advanced:
			return (
				definition.feedbackType === FeedbackEntitySubType.Advanced ||
				definition.feedbackType === FeedbackEntitySubType.Boolean
			)
		default:
			assertNever(feedbackListType)
			return false
	}
}
