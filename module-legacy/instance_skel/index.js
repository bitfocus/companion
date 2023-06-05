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

const util = require('util')
// const debug = require('debug')('lib/instance_skel')
var icons = require('../lib/resources/icons')

const pkgJson = global.modulePkg
if (!pkgJson) throw new Error('Missing module package.json data')

function instance(system, id, config) {
	var self = this

	self.system = system
	self.id = id
	self.config = config
	self.package_info = pkgJson

	self.Image = self.system.Image

	self.label = config.label

	// Debug with module-name prepeded
	self.defineConst('debug', require('debug')('instance:' + self.package_info.name + ':' + self.id))

	// Update instance health, levels: null = unknown, 0 = ok, 1 = warning, 2 = error
	self.defineConst('log', function (level, info) {
		var self = this

		self.system.sendLog(level, info)
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

	/**
	 * Backwards compatibility for some usages of system..`
	 */

	system.on('instance_actions', function (_id, actions) {
		self.setActions(actions)
	})

	system.on('variable_parse', function (string, cb) {
		self.system.parseVariables(string, cb)
	})

	system.on('osc_send', function (host, port, path, args) {
		self.oscSend(host, port, path, args)
	})

	system.on('log', function (source, level, message) {
		self.sendLog(level, message)
	})
}

instance.prototype.defineConst = function (name, value) {
	Object.defineProperty(this, name, {
		value: value,
		enumerable: true,
		writable: false,
	})
}

instance.prototype.rgb = (r, g, b, base = 10) => {
	r = parseInt(r, base)
	g = parseInt(g, base)
	b = parseInt(b, base)

	if (isNaN(r) || isNaN(g) || isNaN(b)) return false
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

instance.prototype.rgbRev = (dec) => {
	dec = Math.round(dec)

	return {
		r: (dec & 0xff0000) >> 16,
		g: (dec & 0x00ff00) >> 8,
		b: dec & 0x0000ff,
	}
}

// Update instance health, levels: null = unknown, 0 = ok, 1 = warning, 2 = error
instance.prototype.status = function (level, message) {
	var self = this

	if (self.currentStatus != level || self.currentStatusMessage != message) {
		self.currentStatus = level
		self.currentStatusMessage = message

		self.system.sendStatus(level, message)
	}
}

instance.prototype.saveConfig = function () {
	var self = this
	self.system.saveConfig(self.config)
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
	self.system.setActions(actions, self.action && self.action.bind(self))
}

instance.prototype.setVariableDefinitions = function (variables) {
	var self = this
	self.system.setVariableDefinitions(variables)
}

instance.prototype.setVariable = function (variable, value) {
	var self = this
	self.system.setVariable(variable, value)
}

instance.prototype.setVariables = function (variables) {
	var self = this

	if (typeof variables === 'object') {
		self.system.setVariables(variables)
	}
}

instance.prototype.getVariable = function (variable, cb) {
	var self = this
	self.system.getVariable(variable, cb)
}

instance.prototype.parseVariables = function (string, cb) {
	var self = this
	self.system.parseVariables(string, cb)
}

instance.prototype.setFeedbackDefinitions = function (feedbacks) {
	var self = this
	self.system.setFeedbackDefinitions(feedbacks, self.feedback && self.feedback.bind(self))
}

instance.prototype.setPresetDefinitions = function (presets) {
	var self = this
	self.system.setPresetDefinitions(presets)
}

instance.prototype.checkFeedbacks = function (...types) {
	var self = this
	return self.system.checkFeedbacks(...types)
}

instance.prototype.checkFeedbacksById = function (...ids) {
	var self = this
	return self.system.checkFeedbacksById(...ids)
}

instance.prototype.getAllFeedbacks = function () {
	var self = this
	return self.system.getAllFeedbacks()
}

instance.prototype.subscribeFeedbacks = function (type) {
	var self = this
	return self.system.subscribeFeedbacks(type)
}

instance.prototype.unsubscribeFeedbacks = function (type) {
	var self = this
	return self.system.unsubscribeFeedbacks(type)
}

instance.prototype.getAllActions = function () {
	var self = this
	return self.system.getAllActions()
}

instance.prototype.subscribeActions = function (type) {
	var self = this
	return self.system.subscribeActions(type)
}

instance.prototype.unsubscribeActions = function (type) {
	var self = this
	return self.system.unsubscribeActions(type)
}

instance.prototype.oscSend = function (host, port, path, args) {
	var self = this
	self.system.oscSend(host, port, path, args)
}

instance.extendedBy = function (module) {
	util.inherits(module, instance)
}

module.exports = instance
