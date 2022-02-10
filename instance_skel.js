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

var upgrades = require('./lib/Data/Upgrade')

instance.prototype.parseVariables = function (string, cb) {
	var self = this

	self.system.emit('variable_parse', string, cb)
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
		preset = upgrades.upgradePreset(preset)

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

instance.prototype.getAllActions = function () {
	var self = this
	var result = []

	self.system.emit('actions_for_instance', self.id, function (_result) {
		result = _result
	})

	return result
}

module.exports = instance
