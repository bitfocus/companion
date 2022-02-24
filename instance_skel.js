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

var util = require('util')
var debug = require('debug')('lib/instance_skel')
var image = require('./lib/image')
var icons = require('./lib/resources/icons')
var { serializeIsVisibleFn } = require('./lib/resources/util')

function instance(system, id, config) {
	var self = this

	self.system = system
	self.id = id
	self.config = config
	self.package_info = {}
	self._feedbackDefinitions = {}
	self._actionDefinitions = {}

	// we need this object from instance, and I don't really know how to get it
	// out of instance.js without adding an argument to instance() for every
	// single module? TODO: håkon: look over this, please.
	system.emit('instance_get_package_info', function (obj) {
		self.package_info = obj[self.config.instance_type]
	})

	for (var key in icons) {
		self.defineConst(key, icons[key])
	}

	self.defineConst(
		'REGEX_IP',
		'/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/'
	)
	self.defineConst(
		'REGEX_HOSTNAME',
		'/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/'
	)
	self.defineConst('REGEX_BOOLEAN', '/^(true|false|0|1)$/i')
	self.defineConst(
		'REGEX_PORT',
		'/^([1-9]|[1-8][0-9]|9[0-9]|[1-8][0-9]{2}|9[0-8][0-9]|99[0-9]|[1-8][0-9]{3}|9[0-8][0-9]{2}|99[0-8][0-9]|999[0-9]|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-4])$/'
	)
	self.defineConst('REGEX_PERCENT', '/^(100|[0-9]|[0-9][0-9])$/')
	self.defineConst('REGEX_FLOAT', '/^([0-9]*\\.)?[0-9]+$/')
	self.defineConst('REGEX_FLOAT_OR_INT', '/^([0-9]+)(\\.[0-9]+)?$/')
	self.defineConst('REGEX_SIGNED_FLOAT', '/^[+-]?([0-9]*\\.)?[0-9]+$/')
	self.defineConst('REGEX_NUMBER', '/^\\d+$/')
	self.defineConst('REGEX_SOMETHING', '/^.+$/')
	self.defineConst('REGEX_SIGNED_NUMBER', '/^[+-]?\\d+$/')
	self.defineConst(
		'REGEX_TIMECODE',
		'/^(0*[0-9]|1[0-9]|2[0-4]):(0*[0-9]|[1-5][0-9]|60):(0*[0-9]|[1-5][0-9]|60):(0*[0-9]|[12][0-9]|30)$/'
	)
	self.defineConst('CHOICES_YESNO_BOOLEAN', [
		{ id: 'true', label: 'Yes' },
		{ id: 'false', label: 'No' },
	])

	// Going to be deprecated sometime
	self.defineConst('STATE_UNKNOWN', null)
	self.defineConst('STATE_OK', 0)
	self.defineConst('STATE_WARNING', 1)
	self.defineConst('STATE_ERROR', 2)

	// Use these instead
	self.defineConst('STATUS_UNKNOWN', null)
	self.defineConst('STATUS_OK', 0)
	self.defineConst('STATUS_WARNING', 1)
	self.defineConst('STATUS_ERROR', 2)

	self.currentStatus = self.STATUS_UNKNOWN
	self.currentStatusMessage = ''
}

instance.prototype.defineConst = function (name, value) {
	Object.defineProperty(this, name, {
		value: value,
		enumerable: true,
	})
}

instance.prototype.Image = image

instance.prototype.rgb = image.rgb

instance.prototype.rgbRev = image.rgbRev

instance.prototype._init = function () {
	var self = this

	// These two functions needs to be defined after the module has been instanced,
	// as they reference the original constructors static data

	// Debug with module-name prepeded
	self.debug = require('debug')('instance:' + self.package_info.name + ':' + self.id)

	// Log to the skeleton (launcher) log window
	self.log = function (level, info) {
		self.system.emit('log', 'instance(' + self.label + ')', level, info)
	}

	if (typeof self.init == 'function') {
		self.init()
	}
}

// Update instance health, levels: null = unknown, 0 = ok, 1 = warning, 2 = error
instance.prototype.status = function (level, message) {
	var self = this

	if (self.currentStatus != level || self.currentStatusMessage != message) {
		self.currentStatus = level
		self.currentStatusMessage = message
		self.system.emit('instance_status_update', self.id, level, message)
	}
}

instance.prototype.saveConfig = function () {
	var self = this

	// Save config, but do not automatically call this module's updateConfig again
	self.system.emit('instance_config_put', self.id, self.config, true)
}

instance.CreateConvertToBooleanFeedbackUpgradeScript = function (upgrade_map) {
	// Warning: the unused parameters will often be null
	return function (_context, _config, _actions, feedbacks) {
		let changed = false

		for (const feedback of feedbacks) {
			let upgrade_rules = upgrade_map[feedback.type]
			if (upgrade_rules === true) {
				// These are some automated built in rules. They can help make it easier to migrate
				upgrade_rules = {
					bg: 'bgcolor',
					bgcolor: 'bgcolor',
					fg: 'color',
					color: 'color',
					png64: 'png64',
					png: 'png64',
				}
			}

			if (upgrade_rules) {
				if (!feedback.style) feedback.style = {}

				for (const [option_key, style_key] of Object.entries(upgrade_rules)) {
					if (feedback.options[option_key] !== undefined) {
						feedback.style[style_key] = feedback.options[option_key]
						delete feedback.options[option_key]
						changed = true
					}
				}
			}
		}

		return changed
	}
}

/** @deprecated implement the static GetUpgradeScripts instead */
instance.prototype.addUpgradeScript = function () {
	var self = this

	throw new Error(
		'addUpgradeScript has been removed and replaced by a new static GetUpgradeScripts flow. Check the wiki for more information'
	)
}

instance.prototype.setActions = function (actions) {
	var self = this

	if (actions === undefined) {
		self._actionDefinitions = {}
	} else {
		actions = Object.fromEntries(
			Object.entries(actions).map(([id, action]) => {
				if (action && action.options) {
					action.options = serializeIsVisibleFn(action.options)
				}
				return [id, action]
			})
		)

		self._actionDefinitions = actions
	}

	self.system.emit('instance_actions', self.id, actions)
}

instance.prototype.setVariableDefinitions = function (variables) {
	var self = this

	self.system.emit('variable_instance_definitions_set', self, variables)
}

instance.prototype.setVariable = function (variable, value) {
	var self = this

	self.system.emit('variable_instance_set', self, variable, value)
}

instance.prototype.setVariables = function (variables) {
	var self = this

	if (typeof variables === 'object') {
		self.system.emit('variable_instance_set_many', self, variables)
	}
}

instance.prototype.getVariable = function (variable, cb) {
	var self = this

	self.system.emit('variable_get', self.label, variable, cb)
}

instance.prototype.parseVariables = function (string, cb) {
	var self = this

	self.system.emit('variable_parse', string, cb)
}

instance.prototype.setFeedbackDefinitions = function (feedbacks) {
	var self = this

	if (feedbacks === undefined) {
		self._feedbackDefinitions = {}
	} else {
		feedbacks = Object.fromEntries(
			Object.entries(feedbacks).map(([id, feedback]) => {
				if (feedback && feedback.options) {
					feedback.options = serializeIsVisibleFn(feedback.options)
				}
				return [id, feedback]
			})
		)

		self._feedbackDefinitions = feedbacks
	}

	self.system.emit('feedback_instance_definitions_set', self, feedbacks)
}

instance.prototype.setPresetDefinitions = function (presets) {
	var self = this

	const variableRegex = /\$\(([^:)]+):([^)]+)\)/g
	function replaceAllVariables(fixtext) {
		if (fixtext && fixtext.includes('$(')) {
			let matches
			while ((matches = variableRegex.exec(fixtext)) !== null) {
				if (matches[2] !== undefined) {
					fixtext = fixtext.replace(matches[0], '$(' + self.label + ':' + matches[2] + ')')
				}
			}
		}
		return fixtext
	}

	/*
	 * Clean up variable references: $(instance:variable)
	 * since the name of the instance is dynamic. We don't want to
	 * demand that your presets MUST be dynamically generated.
	 */
	for (let preset of presets) {
		if (preset.bank) {
			preset.bank.text = replaceAllVariables(preset.bank.text)
		}

		if (preset.feedbacks) {
			for (const feedback of preset.feedbacks) {
				if (feedback.style && feedback.style.text) {
					feedback.style.text = replaceAllVariables(feedback.style.text)
				}
			}
		}
	}

	self.system.emit('preset_instance_definitions_set', self, presets)
}

instance.prototype.checkFeedbacks = function (...types) {
	var self = this

	self.system.emit('feedback_check_all', { instance_id: self.id, feedback_types: types })
}

instance.prototype.checkFeedbacksById = function (...ids) {
	var self = this

	if (ids && ids.length > 0) {
		self.system.emit('feedback_check_all', { instance_id: self.id, feedback_ids: ids })
	}
}

instance.prototype.getAllFeedbacks = function () {
	var self = this
	var result = undefined

	self.system.emit('feedbacks_for_instance', self.id, function (_result) {
		result = _result
	})
	return result
}

instance.prototype.subscribeFeedbacks = function (type) {
	var self = this
	var feedbacks = self.getAllFeedbacks()

	if (feedbacks.length > 0) {
		for (var i in feedbacks) {
			let feedback = feedbacks[i]

			if (type !== undefined && feedback.type != type) {
				continue
			}

			if (feedback.type !== undefined && self._feedbackDefinitions[feedback.type] !== undefined) {
				let definition = self._feedbackDefinitions[feedback.type]
				// Run the subscribe function if needed
				if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
					definition.subscribe(feedback)
				}
			}
		}
	}
}

instance.prototype.unsubscribeFeedbacks = function (type) {
	var self = this
	var feedbacks = self.getAllFeedbacks()

	if (feedbacks.length > 0) {
		for (var i in feedbacks) {
			let feedback = feedbacks[i]

			if (type !== undefined && feedback.type != type) {
				continue
			}

			if (feedback.type !== undefined && self._feedbackDefinitions[feedback.type] !== undefined) {
				let definition = self._feedbackDefinitions[feedback.type]
				// Run the unsubscribe function if needed
				if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
					definition.unsubscribe(feedback)
				}
			}
		}
	}
}

instance.prototype.getAllActions = function () {
	var self = this
	var result = []

	self.system.emit('actions_for_instance', self.id, function (_result) {
		result = _result
	})
	self.system.emit('release_actions_for_instance', self.id, function (_result) {
		result.push(..._result)
	})
	return result
}

instance.prototype.subscribeActions = function (type) {
	var self = this
	var actions = self.getAllActions()

	if (actions.length > 0) {
		for (var i in actions) {
			let action = actions[i]

			if (type !== undefined && action.action != type) {
				continue
			}

			if (action.action !== undefined && self._actionDefinitions[action.action] !== undefined) {
				let definition = self._actionDefinitions[action.action]
				// Run the subscribe function if needed
				if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
					definition.subscribe(action)
				}
			}
		}
	}
}

instance.prototype.unsubscribeActions = function (type) {
	var self = this
	var actions = self.getAllActions()

	if (actions.length > 0) {
		for (var i in actions) {
			let action = actions[i]

			if (type !== undefined && action.action != type) {
				continue
			}

			if (action.action !== undefined && self._actionDefinitions[action.action] !== undefined) {
				let definition = self._actionDefinitions[action.action]
				// Run the unsubscribe function if needed
				if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
					definition.unsubscribe(action)
				}
			}
		}
	}
}

instance.prototype.oscSend = function (host, port, path, args) {
	var self = this
	self.system.emit('osc_send', host, port, path, args)
}

instance.extendedBy = function (module) {
	util.inherits(module, instance)
}

module.exports = instance
