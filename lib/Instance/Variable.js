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

const { parse, resolve } = require('@estilles/expression-parser')
const debug = require('debug')('lib/Instance/Variable')
const CoreBase = require('../Core/Base')

function parseVariablesInString(string, rawVariableValues, cachedVariableValues) {
	if (string === undefined || string === null || string === '') {
		return string
	}
	if (typeof string !== 'string') string = `${string}`
	if (!cachedVariableValues) cachedVariableValues = {}

	// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
	const reg = /\$\(([^:$)]+):([^)$]+)\)/

	let matchCount = 0
	let matches
	while ((matches = reg.exec(string))) {
		if (matchCount++ > 100) {
			// Crudely avoid infinite loops with an iteration limit
			debug(`Reached iteration limit for variable parsing`)
			break
		}

		const fullId = matches[0]
		const instanceId = matches[1]
		const variableId = matches[2]

		let cachedValue = cachedVariableValues[fullId]
		if (cachedVariableValues[fullId] === undefined) {
			// Set a temporary value, to stop the recursion going deep
			cachedVariableValues[fullId] = '$RE'

			// Fetch the raw value, and parse variables inside of it
			if (rawVariableValues[instanceId] && rawVariableValues[instanceId][variableId] !== undefined) {
				const rawValue = rawVariableValues[instanceId][variableId]

				cachedValue = parseVariablesInString(rawValue, rawVariableValues, cachedVariableValues)
				if (cachedValue === undefined) cachedValue = ''
			} else {
				// Variable has no value
				cachedValue = '$NA'
			}

			cachedVariableValues[fullId] = cachedValue
		}

		string = string.replace(fullId, cachedValue)
	}

	return string
}

const custom_variable_prefix = `custom_`

class InstanceVariable extends CoreBase {
	constructor(registry) {
		super(registry, 'variable', 'lib/Instance/Variable')

		this.variable_definitions = {}
		this.variables = {}
		this.custom_variables = this.db.getKey('custom_variables', {})

		this.system.emit('io_get', (_io) => {
			this.io2 = _io

			this.system.on('io_connect', (socket) => {
				socket.on('variable_instance_definitions_get', (answer) => {
					answer(this.variable_definitions)
				})

				socket.on('variables_get', (answer) => {
					let vars = {}
					for (const label in this.variables) {
						for (const variable in this.variables[label]) {
							vars[label + ':' + variable] = this.variables[label][variable]
						}
					}

					answer(vars)
				})

				socket.on('custom_variables_get', (answer) => {
					answer(this.custom_variables)
				})

				socket.on('custom_variables_create', (name, defaultVal, answer) => {
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
					this.save_custom_variables()

					const fullname = `custom_${name}`
					this.set_variables('internal', {
						[fullname]: defaultVal,
					})
				})

				socket.on('custom_variables_delete', (name, answer) => {
					delete this.custom_variables[name]

					answer(true) // success
					this.system.emit('custom_variables_update', this.custom_variables)
					this.io.emit('custom_variables_get', this.custom_variables)
					this.save_custom_variables()

					const fullname = `custom_${name}`
					this.set_variables('internal', {
						[fullname]: undefined,
					})
				})

				socket.on('custom_variables_update_default_value', (name, value, answer) => {
					if (!this.custom_variables[name]) {
						answer('Unknown name')
						return
					}

					this.custom_variables[name].defaultValue = value

					answer(true) // success
					this.system.emit('custom_variables_update', this.custom_variables)
					this.io.emit('custom_variables_get', this.custom_variables)
					this.save_custom_variables()
				})

				socket.on('custom_variables_update_current_value', (name, value, answer) => {
					if (!this.custom_variables[name]) {
						answer('Unknown name')
						return
					}

					const fullname = `custom_${name}`
					this.set_variables('internal', {
						[fullname]: value,
					})

					answer(true) // success
				})
			})
		})

		this.system.on('custom_variables_clear', () => {
			this.custom_variables = {}
			this.system.emit('custom_variables_update', this.custom_variables)
			this.io.emit('custom_variables_get', this.custom_variables)
			this.save_custom_variables()
		})

		this.system.on('custom_variable_set_value', (name, value) => {
			if (this.custom_variables[name]) {
				this.debug(`Set value "${name}":${value}`)
				const fullname = `custom_${name}`
				this.set_variables('internal', {
					[fullname]: value,
				})
			}
		})

		this.system.on('custom_variable_set_expression', (name, expression) => {
			if (this.custom_variables[name]) {
				const fullname = `${custom_variable_prefix}${name}`
				const variablePattern = /^\$\(((?:[^:$)]+):(?:[^)$]+))\)/

				try {
					const temp = parse(expression, variablePattern)
					const values = temp
						.filter((token) => token.name)
						.reduce((previous, { name }) => {
							const [label, variable] = name.split(':')
							let value
							this.system.emit('variable_get', label, variable, (store) => {
								value = store
							})
							return { ...previous, [name]: value }
						}, {})

					this.set_variables('internal', {
						[fullname]: resolve(temp, values),
					})
				} catch (error) {
					this.system.emit('log', 'custom_variable', 'warn', `${error.toString()}, in expression: "${expression}"`)
				}
			}
		})

		this.system.on('custom_variables_replace_all', (custom_variables) => {
			this.custom_variables = custom_variables || {}
			this.system.emit('custom_variables_update', this.custom_variables)
			this.io.emit('custom_variables_get', this.custom_variables)
			this.save_custom_variables()
		})
		this.system.on('custom_variables_get', (cb) => {
			cb(this.custom_variables)
		})

		this.system.on('variable_get_definitions', (cb) => {
			cb(this.variable_definitions)
		})

		this.system.on('variable_instance_definitions_set', (instance, variables) => {
			this.variable_definitions[instance.label] = variables

			this.debug('got instance variable definitions for ' + instance.label)
			this.io.emit('variable_instance_definitions_set', instance.label, variables)
		})

		this.system.on('variable_instance_set', (instance, variable, value) => {
			this.set_variables(instance.label, { [variable]: value })
		})

		this.system.on('variable_instance_set_many', (instance, variables) => {
			this.set_variables(instance.label, variables)
		})

		this.system.on('variable_rename_callback', (str, fromlabel, tolabel, cb) => {
			if (typeof str != 'string') {
				console.log('Warning, variable_rename_callback was called with this: ', str)
				return cb(str)
			}
			let fixtext = str

			if (fixtext.includes('$(')) {
				const reg = /\$\(([^:)]+):([^)]+)\)/g

				let matches
				while ((matches = reg.exec(fixtext)) !== null) {
					if (matches[1] !== undefined && matches[1] == fromlabel) {
						if (matches[2] !== undefined) {
							str = str.replace(matches[0], '$(' + tolabel + ':' + matches[2] + ')')
						}
					}
				}
			}

			cb(str)
		})

		this.system.on('variable_instance_label_rename', (labelFrom, labelTo) => {
			if (this.variables[labelTo] === undefined) {
				this.variables[labelTo] = {}
			}
			if (this.variables[labelFrom] !== undefined) {
				const changed_variables = {}
				const removed_variables = []

				this.system.emit('bank_rename_variables', labelFrom, labelTo)
				for (let variable in this.variables[labelFrom]) {
					this.variables[labelTo][variable] = this.variables[labelFrom][variable]
					delete this.variables[labelFrom][variable]

					removed_variables.push(`${labelFrom}:${variable}`)
					changed_variables[`${labelTo}:${variable}`] = this.variables[labelTo][variable]
				}
				delete this.variables[labelFrom]
				this.variables_changed(changed_variables, removed_variables)
			}

			if (this.variable_definitions[labelFrom] !== undefined) {
				this.variable_definitions[labelTo] = this.variable_definitions[labelFrom]
				delete this.variable_definitions[labelFrom]

				this.io.emit('variable_instance_definitions_set', labelTo, this.variable_definitions[labelTo])
				this.io.emit('variable_instance_definitions_set', labelFrom, [])
			}
		})

		this.system.on('instance_enable', (id, state) => {
			if (state === false) {
				this.system.emit('instance_get', id, (info) => {
					if (info && this.variables[info.label] !== undefined) {
						let keys = Object.keys(this.variables[info.label])
						delete this.variable_definitions[info.label]
						delete this.variables[info.label]
						this.io.emit('variable_instance_definitions_set', info.label, [])

						const removed_variables = keys.map((l) => `${info.label}:${l}`)
						this.variables_changed({}, removed_variables)
					}
				})
			}
		})

		this.system.on('instance_delete', (id, label) => {
			if (label !== undefined) {
				if (this.variables[label] !== undefined) {
					const removed_variables = []
					for (let variable in this.variables[label]) {
						this.variables[label][variable] = undefined
						removed_variables.push(`${label}:${variable}`)
					}
					this.variables_changed({}, removed_variables)
				}

				delete this.variable_definitions[label]
				delete this.variables[label]

				this.io.emit('variable_instance_definitions_set', label, [])
			}
		})

		this.system.on('variable_parse', (string, cb) => {
			cb(parseVariablesInString(string, this.variables))
		})

		this.system.on('variable_get', (label, variable, cb) => {
			if (this.variables[label] !== undefined) {
				cb(this.variables[label][variable])
			} else {
				cb(undefined)
			}
		})

		// Load the startup values of custom variables
		if (Object.keys(this.custom_variables).length > 0) {
			const newValues = {}
			for (const [name, info] of Object.entries(this.custom_variables)) {
				newValues[`${custom_variable_prefix}${name}`] = info.defaultValue || ''
			}
			this.set_variables('internal', newValues)
		}
	}

	save_custom_variables() {
		this.db.setKey('custom_variables', this.custom_variables)
	}

	set_variables(label, variables) {
		if (this.variables[label] === undefined) {
			this.variables[label] = {}
		}

		const changed_variables = {}
		const removed_variables = []
		for (const variable in variables) {
			const value = variables[variable]

			if (this.variables[label][variable] != value) {
				this.variables[label][variable] = value

				if (value === undefined) {
					removed_variables.push(`${label}:${variable}`)
				} else {
					changed_variables[`${label}:${variable}`] = value
				}

				// Skip debug if it's just internal:time_* spamming.
				if (!(label === 'internal' && variable.startsWith('time_'))) {
					this.debug('Variable $(' + label + ':' + variable + ') is "' + value + '"')
				}
			}
		}

		this.variables_changed(changed_variables, removed_variables)
	}

	variables_changed(changed_variables, removed_variables) {
		if (Object.keys(changed_variables).length > 0 || removed_variables.length > 0) {
			this.system.emit('variables_changed', changed_variables, removed_variables)

			this.io.emit('variables_set', changed_variables, removed_variables)
		}
	}
}

exports = module.exports = InstanceVariable
// Export some methods for unit tests
exports.parseVariablesInString = parseVariablesInString
