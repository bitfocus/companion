import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { InternalVisitor } from '../../Internal/Types.js'

/**
 * Visits an entity instance.
 */
export function visitEntityModel(visitor: InternalVisitor, entity: SomeEntityModel): void {
	visitor.visitConnectionId(entity, 'connectionId')

	if (entity.type === EntityModelType.Feedback) {
		// Fixup style overrides on layered buttons
		if (entity.styleOverrides) {
			for (const override of entity.styleOverrides) {
				visitor.visitString(override.override, 'value', entity.id)
			}
		}

		if (entity.isInverted) visitor.visitString(entity.isInverted, 'value', entity.id)
	} else if (entity.type === EntityModelType.Action) {
		// Where the result is stored can be an expression, or name a variable
		if (entity.storeResult) visitExpressionFields(visitor, entity.storeResult, entity.id)
		// As can where each output of a custom action is written
		for (const target of Object.values(entity.outputTargets ?? {})) visitExpressionFields(visitor, target, entity.id)
	}

	// Fixup any references in entity options
	for (const key of Object.keys(entity.options || {})) {
		const origValue = entity.options[key]
		if (isExpressionOrValue(origValue)) {
			// Wrapped option
			visitor.visitString(origValue, 'value', entity.id)
		} else {
			// Unwrapped option
			visitor.visitString(entity.options, key, entity.id)
		}
	}
}

/**
 * Visit each field of an object which can be an expression
 */
function visitExpressionFields(visitor: InternalVisitor, obj: object, entityId: string): void {
	for (const value of Object.values(obj)) {
		if (isExpressionOrValue(value)) visitor.visitString(value, 'value', entityId)
	}
}
