import type { InternalVisitor } from '../../Internal/Types.js'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'

/**
 * Visits an entity instance.
 */
export function visitEntityModel(visitor: InternalVisitor, entity: SomeEntityModel): void {
	visitor.visitConnectionId(entity, 'connectionId')

	if (entity.type === EntityModelType.Feedback) {
		// Fixup style overrides on layered buttons
		if (entity.styleOverrides) {
			for (const override of entity.styleOverrides) {
				visitor.visitString(override, 'override', entity.id)
			}
		}
	}

	// Fixup any references in entity options
	for (const key of Object.keys(entity.options || {})) {
		visitor.visitString(entity.options, key, entity.id)
	}
}
