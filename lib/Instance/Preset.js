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

import { nanoid } from 'nanoid'
import { sendResult } from '../Resources/Util.js'
import CoreBase from '../Core/Base.js'

class InstancePreset extends CoreBase {
	constructor(registry) {
		super(registry, 'presets', 'Instance/Preset')
		this.presets = {}
	}

	forgetInstance(instance_id) {
		delete this.presets[instance_id]
		this.io.emit('presets_delete', instance_id)
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('get_presets', (answer) => {
			sendResult(client, answer, 'get_presets:result', this.presets)
		})

		client.on('preset_drop', (instance_id, config, page, bank) => {
			if (config.action_sets) {
				for (let set in config.action_sets) {
					const actions_set = config.action_sets[set]
					for (const action of actions_set) {
						action.id = nanoid()
						action.instance = instance_id
						action.label = `${instance_id}:${action.action}`
					}
				}
			}

			if (config.feedbacks !== undefined) {
				for (let i = 0; i < config.feedbacks.length; ++i) {
					config.feedbacks[i].id = nanoid()
					config.feedbacks[i].instance_id = instance_id
				}
			} else {
				config.feedbacks = []
			}

			config.config = config.bank
			delete config.bank

			this.bank.importBank(page, bank, config)
			client.emit('preset_drop:result', null, 'ok')
		})
	}

	/**
	 * Set the preset definitions for an instance
	 * @access public
	 * @param {string} instance_id
	 * @param {string} label
	 * @param {object} rawPresets
	 */
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

		this.#updateVariablePrefixesAndStoreDefinitions(instance_id, label, newPresets)
	}

	/**
	 * Update all the variables in the presets to reference the supplied label
	 * @param {string} instance_id
	 * @param {string} labelTo
	 */
	updateVariablePrefixesForLabel(instance_id, labelTo) {
		if (this.presets[instance_id] !== undefined) {
			this.logger.silly('Updating presets for instance ' + labelTo)
			this.#updateVariablePrefixesAndStoreDefinitions(id, labelTo, this.presets[instance_id])
		}
	}

	/**
	 * Update all the variables in the presets to reference the supplied label, and store them
	 * @param {string} instance_id
	 * @param {string} label
	 * @param {object} presets
	 */
	#updateVariablePrefixesAndStoreDefinitions(instance_id, label, presets) {
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

export default InstancePreset
