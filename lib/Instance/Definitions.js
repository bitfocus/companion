import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import CoreBase from '../Core/Base.js'
import { EventDefinitions } from '../Resources/EventDefinitions.js'
import ControlButtonNormal from '../Controls/ControlTypes/Button/Normal.js'
import jsonPatch from 'fast-json-patch'

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
	 * @type {Record<string, Record<string, ActionDefinition>>}
	 * @access private
	 */
	#actionDefinitions = {}
	/**
	 * The feedback definitions
	 * @type {Record<string, Record<string, FeedbackDefinition>>}
	 * @access protected
	 */
	#feedbackDefinitions = {}
	/**
	 * The preset definitions
	 * @type {Record<string, Record<string, PresetDefinition>>}
	 * @access protected
	 */
	#presetDefinitions = {}

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'definitions', 'Instance/Definitions')
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('presets:subscribe', () => {
			client.join(PresetsRoom)

			/** @type {Record<string, Record<string, UIPresetDefinition>>} */
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

		client.onPromise('presets:import-to-location', this.importPresetToLocation.bind(this))

		client.onPromise(
			'presets:preview_render',
			async (/** @type {string } */ connectionId, /** @type {string } */ presetId) => {
				const definition = this.#presetDefinitions[connectionId]?.[presetId]
				if (definition) {
					const style = {
						...(definition.previewStyle ? definition.previewStyle : definition.style),
						style: definition.type,
					}

					if (style.text) style.text = this.instance.variable.parseVariables(style.text).text

					const render = await this.graphics.drawPreview(style)
					if (render) {
						return render.asDataUrl
					} else {
						return null
					}
				} else {
					return null
				}
			}
		)
	}

	/**
	 * Create a action item without saving
	 * @param {string} connectionId - the id of the instance
	 * @param {string} actionId - the id of the action
	 * @access public
	 */
	createActionItem(connectionId, actionId) {
		const definition = this.getActionDefinition(connectionId, actionId)
		if (definition) {
			const action = {
				id: nanoid(),
				action: actionId,
				instance: connectionId,
				options: {},
				delay: 0,
			}

			if (definition.options !== undefined && definition.options.length > 0) {
				for (const j in definition.options) {
					const opt = definition.options[j]
					// @ts-ignore
					action.options[opt.id] = cloneDeep(opt.default)
				}
			}

			return action
		} else {
			return null
		}
	}

	/**
	 * Create a feedback item without saving for the UI
	 * @param {string} connectionId - the id of the connection
	 * @param {string} feedbackId - the id of the feedback
	 * @param {boolean} booleanOnly - whether the feedback must be boolean
	 * @access public
	 */
	createFeedbackItem(connectionId, feedbackId, booleanOnly) {
		const definition = this.getFeedbackDefinition(connectionId, feedbackId)
		if (definition) {
			if (booleanOnly && definition.type !== 'boolean') return null

			const feedback = {
				id: nanoid(),
				type: feedbackId,
				instance_id: connectionId,
				options: {},
				style: {},
				isInverted: false,
			}

			if (definition.options !== undefined && definition.options.length > 0) {
				for (const j in definition.options) {
					const opt = definition.options[j]
					// @ts-ignore
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

	/**
	 *
	 * @param {string} eventType
	 * @returns {import('../Shared/Model/EventModel.js').EventInstance | null}
	 */
	createEventItem(eventType) {
		const definition = EventDefinitions[eventType]
		if (definition) {
			/** @type {import('../Shared/Model/EventModel.js').EventInstance} */
			const event = {
				id: nanoid(),
				type: eventType,
				enabled: true,
				options: {},
			}

			for (const opt of definition.options) {
				// @ts-ignore
				event.options[opt.id] = cloneDeep(opt.default)
			}

			return event
		} else {
			return null
		}
	}

	/**
	 * Forget all the definitions for an instance
	 * @param {string} connectionId
	 * @access public
	 */
	forgetConnection(connectionId) {
		delete this.#presetDefinitions[connectionId]
		if (this.io.countRoomMembers(PresetsRoom) > 0) {
			this.io.emitToRoom(PresetsRoom, 'presets:update', connectionId, undefined)
		}

		delete this.#actionDefinitions[connectionId]
		if (this.io.countRoomMembers(ActionsRoom) > 0) {
			this.io.emitToRoom(ActionsRoom, 'action-definitions:update', connectionId, undefined)
		}

		delete this.#feedbackDefinitions[connectionId]
		if (this.io.countRoomMembers(FeedbacksRoom) > 0) {
			this.io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', connectionId, undefined)
		}
	}

	/**
	 * Get an action definition
	 * @param {string} connectionId
	 * @param {string} actionId
	 * @access public
	 */
	getActionDefinition(connectionId, actionId) {
		if (this.#actionDefinitions[connectionId]) {
			return this.#actionDefinitions[connectionId][actionId]
		} else {
			return undefined
		}
	}

	/**
	 * Get a feedback definition
	 * @param {string} connectionId
	 * @param {string} feedbackId
	 * @access public
	 */
	getFeedbackDefinition(connectionId, feedbackId) {
		if (this.#feedbackDefinitions[connectionId]) {
			return this.#feedbackDefinitions[connectionId][feedbackId]
		} else {
			return undefined
		}
	}

	/**
	 * Import a preset to a location
	 * @param {string} connectionId
	 * @param {string} presetId
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @returns {boolean}
	 * @access public
	 */
	importPresetToLocation(connectionId, presetId, location) {
		const definition = this.#presetDefinitions[connectionId]?.[presetId]
		if (!definition) return false

		/** @type {import('../Shared/Model/ButtonModel.js').NormalButtonModel} */
		const result = {
			type: 'button',
			options: {
				relativeDelay: definition.options?.relativeDelay ?? false,
				rotaryActions: definition.options?.rotaryActions ?? false,
				stepAutoProgress: definition.options?.stepAutoProgress ?? true,
			},
			style: {
				...cloneDeep(definition.style),
				textExpression: false,
				// TODO - avoid defaults..
				alignment: definition.style.alignment ?? 'center:center',
				pngalignment: definition.style.pngalignment ?? 'center:center',
				png64: definition.style.png64 ?? null,
				show_topbar: definition.style.show_topbar ?? 'default',
			},
			feedbacks: [],
			steps: {},
		}
		if (definition.steps) {
			for (let i = 0; i < definition.steps.length; i++) {
				/** @type {import('../Shared/Model/ButtonModel.js').NormalButtonSteps[0]} */
				const newStep = {
					action_sets: {},
					options: cloneDeep(definition.steps[i].options) ?? cloneDeep(ControlButtonNormal.DefaultStepOptions),
				}
				result.steps[i] = newStep

				for (const [set, actions_set] of Object.entries(definition.steps[i].action_sets)) {
					newStep.action_sets[set] = actions_set.map((/** @type {PresetActionInstance} */ action) => ({
						id: nanoid(),
						instance: connectionId,
						action: action.action,
						options: cloneDeep(action.options ?? {}),
						delay: action.delay ?? 0,
					}))
				}
			}
		}

		if (definition.feedbacks) {
			result.feedbacks = definition.feedbacks.map((feedback) => ({
				id: nanoid(),
				instance_id: connectionId,
				type: feedback.type,
				options: cloneDeep(feedback.options ?? {}),
				isInverted: feedback.isInverted,
				style: cloneDeep(feedback.style),
			}))
		}

		this.controls.importControl(location, result)

		return true
	}

	/**
	 * Set the action definitions for a connection
	 * @param {string} connectionId
	 * @param {Record<string, ActionDefinition>} actionDefinitions
	 * @access public
	 */
	setActionDefinitions(connectionId, actionDefinitions) {
		const lastActionDefinitions = this.#actionDefinitions[connectionId]
		this.#actionDefinitions[connectionId] = cloneDeep(actionDefinitions)

		if (this.io.countRoomMembers(ActionsRoom) > 0) {
			if (!lastActionDefinitions) {
				this.io.emitToRoom(ActionsRoom, 'action-definitions:update', connectionId, actionDefinitions)
			} else {
				const patch = jsonPatch.compare(lastActionDefinitions, actionDefinitions || {})
				if (patch.length > 0) {
					this.io.emitToRoom(ActionsRoom, 'action-definitions:update', connectionId, patch)
				}
			}
		}
	}

	/**
	 * Set the feedback definitions for a connection
	 * @param {string} connectionId - the connection ID
	 * @param {Record<string, FeedbackDefinition>} feedbackDefinitions - the feedback definitions
	 * @access public
	 */
	setFeedbackDefinitions(connectionId, feedbackDefinitions) {
		const lastFeedbackDefinitions = this.#feedbackDefinitions[connectionId]
		this.#feedbackDefinitions[connectionId] = cloneDeep(feedbackDefinitions)

		if (this.io.countRoomMembers(FeedbacksRoom) > 0) {
			if (!lastFeedbackDefinitions) {
				this.io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', connectionId, feedbackDefinitions)
			} else {
				const patch = jsonPatch.compare(lastFeedbackDefinitions, feedbackDefinitions || {})
				if (patch.length > 0) {
					this.io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', connectionId, patch)
				}
			}
		}
	}

	/**
	 * Set the preset definitions for a connection
	 * @access public
	 * @param {string} connectionId
	 * @param {string} label
	 * @param {Record<string, PresetDefinitionTmp>} rawPresets
	 */
	setPresetDefinitions(connectionId, label, rawPresets) {
		/** @type {Record<string, PresetDefinition>} */
		const newPresets = {}

		for (const [id, rawPreset] of Object.entries(rawPresets)) {
			try {
				newPresets[id] = {
					id: id,
					category: rawPreset.category,
					name: rawPreset.name,
					type: rawPreset.type,
					style: rawPreset.style,
					previewStyle: rawPreset.previewStyle,
					options: rawPreset.options,
					feedbacks: (rawPreset.feedbacks ?? []).map((fb) => ({
						type: fb.feedbackId,
						options: fb.options,
						style: fb.style,
						isInverted: !!fb.isInverted,
					})),
					steps: rawPreset.steps.map((step) => {
						const options = cloneDeep(ControlButtonNormal.DefaultStepOptions)
						/** @type {PresetActionSets} */
						const action_sets = {
							down: [],
							up: [],
						}

						for (const [setId, set] of Object.entries(step)) {
							/** @type {import('@companion-module/base').CompanionPresetAction[]} */
							const setActions = Array.isArray(set) ? set : set.actions
							if (!isNaN(Number(setId)) && set.options?.runWhileHeld) options.runWhileHeld.push(Number(setId))

							// @ts-ignore
							action_sets[setId] = setActions.map((act) => ({
								action: act.actionId,
								options: act.options,
								delay: act.delay,
							}))
						}

						return {
							options,
							action_sets,
						}
					}),
				}

				if (!newPresets[id].steps.length) {
					newPresets[id].steps.push({
						action_sets: {
							down: [],
							up: [],
						},
					})
				}
			} catch (e) {
				this.logger.warn(`${label} gave invalid preset "${id}": ${e}`)
			}
		}

		this.#updateVariablePrefixesAndStoreDefinitions(connectionId, label, newPresets)
	}

	/**
	 * The ui doesnt need many of the preset properties. Simplify an array of them in preparation for sending to the ui
	 * @param {Record<string, PresetDefinition>} presets
	 * @access private
	 */
	#simplifyPresetsForUi(presets) {
		/** @type {Record<string, UIPresetDefinition>} */
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
	 * @param {string} connectionId
	 * @param {string} labelTo
	 */
	updateVariablePrefixesForLabel(connectionId, labelTo) {
		if (this.#presetDefinitions[connectionId] !== undefined) {
			this.logger.silly('Updating presets for connection ' + labelTo)
			this.#updateVariablePrefixesAndStoreDefinitions(connectionId, labelTo, this.#presetDefinitions[connectionId])
		}
	}

	/**
	 * Update all the variables in the presets to reference the supplied label, and store them
	 * @param {string} connectionId
	 * @param {string} label
	 * @param {Record<string, PresetDefinition>} presets
	 */
	#updateVariablePrefixesAndStoreDefinitions(connectionId, label, presets) {
		const variableRegex = /\$\(([^:)]+):([^)]+)\)/g

		/**
		 * @param {string} fixtext
		 * @returns {string}
		 */
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
		 * Clean up variable references: $(label:variable)
		 * since the name of the connection is dynamic. We don't want to
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

		const lastPresetDefinitions = this.#presetDefinitions[connectionId]
		this.#presetDefinitions[connectionId] = cloneDeep(presets)

		if (this.io.countRoomMembers(PresetsRoom) > 0) {
			const newSimplifiedPresets = this.#simplifyPresetsForUi(presets)
			if (!lastPresetDefinitions) {
				this.io.emitToRoom(PresetsRoom, 'presets:update', connectionId, newSimplifiedPresets)
			} else {
				const lastSimplifiedPresets = this.#simplifyPresetsForUi(lastPresetDefinitions)
				const patch = jsonPatch.compare(lastSimplifiedPresets, newSimplifiedPresets)
				if (patch.length > 0) {
					this.io.emitToRoom(PresetsRoom, 'presets:update', connectionId, patch)
				}
			}
		}
	}
}

export default InstanceDefinitions

/**
 * @typedef {import('../Shared/Model/Options.js').ActionDefinition} ActionDefinition
 * @typedef {import('../Shared/Model/Options.js').FeedbackDefinition} FeedbackDefinition
 */

/**
 * @typedef {import('../Shared/Model/Presets.js').PresetFeedbackInstance} PresetFeedbackInstance
 * @typedef {import('../Shared/Model/Presets.js').PresetActionInstance} PresetActionInstance
 * @typedef {import('../Shared/Model/Presets.js').PresetActionSets} PresetActionSets
 * @typedef {import('../Shared/Model/Presets.js').PresetActionSteps} PresetActionSteps
 * @typedef {import('../Shared/Model/Presets.js').PresetDefinition} PresetDefinition
 */

/**
 * @typedef {{
 *   id: string
 * } & import('@companion-module/base').CompanionButtonPresetDefinition} PresetDefinitionTmp
 */

/**
 * @typedef {import('../Shared/Model/Presets.js').UIPresetDefinition} UIPresetDefinition
 */
