import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { VariableValue, VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'

/**
 * The values seen by the entities of a custom entity (a custom action or feedback): its inputs, and the values its
 * local variables have been set to
 */
export interface CustomEntityValues {
	/** The values of the inputs, exposed to the entities as `$(options:<id>)` */
	readonly options: VariableValues
	/**
	 * The values of the local variables which have been set, by name (without the `local:` prefix).
	 * A variable which has not been set has its startup value
	 */
	readonly localValues: Map<string, VariableValue>
}

/**
 * A control which is offered as an entity of its own (a custom action or feedback), and which the entities calling it
 * hold a copy of
 */
export interface CustomEntitySource {
	readonly controlId: string
	readonly options: { readonly name: string }

	/**
	 * Parse the options of an entity which calls this into the values of the inputs
	 * @param rawOptions The options of the calling entity
	 * @param parser A parser in the context of the caller
	 * @param callerControlId The control holding the calling entity, if there is one
	 */
	parseCallInputs(
		rawOptions: ExpressionableOptionsObject,
		parser: VariablesAndExpressionParser,
		callerControlId: string | null
	): { options: CompanionOptionValues; referencedVariableIds: ReadonlySet<string> }

	/**
	 * A parser for the entities of a copy of this, held by an entity which calls it
	 * @param values The inputs and local variable values of the copy
	 * @param callerControlId The control which holds the copy, which provides the `this:*` and `page:*` variables
	 * @param localVariableEntities The local variables of the copy
	 * @param overrideVariableValues Any additional variables
	 * @param options Options for the parser
	 */
	createCopyParser(
		values: CustomEntityValues,
		callerControlId: string,
		localVariableEntities: ControlEntityInstance[],
		overrideVariableValues: VariableValues | null,
		options: ExpressionParserOptions
	): VariablesAndExpressionParser
}
