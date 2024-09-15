import type { FeedbackInstance } from '../../Controls/IControlFragments.js'
import type { InternalVisitor } from '../../Internal/Types.js'

/**
 * Visits a feedback instance.
 */
export function visitFeedbackInstance(visitor: InternalVisitor, feedback: FeedbackInstance) {
	// Fixup any boolean feedbacks
	if (feedback.style?.text) {
		visitor.visitString(feedback.style, 'text')
	}

	// Fixup any references in feedback options
	for (const key of Object.keys(feedback.options || {})) {
		visitor.visitString(feedback.options, key, feedback.id)
	}
}
