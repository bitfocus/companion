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

	self._versionscripts = []

	for (var key in icons) {
		self.defineConst(key, icons[key])
	}

	self.defineConst(
		'REGEX_IP',
		'/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/'
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

	self.currentStatus = level
	self.currentStatusMessage = message
	self.system.emit('instance_status_update', self.id, level, message)
}

instance.prototype.upgradeConfig = function () {
	var self = this

	var idx = self.config._configIdx
	if (idx === undefined) {
		idx = -1
	}

	var debug = require('debug')('instance:' + self.package_info.name + ':' + self.id)

	if (idx + 1 < self._versionscripts.length) {
		debug('upgradeConfig(' + self.package_info.name + '): ' + (idx + 1) + ' to ' + self._versionscripts.length)
	}

	for (var i = idx + 1; i < self._versionscripts.length; ++i) {
		debug('UpgradeConfig: Upgrading to version ' + (i + 1))

		// Fetch instance actions
		var actions = []
		self.system.emit('actions_for_instance', self.id, function (_actions) {
			actions = _actions
		})
		var release_actions = []
		self.system.emit('release_actions_for_instance', self.id, function (_release_actions) {
			release_actions = _release_actions
		})
		var feedbacks = []
		self.system.emit('feedbacks_for_instance', self.id, function (_feedbacks) {
			feedbacks = _feedbacks
		})

		var result
		try {
			result = self._versionscripts[i](self.config, actions, release_actions, feedbacks)
		} catch (e) {
			debug('Upgradescript in ' + self.package_info.name + ' failed', e)
		}
		self.config._configIdx = i

		for (const action of [...actions, release_actions]) {
			action.instance = self.id
			action.label = `${self.id}:${action.action}`
		}

		// If anything was changed, update system and db
		if (result) {
			self.system.emit('config_save')
			self.system.emit('action_save')
			self.system.emit('release_action_save')
			self.system.emit('feedback_save')
			self.system.emit('instance_save')
			self.system.emit('db_save')
		}
	}

	if (idx + 1 < self._versionscripts.length) {
		// Save the _configIdx change
		this.saveConfig()
	}

	debug('instance save')
	self.system.emit('instance_save')
}

instance.prototype.saveConfig = function () {
	var self = this

	// Save config, but do not automatically call this module's updateConfig again
	self.system.emit('instance_config_put', self.id, self.config, true)
}

instance.prototype.addUpgradeScript = function (cb) {
	var self = this

	self._versionscripts.push(cb)
}

instance.prototype.setActions = function (actions) {
	var self = this

	if (actions === undefined) {
		self._actionDefinitions = {}
	} else {
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
		self._feedbackDefinitions = feedbacks
	}

	self.system.emit('feedback_instance_definitions_set', self, feedbacks)
}

instance.prototype.setPresetDefinitions = function (presets) {
	var self = this

	// Because RegExp.escape did not become a standard somehow
	function escape(str) {
		return str.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&')
	}

	/*
	 * Clean up variable references: $(instance:variable)
	 * since the name of the instance is dynamic. We don't want to
	 * demand that your presets MUST be dynamically generated.
	 */
	for (var i = 0; i < presets.length; ++i) {
		var bank = presets[i].bank
		var fixtext = bank.text
		if (bank !== undefined && fixtext !== undefined) {
			if (fixtext.match(/\$\(/)) {
				var matches,
					reg = /\$\(([^:)]+):([^)]+)\)/g

				while ((matches = reg.exec(fixtext)) !== null) {
					if (matches[1] !== undefined) {
						if (matches[2] !== undefined) {
							reg2 = new RegExp('\\$\\(' + escape(matches[1]) + ':' + escape(matches[2]) + '\\)')
							bank.text = bank.text.replace(reg2, '$(' + self.label + ':' + matches[2] + ')')
						}
					}
				}
			}
		}
	}

	self.system.emit('preset_instance_definitions_set', self, presets)
}

instance.prototype.checkFeedbacks = function (type) {
	var self = this

	self.system.emit('feedback_instance_check', self, type)
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

			self.subscribeFeedback(feedback)
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

			self.unsubscribeFeedback(feedback)
		}
	}
}

instance.prototype.subscribeFeedback = function (feedback) {
	var self = this

	if (feedback.type !== undefined && self._feedbackDefinitions[feedback.type] !== undefined) {
		let definition = self._feedbackDefinitions[feedback.type]
		// Run the subscribe function if needed
		if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
			definition.subscribe(feedback)
		}
	}
}

instance.prototype.unsubscribeFeedback = function (feedback) {
	var self = this

	if (feedback.type !== undefined && self._feedbackDefinitions[feedback.type] !== undefined) {
		let definition = self._feedbackDefinitions[feedback.type]
		// Run the unsubscribe function if needed
		if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
			definition.unsubscribe(feedback)
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

			self.subscribeAction(action)
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

			self.unsubscribeAction(action)
		}
	}
}

instance.prototype.subscribeAction = function (action) {
	var self = this

	if (action.action !== undefined && self._actionDefinitions[action.action] !== undefined) {
		let definition = self._actionDefinitions[action.action]
		// Run the subscribe function if needed
		if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
			definition.subscribe(action)
		}
	}
}

instance.prototype.unsubscribeAction = function (action) {
	var self = this

	if (action.action !== undefined && self._actionDefinitions[action.action] !== undefined) {
		let definition = self._actionDefinitions[action.action]
		// Run the unsubscribe function if needed
		if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
			definition.unsubscribe(action)
		}
	}
}

instance.extendedBy = function (module) {
	util.inherits(module, instance)
}

module.exports = instance
