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

var debug = require('debug')('Instance/Variable')
var CoreBase = require('../Core/Base')

class Variable extends CoreBase {
	constructor(registry) {
		super(registry, 'variable')

		this.variable_definitions = {}
		this.variables = {}

		this.system.on('io_connect', (client) => {
			client.on('variable_instance_definitions_get', (answer) => {
				answer(null, this.variable_definitions)
			})

			client.on('variables_get', (answer) => {
				answer(null, this.getVariablesForClient())
			})
		})

		this.system.on('variable_get', this.getVariable.bind(this))
		this.system.on('variable_get_definitions', this.getDefinitions.bind(this))
		this.system.on('variable_instance_definitions_set', this.setInstanceDefinitions.bind(this))
		this.system.on('variable_instance_label_rename', this.renameInstance.bind(this))
		this.system.on('variable_instance_set', this.setVariable.bind(this))
		this.system.on('variable_parse', this.parseVariables.bind(this))
		this.system.on('variable_rename_callback', this.renameInstanceInline.bind(this))

		this.system.on('instance_enable', this.enableInstance.bind(this))
		this.system.on('instance_delete', this.deleteInstance.bind(this))
	}

	deleteInstance(id, label) {
		//this.io.emit('variable_instance_definitions_set', label, []);

		if (label !== undefined) {
			if (this.variables[label] !== undefined) {
				for (var variable in this.variables[label]) {
					this.variables[label][variable] = undefined
					this.system.emit('variable_changed', label, variable, undefined)
					this.io.emit('variable_set', label + ':' + variable, undefined)
				}
			}

			delete this.variable_definitions[label]
			delete this.variables[label]

			this.io.emit('variable_instance_definitions_set', label, [])
		}
	}

	enableInstance(id, state) {
		if (state === false) {
			this.system.emit('instance_get', id, (info) => {
				if (info && this.variables[info.label] !== undefined) {
					var keys = Object.keys(this.variables[info.label])
					delete this.variable_definitions[info.label]
					delete this.variables[info.label]
					this.io.emit('variable_instance_definitions_set', info.label, [])

					// Reset banks
					for (var i = 0; i < keys.length; ++i) {
						// Force update
						this.system.emit('variable_changed', info.label, keys[i], undefined)
					}
				}
			})
		}
	}

	escapeReg(str) {
		return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
	}

	getDefinitions(cb) {
		cb(this.variable_definitions)
	}

	getVariable(label, variable, cb) {
		if (this.variables[label] !== undefined) {
			cb(this.variables[label][variable])
		} else {
			cb(undefined)
		}
	}

	getVariablesForClient() {
		var vars = {}

		for (var label in this.variables) {
			for (var variable in this.variables[label]) {
				vars[label + ':' + variable] = this.variables[label][variable]
			}
		}

		return vars
	}

	parseVariables(string, cb) {
		// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
		var vars,
			matches,
			reg = /\$\([^:$)]+:[^)$]+\)/

		if (cb === undefined || typeof cb != 'function') {
			return
		} else if (string === undefined) {
			return cb(undefined)
		}

		while ((vars = reg.exec(string))) {
			matches = vars[0].match(/\$\(([^:)]+):([^)]+)\)/)

			if (this.variables[matches[1]] !== undefined) {
				if (this.variables[matches[1]][matches[2]] !== undefined) {
					string = string.replace(new RegExp(this.escapeReg(matches[0])), this.variables[matches[1]][matches[2]])
				} else {
					string = string.replace(new RegExp(this.escapeReg(matches[0])), '$NA')
				}
			} else {
				string = string.replace(new RegExp(this.escapeReg(matches[0])), '$NA')
			}
		}

		cb(string)
	}

	renameInstance(labelFrom, labelTo) {
		if (this.variables[labelTo] === undefined) {
			this.variables[labelTo] = {}
		}

		if (this.variables[labelFrom] !== undefined) {
			for (var variable in this.variables[labelFrom]) {
				this.system.emit('bank_rename_variables', labelFrom, labelTo)
				this.variables[labelTo][variable] = this.variables[labelFrom][variable]
				delete this.variables[labelFrom][variable]
				this.io.emit('variable_set', labelFrom + ':' + variable, undefined)

				// In case variables exists in banks from before
				this.system.emit('variable_changed', labelTo, variable, this.variables[labelTo][variable])
				this.io.emit('variable_set', labelTo + ':' + variable, this.variables[labelTo][variable])
			}

			delete this.variables[labelFrom]
		}

		if (this.variable_definitions[labelFrom] !== undefined) {
			this.variable_definitions[labelTo] = this.variable_definitions[labelFrom]
			delete this.variable_definitions[labelFrom]

			this.io.emit('variable_instance_definitions_set', labelTo, this.variable_definitions[labelTo])
			this.io.emit('variable_instance_definitions_set', labelFrom, [])
		}
	}

	renameInstanceInline(str, fromlabel, tolabel, cb) {
		if (typeof str != 'string') {
			console.log('Warning, variable_rename_callback was called with this: ', str)
			return cb(str)
		}

		var fixtext = str

		if (fixtext.match(/\$\(/)) {
			var matches,
				reg = /\$\(([^:)]+):([^)]+)\)/g

			while ((matches = reg.exec(fixtext)) !== null) {
				if (matches[1] !== undefined && matches[1] == fromlabel) {
					if (matches[2] !== undefined) {
						reg2 = new RegExp('\\$\\(' + escape(matches[1]) + ':' + escape(matches[2]) + '\\)')
						str = str.replace(reg2, '$(' + tolabel + ':' + matches[2] + ')')
					}
				}
			}
		}

		cb(str)
	}

	setInstanceDefinitions(instance, variables) {
		this.variable_definitions[instance.label] = variables

		debug('got instance variable definitions for ' + instance.label)
		this.io.emit('variable_instance_definitions_set', instance.label, variables)
	}

	setVariable(instance, variable, value) {
		var label = instance.label

		if (this.variables[label] === undefined) {
			this.variables[label] = {}
		}

		if (this.variables[label][variable] != value) {
			this.variables[label][variable] = value

			this.system.emit('variable_changed', label, variable, value)

			// Skip debug if it's just internal:time_* spamming.
			if (!(label === 'internal' && variable.match(/^time_/))) {
				debug('Variable $(' + label + ':' + variable + ') is "' + value + '"')
			}

			if (this.io() !== undefined) {
				this.io.emit('variable_set', label + ':' + variable, value)
			}
		}
	}
}

exports = module.exports = Variable
