import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { InternalVisitor } from '../../Internal/Types.js'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'

/**
 * Visits an entity instance.
 */
export function visitEntityModel(visitor: InternalVisitor, entity: SomeEntityModel): void {
	visitor.visitConnectionId(entity, 'connectionId')

	if (entity.type === EntityModelType.Feedback) {
		// Fixup any boolean feedbacks
		if (entity.style?.text) {
			visitor.visitString(entity.style, 'text')
		}
	}

	// Fixup any references in entity options
	for (const key of Object.keys(entity.options || {})) {
		const origValue = entity.options[key]
		if (isExpressionOrValue(origValue) && origValue.isExpression) {
			// Wrapped option
			visitor.visitString(origValue, 'value', entity.id)
		} else {
			// Unwrapped option
			visitor.visitString(entity.options, key, entity.id)
		}
	}
}
