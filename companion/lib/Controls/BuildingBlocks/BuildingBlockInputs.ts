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
 * The user defined inputs of a building block, such as a custom action or custom feedback.
 * This keeps the `$(options:<id>)` references in the entities of the building block in step with them, but not
 * whatever uses the building block, which is the caller's job.
 */
export class BuildingBlockInputs {
	readonly #internalModule: InternalController
	readonly #entities: ControlEntityListPoolBase
	readonly #reportChange: () => void

	#fields: AuthorableInputField[] = []

	/**
	 * @param internalModule The internal module, to update the references to a renamed input
	 * @param entities The entities of the building block, which may reference the inputs
	 * @param reportChange Called after the inputs have been changed, to save them
	 */
	constructor(internalModule: InternalController, entities: ControlEntityListPoolBase, reportChange: () => void) {
		this.#internalModule = internalModule
		this.#entities = entities
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
	 * Replace an input. If the new input has a different id, the references to it in the entities of the building
	 * block are updated
	 * @returns Whether the input was updated
	 */
	update(inputId: string, field: AuthorableInputField): boolean {
		if (!AuthorableInputFieldSchema.safeParse(field).success) return false

		const index = this.#fields.findIndex((input) => input.id === inputId)
		if (index === -1) return false

		if (field.id !== inputId) {
			// Renaming, so the new id must be unused
			if (this.#fields.some((input) => input.id === field.id)) return false

			this.#renameReferences(inputId, field.id)
		}

		this.#fields[index] = structuredClone(field)

		this.#reportChange()
		return true
	}

	/**
	 * Update the `$(options:<id>)` references to an input in the entities of the building block
	 */
	#renameReferences(fromId: string, toId: string): void {
		const changed = new VisitorVariableRenamer(this.#internalModule, `options:${fromId}`, `options:${toId}`)
			.visitEntityInstances(this.#entities.getAllEntities())
			.recheckChangedFeedbacks()
			.hasChanges()

		// The entities were changed in place, so must be parsed again
		if (changed) this.#entities.resubscribeEntities()
	}
}
