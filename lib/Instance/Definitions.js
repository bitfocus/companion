import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import CoreBase from '../Core/Base.js'
import { CreateBankControlId } from '../Shared/ControlId.js'
import { EventDefinitions } from '../Resources/EventDefinitions.js'

const PresetsRoom = 'presets'
const ActionsRoom = 'action-definitions'
const FeedbacksRoom = 'feedback-definitions'

/**
 * Class to handle and store the 'definitions' produced by instances.
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @abstract
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class InstanceDefinitions extends CoreBase {
	/**
	 * The action definitions
	 * @type {Object}
	 * @access private
	 */
	#actionDefinitions = {}
	/**
	 * The feedback definitions
	 * @type {Object}
	 * @access protected
	 */
	#feedbackDefinitions = {}
	/**
	 * The preset definitions
	 * @type {Object}
	 * @access protected
	 */
	#presetDefinitions = {}

	/**
	 * @param {Registry} registry - the application core
	 */
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
			for (const [id, presets] of Object.entries(this.#presetDefinitions)) {
				if (Object.keys(presets).length > 0) {
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

			return this.#actionDefinitions
		})
		client.onPromise('action-definitions:unsubscribe', () => {
			client.leave(ActionsRoom)
		})

		client.onPromise('feedback-definitions:subscribe', () => {
			client.join(FeedbacksRoom)

			return this.#feedbackDefinitions
		})
		client.onPromise('feedback-definitions:unsubscribe', () => {
			client.leave(FeedbacksRoom)
		})

		client.onPromise('event-definitions:get', () => {
			return EventDefinitions
		})

		client.onPromise('presets:import_to_bank', this.importPresetToBank.bind(this))

		client.onPromise('presets:preview_render', (instance_id, preset_id) => {
			const definition = this.#presetDefinitions[instance_id]?.[preset_id]
			if (definition) {
				const style = {
					...definition.style,
					style: definition.type,
				}

				if (style.text) style.text = this.instance.variable.parseVariables(style.text).text

				const render = this.graphics.drawPreview(style)
				if (render) {
					return render.buffer
				} else {
					return null
				}
			} else {
				return null
			}
		})

		client.onPromise('action-definitions:create-item', this.createActionItem.bind(this))
		client.onPromise('feedback-definitions:create-item', this.createFeedbackItem.bind(this))

		client.onPromise('action-definitions:learn-single', (action) => {
			if (action) {
				const instance = this.instance.moduleHost.getChild(action.instance)
				if (instance) {
					return instance.actionLearnValues(action)
				}
			}
		})
		client.onPromise('feedback-definitions:learn-single', (feedback) => {
			if (feedback) {
				const instance = this.instance.moduleHost.getChild(feedback.instance_id)
				if (instance) {
					return instance.feedbackLearnValues(feedback)
				}
			}
		})
	}

	/**
	 * Create a action item without saving
	 * @param {string} instanceId - the id of the instance
	 * @param {string} actionId - the id of the action
	 * @access public
	 */
	createActionItem(instanceId, actionId) {
		const definition = this.getActionDefinition(instanceId, actionId)
		if (definition) {
			const action = {
				id: nanoid(),
				action: actionId,
				instance: instanceId,
				options: {},
				delay: 0,
			}

			if (definition.options !== undefined && definition.options.length > 0) {
				for (const j in definition.options) {
					const opt = definition.options[j]
					action.options[opt.id] = cloneDeep(opt.default)
				}
			}

			return action
		} else {
			return null
		}
	}

	/**
	 * Create a feedback item without saving fpr the UI
	 * @param {string} instanceId - the id of the instance
	 * @param {string} feedbackId - the id of the feedback
	 * @param {boolean} booleanOnly - whether the feedback must be boolean
	 * @access public
	 */
	createFeedbackItem(instanceId, feedbackId, booleanOnly) {
		const definition = this.getFeedbackDefinition(instanceId, feedbackId)
		if (definition) {
			if (booleanOnly && definition.type !== 'boolean') return null

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

			if (!booleanOnly && definition.type === 'boolean' && definition.style) {
				feedback.style = cloneDeep(definition.style)
			}

			return feedback
		} else {
			return null
		}
	}

	createEventItem(eventType) {
		const definition = EventDefinitions[eventType]
		if (definition) {
			const event = {
				id: nanoid(),
				type: eventType,
				enabled: true,
				options: {},
			}

			for (const opt of definition.options) {
				event.options[opt.id] = cloneDeep(opt.default)
			}

			return event
		} else {
			return null
		}
	}

	/**
	 * Forget all the definitions for an instance
	 * @param {string} instance_id
	 * @access public
	 */
	forgetInstance(instance_id) {
		delete this.#presetDefinitions[instance_id]
		this.io.emitToRoom(PresetsRoom, 'presets:update', instance_id, undefined)

		delete this.#actionDefinitions[instance_id]
		this.io.emitToRoom(ActionsRoom, 'action-definitions:update', instance_id, undefined)

		delete this.#feedbackDefinitions[instance_id]
		this.io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', instance_id, undefined)
	}

	/**
	 * Get an action definition
	 * @param {string} instanceId
	 * @param {string} actionId
	 * @access public
	 */
	getActionDefinition(instanceId, actionId) {
		if (this.#actionDefinitions[instanceId]) {
			return this.#actionDefinitions[instanceId][actionId]
		} else {
			return undefined
		}
	}

	/**
	 * Get a feedback definition
	 * @param {string} instanceId
	 * @param {string} feedbackId
	 * @access public
	 */
	getFeedbackDefinition(instanceId, feedbackId) {
		if (this.#feedbackDefinitions[instanceId]) {
			return this.#feedbackDefinitions[instanceId][feedbackId]
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
	 * @access public
	 */
	importPresetToBank(instance_id, preset_id, page, bank) {
		const definition = cloneDeep(this.#presetDefinitions[instance_id]?.[preset_id])
		if (definition) {
			if (definition.steps) {
				const newSteps = {}
				for (let i = 0; i < definition.steps.length; i++) {
					newSteps[i] = { action_sets: definition.steps[i] }
					for (let set in definition.steps[i]) {
						const actions_set = definition.steps[i][set]
						for (const action of actions_set) {
							action.id = nanoid()
							action.instance = instance_id
							action.delay = action.delay ?? 0
						}
					}
				}
				definition.steps = newSteps
			}

			if (definition.feedbacks) {
				for (let i = 0; i < definition.feedbacks.length; ++i) {
					definition.feedbacks[i].id = nanoid()
					definition.feedbacks[i].instance_id = instance_id
				}
			} else {
				definition.feedbacks = []
			}

			if (!definition.options) {
				// TODO - how is this possible?
				definition.options = {}
			}

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
		this.#actionDefinitions[instanceId] = actions
		this.io.emitToRoom(ActionsRoom, 'action-definitions:update', instanceId, actions)
	}

	/**
	 * Set the feedback definitions for an instance
	 * @param {string} instanceId - the instance ID
	 * @param {object} feedbacks - the feedback definitions
	 * @access public
	 */
	setFeedbackDefinitions(instanceId, feedbacks) {
		this.#feedbackDefinitions[instanceId] = feedbacks
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
		const newPresets = {}

		for (const [id, rawPreset] of Object.entries(rawPresets)) {
			try {
				newPresets[id] = {
					id: id,
					category: rawPreset.category,
					name: rawPreset.name,
					type: rawPreset.type,
					style: rawPreset.style,
					options: rawPreset.options,
					feedbacks: rawPreset.feedbacks.map((fb) => ({
						type: fb.feedbackId,
						options: fb.options,
						style: fb.style,
					})),
					steps: rawPreset.steps.map((step) => {
						const action_sets = {}
						for (const [setId, set] of Object.entries(step)) {
							action_sets[setId] = set.map((act) => ({
								action: act.actionId,
								options: act.options,
								delay: act.delay,
							}))
						}
						return action_sets
					}),
				}

				if (!newPresets[id].steps.length) {
					newPresets[id].steps.push({ down: [], up: [] })
				}
			} catch (e) {
				this.logger.warn(`${label} gave invalid preset "${id}": ${e}`)
			}
		}

		this.#updateVariablePrefixesAndStoreDefinitions(instance_id, label, newPresets)
	}

	/**
	 * The ui doesnt need many of the preset properties. Simplify an array of them in preparation for sending to the ui
	 * @param {object} presets
	 * @access private
	 */
	#simplifyPresetsForUi(presets) {
		const res = {}

		for (const [id, preset] of Object.entries(presets)) {
			res[id] = {
				id: preset.id,
				label: preset.name,
				category: preset.category,
			}
		}

		return res
	}

	/**
	 * Update all the variables in the presets to reference the supplied label
	 * @param {string} instance_id
	 * @param {string} labelTo
	 */
	updateVariablePrefixesForLabel(instance_id, labelTo) {
		if (this.#presetDefinitions[instance_id] !== undefined) {
			this.logger.silly('Updating presets for instance ' + labelTo)
			this.#updateVariablePrefixesAndStoreDefinitions(instance_id, labelTo, this.#presetDefinitions[instance_id])
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
		for (const preset of Object.values(presets)) {
			if (preset.style) {
				preset.style.text = replaceAllVariables(preset.style.text)
			}

			if (preset.feedbacks) {
				for (const feedback of preset.feedbacks) {
					if (feedback.style && feedback.style.text) {
						feedback.style.text = replaceAllVariables(feedback.style.text)
					}
				}
			}
		}

		this.#presetDefinitions[instance_id] = presets
		this.io.emitToRoom(PresetsRoom, 'presets:update', instance_id, this.#simplifyPresetsForUi(presets))
	}
}

export default InstanceDefinitions
