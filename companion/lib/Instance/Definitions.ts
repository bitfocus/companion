import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import { EventDefinitions } from '../Resources/EventDefinitions.js'
import { ControlEntityListPoolButton } from '../Controls/Entities/EntityListPoolButton.js'
import jsonPatch from 'fast-json-patch'
import { diffObjects } from '@companion-app/shared/Diff.js'
import { replaceAllVariables } from '../Variables/Util.js'
import type {
	PresetActionInstance,
	PresetActionSets,
	PresetDefinition,
	UIPresetDefinition,
	UIPresetDefinitionUpdate,
} from '@companion-app/shared/Model/Presets.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { NormalButtonModel, NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type {
	CompanionButtonStyleProps,
	CompanionPresetAction,
	CompanionPresetDefinition,
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

type DefinitionsEvents = {
	presets: [update: UIPresetDefinitionUpdate]
	actions: [update: EntityDefinitionUpdate]
	feedbacks: [update: EntityDefinitionUpdate]
}

/**
 * Class to handle and store the 'definitions' produced by instances.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class InstanceDefinitions {
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

	/**
	 * Get the draw style for a preset
	 * @param connectionId - the id of the instance
	 * @param presetId - the id of the preset
	 */
	getPresetDrawStyle(connectionId: string, presetId: string): (CompanionButtonStyleProps & { style: 'button' }) | null {
		const definition = this.#presetDefinitions[connectionId]?.[presetId]
		if (definition && definition.type === 'button') {
			return {
				...(definition.previewStyle ? definition.previewStyle : definition.style),
				style: definition.type,
			}
		} else {
			return null
		}
	}

	/**
	 * Import a preset to a location
	 */
	convertPresetToControlModel(connectionId: string, presetId: string): NormalButtonModel | null {
		const definition = this.#presetDefinitions[connectionId]?.[presetId]
		if (!definition || definition.type !== 'button') return null

		const connectionUpgradeIndex = this.#configStore.getConfigForId(connectionId)?.lastUpgradeIndex

		const result: NormalButtonModel = {
			type: 'button',
			options: {
				rotaryActions: definition.options?.rotaryActions ?? false,
				stepProgression: (definition.options?.stepAutoProgress ?? true) ? 'auto' : 'manual',
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
			localVariables: [],
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
					options: cloneDeep(definition.steps[i].options) ?? cloneDeep(ControlEntityListPoolButton.DefaultStepOptions),
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
						definition.options?.relativeDelay,
						connectionUpgradeIndex
					)
				}
			}
		}

		if (definition.feedbacks) {
			result.feedbacks = definition.feedbacks.map((feedback) => ({
				type: EntityModelType.Feedback,
				id: nanoid(),
				connectionId: connectionId,
				definitionId: feedback.type,
				options: cloneDeep(feedback.options ?? {}),
				isInverted: feedback.isInverted,
				style: cloneDeep(feedback.style),
				headline: feedback.headline,
				upgradeIndex: connectionUpgradeIndex,
			}))
		}

		return result
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
										const options = cloneDeep(ControlEntityListPoolButton.DefaultStepOptions)
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
				const patch = jsonPatch.compare(lastSimplifiedPresets, newSimplifiedPresets)
				if (patch.length > 0) {
					this.#events.emit('presets', {
						type: 'patch',
						connectionId,
						patch: patch,
					})
				}
			}
		}
	}
}

export type PresetDefinitionTmp = CompanionPresetDefinition & {
	id: string
}

function toActionInstance(
	action: PresetActionInstance,
	connectionId: string,
	connectionUpgradeIndex: number | undefined
): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: connectionId,
		definitionId: action.action,
		options: cloneDeep(action.options ?? {}),
		headline: action.headline,
		upgradeIndex: connectionUpgradeIndex,
	}
}

function convertActionsDelay(
	actions: PresetActionInstance[],
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
