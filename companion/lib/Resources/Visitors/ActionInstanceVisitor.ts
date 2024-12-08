import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { InternalVisitor } from '../../Internal/Types.js'

/**
 * Visits a action instance.
 */
export function visitActionInstance(visitor: InternalVisitor, action: ActionInstance) {
	// Fixup any references in action options
	for (const key of Object.keys(action.options || {})) {
		visitor.visitString(action.options, key, action.id)
	}
}
