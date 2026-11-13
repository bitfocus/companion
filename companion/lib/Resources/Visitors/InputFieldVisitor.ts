import type { ExpressionableOptionsObject, SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { InternalVisitor } from '../../Internal/Types.js'

/**
 * Visit the references held in some option values, as described by the fields which define them
 * @param feedbackId The id of the feedback the options belong to, to recheck it when they change
 */
export function visitInputFieldReferences(
	visitor: InternalVisitor,
	fields: SomeCompanionInputField[],
	options: ExpressionableOptionsObject,
	feedbackId: string | undefined
): void {
	for (const field of fields) {
		switch (field.type) {
			case 'internal:connection_id': {
				const value = options[field.id]
				if (field.includeAll && value && !value.isExpression && value.value === 'all') break

				if (field.multiple) {
					visitor.visitConnectionIdArray(options, field.id, feedbackId)
				} else {
					visitor.visitConnectionId(options, field.id, feedbackId)
				}
				break
			}
			case 'internal:variable':
				visitor.visitVariableName(options, field.id, feedbackId)
				break
			case 'internal:outbound_surface_id':
				visitor.visitOutboundSurfaceId(options, field.id, feedbackId)
				break
			case 'textinput':
			case 'number':
			case 'checkbox':
			case 'colorpicker':
			case 'dropdown':
			case 'multidropdown':
			case 'static-text':
			case 'expression':
			case 'custom-variable':
			case 'bonjour-device':
			case 'secret-text':
			case 'internal:connection_collection':
			case 'internal:custom_variable':
			case 'internal:date':
			case 'internal:horizontal-alignment':
			case 'internal:image-file':
			case 'internal:list':
			case 'internal:page':
			case 'internal:surface_serial':
			case 'internal:table':
			case 'internal:text-styles':
			case 'internal:time':
			case 'internal:trigger':
			case 'internal:trigger_collection':
			case 'internal:variable_value':
			case 'internal:vertical-alignment':
				// Not a reference, or one which the generic options visitor follows
				break
			default:
				assertNever(field)
				break
		}
	}
}
