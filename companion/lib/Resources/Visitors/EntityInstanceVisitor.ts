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
		visitor.visitString(entity.options, key, entity.id)
	}
}
