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

import CoreBase from '../Core/Base.js'
import jsonPatch from 'fast-json-patch'
import { isCustomVariableValid } from '../Shared/CustomVariable.js'

const custom_variable_prefix = `custom_`

const CustomVariablesRoom = 'custom-variables'

export default class InstanceCustomVariable extends CoreBase {
	constructor(registry, base) {
		super(registry, 'custom-variable', 'Instance/CustomVariable')

		this.base = base

		this.custom_variables = this.db.getKey('custom_variables', {})
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('custom-variables:subscribe', () => {
			client.join(CustomVariablesRoom)

			return this.custom_variables
		})

		client.onPromise('custom-variables:unsubscribe', () => {
			client.leave(CustomVariablesRoom)
		})

		client.onPromise('custom-variables::create', this.createVariable.bind(this))
		client.onPromise('custom-variables::delete', this.deleteVariable.bind(this))
		client.onPromise('custom-variables::set-default', this.setVariableDefaultValue.bind(this))
		client.onPromise('custom-variables::set-current', this.setValue.bind(this))
		client.onPromise('custom-variables::set-persistence', this.setPersistence.bind(this))
	}

	/**
	 * Create a new custom variable
	 * @param {string} name
	 * @param {string} defaultVal Default value of the variable (string)
	 * @returns undefined or failure reason
	 * @access public
	 */
	createVariable(name, defaultVal) {
		if (this.custom_variables[name]) {
			return `Variable "${name}" already exists`
		}

		if (!isCustomVariableValid(name)) {
			return `Variable name "${name}" is not valid`
		}

		if (typeof defaultVal !== 'string') {
			return 'Bad default value'
		}

		const variablesBefore = { ...this.custom_variables }
		this.custom_variables[name] = {
			description: 'A custom variable',
			defaultValue: defaultVal,
			persistCurrentValue: false,
		}

		this.doSave()

		const patch = jsonPatch.compare(variablesBefore || {}, this.custom_variables || {})
		if (patch.length > 0) {
			this.io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
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
		const variablesBefore = { ...this.custom_variables }
		delete this.custom_variables[name]

		this.doSave()

		const patch = jsonPatch.compare(variablesBefore || {}, this.custom_variables || {})
		if (patch.length > 0) {
			this.io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
		}

		this.#setValueInner(name, undefined)

		return undefined
	}

	/**
	 * Save the current custom variables
	 * @access protected
	 */
	doSave() {
		this.db.setKey('custom_variables', this.custom_variables)
	}

	/**
	 * Get all the current custom variable definitions
	 * @access public
	 */
	getDefinitions() {
		return this.custom_variables
	}

	/**
	 * Initialise the custom variables
	 */
	init() {
		// Load the startup values of custom variables
		if (Object.keys(this.custom_variables).length > 0) {
			const newValues = {}
			for (const [name, info] of Object.entries(this.custom_variables)) {
				newValues[`${custom_variable_prefix}${name}`] = { [null]: info.defaultValue || '' }
			}
			this.base.setVariableValues('internal', newValues)
		}
	}

	/**
	 * Replace all of the current custom variables with new ones
	 * @param {object} custom_variables
	 * @access public
	 */
	replaceDefinitions(custom_variables) {
		const newValues = {}
		// Mark the current variables as to be deleted
		for (const name of Object.keys(this.custom_variables || {})) {
			newValues[`${custom_variable_prefix}${name}`] = undefined
		}
		// Determine the initial values of the variables
		for (const [name, info] of Object.entries(custom_variables || {})) {
			newValues[`${custom_variable_prefix}${name}`] = { [null]: info.defaultValue || '' }
		}

		const variablesBefore = this.custom_variables

		this.custom_variables = custom_variables || {}
		this.doSave()

		// apply the default values
		this.base.setVariableValues('internal', newValues)

		const patch = jsonPatch.compare(variablesBefore || {}, this.custom_variables || {})
		if (patch.length > 0) {
			this.io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
		}
	}

	/**
	 * Remove any custom variables
	 */
	reset() {
		const variablesBefore = this.custom_variables

		this.custom_variables = {}
		this.doSave()

		const patch = jsonPatch.compare(variablesBefore || {}, this.custom_variables || {})
		if (patch.length > 0) {
			this.io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
		}
	}

	setPersistence(name, persistent) {
		if (!this.custom_variables[name]) {
			return 'Unknown name'
		}

		const variablesBefore = {
			...this.custom_variables,
			[name]: { ...this.custom_variables[name] },
		}

		this.custom_variables[name].persistCurrentValue = !!persistent

		if (this.custom_variables[name].persistCurrentValue) {
			const fullname = `${custom_variable_prefix}${name}`
			const value = this.base.getVariableValue('internal', fullname)

			this.custom_variables[name].defaultValue = value
		}

		this.doSave()

		const patch = jsonPatch.compare(variablesBefore || {}, this.custom_variables || {})
		if (patch.length > 0) {
			this.io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
		}
	}

	setValue(name, value) {
		if (this.custom_variables[name]) {
			this.logger.silly(`Set value "${name}":${value}`)
			this.#setValueInner(name, value)
		} else {
			return 'Unknown name'
		}
	}

	#setValueInner(name, value) {
		const fullname = `${custom_variable_prefix}${name}`
		this.base.setVariableValues('internal', {
			[fullname]: { [null]: value },
		})

		this.#persistCustomVariableValue(name, value)
	}

	resetValueToDefault(name) {
		if (this.custom_variables[name]) {
			const value = this.custom_variables[name].defaultValue
			this.logger.silly(`Set value "${name}":${value}`)
			this.#setValueInner(name, value)
		}
	}

	syncValueToDefault(name) {
		if (this.custom_variables[name]) {
			const variablesBefore = {
				...this.custom_variables,
				[name]: { ...this.custom_variables[name] },
			}

			const fullname = `${custom_variable_prefix}${name}`
			const value = this.base.getVariableValue('internal', fullname)
			this.logger.silly(`Set default value "${name}":${value}`)
			this.custom_variables[name].defaultValue = value

			this.doSave()

			const patch = jsonPatch.compare(variablesBefore || {}, this.custom_variables || {})
			if (patch.length > 0) {
				this.io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
			}
		}
	}

	/**
	 * Set the current value of a custom variable to the result of an expression
	 * @param {string} name The variable to update
	 * @param {string} expression The expression to evaluate
	 * @returns success
	 * @access public
	 */
	setValueToExpression(name, expression) {
		if (this.custom_variables[name]) {
			try {
				const result = this.base.parseExpression(expression)
				this.#setValueInner(name, result.value)
				return true
			} catch (error) {
				this.logger.warn(`${error.toString()}, in expression: "${expression}"`)
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
		if (!this.custom_variables[name]) {
			return 'Unknown name'
		}
		if (this.custom_variables[name].persistCurrentValue) {
			return 'Cannot change default'
		}

		const variablesBefore = { ...this.custom_variables, [name]: { ...this.custom_variables[name] } }
		this.custom_variables[name].defaultValue = value

		this.doSave()

		const patch = jsonPatch.compare(variablesBefore || {}, this.custom_variables || {})
		if (patch.length > 0) {
			this.io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
		}

		return undefined
	}

	#persistCustomVariableValue(name, value) {
		if (this.custom_variables[name] && this.custom_variables[name].persistCurrentValue) {
			const variablesBefore = { ...this.custom_variables, [name]: { ...this.custom_variables[name] } }
			this.custom_variables[name].defaultValue = value

			this.doSave()

			const patch = jsonPatch.compare(variablesBefore || {}, this.custom_variables || {})
			if (patch.length > 0) {
				this.io.emitToRoom(CustomVariablesRoom, 'custom-variables:update', patch)
			}
		}
	}
}
