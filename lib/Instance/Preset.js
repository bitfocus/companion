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

var debug = require('debug')('Instance/Preset')
var CoreBase = require('../Core/Base')
var shortid = require('shortid')

class Preset extends CoreBase {
	constructor(registry) {
		super(registry, 'preset')

		this.presets = {}

		this.system.on('io_connect', (client) => {
			client.on('get_presets', (answer) => {
				answer(this.presets)
			})

			client.on('preset_drop', (instance, config, page, bank) => {
				this.system.emit('import_bank', page, bank, this.dropPreset(instance, config))
			})
		})

		this.system.on('instance_enable', this.enableInstance.bind(this))
		this.system.on('instance_delete', this.deleteInstance.bind(this))

		this.system.on('preset_instance_definitions_set', this.setInstanceDefinitions.bind(this))

		this.system.on('variable_instance_label_rename', this.renameInstance.bind(this))
	}

	deleteInstance(id) {
		delete this.presets[id]
		this.io.emit('presets_delete', id)
	}

	dropPreset(instance, config) {
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

		return config
	}

	enableInstance(id, state) {
		if (state === false) {
			this.deleteInstance(id)
		}
	}

	renameInstance(labelFrom, labelTo, id) {
		if (this.presets[id] !== undefined) {
			this.system.emit('instance_get', id, (instance) => {
				if (instance !== undefined) {
					instance.label = labelTo
					debug('Updating presets for instance ' + labelTo)
					instance.setPresetDefinitions(this.presets[id])
				}
			})
		}
	}

	setInstanceDefinitions(instance, presets) {
		this.presets[instance.id] = presets
		this.io.emit('presets_update', instance.id, presets)
	}
}

exports = module.exports = Preset
