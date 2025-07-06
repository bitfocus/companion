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
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { CompanionVariableValue } from '@companion-module/base'
import { DataStoreTableView } from '../Data/StoreBase.js'
import { CustomVariableCollections } from './CustomVariableCollections.js'
import EventEmitter from 'events'
import { router } from '../UI/TRPC.js'

const CustomVariablesRoom = 'custom-variables'
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
	readonly #io: UIHandler

	constructor(db: DataDatabase, io: UIHandler, variableValues: VariablesValues) {
		super()
		this.#dbTable = db.getTableView('custom_variables')
		this.#io = io
		this.#variableValues = variableValues
		this.#collections = new CustomVariableCollections(db, (validCollectionIds) =>
			this.#cleanUnknownCollectionIds(validCollectionIds)
		)

		this.#custom_variables = this.#dbTable.all()
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

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0 && changes.length > 0) {
			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', changes)
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('custom-variables:subscribe', () => {
			client.join(CustomVariablesRoom)

			return this.#custom_variables
		})

		client.onPromise('custom-variables:unsubscribe', () => {
			client.leave(CustomVariablesRoom)
		})

		client.onPromise('custom-variables:create', this.createVariable.bind(this))
		client.onPromise('custom-variables:delete', this.deleteVariable.bind(this))
		client.onPromise('custom-variables:set-default', this.setVariableDefaultValue.bind(this))
		client.onPromise('custom-variables:set-current', this.setValue.bind(this))
		client.onPromise('custom-variables:set-description', this.setVariableDescription.bind(this))
		client.onPromise('custom-variables:set-persistence', this.setPersistence.bind(this))
		client.onPromise('custom-variables:reorder', this.setOrder.bind(this))
	}

	createTrpcRouter() {
		return router({
			collections: this.#collections.createTrpcRouter(),
		})
	}

	/**
	 * Emit to any room members an update of the named variable
	 * @param name
	 */
	#emitUpdateOneVariable(name: string): void {
		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', [
				{ type: 'update', itemId: name, info: this.#custom_variables[name] },
			])
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
	createVariable(name: string, defaultVal: string): string | null {
		if (this.#custom_variables[name]) {
			return `Variable "${name}" already exists`
		}

		if (!isCustomVariableValid(name)) {
			return `Variable name "${name}" is not valid`
		}

		if (typeof defaultVal !== 'string') {
			return 'Bad default value'
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

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', [{ type: 'remove', itemId: name }])
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

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0 && changes.length > 0) {
			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', changes)
		}
	}

	/**
	 * Remove any custom variables
	 */
	reset(): void {
		const namesBefore = Object.keys(this.#custom_variables)

		this.#custom_variables = {}
		this.#dbTable.clear()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0 && namesBefore.length > 0) {
			this.#io.emitToRoom(
				CustomVariablesRoom,
				'custom-variables:update',
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
		const sortedVariables = Array.from(Object.entries(this.#custom_variables))
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

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0 && changes.length > 0) {
			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', changes)
		}
	}

	/**
	 * Get the value of a custom variable
	 */
	getValue(name: string): CompanionVariableValue | undefined {
		return this.#variableValues.getVariableValue(CUSTOM_LABEL, name)
	}

	/**
	 * Set the value of a custom variable
	 * @param name
	 * @param value
	 * @returns Failure reason, if any
	 */
	setValue(name: string, value: CompanionVariableValue | undefined): string | null {
		if (this.#custom_variables[name]) {
			this.#logger.silly(`Set value "${name}":${value}`)
			this.#setValueInner(name, value)
			return null
		} else {
			return 'Unknown name'
		}
	}

	/**
	 * Helper for setting the value of a custom variable
	 */
	#setValueInner(name: string, value: CompanionVariableValue | undefined): void {
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
			this.#logger.silly(`Set value "${name}":${value}`)
			this.#setValueInner(name, value)
		}
	}

	/**
	 * Propagate the current value of a custom variable to be the new default value
	 */
	syncValueToDefault(name: string): void {
		if (this.#custom_variables[name]) {
			const value = this.#variableValues.getVariableValue(CUSTOM_LABEL, name)
			this.#logger.silly(`Set default value "${name}":${value}`)
			this.#custom_variables[name].defaultValue = value === undefined ? '' : value

			this.#emitUpdateOneVariable(name)
		}
	}

	/**
	 * Set the default value of a custom variable
	 */
	setVariableDefaultValue(name: string, value: string): string | null {
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
	#persistCustomVariableValue(name: string, value: CompanionVariableValue | undefined): void {
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
