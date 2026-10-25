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
		case FeedbackEntitySubType.StyleOverride:
			// A feedback can opt out of being used as a style override entirely, regardless of its type
			if (definition.feedbackStyleOverridesUnsupported) return false
			return (
				definition.feedbackType === FeedbackEntitySubType.Advanced ||
				definition.feedbackType === FeedbackEntitySubType.Boolean ||
				definition.feedbackType === FeedbackEntitySubType.Value
			)
		default:
			assertNever(feedbackListType)
			return false
	}
}

/**
 * Whether an entity can be offered in a picker for adding to a list. Some entities, like the placeholder for one
 * that couldn't be loaded, exist but are never added by the user.
 */
export function canOfferEntityInPicker(
	feedbackListType: FeedbackEntitySubType | null,
	definition: ClientEntityDefinition
): boolean {
	return !definition.hiddenFromPicker && canAddEntityToFeedbackList(feedbackListType, definition)
}
