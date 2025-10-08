import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import { EventDefinitions } from '../Resources/EventDefinitions.js'
import { ControlEntityListPoolButton } from '../Controls/Entities/EntityListPoolButton.js'
import { diffObjects } from '@companion-app/shared/Diff.js'
import { replaceAllVariables } from '../Variables/Util.js'
import type {
	PresetDefinition,
	PresetDefinitionButton,
	UIPresetDefinition,
	UIPresetDefinitionUpdate,
} from '@companion-app/shared/Model/Presets.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type {
	NormalButtonModel,
	NormalButtonSteps,
	PresetButtonModel,
} from '@companion-app/shared/Model/ButtonModel.js'
import type {
	CompanionButtonPresetDefinition,
	CompanionButtonStyleProps,
	CompanionPresetAction,
	CompanionPresetFeedback,
	CompanionTextPresetDefinition,
} from '@companion-module/base'
import LogController from '../Log/Controller.js'
import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import {
	ActionEntityModel,
	EntityModelBase,
	EntityModelType,
	FeedbackEntitySubType,
	SomeEntityModel,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type {
	ClientEntityDefinition,
	EntityDefinitionUpdate,
} from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { EventEmitter } from 'node:events'
import { ConnectionConfigStore } from './ConnectionConfigStore.js'
import { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'

type InstanceDefinitionsEvents = {
	readonly updatePresets: [connectionId: string]
}

type DefinitionsEvents = {
	presets: [update: UIPresetDefinitionUpdate]
	actions: [update: EntityDefinitionUpdate]
	feedbacks: [update: EntityDefinitionUpdate]
}

type RawPresetDefinition = (CompanionButtonPresetDefinition | CompanionTextPresetDefinition) & {
	id: string
}

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
 */
export class InstanceDefinitions extends EventEmitter<InstanceDefinitionsEvents> {
	readonly #logger = LogController.createLogger('Instance/Definitions')

	readonly #configStore: ConnectionConfigStore

	/**
	 * The action definitions
	 */
	#actionDefinitions: Record<string, Record<string, ClientEntityDefinition>> = {}
	/**
	 * The feedback definitions
	 */
	#feedbackDefinitions: Record<string, Record<string, ClientEntityDefinition>> = {}
	/**
	 * The preset definitions
	 */
	#presetDefinitions: Record<string, Record<string, PresetDefinition>> = {}

	#events = new EventEmitter<DefinitionsEvents>()

	constructor(configStore: ConnectionConfigStore) {
		super()

		this.setMaxListeners(0)
		this.#events.setMaxListeners(0)

		this.#configStore = configStore
	}

	createTrpcRouter() {
		const self = this
		return router({
			events: publicProcedure.query(() => {
				return EventDefinitions
			}),

			presets: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'presets', signal)

				const result: Record<string, Record<string, UIPresetDefinition>> = {}
				for (const [id, presets] of Object.entries(self.#presetDefinitions)) {
					if (Object.keys(presets).length > 0) {
						result[id] = self.#simplifyPresetsForUi(presets)
					}
				}

				yield { type: 'init', definitions: result } satisfies UIPresetDefinitionUpdate

				for await (const [update] of changes) {
					yield update
				}
			}),

			actions: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'actions', signal)

				yield { type: 'init', definitions: self.#actionDefinitions } satisfies EntityDefinitionUpdate

				for await (const [update] of changes) {
					yield update
				}
			}),

			feedbacks: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'feedbacks', signal)

				yield { type: 'init', definitions: self.#feedbackDefinitions } satisfies EntityDefinitionUpdate

				for await (const [update] of changes) {
					yield update
				}
			}),
		})
	}

	/**
	 * Create a entity item without saving
	 * @param connectionId - the id of the instance
	 * @param entityType - the type of the entity
	 * @param definitionId - the id of the definition
	 */
	createEntityItem(connectionId: string, entityType: EntityModelType, definitionId: string): SomeEntityModel | null {
		const definition = this.getEntityDefinition(entityType, connectionId, definitionId)
		if (!definition) return null

		const connectionConfig = this.#configStore.getConfigForId(connectionId)

		const entity: Omit<EntityModelBase, 'type'> = {
			id: nanoid(),
			definitionId: definitionId,
			connectionId: connectionId,
			options: {},
			upgradeIndex: connectionConfig?.lastUpgradeIndex,
		}

		if (definition.options !== undefined && definition.options.length > 0) {
			for (const opt of definition.options) {
				entity.options[opt.id] = cloneDeep((opt as any).default)
			}
		}

		switch (entityType) {
			case EntityModelType.Action:
				return {
					...entity,
					type: EntityModelType.Action,
				} satisfies ActionEntityModel

			case EntityModelType.Feedback: {
				const feedback: FeedbackEntityModel = {
					...entity,
					type: EntityModelType.Feedback,
					style: {},
					isInverted: false,
				}

				if (/*!booleanOnly &&*/ definition.feedbackType === FeedbackEntitySubType.Boolean && definition.feedbackStyle) {
					feedback.style = cloneDeep(definition.feedbackStyle)
				}

				return feedback
			}

			default:
				assertNever(entityType)
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
				// @ts-expect-error mismatch in key type
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
		if (this.#events.listenerCount('presets') > 0) {
			this.#events.emit('presets', {
				type: 'remove',
				connectionId,
			})
		}

		this.emit('updatePresets', connectionId)

		delete this.#actionDefinitions[connectionId]
		if (this.#events.listenerCount('actions') > 0) {
			this.#events.emit('actions', {
				type: 'forget-connection',
				connectionId,
			})
		}

		delete this.#feedbackDefinitions[connectionId]
		if (this.#events.listenerCount('feedbacks') > 0) {
			this.#events.emit('feedbacks', {
				type: 'forget-connection',
				connectionId,
			})
		}
	}

	/**
	 * Get an entity definition
	 */
	getEntityDefinition(
		entityType: EntityModelType,
		connectionId: string,
		definitionId: string
	): ClientEntityDefinition | undefined {
		switch (entityType) {
			case EntityModelType.Action:
				return this.#actionDefinitions[connectionId]?.[definitionId]
			case EntityModelType.Feedback:
				return this.#feedbackDefinitions[connectionId]?.[definitionId]
			default:
				assertNever(entityType)
				return undefined
		}
	}

	convertPresetToPreviewControlModel(connectionId: string, presetId: string): PresetButtonModel | null {
		const definition = this.#presetDefinitions[connectionId]?.[presetId]
		if (!definition || definition.type !== 'button') return null

		const result: PresetButtonModel = {
			...definition.model,
			type: 'preset:button',
			style: definition.previewStyle
				? convertPresetStyleToDrawStyle(Object.assign({}, definition.model.style, definition.previewStyle))
				: definition.model.style,
			steps: {},
		}

		// make sure that feedbacks don't override previewStyle:
		if ('previewStyle' in definition && definition.previewStyle !== undefined) {
			const newExpressionFeedback: FeedbackEntityModel = {
				type: EntityModelType.Feedback,
				id: nanoid(),
				connectionId: 'internal',
				definitionId: 'check_expression',
				options: {
					expression: 'true',
				},
				isInverted: false,
				style: definition.previewStyle,
				upgradeIndex: undefined,
			}

			// copy all objects so they don't alter the regular button def. (Shallow should be enough.)
			result.feedbacks = [...result.feedbacks, newExpressionFeedback]
		}

		// Omit actions, as they can't be executed in the preview. By doing this we avoid bothering the module with lifecycle methods for them
		for (const [stepId, step] of Object.entries(definition.model.steps)) {
			result.steps[stepId] = {
				options: step.options,
				action_sets: {
					down: [],
					up: [],
					rotate_left: undefined,
					rotate_right: undefined,
				},
			}
		}

		return result
	}

	/**
	 * Import a preset to a location
	 */
	convertPresetToControlModel(connectionId: string, presetId: string): NormalButtonModel | null {
		const definition = this.#presetDefinitions[connectionId]?.[presetId]
		if (!definition || definition.type !== 'button') return null

		return definition.model
	}

	/**
	 * Set the action definitions for a connection
	 */
	setActionDefinitions(connectionId: string, actionDefinitions: Record<string, ClientEntityDefinition>): void {
		const lastActionDefinitions = this.#actionDefinitions[connectionId]
		this.#actionDefinitions[connectionId] = cloneDeep(actionDefinitions)

		if (this.#events.listenerCount('actions') > 0) {
			if (!lastActionDefinitions) {
				this.#events.emit('actions', {
					type: 'add-connection',
					connectionId,

					entities: actionDefinitions,
				})
			} else {
				const diff = diffObjects(lastActionDefinitions, actionDefinitions || {})
				if (diff) {
					this.#events.emit('actions', {
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
	setFeedbackDefinitions(connectionId: string, feedbackDefinitions: Record<string, ClientEntityDefinition>): void {
		const lastFeedbackDefinitions = this.#feedbackDefinitions[connectionId]
		this.#feedbackDefinitions[connectionId] = cloneDeep(feedbackDefinitions)

		if (this.#events.listenerCount('feedbacks') > 0) {
			if (!lastFeedbackDefinitions) {
				this.#events.emit('feedbacks', {
					type: 'add-connection',
					connectionId,

					entities: feedbackDefinitions,
				})
			} else {
				const diff = diffObjects(lastFeedbackDefinitions, feedbackDefinitions || {})
				if (diff) {
					this.#events.emit('feedbacks', {
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
	setPresetDefinitions(connectionId: string, label: string, rawPresets: RawPresetDefinition[]): void {
		const newPresets: Record<string, PresetDefinition> = {}

		const connectionUpgradeIndex = this.#configStore.getConfigForId(connectionId)?.lastUpgradeIndex

		for (const rawPreset of rawPresets) {
			try {
				if (rawPreset.type === 'button') {
					const presetDefinition: PresetDefinitionButton = {
						id: rawPreset.id,
						category: rawPreset.category,
						name: rawPreset.name,
						type: rawPreset.type,
						previewStyle: rawPreset.previewStyle,
						model: {
							type: 'button',
							options: {
								rotaryActions: rawPreset.options?.rotaryActions ?? false,
								stepProgression: (rawPreset.options?.stepAutoProgress ?? true) ? 'auto' : 'manual',
							},
							style: convertPresetStyleToDrawStyle(rawPreset.style),
							feedbacks: convertPresetFeedbacksToEntities(rawPreset.feedbacks, connectionId, connectionUpgradeIndex),
							steps: {},
							localVariables: [],
						},
					}

					if (rawPreset.steps) {
						for (let i = 0; i < rawPreset.steps.length; i++) {
							const newStep: NormalButtonSteps[0] = {
								action_sets: {
									down: [],
									up: [],
									rotate_left: undefined,
									rotate_right: undefined,
								},
								options: cloneDeep(ControlEntityListPoolButton.DefaultStepOptions),
							}
							presetDefinition.model.steps[i] = newStep

							const rawStep = rawPreset.steps[i]
							if (!rawStep) continue

							if (rawStep.name) newStep.options.name = rawStep.name

							for (const [setId, set] of Object.entries(rawStep)) {
								if (setId === 'name') continue

								const setIdSafe = validateActionSetId(setId as any)
								if (setIdSafe === undefined) {
									this.#logger.warn(`Invalid set id: ${setId}`)
									continue
								}

								const setActions: CompanionPresetAction[] = Array.isArray(set) ? set : set.actions
								if (!isNaN(Number(setId)) && set.options?.runWhileHeld) newStep.options.runWhileHeld.push(Number(setId))

								if (setActions) {
									newStep.action_sets[setIdSafe] = convertActionsDelay(
										setActions,
										connectionId,
										rawPreset.options?.relativeDelay,
										connectionUpgradeIndex
									)
								}
							}
						}
					}

					// Ensure that there is at least one step
					if (Object.keys(presetDefinition.model.steps).length === 0) {
						presetDefinition.model.steps[0] = {
							action_sets: { down: [], up: [], rotate_left: undefined, rotate_right: undefined },
							options: cloneDeep(ControlEntityListPoolButton.DefaultStepOptions),
						}
					}

					newPresets[rawPreset.id] = presetDefinition
				} else if (rawPreset.type === 'text') {
					newPresets[rawPreset.id] = {
						id: rawPreset.id,
						category: rawPreset.category,
						name: rawPreset.name,
						type: rawPreset.type,
						text: rawPreset.text,
					}
				}
			} catch (e) {
				this.#logger.warn(`${label} gave invalid preset "${rawPreset?.id}": ${e}`)
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
				if (preset.model.style) {
					preset.model.style.text = replaceAllVariables(preset.model.style.text, label)
				}

				if (preset.model.feedbacks) {
					for (const feedback of preset.model.feedbacks) {
						if (feedback.type === EntityModelType.Feedback && feedback.style && feedback.style.text) {
							feedback.style.text = replaceAllVariables(feedback.style.text, label)
						}
					}
				}
			}
		}

		const lastPresetDefinitions = this.#presetDefinitions[connectionId]
		this.#presetDefinitions[connectionId] = cloneDeep(presets)

		this.emit('updatePresets', connectionId)

		if (this.#events.listenerCount('presets') > 0) {
			const newSimplifiedPresets = this.#simplifyPresetsForUi(presets)
			if (!lastPresetDefinitions) {
				this.#events.emit('presets', {
					type: 'add',
					connectionId,
					definitions: newSimplifiedPresets,
				})
			} else {
				const lastSimplifiedPresets = this.#simplifyPresetsForUi(lastPresetDefinitions)
				const diff = diffObjects(lastSimplifiedPresets, newSimplifiedPresets)
				if (diff) {
					this.#events.emit('presets', { type: 'patch', connectionId, ...diff })
				}
			}
		}
	}
}

function toActionInstance(
	action: CompanionPresetAction,
	connectionId: string,
	connectionUpgradeIndex: number | undefined
): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: connectionId,
		definitionId: action.actionId,
		options: cloneDeep(action.options ?? {}),
		headline: action.headline,
		upgradeIndex: connectionUpgradeIndex,
	}
}

function convertActionsDelay(
	actions: CompanionPresetAction[],
	connectionId: string,
	relativeDelays: boolean | undefined,
	connectionUpgradeIndex: number | undefined
): ActionEntityModel[] {
	if (relativeDelays) {
		const newActions: ActionEntityModel[] = []

		for (const action of actions) {
			const delay = Number(action.delay)

			// Add the wait action
			if (!isNaN(delay) && delay > 0) {
				newActions.push(createWaitAction(delay))
			}

			newActions.push(toActionInstance(action, connectionId, connectionUpgradeIndex))
		}

		return newActions
	} else {
		let currentDelay = 0
		let currentDelayGroupChildren: ActionEntityModel[] = []

		const delayGroups: ActionEntityModel[] = [wrapActionsInGroup(currentDelayGroupChildren)]

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

			currentDelayGroupChildren.push(toActionInstance(action, connectionId, connectionUpgradeIndex))
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

function wrapActionsInGroup(actions: ActionEntityModel[]): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: 'internal',
		definitionId: 'action_group',
		options: {
			execution_mode: 'concurrent',
		},
		children: {
			default: actions,
		},
		upgradeIndex: undefined,
	}
}
function createWaitAction(delay: number): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: 'internal',
		definitionId: 'wait',
		options: {
			time: delay,
		},
		upgradeIndex: undefined,
	}
}

function convertPresetFeedbacksToEntities(
	rawFeedbacks: CompanionPresetFeedback[] | undefined,
	connectionId: string,
	connectionUpgradeIndex: number | undefined
): FeedbackEntityModel[] {
	if (!rawFeedbacks) return []

	return rawFeedbacks.map((feedback) => ({
		type: EntityModelType.Feedback,
		id: nanoid(),
		connectionId: connectionId,
		definitionId: feedback.feedbackId,
		options: cloneDeep(feedback.options ?? {}),
		isInverted: !!feedback.isInverted,
		style: cloneDeep(feedback.style),
		headline: feedback.headline,
		upgradeIndex: connectionUpgradeIndex,
	}))
}

function convertPresetStyleToDrawStyle(rawStyle: CompanionButtonStyleProps): ButtonStyleProperties {
	return {
		textExpression: false,
		...cloneDeep(rawStyle),
		// TODO - avoid defaults..
		alignment: rawStyle.alignment ?? 'center:center',
		pngalignment: rawStyle.pngalignment ?? 'center:center',
		png64: rawStyle.png64 ?? null,
		show_topbar: rawStyle.show_topbar ?? 'default',
	}
}
