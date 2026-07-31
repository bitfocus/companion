/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import type EventEmitter from 'node:events'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	type ActionEntityModel,
	type FeedbackEntityModel,
	type FeedbackValue,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { convertExpressionOptionsWithoutParsing } from '@companion-app/shared/Model/Options.js'
import type { VariableValue, VariableValues } from '@companion-app/shared/Model/Variables.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { CompanionOptionValues, Complete } from '@companion-module/base'
import type { JsonValue } from '@companion-module/host'
import type { ActionRunner } from '../Controls/ActionRunner.js'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { NewFeedbackValue } from '../Controls/Entities/Types.js'
import type { IControlStore } from '../Controls/IControlStore.js'
import type { RenderClock } from '../Controls/RenderClock.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import LogController from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { AppInfo } from '../Registry.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { LocalVariablesController } from '../Variables/LocalVariablesController.js'
import type { VariableValueEntry } from '../Variables/Values.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import { InternalActionRecorder } from './ActionRecorder.js'
import { InternalBuildingBlocks } from './BuildingBlocks.js'
import { InternalControls } from './Controls.js'
import { InternalCustomVariables } from './CustomVariables.js'
import { InternalInstance } from './Instance.js'
import { InternalPage } from './Page.js'
import { InternalSurface } from './Surface.js'
import { InternalSystem } from './System.js'
import { InternalTime } from './Time.js'
import { InternalTriggers } from './Triggers.js'
import type {
	ActionForInternalExecution,
	ActionForVisitor,
	FeedbackExecutionContext,
	FeedbackForInternalExecution,
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalVisitor,
} from './Types.js'
import { InternalVariables } from './Variables.js'

/**
 * The mutable dependency-tracking fields written back during a feedback evaluation, so it can be
 * re-evaluated when its inputs change. {@link FeedbackEntityState} satisfies this shape.
 */
interface FeedbackDependencyTracking {
	referencedVariables: Set<string> | null

	/** Whether the last computed value depends on the render clock (e.g. oscillate() was called) */
	clockSensitive: boolean
}

interface FeedbackEntityState extends FeedbackDependencyTracking {
	controlId: string
	location: ControlLocation | undefined

	entityModel: FeedbackEntityModel
}

export class InternalController {
	readonly #logger = LogController.createLogger('Internal/Controller')

	readonly #controlsStore: IControlStore
	readonly #pageStore: IPageStore
	readonly #instanceDefinitions: InstanceDefinitions
	readonly #variablesController: VariablesController

	readonly #feedbacks = new Map<string, FeedbackEntityState>()

	readonly #unsubscribeRenderClock: () => void

	#buildingBlocksFragment: InternalBuildingBlocks | undefined
	readonly #fragments: InternalModuleFragment[]

	#initialized = false

	constructor(
		controlStore: IControlStore,
		pageStore: IPageStore,
		instanceController: InstanceController,
		variablesController: VariablesController,
		renderClock: RenderClock
	) {
		this.#controlsStore = controlStore
		this.#pageStore = pageStore
		this.#instanceDefinitions = instanceController.definitions
		this.#variablesController = variablesController

		this.#unsubscribeRenderClock = renderClock.subscribe(() => this.#onRenderClockTick())

		this.#fragments = [
			// These are pushed during init
		]
	}

	destroy(): void {
		this.#unsubscribeRenderClock()
	}

	init(
		appInfo: AppInfo,
		controls: ControlsController,
		instanceController: InstanceController,
		surfaceController: SurfaceController,
		graphicsController: GraphicsController,
		userConfigController: DataUserConfig,
		localVariablesController: LocalVariablesController,
		controlEvents: EventEmitter<ControlCommonEvents>,
		actionRunner: ActionRunner,
		requestExit: (fromInternal: boolean, restart: boolean) => void
	): void {
		if (this.#initialized) throw new Error(`InternalController already initialized`)
		this.#initialized = true

		this.#buildingBlocksFragment = new InternalBuildingBlocks(actionRunner)

		this.#fragments.push(
			this.#buildingBlocksFragment,
			new InternalActionRecorder(instanceController.actionRecorder, this.#pageStore),
			new InternalInstance(instanceController),
			new InternalTime(userConfigController),
			new InternalControls(graphicsController, this.#controlsStore, this.#pageStore, controlEvents),
			new InternalCustomVariables(this.#variablesController),
			new InternalPage(this.#pageStore),
			new InternalSurface(surfaceController, this.#controlsStore, this.#pageStore),
			new InternalSystem(appInfo, userConfigController, this.#variablesController, requestExit),
			new InternalTriggers(controls),
			new InternalVariables(localVariablesController)
		)

		// Listen for events from the fragments
		for (const fragment of this.#fragments) {
			fragment.on('checkFeedbacks', (...types) => this.#checkFeedbacks(...types))
			fragment.on('checkFeedbacksById', (...ids) => this.checkFeedbacksById(...ids))
			fragment.on('regenerateVariables', () => this.#regenerateVariables())
			fragment.on('setVariables', (variables) => this.#setVariables(variables))
		}

		// Set everything up
		this.#regenerateActions()
		this.#regenerateFeedbacks()
		this.#regenerateVariables()
	}

	/**
	 * Trigger the first update after launch of each action and feedback
	 */
	firstUpdate(): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		// Find all the feedbacks on controls
		const allControls = this.#controlsStore.getAllControls()
		for (const control of allControls.values()) {
			if (!control.supportsEntities) continue

			control.entities.resubscribeEntities(undefined, 'internal')
		}

		// Make all variables values
		for (const fragment of this.#fragments) {
			if ('updateVariables' in fragment && typeof fragment.updateVariables === 'function') {
				fragment.updateVariables()
			}
		}
	}

	/**
	 * Perform an upgrade for an entity
	 * @param entity
	 * @param controlId
	 * @returns Updated entity if any changes were made
	 */
	entityUpgrade(entity: SomeEntityModel, controlId: string): SomeEntityModel | undefined {
		switch (entity.type) {
			case EntityModelType.Feedback: {
				return this.#feedbackUpgrade(entity, controlId)
			}
			case EntityModelType.Action: {
				return this.#actionUpgrade(entity, controlId)
			}
			default:
				assertNever(entity)
				return undefined
		}
	}

	/**
	 * Perform an upgrade for an action
	 * @param action
	 * @param controlId
	 * @returns Updated action if any changes were made
	 */
	#actionUpgrade(action: ActionEntityModel, controlId: string): ActionEntityModel | undefined {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		for (const fragment of this.#fragments) {
			if ('actionUpgrade' in fragment && typeof fragment.actionUpgrade === 'function') {
				try {
					const newAction = fragment.actionUpgrade(action, controlId)
					if (newAction !== undefined) {
						// It was handled, so break
						return newAction
					}
				} catch (e) {
					this.#logger.silly(`Action upgrade failed: ${JSON.stringify(action)}(${controlId}) - ${stringifyError(e)}`)
				}
			}
		}

		return undefined
	}
	/**
	 * Perform an upgrade for a feedback
	 * @param feedback
	 * @param controlId
	 * @returns Updated feedback if any changes were made
	 */
	#feedbackUpgrade(feedback: FeedbackEntityModel, controlId: string): FeedbackEntityModel | undefined {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		for (const fragment of this.#fragments) {
			if ('feedbackUpgrade' in fragment && typeof fragment.feedbackUpgrade === 'function') {
				try {
					const newFeedback = fragment.feedbackUpgrade(feedback, controlId)
					if (newFeedback !== undefined) {
						// It was handled, so break
						return newFeedback
					}
				} catch (e) {
					this.#logger.silly(
						`Feedback upgrade failed: ${JSON.stringify(feedback)}(${controlId}) - ${stringifyError(e)}`
					)
				}
			}
		}

		return undefined
	}

	entityUpdate(entity: SomeEntityModel, controlId: string): void {
		if (entity.type === EntityModelType.Feedback) {
			this.#feedbackUpdate(entity, controlId)
		}
	}

	/**
	 * A feedback has changed, and state should be updated
	 */
	#feedbackUpdate(feedback: FeedbackEntityModel, controlId: string): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		if (feedback.connectionId !== 'internal') throw new Error(`Feedback is not for internal instance`)
		if (feedback.disabled) return

		const location = this.#pageStore.getLocationOfControlId(controlId)

		const feedbackState: FeedbackEntityState = {
			controlId,
			location,
			referencedVariables: null,
			clockSensitive: false,

			entityModel: structuredClone(feedback),
		}
		this.#feedbacks.set(feedback.id, feedbackState)

		this.#controlsStore.updateFeedbackValues('internal', [
			{
				entityId: feedback.id,
				controlId: controlId,
				value: this.#feedbackGetValue(feedbackState),
			},
		])
	}

	/**
	 * Evaluate an internal feedback live, using an externally supplied parser.
	 *
	 * This is the lazy entry point used when an internal feedback is a child of an action: the caller
	 * builds a parser carrying the action's execution-context `$(this:*)` overrides and passes it here.
	 * Unlike the eager path, this does NOT read or write the `#feedbacks` cache map, and does not track
	 * variable dependencies (the value is recomputed on each execution).
	 */
	evaluateFeedbackValue(
		entityModel: FeedbackEntityModel,
		controlId: string,
		parser: VariablesAndExpressionParser
	): FeedbackValue {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)
		if (entityModel.connectionId !== 'internal') throw new Error(`Feedback is not for internal instance`)

		const location = this.#pageStore.getLocationOfControlId(controlId)

		return this.#computeFeedbackValue(entityModel, controlId, location, parser, null)
	}
	/**
	 * A feedback has been deleted
	 */
	entityDelete(entity: SomeEntityModel): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		if (entity.connectionId !== 'internal') throw new Error(`Feedback is not for internal instance`)

		if (entity.type !== EntityModelType.Feedback) return

		this.#feedbacks.delete(entity.id)

		for (const fragment of this.#fragments) {
			if (typeof fragment.forgetFeedback === 'function') {
				try {
					fragment.forgetFeedback(entity)
				} catch (e) {
					this.#logger.silly(`Feedback forget failed: ${JSON.stringify(entity)} - ${stringifyError(e)}`)
				}
			}
		}
	}
	/**
	 * Get an updated value for a tracked (eagerly-cached) feedback.
	 * Builds a parser for the control (with no execution-context overrides) and records the dependency
	 * tracking onto the {@link FeedbackEntityState} so it can be re-evaluated when its inputs change.
	 */
	#feedbackGetValue(feedbackState: FeedbackEntityState): FeedbackValue {
		const parser = this.#controlsStore.createVariablesAndExpressionParser(feedbackState.controlId, null)

		return this.#computeFeedbackValue(
			feedbackState.entityModel,
			feedbackState.controlId,
			feedbackState.location,
			parser,
			feedbackState
		)
	}

	/**
	 * The single feedback evaluation routine shared by the eager (cached) and lazy (execution-context)
	 * paths. It looks up the definition, parses the options with the supplied parser, then asks each
	 * fragment to execute the feedback.
	 *
	 * @param tracking When non-null, the referenced-variable/clock-sensitivity dependencies discovered
	 * during evaluation are written back here for accurate re-evaluation (the eager path). When null, no
	 * dependency tracking is performed (the lazy path re-evaluates on every execution).
	 */
	#computeFeedbackValue(
		entityModel: FeedbackEntityModel,
		controlId: string,
		location: ControlLocation | undefined,
		parser: VariablesAndExpressionParser,
		tracking: FeedbackDependencyTracking | null
	): FeedbackValue {
		try {
			const entityDefinition = this.#instanceDefinitions.getEntityDefinition(
				EntityModelType.Feedback,
				'internal', // This is the internal instance code
				entityModel.definitionId
			)
			if (!entityDefinition) {
				// No definition found, so cannot evaluate
				if (tracking) {
					tracking.referencedVariables = null
					tracking.clockSensitive = false
				}

				return undefined
			}

			// Parse the options if enabled
			let parsedOptions: CompanionOptionValues
			if (entityDefinition.optionsSupportExpressions) {
				const parseRes = parser.parseEntityOptions(entityDefinition, entityModel.options)

				// Always track the dependencies, for accurate re-evaluation when something changes
				if (tracking) {
					tracking.referencedVariables = parseRes.referencedVariableIds
					tracking.clockSensitive = parseRes.clockSensitive
				}

				if (!parseRes.ok) {
					this.#logger.warn(
						`Failed to parse options for feedback ${entityModel.definitionId} in control ${controlId}: ${JSON.stringify(parseRes.optionErrors)}`
					)
					throw new Error(
						`Failed to parse options for feedback ${entityModel.definitionId}. One or more options were invalid`
					)
				} else {
					parsedOptions = parseRes.parsedOptions
				}
			} else {
				parsedOptions = convertExpressionOptionsWithoutParsing(entityModel.options)
				if (tracking) {
					tracking.referencedVariables = new Set<string>()
					tracking.clockSensitive = false
				}
			}

			const executionFeedback: Complete<FeedbackForInternalExecution> = {
				controlId: controlId,
				location: location,

				options: parsedOptions,

				id: entityModel.id,
				definitionId: entityModel.definitionId,
			}

			for (const fragment of this.#fragments) {
				if ('executeFeedback' in fragment && typeof fragment.executeFeedback === 'function') {
					let value: ReturnType<Required<InternalModuleFragment>['executeFeedback']> | undefined
					try {
						value = fragment.executeFeedback(executionFeedback, parser)
					} catch (e) {
						this.#logger.silly(`Feedback check failed: ${JSON.stringify(executionFeedback)} - ${stringifyError(e)}`)
					}

					if (value && typeof value === 'object' && 'referencedVariables' in value) {
						if (tracking?.referencedVariables) {
							for (const variable of value.referencedVariables) {
								tracking.referencedVariables.add(variable)
							}
						}

						return value.value
					} else if (value !== undefined) {
						return value
					}
				}
			}
		} catch (e) {
			this.#logger.warn(`Feedback get value failed: ${JSON.stringify(entityModel)} - ${stringifyError(e)}`)
			return undefined
		} finally {
			// If there are no referenced variables, set to null
			if (tracking?.referencedVariables && tracking.referencedVariables.size === 0) {
				tracking.referencedVariables = null
			}
		}

		return undefined
	}

	/**
	 * Visit any references in some inactive internal actions and feedbacks
	 */
	visitReferences(visitor: InternalVisitor, rawEntities: SomeEntityModel[], entities: ControlEntityInstance[]): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		const simpleInternalFeedbacks: FeedbackForVisitor[] = []
		const simpleInternalActions: ActionForVisitor[] = []

		for (const entity of rawEntities) {
			if (entity.connectionId !== 'internal') continue

			switch (entity.type) {
				case EntityModelType.Feedback:
					simpleInternalFeedbacks.push({
						id: entity.id,
						type: entity.definitionId,
						options: entity.options,
					})
					break
				case EntityModelType.Action:
					simpleInternalActions.push({
						id: entity.id,
						action: entity.definitionId,
						options: entity.options,
					})
					break
				default:
					assertNever(entity)
					break
			}
		}
		for (const entity of entities) {
			if (entity.connectionId !== 'internal') continue

			switch (entity.type) {
				case EntityModelType.Feedback:
					simpleInternalFeedbacks.push({
						id: entity.id,
						type: entity.definitionId,
						options: entity.rawOptions, // Ensure the options is not a copy/clone
					})
					break
				case EntityModelType.Action:
					simpleInternalActions.push({
						id: entity.id,
						action: entity.definitionId,
						options: entity.rawOptions, // Ensure the options is not a copy/clone
					})
					break
				default:
					assertNever(entity.type)
					break
			}
		}

		for (const fragment of this.#fragments) {
			if ('visitReferences' in fragment && typeof fragment.visitReferences === 'function') {
				fragment.visitReferences(visitor, simpleInternalActions, simpleInternalFeedbacks)
			}
		}
	}

	/**
	 * Run a single internal action
	 */
	async executeAction(action: ControlEntityInstance, extras: RunActionExtras): Promise<JsonValue | undefined> {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		if (action.type !== EntityModelType.Action)
			throw new Error(`Cannot execute entity of type "${action.type}" as an action`)

		try {
			const entityDefinition = this.#instanceDefinitions.getEntityDefinition(
				EntityModelType.Action,
				'internal',
				action.definitionId
			)
			if (!entityDefinition) return

			const overrideVariableValues = buildActionExecutionOverrides(extras)
			// Actions are sampled once at execution and never re-evaluated, so clock-sensitive
			// expressions (e.g. oscillate()) would be misleading - reject them, matching module actions.
			const parser = this.#controlsStore.createVariablesAndExpressionParser(extras.controlId, overrideVariableValues, {
				allowClockSensitive: false,
			})

			// Context for lazily evaluating this action's child feedbacks. A parser snapshots local/page
			// variable values at construction, so we build a fresh one per call rather than reusing the
			// action's `parser`: logic_while re-checks its condition each iteration and must see values that
			// its own body changed mid-loop.
			const createFeedbackContext = (): FeedbackExecutionContext => ({
				parser: this.#controlsStore.createVariablesAndExpressionParser(extras.controlId, overrideVariableValues, {
					allowClockSensitive: false,
				}),
			})

			let parsedOptions: CompanionOptionValues
			if (entityDefinition.optionsSupportExpressions) {
				const parseRes = parser.parseEntityOptions(entityDefinition, action.rawOptions)
				if (!parseRes.ok) {
					this.#logger.warn(
						`Failed to parse options for action ${action.definitionId} in control ${extras.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
					)
					throw new Error(`Failed to parse options for action ${action.definitionId}. One or more options were invalid`)
				} else {
					parsedOptions = parseRes.parsedOptions
				}
			} else {
				parsedOptions = convertExpressionOptionsWithoutParsing(action.rawOptions)
			}

			const executionAction: Complete<ActionForInternalExecution> = {
				options: parsedOptions,

				id: action.id,
				definitionId: action.definitionId,

				rawEntity: action,
			}

			for (const fragment of this.#fragments) {
				if ('executeAction' in fragment && typeof fragment.executeAction === 'function') {
					let result = fragment.executeAction(executionAction, extras, parser, createFeedbackContext)
					// Only await if it is a promise, to avoid unnecessary async pauses
					result = result instanceof Promise ? await result : result

					if (result) {
						// It was handled, so break
						return result.result
					}
				}
			}
		} catch (e) {
			this.#logger.warn(
				`Action execute failed: ${JSON.stringify(action.asEntityModel(false))}(${JSON.stringify(extras)}) - ${stringifyError(
					e
				)}`
			)
		}

		return undefined
	}

	/**
	 * Execute a logic feedback
	 */
	executeLogicFeedback(feedback: FeedbackEntityModel, isInverted: boolean, childValues: boolean[]): boolean {
		if (!this.#initialized || !this.#buildingBlocksFragment) throw new Error(`InternalController is not initialized`)

		return this.#buildingBlocksFragment.executeLogicFeedback(feedback, isInverted, childValues)
	}

	/**
	 * Set internal variable values
	 */
	#setVariables(variables: Record<string, VariableValue | undefined>): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		// This isn't ideal, but it's cheap enough and avoids updating the calling code
		const valuesArr: VariableValueEntry[] = Object.entries(variables).map(([id, value]) => ({
			id,
			value,
		}))

		this.#variablesController.values.setVariableValues('internal', valuesArr)
	}
	/**
	 * Recheck all feedbacks of specified types
	 */
	#checkFeedbacks(...types: string[]): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		const typesSet = new Set(types)

		const newValues: NewFeedbackValue[] = []

		for (const [id, feedback] of this.#feedbacks.entries()) {
			if (typesSet.size === 0 || typesSet.has(feedback.entityModel.definitionId)) {
				newValues.push({
					entityId: id,
					controlId: feedback.controlId,
					value: this.#feedbackGetValue(feedback),
				})
			}
		}

		this.#controlsStore.updateFeedbackValues('internal', newValues)
	}
	/**
	 * Recheck all feedbacks of specified id
	 */
	checkFeedbacksById(...ids: string[]): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		const newValues: NewFeedbackValue[] = []

		for (const id of ids) {
			const feedback = this.#feedbacks.get(id)
			if (feedback) {
				newValues.push({
					entityId: id,
					controlId: feedback.controlId,
					value: this.#feedbackGetValue(feedback),
				})
			}
		}

		this.#controlsStore.updateFeedbackValues('internal', newValues)
	}
	#regenerateActions(): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		const actions: Record<string, ClientEntityDefinition> = {}

		for (const fragment of this.#fragments) {
			if ('getActionDefinitions' in fragment && typeof fragment.getActionDefinitions === 'function') {
				for (const [id, action] of Object.entries(fragment.getActionDefinitions())) {
					actions[id] = {
						...action,
						sortKey: action.sortKey ?? null,
						hasLifecycleFunctions: false,
						hasLearn: action.hasLearn ?? false,
						learnTimeout: action.learnTimeout,

						actionHasResult: !!action.actionHasResult,

						showButtonPreview: action.showButtonPreview ?? false,
						supportsChildGroups: action.supportsChildGroups ?? [],

						entityType: EntityModelType.Action,
						showInvert: false,
						feedbackType: null,
						feedbackStyle: undefined,
						feedbackAffectedProperties: undefined,
						feedbackDisableStyleOverrides: false,

						optionsSupportExpressions: action.optionsSupportExpressions ?? false,

						optionsToMonitorForInvalidations: action.optionsToMonitorForInvalidations || null,
					} satisfies Complete<ClientEntityDefinition>
				}
			}
		}

		this.#instanceDefinitions.setActionDefinitions('internal', actions)
	}
	#regenerateFeedbacks(): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		const feedbacks: Record<string, ClientEntityDefinition> = {}

		for (const fragment of this.#fragments) {
			if ('getFeedbackDefinitions' in fragment && typeof fragment.getFeedbackDefinitions === 'function') {
				for (const [id, feedback] of Object.entries(fragment.getFeedbackDefinitions())) {
					feedbacks[id] = {
						...feedback,
						sortKey: feedback.sortKey ?? null,
						hasLifecycleFunctions: false,
						showInvert: feedback.showInvert ?? false,
						hasLearn: feedback.hasLearn ?? false,
						learnTimeout: feedback.learnTimeout,

						actionHasResult: undefined,

						entityType: EntityModelType.Feedback,
						showButtonPreview: feedback.showButtonPreview ?? false,
						supportsChildGroups: feedback.supportsChildGroups ?? [],
						feedbackAffectedProperties: feedback.feedbackAffectedProperties ?? undefined,
						feedbackDisableStyleOverrides: feedback.feedbackDisableStyleOverrides ?? false,

						optionsSupportExpressions: feedback.optionsSupportExpressions ?? false,

						// Always monitor everything
						optionsToMonitorForInvalidations: null,
					} satisfies Complete<ClientEntityDefinition>
				}
			}
		}

		this.#instanceDefinitions.setFeedbackDefinitions('internal', feedbacks)
	}
	#regenerateVariables(): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		const variables = []

		for (const fragment of this.#fragments) {
			if ('getVariableDefinitions' in fragment && typeof fragment.getVariableDefinitions === 'function') {
				variables.push(...fragment.getVariableDefinitions())
			}
		}

		this.#variablesController.definitions.setVariableDefinitions('internal', variables)
	}

	/**
	 * The render clock has ticked, recompute any clock-sensitive feedbacks (e.g. those using oscillate())
	 */
	#onRenderClockTick(): void {
		if (!this.#initialized) return

		const newValues: NewFeedbackValue[] = []

		for (const [id, feedback] of this.#feedbacks) {
			if (!feedback.clockSensitive) continue

			newValues.push({
				entityId: id,
				controlId: feedback.controlId,
				value: this.#feedbackGetValue(feedback),
			})
		}

		if (newValues.length > 0) this.#controlsStore.updateFeedbackValues('internal', newValues)
	}

	onVariablesChanged(changedVariablesSet: ReadonlySet<string>, controlIdFilter: ReadonlySet<string> | null): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		const newValues: NewFeedbackValue[] = []

		// Lookup feedbacks
		for (const [id, feedback] of this.#feedbacks) {
			if (!feedback.referencedVariables || !feedback.referencedVariables.size) continue

			// If the change is scoped to specific control(s), only update feedbacks for those
			if (controlIdFilter && !controlIdFilter.has(feedback.controlId)) continue

			// Check a referenced variable was changed
			if (feedback.referencedVariables.isDisjointFrom(changedVariablesSet)) continue

			newValues.push({
				entityId: id,
				controlId: feedback.controlId,
				value: this.#feedbackGetValue(feedback),
			})
		}

		this.#controlsStore.updateFeedbackValues('internal', newValues)
	}

	/**
	 * The bind address has changed
	 */
	updateBindIp(bindIp: string, bindPort?: number): void {
		for (const fragment of this.#fragments) {
			if (fragment instanceof InternalSystem) {
				fragment.updateBindIp(bindIp, bindPort)
			}
		}
	}
}

/**
 * The `$(this:*)` overrides derived from an action's execution context. Shared by the parser for the
 * action's own options and by the one for its child feedbacks, so both see the same variables.
 */
function buildActionExecutionOverrides(extras: RunActionExtras): VariableValues {
	return {
		'this:surface_id': extras.surfaceId,
	}
}
