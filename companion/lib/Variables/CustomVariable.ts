/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import LogController from '../Log/Controller.js'
import { isCustomVariableValid } from '@companion-app/shared/CustomVariable.js'
import type { VariablesValues, VariableValueEntry } from './Values.js'
import type {
	CustomVariableCollection,
	CustomVariableDefinition,
	CustomVariablesModel,
	CustomVariableUpdate,
	CustomVariableUpdateRemoveOp,
} from '@companion-app/shared/Model/CustomVariableModel.js'
import type { DataDatabase } from '../Data/Database.js'
import { stringifyVariableValue, type VariableValue } from '@companion-app/shared/Model/Variables.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { CustomVariableCollections } from './CustomVariableCollections.js'
import EventEmitter from 'events'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import { JsonValueSchema } from '@companion-app/shared/Model/Options.js'

const CUSTOM_LABEL = 'custom'

export interface VariablesCustomVariableEvents {
	custom_variable_definition_changed: [id: string, info: CustomVariableDefinition | null]
}

export class VariablesCustomVariable extends EventEmitter<VariablesCustomVariableEvents> {
	readonly #logger = LogController.createLogger('Variables/CustomVariable')
	readonly #variableValues: VariablesValues
	readonly #collections: CustomVariableCollections

	/**
	 * Custom variable definitions
	 */
	#custom_variables: CustomVariablesModel

	readonly #dbTable: DataStoreTableView<Record<string, CustomVariableDefinition>>

	readonly #events = new EventEmitter<{ update: [CustomVariableUpdate[]] }>()

	constructor(db: DataDatabase, variableValues: VariablesValues) {
		super()
		this.#dbTable = db.getTableView('custom_variables')
		this.#variableValues = variableValues
		this.#collections = new CustomVariableCollections(db, (validCollectionIds) =>
			this.#cleanUnknownCollectionIds(validCollectionIds)
		)

		this.#custom_variables = this.#dbTable.all()

		this.#events.setMaxListeners(0)
	}

	#cleanUnknownCollectionIds(validCollectionIds: ReadonlySet<string>): void {
		const changes: CustomVariableUpdate[] = []

		for (const [id, info] of Object.entries(this.#custom_variables)) {
			if (!info || !info.collectionId) continue

			if (validCollectionIds.has(info.collectionId)) continue

			info.collectionId = undefined
			this.#dbTable.set(id, info)

			changes.push({ type: 'update', itemId: id, info })
		}

		if (this.#events.listenerCount('update') > 0 && changes.length > 0) {
			this.#events.emit('update', changes)
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			collections: this.#collections.createTrpcRouter(),

			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'update', signal)

				yield [
					{
						type: 'init',
						info: self.#custom_variables,
					},
				] satisfies CustomVariableUpdate[]

				for await (const [change] of changes) {
					yield change
				}
			}),

			create: publicProcedure
				.input(
					z.object({
						name: z.string(),
						defaultVal: z.string(),
					})
				)
				.mutation(({ input }) => {
					return this.createVariable(input.name, input.defaultVal)
				}),

			delete: publicProcedure
				.input(
					z.object({
						name: z.string(),
					})
				)
				.mutation(({ input }) => {
					this.deleteVariable(input.name)
				}),

			setDefault: publicProcedure
				.input(
					z.object({
						name: z.string(),
						value: JsonValueSchema.optional(),
					})
				)
				.mutation(({ input }) => {
					return this.setVariableDefaultValue(input.name, input.value)
				}),

			setCurrent: publicProcedure
				.input(
					z.object({
						name: z.string(),
						value: JsonValueSchema.optional(),
					})
				)
				.mutation(({ input }) => {
					return this.setValue(input.name, input.value)
				}),

			setDescription: publicProcedure
				.input(
					z.object({
						name: z.string(),
						description: z.string(),
					})
				)
				.mutation(({ input }) => {
					return this.setVariableDescription(input.name, input.description)
				}),

			setPersistence: publicProcedure
				.input(
					z.object({
						name: z.string(),
						value: z.boolean(),
					})
				)
				.mutation(({ input }) => {
					return this.setPersistence(input.name, input.value)
				}),

			reorder: publicProcedure
				.input(
					z.object({
						collectionId: z.string().nullable(),
						name: z.string(),
						dropIndex: z.number(),
					})
				)
				.mutation(({ input }) => {
					return this.setOrder(input.collectionId, input.name, input.dropIndex)
				}),
		})
	}

	/**
	 * Emit to any room members an update of the named variable
	 * @param name
	 */
	#emitUpdateOneVariable(name: string): void {
		if (this.#events.listenerCount('update') > 0) {
			this.#events.emit('update', [{ type: 'update', itemId: name, info: this.#custom_variables[name] }])
		}
	}

	exportCollections(): CustomVariableCollection[] {
		return this.#collections.collectionData
	}

	replaceCollections(collections: CustomVariableCollection[]): void {
		this.#collections.replaceCollections(collections)
	}

	/**
	 * Create a new custom variable
	 * @param name
	 * @param defaultVal Default value of the variable (string)
	 * @returns null or failure reason
	 */
	createVariable(name: string, defaultVal: VariableValue | undefined): string | null {
		if (this.#custom_variables[name]) {
			return `Variable "${name}" already exists`
		}

		if (!isCustomVariableValid(name)) {
			return `Variable name "${name}" is not valid`
		}

		const highestSortOrder = Math.max(-1, ...Object.values(this.#custom_variables).map((v) => v.sortOrder))

		this.#custom_variables[name] = {
			description: 'A custom variable',
			defaultValue: defaultVal,
			persistCurrentValue: false,
			sortOrder: highestSortOrder + 1,
		}

		this.#dbTable.set(name, this.#custom_variables[name])

		this.#emitUpdateOneVariable(name)

		this.#setValueInner(name, defaultVal)

		return null
	}

	/**
	 * Create a custom variable
	 * @param name
	 */
	deleteVariable(name: string): void {
		delete this.#custom_variables[name]

		this.#dbTable.delete(name)

		if (this.#events.listenerCount('update') > 0) {
			this.#events.emit('update', [{ type: 'remove', itemId: name }])
		}

		this.#setValueInner(name, undefined)
	}

	/**
	 * Get all the current custom variable definitions
	 */
	getDefinitions(): CustomVariablesModel {
		return this.#custom_variables
	}

	/**
	 * Check if a custom variable exists
	 */
	hasCustomVariable(name: string): boolean {
		return !!this.#custom_variables[name]
	}

	/**
	 * Initialise the custom variables
	 */
	init(): void {
		// Load the startup values of custom variables
		if (Object.keys(this.#custom_variables).length > 0) {
			const newValues: VariableValueEntry[] = []
			for (const [name, info] of Object.entries(this.#custom_variables)) {
				newValues.push({ id: name, value: info.defaultValue })
				this.#emitVariableDefinitionChange(name, info)
			}
			this.#variableValues.setVariableValues(CUSTOM_LABEL, newValues)
		}

		this.#cleanUnknownCollectionIds(this.#collections.collectAllCollectionIds())
	}

	/**
	 * Replace all of the current custom variables with new ones
	 */
	replaceDefinitions(custom_variables: CustomVariablesModel): void {
		const newValues: VariableValueEntry[] = []
		// Mark the current variables as to be deleted
		for (const name of Object.keys(this.#custom_variables || {})) {
			newValues.push({ id: name, value: undefined })
		}
		// Determine the initial values of the variables
		for (const [name, info] of Object.entries(custom_variables || {})) {
			newValues.push({ id: name, value: info.defaultValue })
		}

		const namesBefore = Object.keys(this.#custom_variables)

		this.#custom_variables = custom_variables || {}

		const changes: CustomVariableUpdate[] = []

		// Add inserts
		for (const [id, info] of Object.entries(this.#custom_variables)) {
			if (!info) continue

			this.#dbTable.set(id, info)

			changes.push({ type: 'update', itemId: id, info })

			this.#emitVariableDefinitionChange(id, info)
		}

		// Add deletes
		for (const id of namesBefore) {
			if (this.#custom_variables[id]) continue // Replaced

			this.#dbTable.delete(id)

			changes.push({ type: 'remove', itemId: id })

			this.#emitVariableDefinitionChange(id, null)
		}

		// apply the default values
		this.#variableValues.setVariableValues(CUSTOM_LABEL, newValues)

		if (this.#events.listenerCount('update') > 0 && changes.length > 0) {
			this.#events.emit('update', changes)
		}
	}

	/**
	 * Remove any custom variables
	 */
	reset(): void {
		const namesBefore = Object.keys(this.#custom_variables)

		this.#custom_variables = {}
		this.#dbTable.clear()

		if (this.#events.listenerCount('update') > 0 && namesBefore.length > 0) {
			this.#events.emit(
				'update',
				namesBefore.map((name): CustomVariableUpdateRemoveOp => ({ type: 'remove', itemId: name }))
			)
		}

		this.#collections.discardAllCollections()
		namesBefore.forEach((name) => {
			this.#emitVariableDefinitionChange(name, null)
		})
	}

	/**
	 * Set the persistence of a custom variable
	 * @param name
	 * @param persistent
	 * @returns Failure reason, if any
	 */
	setPersistence(name: string, persistent: boolean): string | null {
		if (!this.#custom_variables[name]) {
			return 'Unknown name'
		}

		this.#custom_variables[name].persistCurrentValue = !!persistent

		if (this.#custom_variables[name].persistCurrentValue) {
			const value = this.#variableValues.getVariableValue(CUSTOM_LABEL, name)

			this.#custom_variables[name].defaultValue = value === undefined ? '' : value
		}

		this.#dbTable.set(name, this.#custom_variables[name])

		this.#emitUpdateOneVariable(name)
		this.#emitVariableDefinitionChange(name, this.#custom_variables[name])

		return null
	}

	/**
	 * Set the order of the custom variable
	 * @param newNames Sorted variable names
	 */
	setOrder(collectionId: string | null, name: string, dropIndex: number): void {
		const thisVariable = this.#custom_variables[name]
		if (!thisVariable) return

		if (!this.#collections.doesCollectionIdExist(collectionId)) return

		// update the collectionId of the variable being moved if needed
		if (thisVariable.collectionId !== (collectionId ?? undefined)) {
			thisVariable.collectionId = collectionId ?? undefined
		}

		// find all the other variables with the matching collectionId
		const sortedVariables = Object.entries(this.#custom_variables)
			.filter(
				([varName, variable]) =>
					name !== varName && ((!variable.collectionId && !collectionId) || variable.collectionId === collectionId)
			)
			.sort(([, a], [, b]) => (a.sortOrder || 0) - (b.sortOrder || 0))

		if (dropIndex < 0) {
			// Push the variable to the end of the array
			sortedVariables.push([name, thisVariable])
		} else {
			// Insert the variable at the drop index
			sortedVariables.splice(dropIndex, 0, [name, thisVariable])
		}

		const changes: CustomVariableUpdate[] = []

		// update the sort order of the variables in the store, tracking which ones changed
		sortedVariables.forEach(([id, variable], index) => {
			if (variable.sortOrder === index && id !== name) return // No change

			variable.sortOrder = index // Update the sort order
			this.#dbTable.set(id, variable)

			changes.push({ type: 'update', itemId: id, info: variable })
		})

		if (this.#events.listenerCount('update') > 0 && changes.length > 0) {
			this.#events.emit('update', changes)
		}
	}

	/**
	 * Get the value of a custom variable
	 */
	getValue(name: string): VariableValue | undefined {
		return this.#variableValues.getVariableValue(CUSTOM_LABEL, name)
	}

	/**
	 * Set the value of a custom variable
	 * @param name
	 * @param value
	 * @returns Failure reason, if any
	 */
	setValue(name: string, value: VariableValue | undefined): string | null {
		if (this.#custom_variables[name]) {
			this.#logger.silly(`Set value "${name}":${stringifyVariableValue(value)}`)
			this.#setValueInner(name, value)
			return null
		} else {
			return 'Unknown name'
		}
	}

	/**
	 * Helper for setting the value of a custom variable
	 */
	#setValueInner(name: string, value: VariableValue | undefined): void {
		this.#variableValues.setVariableValues(CUSTOM_LABEL, [{ id: name, value: value }])

		this.#persistCustomVariableValue(name, value)
	}

	/**
	 * Set the description of a custom variable
	 * @param name
	 * @param description
	 * @returns Failure reason, if any
	 */
	setVariableDescription(name: string, description: string): string | null {
		if (!this.#custom_variables[name]) {
			return 'Unknown name'
		}

		this.#custom_variables[name].description = description

		this.#dbTable.set(name, this.#custom_variables[name])

		this.#emitUpdateOneVariable(name)
		this.#emitVariableDefinitionChange(name, this.#custom_variables[name])

		return null
	}

	/**
	 * Get the description of a custom variable
	 * @param name
	 * @returns Description or Unknown Name
	 */

	getVariableDescription(name: string): string {
		if (!this.#custom_variables[name]) {
			return 'Unknown name'
		}
		return this.#custom_variables[name].description
	}

	/**
	 * Reset a custom variable to the default value
	 */
	resetValueToDefault(name: string): void {
		if (this.#custom_variables[name]) {
			const value = this.#custom_variables[name].defaultValue
			this.#logger.silly(`Set value "${name}":${stringifyVariableValue(value)}`)
			this.#setValueInner(name, value)
		}
	}

	/**
	 * Propagate the current value of a custom variable to be the new default value
	 */
	syncValueToDefault(name: string): void {
		if (this.#custom_variables[name]) {
			const value = this.#variableValues.getVariableValue(CUSTOM_LABEL, name)
			this.#logger.silly(`Set default value "${name}":${stringifyVariableValue(value)}`)
			this.#custom_variables[name].defaultValue = value

			this.#emitUpdateOneVariable(name)
		}
	}

	/**
	 * Set the default value of a custom variable
	 */
	setVariableDefaultValue(name: string, value: VariableValue): string | null {
		if (!this.#custom_variables[name]) {
			return 'Unknown name'
		}
		if (this.#custom_variables[name].persistCurrentValue) {
			return 'Cannot change default'
		}

		this.#custom_variables[name].defaultValue = value

		this.#dbTable.set(name, this.#custom_variables[name])

		this.#emitUpdateOneVariable(name)
		this.#emitVariableDefinitionChange(name, this.#custom_variables[name])

		return null
	}

	/**
	 * Update the persisted value of a variable, if required
	 */
	#persistCustomVariableValue(name: string, value: VariableValue | undefined): void {
		if (this.#custom_variables[name] && this.#custom_variables[name].persistCurrentValue) {
			this.#custom_variables[name].defaultValue = value === undefined ? '' : value

			this.#dbTable.set(name, this.#custom_variables[name])

			this.#emitUpdateOneVariable(name)
		}
	}

	#emitVariableDefinitionChange(name: string, info: CustomVariableDefinition | null): void {
		try {
			this.emit('custom_variable_definition_changed', name, info)
		} catch (e) {
			this.#logger.error(`Failed to emit changed custom variable definition: ${e}`)
		}
	}
}
