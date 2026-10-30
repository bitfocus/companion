import { isInternalConnectionId } from '@companion-app/shared/ConnectionId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { VariablesValues } from '../../Variables/Values.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import { isInternalUserValueFeedback, type ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { CustomEntityValues } from './Types.js'

/**
 * A parser for an entity of a custom action or feedback, being used by a caller (or run).
 * The `this:*` and `page:*` variables are those of the control of the caller, and the `local:*` variables are those
 * of the custom entity, with the values they have for this use.
 * @param variableValues The variable values
 * @param values The inputs and the local variable values which have been set
 * @param localVariableEntities The local variables to use, either those of the custom entity or of a copy of it
 * @param callerLocation The location of the control of the caller
 * @param callerPageEntities The page variables of the control of the caller
 * @param overrideVariableValues The execution context variables, including the `options:*` of the use
 * @param options Options for the parser
 */
export function createCustomEntityParser(
	variableValues: VariablesValues,
	values: CustomEntityValues,
	localVariableEntities: ControlEntityInstance[],
	callerLocation: ControlLocation | null,
	callerPageEntities: ControlEntityInstance[] | null,
	overrideVariableValues: VariableValues,
	options: ExpressionParserOptions
): VariablesAndExpressionParser {
	const createParser = (parserValues: VariableValues) =>
		variableValues.createVariablesAndExpressionParser(callerLocation, null, parserValues, callerPageEntities, options)

	// The local variables are passed as overrides, which resolve when the parser has no local values of its own
	const parserValues: VariableValues = { ...overrideVariableValues }

	// Resolve the variables in order, so that a computed variable can use the values of those before it
	for (const entity of localVariableEntities) {
		const name = entity.rawLocalVariableName
		if (!name) continue

		if (values.localValues.has(name)) {
			parserValues[`local:${name}`] = values.localValues.get(name)
		} else if (isInternalUserValueFeedback(entity) || !isInternalConnectionId(entity.connectionId)) {
			// A user value which has not been set has its startup value, and a module feedback can only provide its
			// cached value
			parserValues[`local:${name}`] = entity.getResolvedFeedbackValue(null)
		} else {
			// A computed variable is evaluated for this use, so that it sees the inputs and variables of the use
			parserValues[`local:${name}`] = entity.getResolvedFeedbackValue({ parser: createParser(parserValues) })
		}
	}

	return createParser(parserValues)
}

/**
 * Check if any of some entities (or their children) calls a custom action or feedback
 * @param entityModels The entities to check
 * @param call The connection and definition of the entity which calls it
 */
export function containsCustomEntityCall(
	entityModels: SomeEntityModel[],
	call: { connectionId: string; definitionId: string }
): boolean {
	return entityModels.some(
		(entity) =>
			(entity.connectionId === call.connectionId && entity.definitionId === call.definitionId) ||
			Object.values(entity.children ?? {}).some((children) => containsCustomEntityCall(children ?? [], call))
	)
}
