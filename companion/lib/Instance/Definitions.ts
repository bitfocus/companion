import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import { isInternalConnectionId } from '@companion-app/shared/ConnectionId.js'
import type { ControlIdKind } from '@companion-app/shared/ControlId.js'
import { diffObject, diffObjects } from '@companion-app/shared/Diff.js'
import type {
	LayeredButtonModel,
	PresetButtonModel,
	PresetReferenceButtonModel,
} from '@companion-app/shared/Model/ButtonModel.js'
import type {
	ClientActionDefinition,
	ClientEntityDefinition,
	ClientEntityDefinitionBase,
	ClientFeedbackDefinition,
	CompositeElementDefinitionUpdate,
	EntityDefinitionUpdate,
	UICompositeElementDefinition,
} from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type ActionEntityModel,
	type EntityModelBase,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import {
	exprVal,
	getFieldDefaultForControl,
	isExpressionOrValue,
	type ExpressionableOptionsObject,
	type ExpressionOrValue,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import type {
	PresetDefinition,
	UIPresetDefinitionUpdate,
	UIPresetSection,
	UIPresetSections,
} from '@companion-app/shared/Model/Presets.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { createStableObjectHash } from '@companion-app/shared/Util/Hash.js'
import type { CompanionButtonStyleProps, Complete } from '@companion-module/base'
import LogController from '../Log/Controller.js'
import {
	ConvertBooleanFeedbackStyleToOverrides,
	CreateAdvancedFeedbackStyleOverrides,
	ParseLegacyStyle,
} from '../Resources/ConvertLegacyStyleToElements.js'
import { EventDefinitions } from '../Resources/EventDefinitions.js'
import { randomIdGenerator } from '../Resources/IdGenerator.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import {
	injectOverriddenLocalVariableValues,
	replaceAllVariables,
	visitEntityOptionsForVariables,
} from '../Variables/Util.js'
import type { InstanceConfigStore } from './ConfigStore.js'

/**
 * What the definitions of actions and feedbacks have in common, that only the backend needs
 */
interface EntityDefinitionBase {
	learnTimeout: number | undefined
}

/**
 * The definition of an action, with what only the backend needs on top of what the ui is sent
 */
export interface ActionDefinition extends ClientActionDefinition, EntityDefinitionBase {
	/**
	 * The options whose variables invalidate the action, to tell the module about it again
	 * If null, all options are monitored
	 */
	optionsToMonitorForInvalidations: string[] | null
	/**
	 * Whether the module is told about the action when it is added, changed or removed
	 */
	hasLifecycleFunctions: boolean
	/**
	 * How long (in ms) its callback may run before it is cancelled. The host clamps this to a maximum.
	 * Defaults to 5000ms when not set.
	 */
	actionExecutionTimeout: number | undefined
}

/**
 * The definition of a feedback, with what only the backend needs on top of what the ui is sent
 */
export interface FeedbackDefinition extends ClientFeedbackDefinition, EntityDefinitionBase {
	feedbackStyle: Partial<CompanionButtonStyleProps> | undefined
	/**
	 * When an advanced feedback, the properties that should have overrides assigned
	 */
	feedbackAffectedProperties: string[] | undefined
}

export type EntityDefinition = ActionDefinition | FeedbackDefinition

export interface CompositeElementDefinition {
	id: string
	name: string
	sortKey: string | null
	description: string | undefined
	options: SomeCompanionInputField[]
	elements: SomeButtonGraphicsElement[]
}

type InstanceDefinitionsEvents = {
	readonly updatePresets: [connectionId: string]
	readonly updateCompositeElements: [elementIds: ReadonlySet<CompositeElementIdString>]
}

export type CompositeElementIdString = `${string}:${string}`

type DefinitionsEvents = {
	presets: [update: UIPresetDefinitionUpdate]
	actions: [update: EntityDefinitionUpdate<ClientActionDefinition>]
	feedbacks: [update: EntityDefinitionUpdate<ClientFeedbackDefinition>]
	compositeElements: [update: CompositeElementDefinitionUpdate]
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
	#actionDefinitions: Record<string, Record<string, ActionDefinition>> = {}
	/**
	 * The action definitions, as viewed by the ui
	 */
	#uiActionDefinitions: Record<string, Record<string, ClientActionDefinition>> = {}
	/**
	 * The feedback definitions
	 */
	#feedbackDefinitions: Record<string, Record<string, FeedbackDefinition>> = {}
	/**
	 * The feedback definitions, as viewed by the ui
	 */
	#uiFeedbackDefinitions: Record<string, Record<string, ClientFeedbackDefinition>> = {}
	/**
	 * The preset definitions, to convert into real controls
	 */
	#presetDefinitions: Record<string, ReadonlyMap<string, PresetDefinition>> = {}
	/**
	 * The preset definitions, as viewed by the ui
	 */
	#uiPresetDefinitions: Record<string, UIPresetSections> = {}
	/**
	 * The composite element definitions
	 */
	#compositeElementDefinitions: Record<string, Record<string, CompositeElementDefinition>> = {}

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

				yield {
					type: 'init',
					definitions: self.#uiActionDefinitions,
				} satisfies EntityDefinitionUpdate<ClientActionDefinition>

				for await (const [update] of changes) {
					yield update
				}
			}),

			feedbacks: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'feedbacks', signal)

				yield {
					type: 'init',
					definitions: self.#uiFeedbackDefinitions,
				} satisfies EntityDefinitionUpdate<ClientFeedbackDefinition>

				for await (const [update] of changes) {
					yield update
				}
			}),

			compositeElements: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'compositeElements', signal)

				const fullDefinitions: Record<string, Record<string, UICompositeElementDefinition>> = {}
				for (const [connectionId, definitions] of Object.entries(self.#compositeElementDefinitions)) {
					fullDefinitions[connectionId] = self.#simplifyCompositeElementsForUi(definitions)
				}

				yield {
					type: 'init',
					definitions: fullDefinitions,
				} satisfies CompositeElementDefinitionUpdate

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
	 * @param controlKind - the kind of control the entity is for, to pick option defaults
	 * @param layeredStyleSelectedElementIds - selected element ids for layered style controls
	 */
	createEntityItem(
		connectionId: string,
		entityType: EntityModelType,
		definitionId: string,
		controlKind: ControlIdKind | null,
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
				if (opt.type === 'static-text') continue

				const defaultValue = structuredClone(getFieldDefaultForControl(opt, controlKind))
				entity.options[opt.id] = {
					isExpression: false,
					value: defaultValue,
				} satisfies ExpressionOrValue<JsonValue | undefined>
			}
		}

		switch (definition.entityType) {
			case EntityModelType.Action:
				return {
					...entity,
					type: EntityModelType.Action,
				} satisfies ActionEntityModel

			case EntityModelType.Feedback: {
				const feedback: FeedbackEntityModel = {
					...entity,
					type: EntityModelType.Feedback,
					isInverted: exprVal(false),
					styleOverrides: [],
				}

				if (layeredStyleSelectedElementIds) {
					if (definition.feedbackType === FeedbackEntitySubType.Boolean && definition.feedbackStyle) {
						const parsedStyle = ParseLegacyStyle(definition.feedbackStyle, undefined)
						feedback.styleOverrides = ConvertBooleanFeedbackStyleToOverrides(
							parsedStyle,
							layeredStyleSelectedElementIds,
							randomIdGenerator
						)
					} else if (definition.feedbackType === FeedbackEntitySubType.Advanced) {
						feedback.styleOverrides = CreateAdvancedFeedbackStyleOverrides(
							layeredStyleSelectedElementIds,
							layeredStyleSelectedElementIds[ButtonGraphicsElementUsage.Image],
							definition.feedbackAffectedProperties,
							randomIdGenerator
						)
					}
				}

				return feedback
			}

			default:
				assertNever(definition)
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
	 * Count the action, feedback and preset definitions a connection currently exposes.
	 */
	getDefinitionCounts(connectionId: string): { actions: number; feedbacks: number; presets: number } {
		return {
			actions: Object.keys(this.#actionDefinitions[connectionId] ?? {}).length,
			feedbacks: Object.keys(this.#feedbackDefinitions[connectionId] ?? {}).length,
			presets: this.#presetDefinitions[connectionId]?.size ?? 0,
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
		delete this.#uiActionDefinitions[connectionId]
		if (this.#events.listenerCount('actions') > 0) {
			this.#events.emit('actions', {
				type: 'forget-connection',
				connectionId,
			})
		}

		delete this.#feedbackDefinitions[connectionId]
		delete this.#uiFeedbackDefinitions[connectionId]
		if (this.#events.listenerCount('feedbacks') > 0) {
			this.#events.emit('feedbacks', {
				type: 'forget-connection',
				connectionId,
			})
		}

		const oldElements = this.#compositeElementDefinitions[connectionId]
		delete this.#compositeElementDefinitions[connectionId]
		if (this.#events.listenerCount('compositeElements') > 0) {
			this.#events.emit('compositeElements', {
				type: 'forget-connection',
				connectionId,
			})
		}

		// Trigger invalidation of any drawn controls using these elements
		const forgottenIds = oldElements
			? new Set<CompositeElementIdString>(Object.keys(oldElements).map((id) => `${connectionId}:${id}` as const))
			: null
		if (forgottenIds && forgottenIds.size > 0) {
			this.emit('updateCompositeElements', forgottenIds)
		}
	}

	/**
	 * Get an entity definition
	 */
	getEntityDefinition(
		entityType: EntityModelType,
		connectionId: string,
		definitionId: string
	): EntityDefinition | undefined {
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
	 * Get a composite element definition
	 */
	getCompositeElementDefinition(connectionId: string, elementId: string): CompositeElementDefinition | undefined {
		return this.#compositeElementDefinitions[connectionId]?.[elementId]
	}

	/**
	 * Get all composite element definitions
	 */
	getAllCompositeElementDefinitions(): Record<string, Record<string, CompositeElementDefinition>> {
		return this.#compositeElementDefinitions
	}

	convertPresetToPreviewControlModel(connectionId: string, presetId: string): PresetButtonModel | null {
		const definition = this.#presetDefinitions[connectionId]?.get(presetId)
		if (!definition || definition.type !== 'button') return null

		const result: PresetButtonModel = {
			...definition.model,
			type: 'preset:button',
			steps: {},
			feedbacks: [...definition.model.feedbacks, ...definition.presetExtraFeedbacks],
			checksum: this.#getPresetChecksum(definition),
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
		variableValues: VariableValues | null
	): LayeredButtonModel | null {
		const definition = this.#presetDefinitions[connectionId]?.get(presetId)
		if (!definition || definition.type !== 'button') return null

		if (!variableValues) return definition.model

		const model: LayeredButtonModel = {
			...definition.model,
			localVariables: structuredClone(definition.model.localVariables),
		}

		injectOverriddenLocalVariableValues(model.localVariables, variableValues)

		return model
	}

	/**
	 * Build a preset-reference control model for a preset. The resulting model carries a cached copy of the
	 * resolved button data plus a reference to the source preset, so the placed control keeps running in its
	 * last-known state if the source preset/connection disappears.
	 *
	 * Only `localVariables` is cloned here (it is mutated by the templated-value injection); the other
	 * fields are deep-cloned downstream when loaded into the control's entity pool.
	 */
	convertPresetToReferenceControlModel(
		connectionId: string,
		presetId: string,
		variableValues: VariableValues | null
	): PresetReferenceButtonModel | null {
		const definition = this.#presetDefinitions[connectionId]?.get(presetId)
		if (!definition || definition.type !== 'button') return null

		const config = this.#configStore.getConfigOfTypeForId(connectionId, ModuleInstanceType.Connection)
		if (!config) return null

		const localVariables = structuredClone(definition.model.localVariables)
		// Store the overrides that were actually applied, not the raw input.
		const appliedVariableValues = variableValues
			? injectOverriddenLocalVariableValues(localVariables, variableValues)
			: null

		return {
			type: 'preset-reference',
			style: definition.model.style,
			options: definition.model.options,
			feedbacks: definition.model.feedbacks,
			steps: definition.model.steps,
			localVariables,
			presetRef: {
				connectionId,
				moduleId: config.moduleId,
				presetId,
				variableValues: appliedVariableValues,
			},
			checksum: this.#getPresetChecksum(definition),
		}
	}

	/**
	 * Get a stable, content-based checksum of a preset definition, memoised on the definition itself so it is
	 * computed at most once per stored definition (the memo resets naturally when the connection re-reports its
	 * presets, since the whole definition object is replaced). Produced here, alongside the resolved model, so a
	 * caller always gets a checksum that matches the model it was handed - the two cannot drift apart. Covers the
	 * button `model` and the preview-only `presetExtraFeedbacks`; it is derived from content, so it is stable
	 * across module restarts.
	 */
	#getPresetChecksum(definition: PresetDefinition): string {
		return (definition.checksum ??= createHash('sha1')
			.update(
				createStableObjectHash({
					model: definition.model,
					presetExtraFeedbacks: definition.presetExtraFeedbacks,
				})
			)
			.digest('hex'))
	}

	/**
	 * Set the action definitions for a connection
	 */
	setActionDefinitions(connectionId: string, actionDefinitions: Record<string, ActionDefinition>): void {
		this.#actionDefinitions[connectionId] = actionDefinitions

		const lastUiDefinitions = this.#uiActionDefinitions[connectionId]
		const uiDefinitions: Record<string, ClientActionDefinition> = {}
		for (const [id, definition] of Object.entries(actionDefinitions)) {
			uiDefinitions[id] = toClientActionDefinition(definition)
		}
		this.#uiActionDefinitions[connectionId] = uiDefinitions

		if (this.#events.listenerCount('actions') > 0) {
			const update = createEntityDefinitionsUpdate(connectionId, lastUiDefinitions, uiDefinitions)
			if (update) this.#events.emit('actions', update)
		}
	}

	/**
	 * Set the feedback definitions for a connection
	 */
	setFeedbackDefinitions(connectionId: string, feedbackDefinitions: Record<string, FeedbackDefinition>): void {
		this.#feedbackDefinitions[connectionId] = feedbackDefinitions

		const lastUiDefinitions = this.#uiFeedbackDefinitions[connectionId]
		const uiDefinitions: Record<string, ClientFeedbackDefinition> = {}
		for (const [id, definition] of Object.entries(feedbackDefinitions)) {
			uiDefinitions[id] = toClientFeedbackDefinition(definition)
		}
		this.#uiFeedbackDefinitions[connectionId] = uiDefinitions

		if (this.#events.listenerCount('feedbacks') > 0) {
			const update = createEntityDefinitionsUpdate(connectionId, lastUiDefinitions, uiDefinitions)
			if (update) this.#events.emit('feedbacks', update)
		}
	}

	/**
	 * Set the preset definitions for a connection
	 */
	setPresetDefinitions(
		connectionId: string,
		newPresets: ReadonlyMap<string, PresetDefinition>,
		uiDefinitions: Record<string, UIPresetSection>,
		supportsReferences: boolean
	): void {
		const config = this.#configStore.getConfigOfTypeForId(connectionId, ModuleInstanceType.Connection)
		if (!config) return

		this.#updateVariablePrefixesAndStoreDefinitions(
			connectionId,
			config.label,
			newPresets,
			uiDefinitions,
			supportsReferences
		)
	}

	/**
	 * Whether a connection's module supports placing its presets as live references (linked presets).
	 * Older modules (pre 2.0 api) only support being placed as a one-off copy.
	 */
	doesConnectionSupportPresetReferences(connectionId: string): boolean {
		return this.#uiPresetDefinitions[connectionId]?.supportsReferences ?? false
	}

	setCompositeElementDefinitions(connectionId: string, rawDefinitions: CompositeElementDefinition[]): void {
		const config = this.#configStore.getConfigOfTypeForId(connectionId, ModuleInstanceType.Connection)
		if (!config) return

		const newDefinitions: Record<string, CompositeElementDefinition> = {}
		for (const rawDefinition of rawDefinitions) {
			newDefinitions[rawDefinition.id] = rawDefinition
		}

		this.#updateVariablePrefixesAndStoreCompositeElements(connectionId, config.label, newDefinitions)
	}

	/**
	 * Simplify composite element definitions for UI by removing the element property
	 */
	#simplifyCompositeElementsForUi(
		definitions: Record<string, CompositeElementDefinition>
	): Record<string, UICompositeElementDefinition> {
		const result: Record<string, UICompositeElementDefinition> = {}

		for (const [elementId, definition] of Object.entries(definitions)) {
			result[elementId] = {
				name: definition.name,
				sortKey: definition.sortKey,
				description: definition.description,
				options: definition.options.map((opt) => ({ ...opt, id: `opt:${opt.id}` })),
			} satisfies Complete<UICompositeElementDefinition>
		}

		return result
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
				this.#uiPresetDefinitions[connectionId].sections,
				this.#uiPresetDefinitions[connectionId].supportsReferences
			)
		}
		if (this.#compositeElementDefinitions[connectionId] !== undefined) {
			this.#logger.silly('Updating composite elements for connection ' + labelTo)
			this.#updateVariablePrefixesAndStoreCompositeElements(
				connectionId,
				labelTo,
				this.#compositeElementDefinitions[connectionId]
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
		uiDefinitions: Record<string, UIPresetSection>,
		supportsReferences: boolean
	): void {
		const missingReferencedFeedbackDefinitions = new Set<string>()
		const missingReferencedActionDefinitions = new Set<string>()

		const allowedSet = new Set<string>(['local', 'this'])

		const replaceVariablesInEntityOptions = (
			definition: EntityDefinition,
			options: ExpressionableOptionsObject
		): ExpressionableOptionsObject =>
			visitEntityOptionsForVariables<ExpressionOrValue<JsonValue | undefined> | undefined>(
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

		// Fix up the variable references in a single entity and any children it may have.
		// The definition is looked up using the entity's own connectionId, so that internal
		// entities (eg building blocks, `user_value` local variables) resolve too.
		const fixupEntity = (entity: SomeEntityModel): void => {
			if (entity.type === EntityModelType.Feedback && entity.styleOverrides) {
				for (const styleOverride of entity.styleOverrides) {
					if (styleOverride.override && isExpressionOrValue(styleOverride.override)) {
						if (styleOverride.override.isExpression) {
							styleOverride.override.value = replaceAllVariables(styleOverride.override.value, label, allowedSet)
						} else if (styleOverride.elementProperty === 'text' && typeof styleOverride.override.value === 'string') {
							// TODO - this may be too strict/loose
							styleOverride.override.value = replaceAllVariables(styleOverride.override.value, label, allowedSet)
						}
					}
				}
			}

			const definition = this.getEntityDefinition(entity.type, entity.connectionId, entity.definitionId)
			if (!definition) {
				if (entity.type === EntityModelType.Action) {
					missingReferencedActionDefinitions.add(entity.definitionId)
				} else {
					missingReferencedFeedbackDefinitions.add(entity.definitionId)
				}
			} else {
				entity.options = replaceVariablesInEntityOptions(definition, entity.options)
			}

			if (isInternalConnectionId(entity.connectionId) && entity.children) {
				for (const childGroup of Object.values(entity.children)) {
					if (!childGroup) continue
					for (const child of childGroup) fixupEntity(child)
				}
			}
		}

		/*
		 * Clean up variable references: $(label:variable)
		 * since the name of the connection is dynamic. We don't want to
		 * demand that your presets MUST be dynamically generated.
		 */
		for (const preset of presets.values()) {
			// Update variable references in style layers
			replaceAllVariablesInElements(preset.model.style.layers, label, allowedSet)

			for (const feedback of preset.model.feedbacks ?? []) {
				fixupEntity(feedback)
			}

			for (const localVariable of preset.model.localVariables ?? []) {
				fixupEntity(localVariable)
			}

			for (const extraFeedback of preset.presetExtraFeedbacks ?? []) {
				fixupEntity(extraFeedback)
			}

			for (const step of Object.values(preset.model.steps)) {
				if (!step.action_sets || typeof step.action_sets !== 'object') continue
				for (const set of Object.values(step.action_sets)) {
					if (!set || !Array.isArray(set)) continue

					for (const action of set) {
						fixupEntity(action)
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
		const newUiDefinitions: UIPresetSections = {
			supportsReferences,
			sections: structuredClone(uiDefinitions),
		}
		this.#uiPresetDefinitions[connectionId] = newUiDefinitions

		this.emit('updatePresets', connectionId)

		if (this.#events.listenerCount('presets') > 0) {
			if (!lastPresetDefinitions) {
				this.#events.emit('presets', {
					type: 'add',
					connectionId,
					definitions: newUiDefinitions,
				})
			} else {
				const diff = diffObject(lastPresetDefinitions, newUiDefinitions)
				if (diff && diff.length > 0) {
					this.#events.emit('presets', { type: 'patch', connectionId, patch: diff })
				}
			}
		}
	}

	/**
	 * Update all the variables in the composite elements to reference the supplied label, and store them
	 */
	#updateVariablePrefixesAndStoreCompositeElements(
		connectionId: string,
		label: string,
		compositeElements: Record<string, CompositeElementDefinition>
	): void {
		const replaceSet = new Set(['options'])

		/*
		 * Clean up variable references: $(label:variable)
		 * since the name of the connection is dynamic. We don't want to
		 * demand that your presets MUST be dynamically generated.
		 */
		for (const compositeElement of Object.values(compositeElements)) {
			// Update variable references in style layers
			replaceAllVariablesInElements(compositeElement.elements, label, replaceSet)
		}

		const lastCompositeElementDefinitions = this.#compositeElementDefinitions[connectionId]
		this.#compositeElementDefinitions[connectionId] = structuredClone(compositeElements)

		// Report the changes
		// Future: This could be better if it performed some diffing and only reported changed element ids
		const changedElementIds = new Set<CompositeElementIdString>([
			...Object.keys(compositeElements).map((id) => `${connectionId}:${id}` as const),
			...Object.keys(lastCompositeElementDefinitions ?? {}).map((id) => `${connectionId}:${id}` as const),
		])
		if (changedElementIds.size > 0) this.emit('updateCompositeElements', changedElementIds)

		if (this.#events.listenerCount('compositeElements') > 0) {
			const newSimplifiedElements = this.#simplifyCompositeElementsForUi(compositeElements)
			if (!lastCompositeElementDefinitions) {
				this.#events.emit('compositeElements', {
					type: 'add-connection',
					connectionId,
					definitions: newSimplifiedElements,
				})
			} else {
				const lastSimplifiedElements = this.#simplifyCompositeElementsForUi(lastCompositeElementDefinitions)
				const diff = diffObjects(lastSimplifiedElements, newSimplifiedElements)
				if (diff) {
					this.#events.emit('compositeElements', { type: 'update-connection', connectionId, ...diff })
				}
			}
		}
	}
}

/**
 * The update to send the ui for the definitions of a connection, or null when nothing it is sent has changed
 */
function createEntityDefinitionsUpdate<TDefinition extends ClientEntityDefinition>(
	connectionId: string,
	lastDefinitions: Record<string, TDefinition> | undefined,
	definitions: Record<string, TDefinition>
): EntityDefinitionUpdate<TDefinition> | null {
	if (!lastDefinitions) return { type: 'add-connection', connectionId, entities: definitions }

	const diff = diffObjects(lastDefinitions, definitions)
	if (!diff) return null
	return { type: 'update-connection', connectionId, ...diff }
}

function toClientEntityDefinitionBase(definition: EntityDefinition): Complete<ClientEntityDefinitionBase> {
	return {
		label: definition.label,
		sortKey: definition.sortKey,
		description: definition.description,
		options: definition.options,
		hiddenFromPicker: definition.hiddenFromPicker,
		hiddenForControlTypes: definition.hiddenForControlTypes,
		hasLearn: definition.hasLearn,
		warning: definition.warning,
		optionsSupportExpressions: definition.optionsSupportExpressions,
		showButtonPreview: definition.showButtonPreview,
		supportsChildGroups: definition.supportsChildGroups,
	} satisfies Complete<ClientEntityDefinitionBase>
}

function toClientActionDefinition(definition: ActionDefinition): ClientActionDefinition {
	return {
		...toClientEntityDefinitionBase(definition),
		entityType: definition.entityType,
		actionHasResult: definition.actionHasResult,
		actionOutputs: definition.actionOutputs,
	} satisfies Complete<ClientActionDefinition>
}

function toClientFeedbackDefinition(definition: FeedbackDefinition): ClientFeedbackDefinition {
	return {
		...toClientEntityDefinitionBase(definition),
		entityType: definition.entityType,
		feedbackType: definition.feedbackType,
		feedbackDisableStyleOverrides: definition.feedbackDisableStyleOverrides,
		feedbackStyleOverridesUnsupported: definition.feedbackStyleOverridesUnsupported,
		showInvert: definition.showInvert,
	} satisfies Complete<ClientFeedbackDefinition>
}

function replaceAllVariablesInElements(
	elements: SomeButtonGraphicsElement[],
	label: string,
	preserveLabels: Set<string>
): void {
	for (const element of elements) {
		if (element.type === 'group') replaceAllVariablesInElements(element.children, label, preserveLabels)

		// Future: This should be refactored to handle things more generically, based on the schemas
		for (const [key, value] of Object.entries(element)) {
			if (value && isExpressionOrValue(value)) {
				if (value.isExpression) {
					value.value = replaceAllVariables(value.value, label, preserveLabels)
				} else if (element.type === 'text' && key === 'text') {
					value.value = replaceAllVariables(value.value as string, label, preserveLabels)
				}
			}
		}
	}
}
