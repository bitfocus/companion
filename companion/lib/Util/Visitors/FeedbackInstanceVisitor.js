/**
 * Visits a feedback instance.
 * @param {import("../../Internal/Types.js").InternalVisitor} visitor
 * @param {import("../../Controls/IControlFragments.js").FeedbackInstance} feedback
 */
export function visitFeedbackInstance(visitor, feedback) {
	// Fixup any boolean feedbacks
	if (feedback.style?.text) {
		visitor.visitString(feedback.style, 'text')
	}

	// Fixup any references in feedback options
	for (const key of Object.keys(feedback.options || {})) {
		visitor.visitString(feedback.options, key, feedback.id)
	}
}
