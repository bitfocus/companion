import {
	AuthorableInputFieldSchema,
	toCompanionInputField,
	type AuthorableInputField,
	type ExpressionableOptionsObject,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { InternalController } from '../../Internal/Controller.js'
import { VisitorVariableRenamer } from '../../Resources/Visitors/VariableRenamer.js'
import type { ControlEntityListPoolBase } from '../Entities/EntityListPoolBase.js'

/**
 * Where a building block references its inputs, as `$(options:<id>)`, so that a renamed input can be followed
 */
export interface BuildingBlockInputReferences {
	/**
	 * Rename the references to a variable
	 * @param fromVariableId The old variable, eg `options:old`
	 * @param toVariableId The new variable, eg `options:new`
	 */
	rename(fromVariableId: string, toVariableId: string): void
}

/**
 * The references to the inputs in the entities of a building block, such as a custom action or custom feedback
 * @param internalModule The internal module, to recheck the internal feedbacks which changed
 * @param entities The entities of the building block
 */
export function entityInputReferences(
	internalModule: InternalController,
	entities: ControlEntityListPoolBase
): BuildingBlockInputReferences {
	return {
		rename: (fromVariableId, toVariableId) => {
			const changed = new VisitorVariableRenamer(internalModule, fromVariableId, toVariableId)
				.visitEntityInstances(entities.getAllEntities())
				.recheckChangedFeedbacks()
				.hasChanges()

			// The entities were changed in place, so must be parsed again
			if (changed) entities.resubscribeEntities()
		},
	}
}

/**
 * The user defined inputs of a building block, such as a custom action, custom feedback or custom element.
 * This keeps the `$(options:<id>)` references in the building block in step with them, but not whatever uses the
 * building block, which is the caller's job.
 */
export class BuildingBlockInputs {
	readonly #references: BuildingBlockInputReferences
	readonly #reportChange: () => void

	#fields: AuthorableInputField[] = []

	/**
	 * @param references Where the building block references its inputs, to follow a renamed input
	 * @param reportChange Called after the inputs have been changed, to save them
	 */
	constructor(references: BuildingBlockInputReferences, reportChange: () => void) {
		this.#references = references
		this.#reportChange = reportChange
	}

	get fields(): ReadonlyArray<AuthorableInputField> {
		return this.#fields
	}

	/**
	 * Load the inputs from storage, which are checked by the schema of the building block when it is loaded
	 */
	loadStorage(fields: AuthorableInputField[]): void {
		this.#fields = fields
	}

	/**
	 * The inputs, to be sent to the client and written to the db
	 */
	toJSON(): AuthorableInputField[] {
		return this.#fields
	}

	/**
	 * The inputs, as the options of the entity which uses the building block
	 */
	toCompanionInputFields(): SomeCompanionInputField[] {
		return this.#fields.map((field) => toCompanionInputField(structuredClone(field)))
	}

	/**
	 * The values of the inputs when they have not been given
	 */
	getDefaultValues(): VariableValues {
		const values: VariableValues = {}
		for (const field of this.#fields) {
			values[field.id] = 'default' in field ? structuredClone(field.default) : undefined
		}
		return values
	}

	/**
	 * The options of an entity which uses the building block, with the default value of each input it doesn't give
	 */
	withDefaultOptions(rawOptions: ExpressionableOptionsObject): ExpressionableOptionsObject {
		const options: ExpressionableOptionsObject = { ...rawOptions }
		for (const field of this.#fields) {
			if (options[field.id] === undefined && 'default' in field) {
				options[field.id] = { isExpression: false, value: field.default }
			}
		}
		return options
	}

	/**
	 * Add an input
	 */
	add(field: AuthorableInputField): boolean {
		if (!AuthorableInputFieldSchema.safeParse(field).success) return false
		if (this.#fields.some((input) => input.id === field.id)) return false

		this.#fields.push(structuredClone(field))

		this.#reportChange()
		return true
	}

	/**
	 * Remove an input
	 */
	remove(inputId: string): boolean {
		const index = this.#fields.findIndex((input) => input.id === inputId)
		if (index === -1) return false

		this.#fields.splice(index, 1)

		this.#reportChange()
		return true
	}

	/**
	 * Move an input to a new position in the list
	 * @param inputId The id of the input
	 * @param target The index to move it to
	 */
	move(inputId: string, target: number): boolean {
		const index = this.#fields.findIndex((input) => input.id === inputId)
		if (index === -1 || target < 0 || target >= this.#fields.length || target === index) return false

		const [input] = this.#fields.splice(index, 1)
		this.#fields.splice(target, 0, input)

		this.#reportChange()
		return true
	}

	/**
	 * Replace an input. If the new input has a different id, the references to it in the building block are updated
	 * @returns Whether the input was updated
	 */
	update(inputId: string, field: AuthorableInputField): boolean {
		if (!AuthorableInputFieldSchema.safeParse(field).success) return false

		const index = this.#fields.findIndex((input) => input.id === inputId)
		if (index === -1) return false

		if (field.id !== inputId) {
			// Renaming, so the new id must be unused
			if (this.#fields.some((input) => input.id === field.id)) return false

			this.#references.rename(`options:${inputId}`, `options:${field.id}`)
		}

		this.#fields[index] = structuredClone(field)

		this.#reportChange()
		return true
	}
}
