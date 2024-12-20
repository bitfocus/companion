import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { InternalVisitor } from '../../Internal/Types.js'
import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { visitActionInstance } from './ActionInstanceVisitor.js'

export function visitEntityModel(visitor: InternalVisitor, entity: SomeEntityModel) {
	switch (entity.type) {
		case EntityModelType.Action:
			visitActionInstance(visitor, entity)
			break
		case EntityModelType.Feedback:
			visitFeedbackInstance(visitor, entity)
			break
		default:
			assertNever(entity)
			break
	}
}

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
