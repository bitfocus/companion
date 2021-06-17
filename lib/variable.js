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

var system
var io
var debug = require('debug')('lib/variable')

const custom_variable_prefix = `custom_`
function variable(system) {
	var self = this

	self.system = system
	self.variable_definitions = {}
	self.variables = {}
	self.custom_variables = {}

	system.emit('db_get', 'custom_variables', function (val) {
		self.custom_variables = val || {}
	})

	system.emit('io_get', function (_io) {
		io = _io

		system.on('io_connect', function (socket) {
			socket.on('variable_instance_definitions_get', function (answer) {
				answer(self.variable_definitions)
			})

			socket.on('variables_get', function (answer) {
				var vars = {}
				for (var label in self.variables) {
					for (var variable in self.variables[label]) {
						vars[label + ':' + variable] = self.variables[label][variable]
					}
				}

				answer(vars)
			})

			socket.on('custom_variables_get', function (answer) {
				answer(self.custom_variables)
			})

			socket.on('custom_variables_create', function (name, defaultVal, answer) {
				if (self.custom_variables[name]) {
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

				self.custom_variables[name] = {
					description: 'A custom variable',
					defaultValue: defaultVal,
				}

				answer(true) // success
				self.system.emit('custom_variables_update', self.custom_variables)
				io.emit('custom_variables_get', self.custom_variables)
				self.save_custom_variables()

				const fullname = `custom_${name}`
				self.set_variables('internal', {
					[fullname]: defaultVal,
				})
			})

			socket.on('custom_variables_delete', function (name, answer) {
				delete self.custom_variables[name]

				answer(true) // success
				self.system.emit('custom_variables_update', self.custom_variables)
				io.emit('custom_variables_get', self.custom_variables)
				self.save_custom_variables()

				const fullname = `custom_${name}`
				self.set_variables('internal', {
					[fullname]: undefined,
				})
			})

			socket.on('custom_variables_update_default_value', function (name, value, answer) {
				if (!self.custom_variables[name]) {
					answer('Unknown name')
					return
				}

				self.custom_variables[name].defaultValue = value

				answer(true) // success
				self.system.emit('custom_variables_update', self.custom_variables)
				io.emit('custom_variables_get', self.custom_variables)
				self.save_custom_variables()
			})

			socket.on('custom_variables_update_current_value', function (name, value, answer) {
				if (!self.custom_variables[name]) {
					answer('Unknown name')
					return
				}

				const fullname = `custom_${name}`
				self.set_variables('internal', {
					[fullname]: value,
				})

				answer(true) // success
			})
		})
	})

	system.on('custom_variable_set_value', function (name, value) {
		console.log('new value', name, value)
		if (self.custom_variables[name]) {
			const fullname = `custom_${name}`
			self.set_variables('internal', {
				[fullname]: value,
			})
		}
	})
	system.on('custom_variables_get', function (cb) {
		cb(self.custom_variables)
	})

	system.on('variable_get_definitions', function (cb) {
		cb(self.variable_definitions)
	})

	system.on('variable_instance_definitions_set', function (instance, variables) {
		self.variable_definitions[instance.label] = variables

		debug('got instance variable definitions for ' + instance.label)
		io.emit('variable_instance_definitions_set', instance.label, variables)
	})

	system.on('variable_instance_set', function (instance, variable, value) {
		self.set_variables(instance.label, { [variable]: value })
	})

	system.on('variable_instance_set_many', function (instance, variables) {
		self.set_variables(instance.label, variables)
	})

	system.on('variable_rename_callback', function (str, fromlabel, tolabel, cb) {
		if (typeof str != 'string') {
			console.log('Warning, variable_rename_callback was called with this: ', str)
			return cb(str)
		}
		var fixtext = str

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

	system.on('variable_instance_label_rename', function (labelFrom, labelTo) {
		if (self.variables[labelTo] === undefined) {
			self.variables[labelTo] = {}
		}
		if (self.variables[labelFrom] !== undefined) {
			const changed_variables = {}
			const removed_variables = []

			system.emit('bank_rename_variables', labelFrom, labelTo)
			for (var variable in self.variables[labelFrom]) {
				self.variables[labelTo][variable] = self.variables[labelFrom][variable]
				delete self.variables[labelFrom][variable]

				removed_variables.push(`${labelFrom}:${variable}`)
				changed_variables[`${labelTo}:${variable}`] = self.variables[labelTo][variable]
			}
			delete self.variables[labelFrom]
			self.variables_changed(changed_variables, removed_variables)
		}

		if (self.variable_definitions[labelFrom] !== undefined) {
			self.variable_definitions[labelTo] = self.variable_definitions[labelFrom]
			delete self.variable_definitions[labelFrom]

			io.emit('variable_instance_definitions_set', labelTo, self.variable_definitions[labelTo])
			io.emit('variable_instance_definitions_set', labelFrom, [])
		}
	})

	system.on('instance_enable', function (id, state) {
		if (state === false) {
			system.emit('instance_get', id, function (info) {
				if (info && self.variables[info.label] !== undefined) {
					var keys = Object.keys(self.variables[info.label])
					delete self.variable_definitions[info.label]
					delete self.variables[info.label]
					io.emit('variable_instance_definitions_set', info.label, [])

					const removed_variables = keys.map((l) => `${info.label}:${l}`)
					self.variables_changed({}, removed_variables)
				}
			})
		}
	})

	system.on('instance_delete', function (id, label) {
		if (label !== undefined) {
			if (self.variables[label] !== undefined) {
				const removed_variables = []
				for (var variable in self.variables[label]) {
					self.variables[label][variable] = undefined
					removed_variables.push(`${label}:${variable}`)
				}
				self.variables_changed({}, removed_variables)
			}

			delete self.variable_definitions[label]
			delete self.variables[label]

			io.emit('variable_instance_definitions_set', label, [])
		}
	})

	// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
	system.on('variable_parse', function (string, cb) {
		if (string === undefined) {
			return cb(undefined)
		}

		const reg = /\$\(([^:$)]+):([^)$]+)\)/

		let matches
		while ((matches = reg.exec(string))) {
			if (self.variables[matches[1]] !== undefined) {
				if (self.variables[matches[1]][matches[2]] !== undefined) {
					string = string.replace(matches[0], self.variables[matches[1]][matches[2]])
				} else {
					string = string.replace(matches[0], '$NA')
				}
			} else {
				string = string.replace(matches[0], '$NA')
			}
		}
		cb(string)
	})

	system.on('variable_get', function (label, variable, cb) {
		if (self.variables[label] !== undefined) {
			cb(self.variables[label][variable])
		} else {
			cb(undefined)
		}
	})

	// Load the startup values of custom variables
	if (Object.keys(self.custom_variables).length > 0) {
		const newValues = {}
		for (const [name, info] of Object.entries(self.custom_variables)) {
			newValues[`${custom_variable_prefix}${name}`] = info.defaultValue || ''
		}
		self.set_variables('internal', newValues)
	}

	return self
}

variable.prototype.save_custom_variables = function () {
	var self = this

	self.system.emit('db_set', 'custom_variables', self.custom_variables)
}

variable.prototype.set_variables = function (label, variables) {
	var self = this

	if (self.variables[label] === undefined) {
		self.variables[label] = {}
	}

	const changed_variables = {}
	const removed_variables = []
	for (const variable in variables) {
		const value = variables[variable]

		if (self.variables[label][variable] != value) {
			self.variables[label][variable] = value

			if (value === undefined) {
				removed_variables.push(`${label}:${variable}`)
			} else {
				changed_variables[`${label}:${variable}`] = value
			}

			// Skip debug if it's just internal:time_* spamming.
			if (!(label === 'internal' && variable.startsWith('time_'))) {
				debug('Variable $(' + label + ':' + variable + ') is "' + value + '"')
			}
		}
	}

	self.variables_changed(changed_variables, removed_variables)
}

variable.prototype.variables_changed = function (changed_variables, removed_variables) {
	var self = this

	if (Object.keys(changed_variables).length > 0 || removed_variables.length > 0) {
		self.system.emit('variables_changed', changed_variables, removed_variables)

		io.emit('variables_set', changed_variables, removed_variables)
	}
}

exports = module.exports = function (system) {
	return new variable(system)
}
