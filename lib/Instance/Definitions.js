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

		client.onPromise('presets:import_to_bank', this.importPresetToBank.bind(this))

		client.onPromise(
			'presets:preview_render',
			async (/** @type {string } */ instanceId, /** @type {string } */ presetId) => {
				const definition = this.#presetDefinitions[instanceId]?.[presetId]
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
	 * @returns {import('../Data/Model/EventModel.js').EventInstance | null}
	 */
	createEventItem(eventType) {
		const definition = EventDefinitions[eventType]
		if (definition) {
			/** @type {import('../Data/Model/EventModel.js').EventInstance} */
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
	 * @param {string} instance_id
	 * @access public
	 */
	forgetInstance(instance_id) {
		delete this.#presetDefinitions[instance_id]
		if (this.io.countRoomMembers(PresetsRoom) > 0) {
			this.io.emitToRoom(PresetsRoom, 'presets:update', instance_id, undefined)
		}

		delete this.#actionDefinitions[instance_id]
		if (this.io.countRoomMembers(ActionsRoom) > 0) {
			this.io.emitToRoom(ActionsRoom, 'action-definitions:update', instance_id, undefined)
		}

		delete this.#feedbackDefinitions[instance_id]
		if (this.io.countRoomMembers(FeedbacksRoom) > 0) {
			this.io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', instance_id, undefined)
		}
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
	 * @param {string} connectionId
	 * @param {string} presetId
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @returns {boolean}
	 * @access public
	 */
	importPresetToBank(connectionId, presetId, location) {
		const definition = this.#presetDefinitions[connectionId]?.[presetId]
		if (!definition) return false

		/** @type {import('../Data/Model/ButtonModel.js').NormalButtonModel} */
		const result = {
			type: 'button',
			options: {
				relativeDelay: definition.options?.relativeDelay ?? false,
				rotaryActions: definition.options?.rotaryActions ?? false,
				stepAutoProgress: definition.options?.stepAutoProgress ?? false,
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
				/** @type {import('../Data/Model/ButtonModel.js').NormalButtonSteps[0]} */
				const newStep = {
					action_sets: {},
					options: cloneDeep(definition.steps[i].options) ?? cloneDeep(ControlButtonNormal.DefaultStepOptions),
				}
				result.steps[i] = newStep

				for (const [set, actions_set] of Object.entries(definition.steps[i].action_sets)) {
					newStep.action_sets[set] = actions_set.map((action) => ({
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
	 * Set the action definitions for an instance
	 * @param {string} instanceId
	 * @param {Record<string, ActionDefinition>} actionDefinitions
	 * @access public
	 */
	setActionDefinitions(instanceId, actionDefinitions) {
		const lastActionDefinitions = this.#actionDefinitions[instanceId]
		this.#actionDefinitions[instanceId] = cloneDeep(actionDefinitions)

		if (this.io.countRoomMembers(ActionsRoom) > 0) {
			if (!lastActionDefinitions) {
				this.io.emitToRoom(ActionsRoom, 'action-definitions:update', instanceId, actionDefinitions)
			} else {
				const patch = jsonPatch.compare(lastActionDefinitions, actionDefinitions || {})
				if (patch.length > 0) {
					this.io.emitToRoom(ActionsRoom, 'action-definitions:update', instanceId, patch)
				}
			}
		}
	}

	/**
	 * Set the feedback definitions for an instance
	 * @param {string} instanceId - the instance ID
	 * @param {Record<string, FeedbackDefinition>} feedbackDefinitions - the feedback definitions
	 * @access public
	 */
	setFeedbackDefinitions(instanceId, feedbackDefinitions) {
		const lastFeedbackDefinitions = this.#feedbackDefinitions[instanceId]
		this.#feedbackDefinitions[instanceId] = cloneDeep(feedbackDefinitions)

		if (this.io.countRoomMembers(FeedbacksRoom) > 0) {
			if (!lastFeedbackDefinitions) {
				this.io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', instanceId, feedbackDefinitions)
			} else {
				const patch = jsonPatch.compare(lastFeedbackDefinitions, feedbackDefinitions || {})
				if (patch.length > 0) {
					this.io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', instanceId, patch)
				}
			}
		}
	}

	/**
	 * Set the preset definitions for an instance
	 * @access public
	 * @param {string} instance_id
	 * @param {string} label
	 * @param {Record<string, PresetDefinitionTmp>} rawPresets
	 */
	setPresetDefinitions(instance_id, label, rawPresets) {
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

		this.#updateVariablePrefixesAndStoreDefinitions(instance_id, label, newPresets)
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
	 * @param {string} instanceId
	 * @param {string} label
	 * @param {Record<string, PresetDefinition>} presets
	 */
	#updateVariablePrefixesAndStoreDefinitions(instanceId, label, presets) {
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

		const lastPresetDefinitions = this.#presetDefinitions[instanceId]
		this.#presetDefinitions[instanceId] = cloneDeep(presets)

		if (this.io.countRoomMembers(PresetsRoom) > 0) {
			const newSimplifiedPresets = this.#simplifyPresetsForUi(presets)
			if (!lastPresetDefinitions) {
				this.io.emitToRoom(PresetsRoom, 'presets:update', instanceId, newSimplifiedPresets)
			} else {
				const lastSimplifiedPresets = this.#simplifyPresetsForUi(lastPresetDefinitions)
				const patch = jsonPatch.compare(lastSimplifiedPresets, newSimplifiedPresets)
				if (patch.length > 0) {
					this.io.emitToRoom(PresetsRoom, 'presets:update', instanceId, patch)
				}
			}
		}
	}
}

export default InstanceDefinitions

/**
 * @typedef {{
 *   label: string
 *   description: string | undefined
 *   options: import('@companion-module/base/dist/host-api/api.js').EncodeIsVisible<import('@companion-module/base').SomeCompanionActionInputField>[]
 *   hasLearn: boolean
 * }} ActionDefinition
 */

/**
 * @typedef {{
 *   label: string
 *   description: string | undefined
 *   options: import('@companion-module/base/dist/host-api/api.js').EncodeIsVisible<import('@companion-module/base').SomeCompanionActionInputField>[]
 *   type: 'advanced' | 'boolean'
 *   style: Partial<import('@companion-module/base').CompanionButtonStyleProps> | undefined
 *   hasLearn: boolean
 *   showInvert: boolean
 * }} FeedbackDefinition
 */

/**
 * @typedef {{
 *   type: string
 *   options: import('@companion-module/base').CompanionOptionValues
 *   style: Partial<import('@companion-module/base').CompanionButtonStyleProps> | undefined
 *   isInverted?: boolean
 * }} PresetFeedbackInstance
 *
 * @typedef {{
 *   action: string
 *   options: import('@companion-module/base').CompanionOptionValues
 *   delay: number
 * }} PresetActionInstance
 *
 * @typedef {{
 *    down: PresetActionInstance[]
 *    up: PresetActionInstance[]
 *    [delay: number]: PresetActionInstance[]
 *  }} PresetActionSets
 *
 * @typedef {{
 *   options?: import('../Data/Model/ActionModel.js').ActionStepOptions
 *   action_sets: PresetActionSets
 * }} PresetActionSteps
 *
 * @typedef {{
 *   id: string
 *   name: string
 *   category: string
 *   type: 'button'
 *   style: import('@companion-module/base').CompanionButtonStyleProps
 *   previewStyle: import('@companion-module/base').CompanionButtonStyleProps | undefined
 *   options: import('@companion-module/base').CompanionButtonPresetOptions | undefined
 *   feedbacks: PresetFeedbackInstance[]
 *   steps: PresetActionSteps[]
 * }} PresetDefinition
 */

/**
 * @typedef {{
 *   id: string
 * } & import('@companion-module/base').CompanionButtonPresetDefinition} PresetDefinitionTmp
 */

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   category: string
 * }} UIPresetDefinition
 */
