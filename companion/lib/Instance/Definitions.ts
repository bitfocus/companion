import { nanoid } from 'nanoid'
import { EventDefinitions } from '../Resources/EventDefinitions.js'
import { diffObjects } from '@companion-app/shared/Diff.js'
import {
	injectOverriddenLocalVariableValues,
	replaceAllVariables,
	visitEntityOptionsForVariables,
} from '../Variables/Util.js'
import type {
	PresetDefinition,
	UIPresetDefinitionUpdate,
	UIPresetSection,
} from '@companion-app/shared/Model/Presets.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { NormalButtonModel, PresetButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import LogController from '../Log/Controller.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type FeedbackEntityModel,
	type ActionEntityModel,
	type EntityModelBase,
	type SomeEntityModel,
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
import { ConvertPresetStyleToDrawStyle } from './Connection/Thread/PresetUtils.js'
import {
	exprExpr,
	exprVal,
	type ExpressionOrValue,
	type ExpressionableOptionsObject,
} from '@companion-app/shared/Model/Options.js'
import jsonPatch from 'fast-json-patch'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'

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
	 * The flattened preset definitions
	 */
	#presetDefinitions: Record<string, ReadonlyMap<string, PresetDefinition>> = {}
	/**
	 * The preset definitions, as viewed by the ui
	 */
	#uiPresetDefinitions: Record<string, Record<string, UIPresetSection>> = {}

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

				yield { type: 'init', definitions: self.#uiPresetDefinitions } satisfies UIPresetDefinitionUpdate

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
				if (opt.type === 'static-text') continue

				const defaultValue = structuredClone((opt as any).default)
				entity.options[opt.id] = {
					isExpression: false,
					value: defaultValue,
				} satisfies ExpressionOrValue<any>
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
					isInverted: exprVal(false),
				}

				if (/*!booleanOnly &&*/ definition.feedbackType === FeedbackEntitySubType.Boolean && definition.feedbackStyle) {
					feedback.style = structuredClone(definition.feedbackStyle)
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
				event.options[opt.id] = structuredClone((opt as any).default)
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
		delete this.#uiPresetDefinitions[connectionId]
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
		const definition = this.#presetDefinitions[connectionId]?.get(presetId)
		if (!definition || definition.type !== 'button') return null

		const result: PresetButtonModel = {
			...definition.model,
			type: 'preset:button',
			style: definition.previewStyle
				? ConvertPresetStyleToDrawStyle(Object.assign({}, definition.model.style, definition.previewStyle))
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
					expression: exprExpr('true'),
				},
				isInverted: exprVal(false),
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
	convertPresetToControlModel(
		connectionId: string,
		presetId: string,
		matrixValues: VariableValues | null
	): NormalButtonModel | null {
		const definition = this.#presetDefinitions[connectionId]?.get(presetId)
		if (!definition || definition.type !== 'button') return null

		if (!matrixValues) return definition.model

		const model: NormalButtonModel = {
			...definition.model,
			localVariables: structuredClone(definition.model.localVariables),
		}

		injectOverriddenLocalVariableValues(model.localVariables, matrixValues)

		return model
	}

	/**
	 * Set the action definitions for a connection
	 */
	setActionDefinitions(connectionId: string, actionDefinitions: Record<string, ClientEntityDefinition>): void {
		const lastActionDefinitions = this.#actionDefinitions[connectionId]
		this.#actionDefinitions[connectionId] = actionDefinitions

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
		this.#feedbackDefinitions[connectionId] = feedbackDefinitions

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
	setPresetDefinitions(
		connectionId: string,
		newPresets: ReadonlyMap<string, PresetDefinition>,
		uiDefinitions: Record<string, UIPresetSection>
	): void {
		const config = this.#configStore.getConfigOfTypeForId(connectionId, ModuleInstanceType.Connection)
		if (!config) return

		this.#updateVariablePrefixesAndStoreDefinitions(connectionId, config.label, newPresets, uiDefinitions)
	}

	/**
	 * Update all the variables in the presets to reference the supplied label
	 * @param connectionId
	 * @param labelTo
	 */
	updateVariablePrefixesForLabel(connectionId: string, labelTo: string): void {
		if (this.#presetDefinitions[connectionId] !== undefined) {
			this.#logger.silly('Updating presets for connection ' + labelTo)
			this.#updateVariablePrefixesAndStoreDefinitions(
				connectionId,
				labelTo,
				this.#presetDefinitions[connectionId],
				this.#uiPresetDefinitions[connectionId]
			)
		}
	}

	/**
	 * Update all the variables in the presets to reference the supplied label, and store them
	 */
	#updateVariablePrefixesAndStoreDefinitions(
		connectionId: string,
		label: string,
		presets: ReadonlyMap<string, PresetDefinition>,
		uiDefinitions: Record<string, UIPresetSection>
	): void {
		const missingReferencedFeedbackDefinitions = new Set<string>()
		const missingReferencedActionDefinitions = new Set<string>()

		const allowedSet = new Set<string>(['local'])

		const replaceVariablesInEntityOptions = (
			definition: ClientEntityDefinition,
			options: ExpressionableOptionsObject
		): ExpressionableOptionsObject =>
			visitEntityOptionsForVariables<ExpressionOrValue<any> | undefined>(
				definition,
				options,
				(_field, optionValue, fieldType) => {
					if (!optionValue || !fieldType) return optionValue

					// Only replace variables in fields that support them
					if (
						(fieldType.parseVariables ||
							fieldType.forceExpression ||
							(fieldType.allowExpression && optionValue.isExpression)) &&
						typeof optionValue.value === 'string'
					) {
						return {
							value: replaceAllVariables(optionValue.value, label, allowedSet),
							isExpression: optionValue.isExpression,
						}
					}

					return optionValue
				}
			)

		/*
		 * Clean up variable references: $(label:variable)
		 * since the name of the connection is dynamic. We don't want to
		 * demand that your presets MUST be dynamically generated.
		 */
		for (const preset of presets.values()) {
			if (preset.model.style) {
				preset.model.style.text = replaceAllVariables(preset.model.style.text, label, allowedSet)
			}

			if (preset.model.feedbacks) {
				for (const feedback of preset.model.feedbacks) {
					if (feedback.type !== EntityModelType.Feedback) continue

					if (typeof feedback.style?.text === 'string') {
						feedback.style.text = replaceAllVariables(feedback.style.text, label, allowedSet)
					}

					const definition = this.getEntityDefinition(EntityModelType.Feedback, connectionId, feedback.definitionId)
					if (!definition) {
						missingReferencedFeedbackDefinitions.add(feedback.definitionId)
						continue
					}

					feedback.options = replaceVariablesInEntityOptions(definition, feedback.options)
				}
			}

			for (const step of Object.values(preset.model.steps)) {
				if (!step.action_sets || typeof step.action_sets !== 'object') continue
				for (const set of Object.values(step.action_sets)) {
					if (!set || !Array.isArray(set)) continue

					for (const action of set) {
						if (action.type !== EntityModelType.Action) continue

						const definition = this.getEntityDefinition(EntityModelType.Action, connectionId, action.definitionId)
						if (!definition) {
							missingReferencedActionDefinitions.add(action.definitionId)
							continue
						}

						action.options = replaceVariablesInEntityOptions(definition, action.options)
					}
				}
			}
		}

		if (missingReferencedActionDefinitions.size > 0) {
			this.#logger.warn(
				`Presets for connection ${label} reference action definitions that do not exist: ${[...missingReferencedActionDefinitions].join(', ')}`
			)
		}
		if (missingReferencedFeedbackDefinitions.size > 0) {
			this.#logger.warn(
				`Presets for connection ${label} reference feedback definitions that do not exist: ${[...missingReferencedFeedbackDefinitions].join(', ')}`
			)
		}

		this.#presetDefinitions[connectionId] = structuredClone(presets)
		const lastPresetDefinitions = this.#uiPresetDefinitions[connectionId]
		this.#uiPresetDefinitions[connectionId] = structuredClone(uiDefinitions)

		this.emit('updatePresets', connectionId)

		if (this.#events.listenerCount('presets') > 0) {
			if (!lastPresetDefinitions) {
				this.#events.emit('presets', {
					type: 'add',
					connectionId,
					definitions: uiDefinitions,
				})
			} else {
				const diff = jsonPatch.compare(lastPresetDefinitions, uiDefinitions)
				if (diff && diff.length > 0) {
					this.#events.emit('presets', { type: 'patch', connectionId, patch: diff })
				}
			}
		}
	}
}
