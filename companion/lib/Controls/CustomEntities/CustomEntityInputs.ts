import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	AuthorableInputFieldSchema,
	isExpressionOrValue,
	toCompanionInputField,
	type AuthorableInputField,
	type ExpressionableOptionsObject,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { Logger } from '../../Log/Controller.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'

/**
 * The user defined inputs of a custom action or feedback, which are the options of the entity which calls it
 */
export class CustomEntityInputs {
	#inputs: AuthorableInputField[]

	/**
	 * @param inputs The inputs, which have been checked by the schema of the control
	 */
	constructor(inputs: AuthorableInputField[]) {
		this.#inputs = inputs
	}

	get inputs(): ReadonlyArray<AuthorableInputField> {
		return this.#inputs
	}

	/**
	 * The inputs, for persisting. This is not a copy
	 */
	toJSON(): AuthorableInputField[] {
		return this.#inputs
	}

	/**
	 * The inputs, as the options of the definition of the calling entity
	 */
	toOptionFields(): SomeCompanionInputField[] {
		return this.#inputs.map((input) => toCompanionInputField(structuredClone(input)))
	}

	/**
	 * The values of the inputs when they have not been given
	 */
	getDefaultValues(): VariableValues {
		const values: VariableValues = {}
		for (const input of this.#inputs) {
			values[input.id] = 'default' in input ? structuredClone(input.default) : undefined
		}
		return values
	}

	/**
	 * Parse the options of an entity which calls the custom entity into the values of the inputs.
	 * An input which is missing or has an invalid value gets its default value, so that a change to the inputs
	 * doesn't stop the entities using it from working
	 * @param definition The definition of the calling entity
	 * @param rawOptions The options of the calling entity
	 * @param parser A parser in the context of the caller
	 * @param callerControlId The control holding the calling entity, if there is one
	 * @param logger For any invalid inputs
	 */
	parseCallInputs(
		definition: ClientEntityDefinition,
		rawOptions: ExpressionableOptionsObject,
		parser: VariablesAndExpressionParser,
		callerControlId: string | null,
		logger: Logger
	): { options: CompanionOptionValues; referencedVariableIds: ReadonlySet<string> } {
		const optionsWithDefaults: ExpressionableOptionsObject = { ...rawOptions }
		for (const input of this.#inputs) {
			if (optionsWithDefaults[input.id] === undefined && 'default' in input) {
				optionsWithDefaults[input.id] = { isExpression: false, value: input.default }
			}
		}

		const parseRes = parser.parseEntityOptions(definition, optionsWithDefaults, callerControlId)
		if (!parseRes.ok) {
			logger.debug(`Using defaults for invalid inputs: ${JSON.stringify(parseRes.optionErrors)}`)
		}

		return {
			options: parseRes.ok ? parseRes.parsedOptions : parseRes.parsedOptionsWithDefaults,
			referencedVariableIds: parseRes.referencedVariableIds,
		}
	}

	/**
	 * Add an input
	 * @returns Whether the input was added
	 */
	add(field: AuthorableInputField): boolean {
		if (!AuthorableInputFieldSchema.safeParse(field).success) return false
		if (this.#inputs.some((input) => input.id === field.id)) return false

		this.#inputs.push(structuredClone(field))
		return true
	}

	/**
	 * Remove an input
	 * @returns Whether the input was removed
	 */
	remove(inputId: string): boolean {
		const index = this.#inputs.findIndex((input) => input.id === inputId)
		if (index === -1) return false

		this.#inputs.splice(index, 1)
		return true
	}

	/**
	 * Move an input to a new position in the list
	 * @param inputId The id of the input
	 * @param target The index to move it to
	 * @returns Whether the input was moved
	 */
	move(inputId: string, target: number): boolean {
		const index = this.#inputs.findIndex((input) => input.id === inputId)
		if (index === -1 || target < 0 || target >= this.#inputs.length || target === index) return false

		const [input] = this.#inputs.splice(index, 1)
		this.#inputs.splice(target, 0, input)
		return true
	}

	/**
	 * Replace an input. If the new input has a different id, the references to it in the given entities are updated.
	 * The caller is responsible for updating the entities which call the custom entity
	 * @param inputId The id of the input
	 * @param field The new input
	 * @param entities The entities of the custom entity, which may reference the input
	 * @returns Whether the input was updated
	 */
	update(inputId: string, field: AuthorableInputField, entities: ControlEntityInstance[]): boolean {
		if (!AuthorableInputFieldSchema.safeParse(field).success) return false

		const index = this.#inputs.findIndex((input) => input.id === inputId)
		if (index === -1) return false

		if (field.id !== inputId) {
			// Renaming, so the new id must be unused
			if (this.#inputs.some((input) => input.id === field.id)) return false

			renameInputReferences(entities, inputId, field.id)
		}

		this.#inputs[index] = structuredClone(field)
		return true
	}
}

/**
 * Update the `$(options:<id>)` references to an input in some entities
 */
function renameInputReferences(entities: ControlEntityInstance[], fromId: string, toId: string): void {
	const fromVariable = `$(options:${fromId})`
	const toVariable = `$(options:${toId})`

	for (const entity of entities) {
		let changed = false
		const newOptions: ExpressionableOptionsObject = {}

		for (const [key, value] of Object.entries(entity.rawOptions)) {
			if (isExpressionOrValue(value) && typeof value.value === 'string' && value.value.includes(fromVariable)) {
				newOptions[key] = { ...value, value: value.value.replaceAll(fromVariable, toVariable) }
				changed = true
			} else {
				newOptions[key] = value
			}
		}

		if (changed) entity.setOptions(newOptions)
	}
}
