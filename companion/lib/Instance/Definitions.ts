import { nanoid } from 'nanoid'
import { EventDefinitions } from '../Resources/EventDefinitions.js'
import { diffObjects } from '@companion-app/shared/Diff.js'
import { replaceAllVariables } from '../Variables/Util.js'
import type {
	PresetDefinition,
	UIPresetDefinition,
	UIPresetDefinitionUpdate,
} from '@companion-app/shared/Model/Presets.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { LayeredButtonModel, PresetButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import LogController from '../Log/Controller.js'
import {
	EntityModelType,
	type FeedbackEntityModel,
	type ActionEntityModel,
	type EntityModelBase,
	type SomeEntityModel,
	FeedbackEntitySubType,
} from '@companion-app/shared/Model/EntityModel.js'
import type {
	ClientEntityDefinition,
	EntityDefinitionUpdate,
} from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { EventEmitter } from 'node:events'
import type { InstanceConfigStore } from './ConfigStore.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { isExpressionOrValue } from '@companion-app/shared/Model/Expression.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import {
	ConvertBooleanFeedbackStyleToOverrides,
	CreateAdvancedFeedbackStyleOverrides,
	ParseLegacyStyle,
} from '../Resources/ConvertLegacyStyleToElements.js'

type InstanceDefinitionsEvents = {
	readonly updatePresets: [connectionId: string]
}

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

	readonly #configStore: InstanceConfigStore

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

	constructor(configStore: InstanceConfigStore) {
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
	 * @param layeredStyleSelectedElementIds - selected element ids for layered style controls
	 */
	createEntityItem(
		connectionId: string,
		entityType: EntityModelType,
		definitionId: string,
		layeredStyleSelectedElementIds: { [usage in ButtonGraphicsElementUsage]: string | undefined } | null
	): SomeEntityModel | null {
		const definition = this.getEntityDefinition(entityType, connectionId, definitionId)
		if (!definition) return null

		const connectionConfig = this.#configStore.getConfigOfTypeForId(connectionId, ModuleInstanceType.Connection)

		const entity: Omit<EntityModelBase, 'type'> = {
			id: nanoid(),
			definitionId: definitionId,
			connectionId: connectionId,
			options: {},
			upgradeIndex: connectionConfig?.lastUpgradeIndex,
		}

		if (definition.options !== undefined && definition.options.length > 0) {
			for (const opt of definition.options) {
				entity.options[opt.id] = structuredClone((opt as any).default)
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
					isInverted: false,
					styleOverrides: [],
				}

				if (layeredStyleSelectedElementIds) {
					if (definition.feedbackType === FeedbackEntitySubType.Boolean && definition.feedbackStyle) {
						const parsedStyle = ParseLegacyStyle(definition.feedbackStyle)
						feedback.styleOverrides = ConvertBooleanFeedbackStyleToOverrides(
							parsedStyle,
							layeredStyleSelectedElementIds
						)
					} else if (definition.feedbackType === FeedbackEntitySubType.Advanced) {
						feedback.styleOverrides = CreateAdvancedFeedbackStyleOverrides(
							layeredStyleSelectedElementIds,
							layeredStyleSelectedElementIds[ButtonGraphicsElementUsage.Image]
						)
					}
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
				event.options[opt.id] = structuredClone(opt.default)
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
			steps: {},
			feedbacks: [...definition.model.feedbacks, ...definition.presetExtraFeedbacks],
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
	convertPresetToControlModel(connectionId: string, presetId: string): LayeredButtonModel | null {
		const definition = this.#presetDefinitions[connectionId]?.[presetId]
		if (!definition || definition.type !== 'button') return null

		return {
			...definition.model,
			options: {
				...definition.model.options,
				canModifyStyleInApis: false,
			},
			type: 'button-layered',
		}
	}

	/**
	 * Set the action definitions for a connection
	 */
	setActionDefinitions(connectionId: string, actionDefinitions: Record<string, ClientEntityDefinition>): void {
		const lastActionDefinitions = this.#actionDefinitions[connectionId]
		this.#actionDefinitions[connectionId] = structuredClone(actionDefinitions)

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
		this.#feedbackDefinitions[connectionId] = structuredClone(feedbackDefinitions)

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
	setPresetDefinitions(connectionId: string, rawPresets: PresetDefinition[]): void {
		const config = this.#configStore.getConfigOfTypeForId(connectionId, ModuleInstanceType.Connection)
		if (!config) return

		const newPresets: Record<string, PresetDefinition> = {}
		for (const rawPreset of rawPresets) {
			newPresets[rawPreset.id] = rawPreset
		}

		this.#updateVariablePrefixesAndStoreDefinitions(connectionId, config.label, newPresets)
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
				// Update variable references in style layers
				replaceAllVariablesInElements(preset.model.style.layers, label)

				for (const feedback of preset.model.feedbacks || []) {
					if (feedback.type === EntityModelType.Feedback && feedback.styleOverrides) {
						for (const styleOverride of feedback.styleOverrides) {
							if (styleOverride.override && isExpressionOrValue(styleOverride.override)) {
								if (styleOverride.override.isExpression) {
									styleOverride.override.value = replaceAllVariables(styleOverride.override.value, label)
								} else if (
									styleOverride.elementProperty === 'text' &&
									typeof styleOverride.override.value === 'string'
								) {
									// TODO - this may be too strict/loose
									styleOverride.override.value = replaceAllVariables(styleOverride.override.value, label)
								}
							}
						}
					}
				}
			}
		}

		const lastPresetDefinitions = this.#presetDefinitions[connectionId]
		this.#presetDefinitions[connectionId] = structuredClone(presets)

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

function replaceAllVariablesInElements(elements: SomeButtonGraphicsElement[], label: string): void {
	for (const element of elements) {
		if (element.type === 'group') replaceAllVariablesInElements(element.children, label)

		// Future: This should be refactored to handle things more generically, based on the schemas
		for (const [key, value] of Object.entries(element)) {
			if (value && isExpressionOrValue(value)) {
				if (value.isExpression) {
					value.value = replaceAllVariables(value.value, label)
				} else if (element.type === 'text' && key === 'text') {
					value.value = replaceAllVariables(value.value as string, label)
				}
			}
		}
	}
}
