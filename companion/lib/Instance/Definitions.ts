import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import { EventDefinitions } from '../Resources/EventDefinitions.js'
import { ControlButtonNormal } from '../Controls/ControlTypes/Button/Normal.js'
import jsonPatch from 'fast-json-patch'
import { diffObjects } from '@companion-app/shared/Diff.js'
import { replaceAllVariables } from '../Variables/Util.js'
import type {
	PresetActionInstance,
	PresetActionSets,
	PresetDefinition,
	UIPresetDefinition,
} from '@companion-app/shared/Model/Presets.js'
import type { ActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import type { FeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { NormalButtonModel, NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { CompanionPresetAction, CompanionPresetDefinition } from '@companion-module/base'
import LogController from '../Log/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { VariablesValues } from '../Variables/Values.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import { validateActionSetId } from '@companion-app/shared/ControlId.js'

const PresetsRoom = 'presets'
const ActionsRoom = 'action-definitions'
const FeedbacksRoom = 'feedback-definitions'

/**
 * Class to handle and store the 'definitions' produced by instances.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
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
export class InstanceDefinitions {
	readonly #logger = LogController.createLogger('Instance/Definitions')

	readonly #io: UIHandler
	readonly #controlsController: ControlsController
	readonly #graphicsController: GraphicsController
	readonly #variablesValuesController: VariablesValues

	/**
	 * The action definitions
	 */
	#actionDefinitions: Record<string, Record<string, ActionDefinition>> = {}
	/**
	 * The feedback definitions
	 */
	#feedbackDefinitions: Record<string, Record<string, FeedbackDefinition>> = {}
	/**
	 * The preset definitions
	 */
	#presetDefinitions: Record<string, Record<string, PresetDefinition>> = {}

	constructor(
		io: UIHandler,
		controls: ControlsController,
		graphics: GraphicsController,
		variablesValues: VariablesValues
	) {
		this.#io = io
		this.#controlsController = controls
		this.#graphicsController = graphics
		this.#variablesValuesController = variablesValues
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket) {
		client.onPromise('presets:subscribe', () => {
			client.join(PresetsRoom)

			const result: Record<string, Record<string, UIPresetDefinition>> = {}
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

		client.onPromise('presets:preview_render', async (connectionId, presetId) => {
			const definition = this.#presetDefinitions[connectionId]?.[presetId]
			if (definition && definition.type === 'button') {
				const style = {
					...(definition.previewStyle ? definition.previewStyle : definition.style),
					style: definition.type,
				}

				if (style.text) {
					if (style.textExpression) {
						const parseResult = this.#variablesValuesController.executeExpression(style.text, null)
						if (parseResult.ok) {
							style.text = parseResult.value + ''
						} else {
							this.#logger.error(`Expression parse error: ${parseResult.error}`)
							style.text = 'ERR'
						}
					} else {
						const parseResult = this.#variablesValuesController.parseVariables(style.text, null)
						style.text = parseResult.text
					}
				}

				const render = await this.#graphicsController.drawPreview(style)
				if (render) {
					return render.asDataUrl
				} else {
					return null
				}
			} else {
				return null
			}
		})
	}

	/**
	 * Create a action item without saving
	 * @param connectionId - the id of the instance
	 * @param actionId - the id of the action
	 */
	createActionItem(connectionId: string, actionId: string): ActionInstance | null {
		const definition = this.getActionDefinition(connectionId, actionId)
		if (definition) {
			const action: ActionInstance = {
				id: nanoid(),
				action: actionId,
				instance: connectionId,
				options: {},
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
	 * @param connectionId - the id of the connection
	 * @param feedbackId - the id of the feedback
	 * @param booleanOnly - whether the feedback must be boolean
	 */
	createFeedbackItem(connectionId: string, feedbackId: string, booleanOnly: boolean): FeedbackInstance | null {
		const definition = this.getFeedbackDefinition(connectionId, feedbackId)
		if (definition) {
			if (booleanOnly && definition.type !== 'boolean') return null

			const feedback: FeedbackInstance = {
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

	createEventItem(eventType: string): EventInstance | null {
		const definition = EventDefinitions[eventType]
		if (definition) {
			const event: EventInstance = {
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
	 */
	forgetConnection(connectionId: string): void {
		delete this.#presetDefinitions[connectionId]
		if (this.#io.countRoomMembers(PresetsRoom) > 0) {
			this.#io.emitToRoom(PresetsRoom, 'presets:update', connectionId, null)
		}

		delete this.#actionDefinitions[connectionId]
		if (this.#io.countRoomMembers(ActionsRoom) > 0) {
			this.#io.emitToRoom(ActionsRoom, 'action-definitions:update', {
				type: 'forget-connection',
				connectionId,
			})
		}

		delete this.#feedbackDefinitions[connectionId]
		if (this.#io.countRoomMembers(FeedbacksRoom) > 0) {
			this.#io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', {
				type: 'forget-connection',
				connectionId,
			})
		}
	}

	/**
	 * Get an action definition
	 */
	getActionDefinition(connectionId: string, actionId: string): ActionDefinition | undefined {
		if (this.#actionDefinitions[connectionId]) {
			return this.#actionDefinitions[connectionId][actionId]
		} else {
			return undefined
		}
	}

	/**
	 * Get a feedback definition
	 */
	getFeedbackDefinition(connectionId: string, feedbackId: string): FeedbackDefinition | undefined {
		if (this.#feedbackDefinitions[connectionId]) {
			return this.#feedbackDefinitions[connectionId][feedbackId]
		} else {
			return undefined
		}
	}

	/**
	 * Import a preset to a location
	 */
	importPresetToLocation(connectionId: string, presetId: string, location: ControlLocation): boolean {
		const definition = this.#presetDefinitions[connectionId]?.[presetId]
		if (!definition || definition.type !== 'button') return false

		const result: NormalButtonModel = {
			type: 'button',
			options: {
				rotaryActions: definition.options?.rotaryActions ?? false,
				stepAutoProgress: definition.options?.stepAutoProgress ?? true,
			},
			style: {
				textExpression: false,
				...cloneDeep(definition.style),
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
				const newStep: NormalButtonSteps[0] = {
					action_sets: {
						down: [],
						up: [],
						rotate_left: undefined,
						rotate_right: undefined,
					},
					options: cloneDeep(definition.steps[i].options) ?? cloneDeep(ControlButtonNormal.DefaultStepOptions),
				}
				result.steps[i] = newStep

				for (const [set, actions_set] of Object.entries(definition.steps[i].action_sets)) {
					const setIdSafe = validateActionSetId(set as any)
					if (setIdSafe === undefined) {
						this.#logger.warn(`Invalid set id: ${set}`)
						continue
					}

					newStep.action_sets[setIdSafe] = convertActionsDelay(
						actions_set,
						connectionId,
						definition.options?.relativeDelay
					)
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
				headline: feedback.headline,
			}))
		}

		this.#controlsController.importControl(location, result)

		return true
	}

	/**
	 * Set the action definitions for a connection
	 */
	setActionDefinitions(connectionId: string, actionDefinitions: Record<string, ActionDefinition>): void {
		const lastActionDefinitions = this.#actionDefinitions[connectionId]
		this.#actionDefinitions[connectionId] = cloneDeep(actionDefinitions)

		if (this.#io.countRoomMembers(ActionsRoom) > 0) {
			if (!lastActionDefinitions) {
				this.#io.emitToRoom(ActionsRoom, 'action-definitions:update', {
					type: 'add-connection',
					connectionId,

					actions: actionDefinitions,
				})
			} else {
				const diff = diffObjects(lastActionDefinitions, actionDefinitions || {})
				if (diff) {
					this.#io.emitToRoom(ActionsRoom, 'action-definitions:update', {
						type: 'update-connection',
						connectionId,

						...diff,
					})
				}
			}
		}
	}

	/**
	 * Set the feedback definitions for a connection
	 */
	setFeedbackDefinitions(connectionId: string, feedbackDefinitions: Record<string, FeedbackDefinition>): void {
		const lastFeedbackDefinitions = this.#feedbackDefinitions[connectionId]
		this.#feedbackDefinitions[connectionId] = cloneDeep(feedbackDefinitions)

		if (this.#io.countRoomMembers(FeedbacksRoom) > 0) {
			if (!lastFeedbackDefinitions) {
				this.#io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', {
					type: 'add-connection',
					connectionId,

					feedbacks: feedbackDefinitions,
				})
			} else {
				const diff = diffObjects(lastFeedbackDefinitions, feedbackDefinitions || {})
				if (diff) {
					this.#io.emitToRoom(FeedbacksRoom, 'feedback-definitions:update', {
						type: 'update-connection',
						connectionId,

						...diff,
					})
				}
			}
		}
	}

	/**
	 * Set the preset definitions for a connection
	 */
	setPresetDefinitions(connectionId: string, label: string, rawPresets: Record<string, PresetDefinitionTmp>): void {
		const newPresets: Record<string, PresetDefinition> = {}

		for (const [id, rawPreset] of Object.entries(rawPresets)) {
			try {
				if (rawPreset.type === 'button') {
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
							headline: fb.headline,
						})),
						steps:
							rawPreset.steps.length === 0
								? [{ action_sets: { down: [], up: [] } }]
								: rawPreset.steps.map((step) => {
										const options = cloneDeep(ControlButtonNormal.DefaultStepOptions)
										const action_sets: PresetActionSets = {
											down: [],
											up: [],
										}

										for (const [setId, set] of Object.entries(step)) {
											if (setId === 'name') continue

											const setActions: CompanionPresetAction[] = Array.isArray(set) ? set : set.actions
											if (!isNaN(Number(setId)) && set.options?.runWhileHeld) options.runWhileHeld.push(Number(setId))

											action_sets[setId as any] = setActions.map((act) => ({
												action: act.actionId,
												options: act.options,
												delay: act.delay ?? 0,
												headline: act.headline,
											}))
										}

										if (step.name) options.name = step.name

										return {
											options,
											action_sets,
										}
									}),
					}
				} else if (rawPreset.type === 'text') {
					newPresets[id] = {
						id: id,
						category: rawPreset.category,
						name: rawPreset.name,
						type: rawPreset.type,
						text: rawPreset.text,
					}
				}
			} catch (e) {
				this.#logger.warn(`${label} gave invalid preset "${id}": ${e}`)
			}
		}

		this.#updateVariablePrefixesAndStoreDefinitions(connectionId, label, newPresets)
	}

	/**
	 * The ui doesnt need many of the preset properties. Simplify an array of them in preparation for sending to the ui
	 */
	#simplifyPresetsForUi(presets: Record<string, PresetDefinition>): Record<string, UIPresetDefinition> {
		const res: Record<string, UIPresetDefinition> = {}

		Object.entries(presets).forEach(([id, preset], index) => {
			if (preset.type === 'button') {
				res[id] = {
					id: preset.id,
					order: index,
					label: preset.name,
					category: preset.category,
					type: 'button',
				}
			} else if (preset.type === 'text') {
				res[id] = {
					id: preset.id,
					order: index,
					label: preset.name,
					category: preset.category,
					type: 'text',
					text: preset.text,
				}
			}
		})

		return res
	}

	/**
	 * Update all the variables in the presets to reference the supplied label
	 * @param connectionId
	 * @param labelTo
	 */
	updateVariablePrefixesForLabel(connectionId: string, labelTo: string): void {
		if (this.#presetDefinitions[connectionId] !== undefined) {
			this.#logger.silly('Updating presets for connection ' + labelTo)
			this.#updateVariablePrefixesAndStoreDefinitions(connectionId, labelTo, this.#presetDefinitions[connectionId])
		}
	}

	/**
	 * Update all the variables in the presets to reference the supplied label, and store them
	 */
	#updateVariablePrefixesAndStoreDefinitions(
		connectionId: string,
		label: string,
		presets: Record<string, PresetDefinition>
	): void {
		/*
		 * Clean up variable references: $(label:variable)
		 * since the name of the connection is dynamic. We don't want to
		 * demand that your presets MUST be dynamically generated.
		 */
		for (const preset of Object.values(presets)) {
			if (preset.type !== 'text') {
				if (preset.style) {
					preset.style.text = replaceAllVariables(preset.style.text, label)
				}

				if (preset.feedbacks) {
					for (const feedback of preset.feedbacks) {
						if (feedback.style && feedback.style.text) {
							feedback.style.text = replaceAllVariables(feedback.style.text, label)
						}
					}
				}
			}
		}

		const lastPresetDefinitions = this.#presetDefinitions[connectionId]
		this.#presetDefinitions[connectionId] = cloneDeep(presets)

		if (this.#io.countRoomMembers(PresetsRoom) > 0) {
			const newSimplifiedPresets = this.#simplifyPresetsForUi(presets)
			if (!lastPresetDefinitions) {
				this.#io.emitToRoom(PresetsRoom, 'presets:update', connectionId, newSimplifiedPresets)
			} else {
				const lastSimplifiedPresets = this.#simplifyPresetsForUi(lastPresetDefinitions)
				const patch = jsonPatch.compare(lastSimplifiedPresets, newSimplifiedPresets)
				if (patch.length > 0) {
					this.#io.emitToRoom(PresetsRoom, 'presets:update', connectionId, patch)
				}
			}
		}
	}
}

export type PresetDefinitionTmp = CompanionPresetDefinition & {
	id: string
}

function toActionInstance(action: PresetActionInstance, connectionId: string): ActionInstance {
	return {
		id: nanoid(),
		instance: connectionId,
		action: action.action,
		options: cloneDeep(action.options ?? {}),
		headline: action.headline,
	}
}

function convertActionsDelay(
	actions: PresetActionInstance[],
	connectionId: string,
	relativeDelays: boolean | undefined
) {
	if (relativeDelays) {
		const newActions: ActionInstance[] = []

		for (const action of actions) {
			const delay = Number(action.delay)

			// Add the wait action
			if (!isNaN(delay) && delay > 0) {
				newActions.push({
					id: nanoid(),
					instance: 'internal',
					action: 'wait',
					options: {
						time: delay,
					},
				})
			}

			newActions.push(toActionInstance(action, connectionId))
		}

		return newActions
	} else {
		let currentDelay = 0
		let currentDelayGroupChildren: any[] = []

		let delayGroups: any[] = [wrapActionsInGroup(currentDelayGroupChildren)]

		for (const action of actions) {
			const delay = Number(action.delay)

			if (!isNaN(delay) && delay >= 0 && delay !== currentDelay) {
				// action has different delay to the last one
				if (delay > currentDelay) {
					// delay is greater than the last one, translate it to a relative delay
					currentDelayGroupChildren.push(createWaitAction(delay - currentDelay))
				} else {
					// delay is less than the last one, preserve the weird order
					currentDelayGroupChildren = []
					if (delay > 0) currentDelayGroupChildren.push(createWaitAction(delay))
					delayGroups.push(wrapActionsInGroup(currentDelayGroupChildren))
				}

				currentDelay = delay
			}

			currentDelayGroupChildren.push(toActionInstance(action, connectionId))
		}

		if (delayGroups.length > 1) {
			// Weird delay ordering was found, preserve it
			return delayGroups
		} else {
			// Order was incrementing, don't add the extra group layer
			return currentDelayGroupChildren
		}
	}
}

function wrapActionsInGroup(actions: any[]): any {
	return {
		id: nanoid(),
		instance: 'internal',
		action: 'action_group',
		options: {
			execution_mode: 'concurrent',
		},
		children: {
			default: actions,
		},
	}
}
function createWaitAction(delay: number): any {
	return {
		id: nanoid(),
		instance: 'internal',
		action: 'wait',
		options: {
			time: delay,
		},
	}
}
