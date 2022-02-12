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
const { sendResult } = require('../Resources/Util')
const DataUpgrade = require('../Data/Upgrade')
const CoreBase = require('../Core/Base')

class InstancePreset extends CoreBase {
	constructor(registry) {
		super(registry, 'presets', 'lib/Instance/Preset')
		this.presets = {}

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', (client) => {
				client.on('get_presets', (answer) => {
					sendResult(client, answer, 'get_presets:result', this.presets)
				})

				client.on('preset_drop', (instance_id, config, page, bank) => {
					if (config.action_sets) {
						for (let set in config.action_sets) {
							const actions_set = config.action_sets[set]
							for (const action of actions_set) {
								action.id = shortid.generate()
								action.instance = instance_id
								action.label = `${instance_id}:${action.action}`
							}
						}
					}

					if (config.feedbacks !== undefined) {
						for (let i = 0; i < config.feedbacks.length; ++i) {
							config.feedbacks[i].id = shortid.generate()
							config.feedbacks[i].instance_id = instance_id
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

		this.system.on('variable_instance_label_rename', (labelFrom, labelTo, id) => {
			if (this.presets[id] !== undefined) {
				this.debug('Updating presets for instance ' + labelTo)
				this.updateVariablePrefixesAndStoreDefinitions(id, labelTo, this.presets[id])
			}
		})
	}

	setPresetDefinitions(instance_id, label, rawPresets) {
		const newPresets = []

		for (const rawPreset of rawPresets) {
			const action_sets = {}
			for (const [setId, set] of Object.entries(rawPreset.action_sets)) {
				action_sets[setId] = set.map((act) => ({
					action: act.actionId,
					options: act.options,
				}))
			}

			newPresets.push({
				category: rawPreset.category,
				label: rawPreset.label,
				bank: rawPreset.bank,
				feedbacks: rawPreset.feedbacks.map((fb) => ({
					type: fb.feedbackId,
					options: fb.options,
					style: fb.style,
				})),
				action_sets: action_sets,
			})
		}

		this.updateVariablePrefixesAndStoreDefinitions(instance_id, label, newPresets)
	}

	updateVariablePrefixesAndStoreDefinitions(instance_id, label, presets) {
		const variableRegex = /\$\(([^:)]+):([^)]+)\)/g
		function replaceAllVariables(fixtext) {
			if (fixtext && fixtext.includes('$(')) {
				let matches
				while ((matches = variableRegex.exec(fixtext)) !== null) {
					if (matches[2] !== undefined) {
						fixtext = fixtext.replace(matches[0], '$(' + label + ':' + matches[2] + ')')
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
		for (const preset of presets) {
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

		this.presets[instance_id] = presets
		this.io.emit('presets_update', instance_id, presets)
	}
}

module.exports = InstancePreset
