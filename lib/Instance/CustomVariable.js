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

import jsonPatch from 'fast-json-patch'
import LogController from '../Log/Controller.js'
import { isCustomVariableValid } from '../Shared/CustomVariable.js'

const custom_variable_prefix = `custom_`

const CustomVariablesRoom = 'custom-variables'

/** @typedef {import('@companion-module/base').CompanionVariableValue} CompanionVariableValue */

export default class InstanceCustomVariable {
	/**
	 * Base variables handler
	 * @type {import('./Variable.js').default}
	 * @access private
	 * @readonly
	 */
	#base

	/**
	 * @type {import('winston').Logger}
	 * @access private
	 * @readonly
	 */
	#logger = LogController.createLogger('Instance/CustomVariable')

	/**
	 * Custom variable definitions
	 * @type {import('../Shared/Model/CustomVariableModel.js').CustomVariablesModel}
	 * @access private
	 */
	#custom_variables

	/**
	 * @type {import ('../Data/Database.js').default}
	 * @access private
	 * @readonly
	 */
	#db

	/**
	 * @type {import ('../UI/Handler.js').default}
	 * @access private
	 * @readonly
	 */
	#io

	/**
	 * @param {import ('../Data/Database.js').default} db
	 * @param {import ('../UI/Handler.js').default} io
	 * @param {import('./Variable.js').default} base
	 */
	constructor(db, io, base) {
		this.#db = db
		this.#io = io
		this.#base = base

		this.#custom_variables = this.#db.getKey('custom_variables', {})
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
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
	 * @param {string} name
	 * @param {string} defaultVal Default value of the variable (string)
	 * @returns undefined or failure reason
	 * @access public
	 */
	createVariable(name, defaultVal) {
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

		const variablesBefore = { ...this.#custom_variables }
		this.#custom_variables[name] = {
			description: 'A custom variable',
			defaultValue: defaultVal,
			persistCurrentValue: false,
			sortOrder: highestSortOrder + 1,
		}

		this.doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			const patch = jsonPatch.compare(variablesBefore || {}, this.#custom_variables || {})
			if (patch.length > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
			}
		}

		this.#setValueInner(name, defaultVal)

		return undefined
	}

	/**
	 * Create a custom variable
	 * @param {string} name
	 * @returns undefined or failure reason
	 * @access public
	 */
	deleteVariable(name) {
		const variablesBefore = { ...this.#custom_variables }
		delete this.#custom_variables[name]

		this.doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			const patch = jsonPatch.compare(variablesBefore || {}, this.#custom_variables || {})
			if (patch.length > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
			}
		}

		this.#setValueInner(name, undefined)

		return undefined
	}

	/**
	 * Save the current custom variables
	 * @access protected
	 */
	doSave() {
		this.#db.setKey('custom_variables', this.#custom_variables)
	}

	/**
	 * Get all the current custom variable definitions
	 * @returns {import('../Shared/Model/CustomVariableModel.js').CustomVariablesModel}
	 * @access public
	 */
	getDefinitions() {
		return this.#custom_variables
	}

	/**
	 * Check if a custom variable exists
	 * @param {string} name
	 * @returns {boolean}
	 */
	hasCustomVariable(name) {
		return !!this.#custom_variables[name]
	}

	/**
	 * Initialise the custom variables
	 */
	init() {
		// Load the startup values of custom variables
		if (Object.keys(this.#custom_variables).length > 0) {
			/** @type {Record<string, CompanionVariableValue>} */
			const newValues = {}
			for (const [name, info] of Object.entries(this.#custom_variables)) {
				newValues[`${custom_variable_prefix}${name}`] = info.defaultValue || ''
			}
			this.#base.setVariableValues('internal', newValues)
		}
	}

	/**
	 * Replace all of the current custom variables with new ones
	 * @param {import('../Shared/Model/CustomVariableModel.js').CustomVariablesModel} custom_variables
	 * @access public
	 */
	replaceDefinitions(custom_variables) {
		/** @type {Record<string, CompanionVariableValue | undefined>} */
		const newValues = {}
		// Mark the current variables as to be deleted
		for (const name of Object.keys(this.#custom_variables || {})) {
			newValues[`${custom_variable_prefix}${name}`] = undefined
		}
		// Determine the initial values of the variables
		for (const [name, info] of Object.entries(custom_variables || {})) {
			newValues[`${custom_variable_prefix}${name}`] = info.defaultValue || ''
		}

		const variablesBefore = this.#custom_variables

		this.#custom_variables = custom_variables || {}
		this.doSave()

		// apply the default values
		this.#base.setVariableValues('internal', newValues)

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			const patch = jsonPatch.compare(variablesBefore || {}, this.#custom_variables || {})
			if (patch.length > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
			}
		}
	}

	/**
	 * Remove any custom variables
	 */
	reset() {
		const variablesBefore = this.#custom_variables

		this.#custom_variables = {}
		this.doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			const patch = jsonPatch.compare(variablesBefore || {}, this.#custom_variables || {})
			if (patch.length > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
			}
		}
	}

	/**
	 * Set the persistence of a custom variable
	 * @param {string} name
	 * @param {boolean} persistent
	 * @returns {string | void} Failure reason, if any
	 */
	setPersistence(name, persistent) {
		if (!this.#custom_variables[name]) {
			return 'Unknown name'
		}

		const variablesBefore = {
			...this.#custom_variables,
			[name]: { ...this.#custom_variables[name] },
		}

		this.#custom_variables[name].persistCurrentValue = !!persistent

		if (this.#custom_variables[name].persistCurrentValue) {
			const fullname = `${custom_variable_prefix}${name}`
			const value = this.#base.getVariableValue('internal', fullname)

			this.#custom_variables[name].defaultValue = value ?? ''
		}

		this.doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			const patch = jsonPatch.compare(variablesBefore || {}, this.#custom_variables || {})
			if (patch.length > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
			}
		}
	}

	/**
	 * Set the order of the custom variable
	 * @param {string[]} newNames Sorted variable names
	 */
	setOrder(newNames) {
		if (!Array.isArray(newNames)) throw new Error('Expected array of names')

		const variablesBefore = { ...this.#custom_variables }

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

		this.doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			const patch = jsonPatch.compare(variablesBefore, this.#custom_variables || {})
			if (patch.length > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
			}
		}
	}

	/**
	 * Get the value of a custom variable
	 * @param {string} name
	 * @returns {CompanionVariableValue | undefined}
	 */
	getValue(name) {
		const fullname = `${custom_variable_prefix}${name}`
		return this.#base.getVariableValue('internal', fullname)
	}

	/**
	 * Set the value of a custom variable
	 * @param {string} name
	 * @param {CompanionVariableValue | undefined} value
	 * @returns {string | void} Failure reason, if any
	 */
	setValue(name, value) {
		if (this.#custom_variables[name]) {
			this.#logger.silly(`Set value "${name}":${value}`)
			this.#setValueInner(name, value)
		} else {
			return 'Unknown name'
		}
	}

	/**
	 * Helper for setting the value of a custom variable
	 * @param {string} name
	 * @param {CompanionVariableValue | undefined} value
	 */
	#setValueInner(name, value) {
		const fullname = `${custom_variable_prefix}${name}`
		this.#base.setVariableValues('internal', {
			[fullname]: value,
		})

		this.#persistCustomVariableValue(name, value)
	}

	/**
	 * Reset a custom variable to the default value
	 * @param {string} name
	 */
	resetValueToDefault(name) {
		if (this.#custom_variables[name]) {
			const value = this.#custom_variables[name].defaultValue
			this.#logger.silly(`Set value "${name}":${value}`)
			this.#setValueInner(name, value)
		}
	}

	/**
	 * Propogate the current value of a custom variable to be the new default value
	 * @param {string} name
	 */
	syncValueToDefault(name) {
		if (this.#custom_variables[name]) {
			const variablesBefore = {
				...this.#custom_variables,
				[name]: { ...this.#custom_variables[name] },
			}

			const fullname = `${custom_variable_prefix}${name}`
			const value = this.#base.getVariableValue('internal', fullname)
			this.#logger.silly(`Set default value "${name}":${value}`)
			this.#custom_variables[name].defaultValue = value ?? ''

			this.doSave()

			if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
				const patch = jsonPatch.compare(variablesBefore || {}, this.#custom_variables || {})
				if (patch.length > 0) {
					this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
				}
			}
		}
	}

	/**
	 * Set the current value of a custom variable to the result of an expression
	 * @param {string} name The variable to update
	 * @param {string} expression The expression to evaluate
	 * @returns {boolean | void} success
	 * @access public
	 */
	setValueToExpression(name, expression) {
		if (this.#custom_variables[name]) {
			try {
				const result = this.#base.parseExpression(expression)
				this.#setValueInner(name, result.value)
				return true
			} catch (/** @type {any} */ error) {
				this.#logger.warn(`${error.toString()}, in expression: "${expression}"`)
				return false
			}
		}
	}

	/**
	 * Set the default value of a custom variable
	 * @param {string} name
	 * @param {string} value Default value of the variable (string)
	 * @returns undefined or failure reason
	 * @access public
	 */
	setVariableDefaultValue(name, value) {
		if (!this.#custom_variables[name]) {
			return 'Unknown name'
		}
		if (this.#custom_variables[name].persistCurrentValue) {
			return 'Cannot change default'
		}

		const variablesBefore = { ...this.#custom_variables, [name]: { ...this.#custom_variables[name] } }
		this.#custom_variables[name].defaultValue = value

		this.doSave()

		if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
			const patch = jsonPatch.compare(variablesBefore || {}, this.#custom_variables || {})
			if (patch.length > 0) {
				this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
			}
		}

		return undefined
	}

	/**
	 * Update the persisted value of a variable, if required
	 * @param {string} name
	 * @param {CompanionVariableValue | undefined} value
	 */
	#persistCustomVariableValue(name, value) {
		if (this.#custom_variables[name] && this.#custom_variables[name].persistCurrentValue) {
			const variablesBefore = { ...this.#custom_variables, [name]: { ...this.#custom_variables[name] } }
			this.#custom_variables[name].defaultValue = value ?? ''

			this.doSave()

			if (this.#io.countRoomMembers(CustomVariablesRoom) > 0) {
				const patch = jsonPatch.compare(variablesBefore || {}, this.#custom_variables || {})
				if (patch.length > 0) {
					this.#io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
				}
			}
		}
	}
}
