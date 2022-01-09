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

const shortid = require('shortid')
const { sendResult } = require('./resources/util')

class preset {
	debug = require('debug')('lib/preset')

	constructor(system) {
		this.system = system
		this.presets = {}

		this.system.emit('io_get', (io) => {
			this.io = io
			this.system.on('io_connect', (client) => {
				client.on('get_presets', (answer) => {
					sendResult(answer, 'get_presets:result', this.presets)
				})

				client.on('preset_drop', (instance, config, page, bank) => {
					if (config.actions !== undefined) {
						for (let i = 0; i < config.actions.length; ++i) {
							config.actions[i].id = shortid.generate()
							config.actions[i].instance = instance
							config.actions[i].label = instance + ':' + config.actions[i].action
						}
					} else {
						config.actions = []
					}

					if (config.release_actions !== undefined) {
						for (let i = 0; i < config.release_actions.length; ++i) {
							config.release_actions[i].id = shortid.generate()
							config.release_actions[i].instance = instance
							config.release_actions[i].label = instance + ':' + config.release_actions[i].action
						}
					} else {
						config.release_actions = []
					}

					if (config.feedbacks !== undefined) {
						for (let i = 0; i < config.feedbacks.length; ++i) {
							config.feedbacks[i].id = shortid.generate()
							config.feedbacks[i].instance_id = instance
						}
					} else {
						config.feedbacks = []
					}

					config.config = config.bank
					delete config.bank

					this.system.emit('import_bank', page, bank, config, () => {
						client.emit('preset_drop:result', null, 'ok')
					})
				})
			})
		})

		this.system.on('instance_enable', (id, state) => {
			if (state === false) {
				delete this.presets[id]
				this.io.emit('presets_delete', id)
			}
		})

		this.system.on('instance_delete', (id) => {
			delete this.presets[id]
			this.io.emit('presets_delete', id)
		})

		this.system.on('preset_instance_definitions_set', (instance, presets) => {
			this.presets[instance.id] = presets
			this.io.emit('presets_update', instance.id, presets)
		})

		this.system.on('variable_instance_label_rename', (labelFrom, labelTo, id) => {
			if (this.presets[id] !== undefined) {
				this.system.emit('instance_get', id, (instance) => {
					if (instance !== undefined) {
						instance.label = labelTo
						this.debug('Updating presets for instance ' + labelTo)
						instance.setPresetDefinitions(this.presets[id])
					}
				})
			}
		})
	}
}

exports = module.exports = function (system) {
	return new preset(system)
}
