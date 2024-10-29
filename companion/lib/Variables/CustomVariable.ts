/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import LogController from '../Log/Controller.js'
import { isCustomVariableValid } from '@companion-app/shared/CustomVariable.js'
import type { VariablesValues } from './Values.js'
import type {
	CustomVariablesModel,
	CustomVariableUpdate,
	CustomVariableUpdateRemoveOp,
} from '@companion-app/shared/Model/CustomVariableModel.js'
import type { DataDatabase } from '../Data/Database.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { CompanionVariableValue } from '@companion-module/base'

const custom_variable_prefix = `custom_`

const CustomVariablesRoom = 'custom-variables'

export class VariablesCustomVariable {
	readonly #logger = LogController.createLogger('Variables/CustomVariable')
	readonly #variableValues: VariablesValues

	/**
	 * Custom variable definitions
	 */
	#custom_variables: CustomVariablesModel

	readonly #db: DataDatabase
	readonly #io: UIHandler

	constructor(db: DataDatabase, io: UIHandler, variableValues: VariablesValues) {
		this.#db = db
		this.#io = io
		this.#variableValues = variableValues

		this.#custom_variables = this.#db.getKey('custom_variables', {})
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket) {
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
		client.onPromise('custom-variables:set-persistence', this.setPersistence.bind(this))
		client.onPromise('custom-variables:set-order', this.setOrder.bind(this))
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

		this.#doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', [
				{
					type: 'update',
					itemId: name,
					info: this.#custom_variables[name],
				},
			])
		}

		this.#setValueInner(name, defaultVal)

		return null
	}

	/**
	 * Create a custom variable
	 * @param name
	 */
	deleteVariable(name: string): void {
		delete this.#custom_variables[name]

		this.#doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', [
				{
					type: 'remove',
					itemId: name,
				},
			])
		}

		this.#setValueInner(name, undefined)
	}

	/**
	 * Save the current custom variables
	 */
	#doSave(): void {
		this.#db.setKey('custom_variables', this.#custom_variables)
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
			const newValues: Record<string, CompanionVariableValue> = {}
			for (const [name, info] of Object.entries(this.#custom_variables)) {
				newValues[`${custom_variable_prefix}${name}`] = info.defaultValue || ''
			}
			this.#variableValues.setVariableValues('internal', newValues)
		}
	}

	/**
	 * Replace all of the current custom variables with new ones
	 */
	replaceDefinitions(custom_variables: CustomVariablesModel): void {
		const newValues: Record<string, CompanionVariableValue | undefined> = {}
		// Mark the current variables as to be deleted
		for (const name of Object.keys(this.#custom_variables || {})) {
			newValues[`${custom_variable_prefix}${name}`] = undefined
		}
		// Determine the initial values of the variables
		for (const [name, info] of Object.entries(custom_variables || {})) {
			newValues[`${custom_variable_prefix}${name}`] = info.defaultValue || ''
		}

		const namesBefore = Object.keys(this.#custom_variables)

		this.#custom_variables = custom_variables || {}
		this.#doSave()

		// apply the default values
		this.#variableValues.setVariableValues('internal', newValues)

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			const changes: CustomVariableUpdate[] = []

			// Add inserts
			for (const [id, info] of Object.entries(this.#custom_variables)) {
				if (!info) continue

				changes.push({
					type: 'update',
					itemId: id,
					info,
				})
			}

			// Add deletes
			for (const id of namesBefore) {
				if (this.#custom_variables[id]) continue // Replaced

				changes.push({
					type: 'remove',
					itemId: id,
				})
			}

			if (changes.length > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', changes)
			}
		}
	}

	/**
	 * Remove any custom variables
	 */
	reset(): void {
		const namesBefore = Object.keys(this.#custom_variables)

		this.#custom_variables = {}
		this.#doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0 && namesBefore.length > 0) {
			this.#io.emitToRoom(
				CustomVariablesRoom,
				'custom-variables:update',
				namesBefore.map((name): CustomVariableUpdateRemoveOp => ({ type: 'remove', itemId: name }))
			)
		}
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
			const fullname = `${custom_variable_prefix}${name}`
			const value = this.#variableValues.getVariableValue('internal', fullname)

			this.#custom_variables[name].defaultValue = value ?? ''
		}

		this.#doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', [
				{
					type: 'update',
					itemId: name,
					info: this.#custom_variables[name],
				},
			])
		}

		return null
	}

	/**
	 * Set the order of the custom variable
	 * @param newNames Sorted variable names
	 */
	setOrder(newNames: string[]): void {
		if (!Array.isArray(newNames)) throw new Error('Expected array of names')

		// Update the order based on the ids provided
		newNames.forEach((name, index) => {
			if (this.#custom_variables[name]) {
				this.#custom_variables[name] = {
					...this.#custom_variables[name],
					sortOrder: index,
				}
			}
		})

		// Make sure all not provided are at the end in their original order
		const allKnownNames = Object.entries(this.#custom_variables)
			.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
			.map(([name]) => name)
		let nextIndex = newNames.length
		for (const name of allKnownNames) {
			if (!newNames.includes(name)) {
				if (this.#custom_variables[name]) {
					this.#custom_variables[name] = {
						...this.#custom_variables[name],
						sortOrder: nextIndex++,
					}
				}
			}
		}

		this.#doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			const changes: CustomVariableUpdate[] = []

			// Add inserts
			for (const [id, info] of Object.entries(this.#custom_variables)) {
				if (!info) continue

				changes.push({
					type: 'update',
					itemId: id,
					info,
				})
			}

			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', changes)
		}
	}

	/**
	 * Get the value of a custom variable
	 */
	getValue(name: string): CompanionVariableValue | undefined {
		const fullname = `${custom_variable_prefix}${name}`
		return this.#variableValues.getVariableValue('internal', fullname)
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
		const fullname = `${custom_variable_prefix}${name}`
		this.#variableValues.setVariableValues('internal', {
			[fullname]: value,
		})

		this.#persistCustomVariableValue(name, value)
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
			const fullname = `${custom_variable_prefix}${name}`
			const value = this.#variableValues.getVariableValue('internal', fullname)
			this.#logger.silly(`Set default value "${name}":${value}`)
			this.#custom_variables[name].defaultValue = value ?? ''

			this.#doSave()

			if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', [
					{
						type: 'update',
						itemId: name,
						info: this.#custom_variables[name],
					},
				])
			}
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

		this.#doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', [
				{
					type: 'update',
					itemId: name,
					info: this.#custom_variables[name],
				},
			])
		}

		return null
	}

	/**
	 * Update the persisted value of a variable, if required
	 */
	#persistCustomVariableValue(name: string, value: CompanionVariableValue | undefined): void {
		if (this.#custom_variables[name] && this.#custom_variables[name].persistCurrentValue) {
			this.#custom_variables[name].defaultValue = value ?? ''

			this.#doSave()

			if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', [
					{
						type: 'update',
						itemId: name,
						info: this.#custom_variables[name],
					},
				])
			}
		}
	}
}
