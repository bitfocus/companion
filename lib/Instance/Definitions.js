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

import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import CoreBase from '../Core/Base.js'
import { CreateBankControlId } from '../Resources/Util.js'

// Socket.IO room, for clients interested in presets
const PresetsRoom = 'presets'
const ActionsRoom = 'action-definitions'
const FeedbacksRoom = 'feedback-definitions'

class InstanceDefinitions extends CoreBase {
	/**
	 * The action definitions
	 * @type {Object}
	 * @access protected
	 */
	actionDefinitions = {}
	/**
	 * The feedback definitions
	 * @type {Object}
	 * @access protected
	 */
	feedbackDefinitions = {}
	/**
	 * The preset definitions
	 * @type {Object}
	 * @access protected
	 */
	presetDefinitions = {}

	constructor(registry) {
		super(registry, 'definitions', 'Instance/Definitions')
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('presets:subscribe', () => {
			client.join(PresetsRoom)

			const result = {}
			for (const [id, presets] of Object.entries(this.presetDefinitions)) {
				if (presets.length > 0) {
					result[id] = this.#simplifyPresetsForUi(presets)
				}
			}

			return result
		})
		client.onPromise('presets:unsubscribe', () => {
			client.leave(PresetsRoom)
		})

		client.onPromise('action-definitions:subscribe', () => {
			client.join(ActionsRoom)

			return this.actionDefinitions
		})
		client.onPromise('action-definitions:unsubscribe', () => {
			client.leave(ActionsRoom)
		})

		client.onPromise('feedback-definitions:subscribe', () => {
			client.join(FeedbacksRoom)

			return this.feedbackDefinitions
		})
		client.onPromise('feedback-definitions:unsubscribe', () => {
			client.leave(FeedbacksRoom)
		})

		client.onPromise('presets:import_to_bank', this.importPresetToBank.bind(this))

		client.onPromise('presets:preview_render', (instance_id, preset_id) => {
			const definition = this.presetDefinitions[instance_id]?.find((p) => p.id === preset_id)
			if (definition) {
				const render = this.graphics.drawPreview(definition.bank)
				if (render) {
					return render.buffer
				} else {
					return null
				}
			} else {
				return null
			}
		})

		client.onPromise('feedback-definitions:create-item', this.createFeedbackItem.bind(this))
	}
	/**
	 * Create a feedback item without saving fpr the UI
	 * @param {string} instanceId - the id of the instance
	 * @param {string} feedbackId - the id of the feedback
	 * @access protected
	 */
	createFeedbackItem(instanceId, feedbackId) {
		const definition = this.getFeedbackDefinition(instanceId, feedbackId)
		if (definition) {
			const feedback = {
				id: nanoid(),
				type: feedbackId,
				instance_id: instanceId,
				options: {},
				style: {},
			}

			if (definition.options !== undefined && definition.options.length > 0) {
				for (const j in definition.options) {
					const opt = definition.options[j]
					feedback.options[opt.id] = cloneDeep(opt.default)
				}
			}

			if (definition.type === 'boolean' && definition.style) {
				feedback.style = cloneDeep(definition.style)
			}

			return feedback
		} else {
			return null
		}
	}

	/**
	 * Forget all the definitions for an instance
	 * @param {string} instance_id
	 */
	forgetInstance(instance_id) {
		delete this.presetDefinitions[instance_id]
		this.io.emitToRoom(PresetsRoom, 'presets:update', instance_id, undefined)

		delete this.actionDefinitions[instance_id]
		this.io.emitToRoom(ActionsRoom, 'action-definitions:update', instance_id, undefined)

		delete this.feedbackDefinitions[instance_id]
		this.io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', instance_id, undefined)
	}

	/**
	 * Get an action definition
	 * @param {string} instanceId
	 * @param {string} actionId
	 * @returns
	 */
	getActionDefinition(instanceId, actionId) {
		if (this.actionDefinitions[instanceId]) {
			return this.actionDefinitions[instanceId][actionId]
		} else {
			return undefined
		}
	}

	/**
	 * Get a feedback definition
	 * @param {string} instanceId
	 * @param {string} feedbackId
	 * @returns
	 */
	getFeedbackDefinition(instanceId, feedbackId) {
		if (this.feedbackDefinitions[instanceId]) {
			return this.feedbackDefinitions[instanceId][feedbackId]
		} else {
			return undefined
		}
	}

	/**
	 * Import a preset onto a bank
	 * @param {string} instance_id
	 * @param {object} preset_id
	 * @param {number} page
	 * @param {number} bank
	 */
	importPresetToBank(instance_id, preset_id, page, bank) {
		const definition = cloneDeep(this.presetDefinitions[instance_id]?.find((p) => p.id === preset_id))
		if (definition) {
			if (definition.action_sets) {
				for (let set in definition.action_sets) {
					const actions_set = definition.action_sets[set]
					for (const action of actions_set) {
						action.id = nanoid()
						action.instance = instance_id
					}
				}
			}

			if (definition.feedbacks !== undefined) {
				for (let i = 0; i < definition.feedbacks.length; ++i) {
					definition.feedbacks[i].id = nanoid()
					definition.feedbacks[i].instance_id = instance_id
				}
			} else {
				definition.feedbacks = []
			}

			definition.config = definition.bank
			delete definition.bank

			this.controls.importControl(CreateBankControlId(page, bank), definition)
		}
	}

	/**
	 * Set the action definitions for an instance
	 * @param {string} instanceId
	 * @param {object} actions
	 * @access public
	 */
	setActionDefinitions(instanceId, actions) {
		this.actionDefinitions[instanceId] = actions
		this.io.emitToRoom(ActionsRoom, 'action-definitions:update', instanceId, actions)
	}

	/**
	 * Set the feedback definitions for an instance
	 * @param {string} instanceId - the instance ID
	 * @param {object} feedbacks - the feedback definitions
	 * @access public
	 */
	setFeedbackDefinitions(instanceId, feedbacks) {
		this.feedbackDefinitions[instanceId] = feedbacks
		this.io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', instanceId, feedbacks)
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
				id: rawPreset.id || nanoid(),
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
		if (this.presetDefinitions[instance_id] !== undefined) {
			this.logger.silly('Updating presets for instance ' + labelTo)
			this.#updateVariablePrefixesAndStoreDefinitions(id, labelTo, this.presetDefinitions[instance_id])
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

		this.presetDefinitions[instance_id] = presets
		this.io.emitToRoom(PresetsRoom, 'presets:update', instance_id, this.#simplifyPresetsForUi(presets))
	}

	/**
	 * The ui doesnt need many of the preset properties. Simplify an array of them in preparation for sending to the ui
	 * @param {Array<object>} presets
	 */
	#simplifyPresetsForUi(presets) {
		return presets.map((preset) => ({
			id: preset.id,
			label: preset.label,
			category: preset.category,
		}))
	}
}

export default InstanceDefinitions
