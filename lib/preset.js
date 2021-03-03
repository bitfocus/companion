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
var debug = require('debug')('lib/preset')
var shortid = require('shortid')

function preset(system) {
	var self = this

	self.system = system
	self.presets = {}

	self.system.emit('io_get', function (io) {
		self.io = io
		self.system.on('io_connect', function (client) {
			function sendResult(answer, name, ...args) {
				if (typeof answer === 'function') {
					answer(...args)
				} else {
					client.emit(name, ...args)
				}
			}

			client.on('get_presets', function (answer) {
				sendResult(answer, 'get_presets:result', self.presets)
			})

			client.on('preset_drop', function (instance, config, page, bank) {
				if (config.actions !== undefined) {
					for (var i = 0; i < config.actions.length; ++i) {
						config.actions[i].id = shortid.generate()
						config.actions[i].instance = instance
						config.actions[i].label = instance + ':' + config.actions[i].action
					}
				} else {
					config.actions = []
				}

				if (config.release_actions !== undefined) {
					for (var i = 0; i < config.release_actions.length; ++i) {
						config.release_actions[i].id = shortid.generate()
						config.release_actions[i].instance = instance
						config.release_actions[i].label = instance + ':' + config.release_actions[i].action
					}
				} else {
					config.release_actions = []
				}

				if (config.feedbacks !== undefined) {
					for (var i = 0; i < config.feedbacks.length; ++i) {
						config.feedbacks[i].id = shortid.generate()
						config.feedbacks[i].instance_id = instance
					}
				} else {
					config.feedbacks = []
				}

				config.config = config.bank
				delete config.bank

				self.system.emit('import_bank', page, bank, config, function () {
					client.emit('preset_drop:result', null, 'ok')
				})
			})
		})
	})

	self.system.on('instance_enable', function (id, state) {
		if (state === false) {
			delete self.presets[id]
			self.io.emit('presets_delete', id)
		}
	})

	self.system.on('instance_delete', function (id) {
		delete self.presets[id]
		self.io.emit('presets_delete', id)
	})

	self.system.on('preset_instance_definitions_set', function (instance, presets) {
		self.presets[instance.id] = presets
		self.io.emit('presets_update', instance.id, presets)
	})

	system.on('variable_instance_label_rename', function (labelFrom, labelTo, id) {
		if (self.presets[id] !== undefined) {
			system.emit('instance_get', id, function (instance) {
				if (instance !== undefined) {
					instance.label = labelTo
					debug('Updating presets for instance ' + labelTo)
					instance.setPresetDefinitions(self.presets[id])
				}
			})
		}
	})

	return self
}

exports = module.exports = function (system) {
	return new preset(system)
}
