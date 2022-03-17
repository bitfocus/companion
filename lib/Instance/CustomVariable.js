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

import { parse, resolve } from '@estilles/expression-parser'
import CoreBase from '../Core/Base.js'

const custom_variable_prefix = `custom_`

export default class InstanceCustomVariable extends CoreBase {
	constructor(registry, base) {
		super(registry, 'custom-variable', 'lib/Instance/CustomVariable')

		this.base = base

		this.custom_variables = this.db.getKey('custom_variables', {})
	}

	init() {
		// Load the startup values of custom variables
		if (Object.keys(this.custom_variables).length > 0) {
			const newValues = {}
			for (const [name, info] of Object.entries(this.custom_variables)) {
				newValues[`${custom_variable_prefix}${name}`] = info.defaultValue || ''
			}
			this.base.setVariableValues('internal', newValues)
		}
	}

	getDefinitions() {
		// Note: old event name 'custom_variables_get'
		return this.custom_variables
	}

	replaceDefinitions(custom_variables) {
		// Note: old event name 'custom_variables_replace_all'
		this.custom_variables = custom_variables || {}
		this.system.emit('custom_variables_update', this.custom_variables)
		this.io.emit('custom_variables_get', this.custom_variables)
		this.doSave()
	}

	setValue(name, value) {
		// Note: old event name 'custom_variable_set_value'
		if (this.custom_variables[name]) {
			this.debug(`Set value "${name}":${value}`)
			this.#setValueInner(name, value)
		}
	}

	#setValueInner(name, value) {
		const fullname = `${custom_variable_prefix}${name}`
		this.base.setVariableValues('internal', {
			[fullname]: value,
		})
	}

	setValueToExpression(name, expression) {
		// Note: old event name: 'custom_variable_set_expression'
		if (this.custom_variables[name]) {
			const fullname = `${custom_variable_prefix}${name}`
			const variablePattern = /^\$\(((?:[^:$)]+):(?:[^)$]+))\)/

			try {
				const temp = parse(expression, variablePattern)
				const values = temp
					.filter((token) => token.name)
					.reduce((previous, { name }) => {
						const [label, variable] = name.split(':')
						const value = this.base.getVariableValue(label, variable)
						return { ...previous, [name]: value }
					}, {})

				this.#setValueInner(name, resolve(temp, values))
			} catch (error) {
				this.log('warn', `${error.toString()}, in expression: "${expression}"`)
			}
		}
	}

	/**
	 * Remove any custom variables
	 */
	reset() {
		this.custom_variables = {}
		this.system.emit('custom_variables_update', this.custom_variables)
		this.io.emit('custom_variables_get', this.custom_variables)
		this.doSave()
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('custom_variables_get', (answer) => {
			answer(this.custom_variables)
		})

		client.on('custom_variables_create', (name, defaultVal, answer) => {
			if (this.custom_variables[name]) {
				answer('Already exists')
				return
			}

			if (!name || typeof name !== 'string') {
				answer('Bad name')
				return
			}

			if (typeof defaultVal !== 'string') {
				answer('Bad default')
				return
			}

			this.custom_variables[name] = {
				description: 'A custom variable',
				defaultValue: defaultVal,
			}

			answer(true) // success
			this.system.emit('custom_variables_update', this.custom_variables)
			this.io.emit('custom_variables_get', this.custom_variables)
			this.doSave()

			this.#setValueInner(name, defaultVal)
		})

		client.on('custom_variables_delete', (name, answer) => {
			delete this.custom_variables[name]

			answer(true) // success
			this.system.emit('custom_variables_update', this.custom_variables)
			this.io.emit('custom_variables_get', this.custom_variables)
			this.doSave()

			this.#setValueInner(name, undefined)
		})

		client.on('custom_variables_update_default_value', (name, value, answer) => {
			if (!this.custom_variables[name]) {
				answer('Unknown name')
				return
			}

			this.custom_variables[name].defaultValue = value

			answer(true) // success
			this.system.emit('custom_variables_update', this.custom_variables)
			this.io.emit('custom_variables_get', this.custom_variables)
			this.doSave()
		})

		client.on('custom_variables_update_current_value', (name, value, answer) => {
			if (!this.custom_variables[name]) {
				answer('Unknown name')
				return
			}

			this.#setValueInner(name, value)

			answer(true) // success
		})
	}

	doSave() {
		this.db.setKey('custom_variables', this.custom_variables)
	}
}
