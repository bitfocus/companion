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

import { InternalBuildingBlocks } from './BuildingBlocks.js'
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalVisitor,
	FeedbackForInternalExecution,
	ActionForInternalExecution,
} from './Types.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type { VariableValue, VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { IControlStore } from '../Controls/IControlStore.js'
import type { ActionRunner } from '../Controls/ActionRunner.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import type { IPageStore } from '../Page/Store.js'
import LogController from '../Log/Controller.js'
import {
	EntityModelType,
	type FeedbackValue,
	type ActionEntityModel,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { CompanionOptionValues, Complete } from '@companion-module/base'
import { InternalSystem } from './System.js'
import type { VariableValueEntry } from '../Variables/Values.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import { InternalActionRecorder } from './ActionRecorder.js'
import { InternalInstance } from './Instance.js'
import { InternalTime } from './Time.js'
import { InternalControls } from './Controls.js'
import { InternalCustomVariables } from './CustomVariables.js'
import { InternalPage } from './Page.js'
import { InternalSurface } from './Surface.js'
import { InternalTriggers } from './Triggers.js'
import { InternalVariables } from './Variables.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'
import type EventEmitter from 'node:events'
import type { AppInfo } from '../Registry.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { convertExpressionOptionsWithoutParsing } from '@companion-app/shared/Model/Options.js'
import type { NewFeedbackValue } from '../Controls/Entities/Types.js'

interface FeedbackEntityState {
	controlId: string
	location: ControlLocation | undefined
	referencedVariables: Set<string> | null

	entityModel: FeedbackEntityModel
}

export class InternalController {
	readonly #logger = LogController.createLogger('Internal/Controller')

	readonly #controlsController: IControlStore
	readonly #actionRunner: ActionRunner
	readonly #pageStore: IPageStore
	readonly #instanceDefinitions: InstanceDefinitions
	readonly #variablesController: VariablesController

	readonly #feedbacks = new Map<string, FeedbackEntityState>()

	readonly #buildingBlocksFragment: InternalBuildingBlocks
	readonly #fragments: InternalModuleFragment[]

	#initialized = false

	constructor(
		appInfo: AppInfo,
		controlStore: IControlStore,
		controls: ControlsController,
		pageStore: IPageStore,
		instanceController: InstanceController,
		variablesController: VariablesController,
		surfaceController: SurfaceController,
		graphicsController: GraphicsController,
		userConfigController: DataUserConfig,
		controlEvents: EventEmitter<ControlCommonEvents>,
		requestExit: (fromInternal: boolean, restart: boolean) => void
	) {
		this.#controlsController = controlStore
		this.#actionRunner = controls.actionRunner
		this.#pageStore = pageStore
		this.#instanceDefinitions = instanceController.definitions
		this.#variablesController = variablesController

		this.#buildingBlocksFragment = new InternalBuildingBlocks()
		this.#fragments = [
			this.#buildingBlocksFragment,
			new InternalActionRecorder(controlStore.actionRecorder, pageStore),
			new InternalInstance(instanceController),
			new InternalTime(),
			new InternalControls(graphicsController, controlStore, pageStore, controlEvents),
			new InternalCustomVariables(variablesController),
			new InternalPage(pageStore),
			new InternalSurface(surfaceController, controlStore, pageStore),
			new InternalSystem(appInfo, userConfigController, variablesController, requestExit),
			new InternalTriggers(controls),
			new InternalVariables(controlStore, pageStore),
		]

		this.#init()
	}

	#init(): void {
		if (this.#initialized) throw new Error(`InternalController already initialized`)
		this.#initialized = true

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
		const allControls = this.#controlsController.getAllControls()
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

			entityModel: structuredClone(feedback),
		}
		this.#feedbacks.set(feedback.id, feedbackState)

		this.#controlsController.updateFeedbackValues('internal', [
			{
				entityId: feedback.id,
				controlId: controlId,
				value: this.#feedbackGetValue(feedbackState),
			},
		])
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
	 * Get an updated value for a feedback
	 */
	#feedbackGetValue(feedbackState: FeedbackEntityState): FeedbackValue {
		try {
			const entityDefinition = this.#instanceDefinitions.getEntityDefinition(
				EntityModelType.Feedback,
				'internal', // This is the internal instance code
				feedbackState.entityModel.definitionId
			)
			if (!entityDefinition) {
				// No definition found, so cannot evaluate
				feedbackState.referencedVariables = null

				return undefined
			}

			const parser = this.#controlsController.createVariablesAndExpressionParser(feedbackState.controlId, null)

			// Parse the options if enabled
			let parsedOptions: CompanionOptionValues
			if (entityDefinition.optionsSupportExpressions) {
				const parseRes = parser.parseEntityOptions(entityDefinition, feedbackState.entityModel.options)
				if (!parseRes.ok) {
					this.#logger.warn(
						`Failed to parse options for feedback ${feedbackState.entityModel.definitionId} in control ${feedbackState.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
					)
					throw new Error(
						`Failed to parse options for feedback ${feedbackState.entityModel.definitionId}. One or more options were invalid`
					)
				} else {
					parsedOptions = parseRes.parsedOptions
					feedbackState.referencedVariables = parseRes.referencedVariableIds
				}
			} else {
				parsedOptions = convertExpressionOptionsWithoutParsing(feedbackState.entityModel.options)
				feedbackState.referencedVariables = new Set<string>()
			}

			const executionFeedback: Complete<FeedbackForInternalExecution> = {
				controlId: feedbackState.controlId,
				location: feedbackState.location,

				options: parsedOptions,

				id: feedbackState.entityModel.id,
				definitionId: feedbackState.entityModel.definitionId,
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
						for (const variable of value.referencedVariables) {
							feedbackState.referencedVariables.add(variable)
						}

						return value.value
					} else if (value !== undefined) {
						return value
					}
				}
			}
		} catch (e) {
			this.#logger.warn(
				`Feedback get value failed: ${JSON.stringify(feedbackState.entityModel)} - ${stringifyError(e)}`
			)
			return undefined
		} finally {
			// If there are no referenced variables, set to null
			if (feedbackState.referencedVariables && feedbackState.referencedVariables.size === 0) {
				feedbackState.referencedVariables = null
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
	async executeAction(action: ControlEntityInstance, extras: RunActionExtras): Promise<void> {
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

			const overrideVariableValues: VariableValues = {
				'$(this:surface_id)': extras.surfaceId,
			}
			const parser = this.#controlsController.createVariablesAndExpressionParser(
				extras.controlId,
				overrideVariableValues
			)

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
					let value = fragment.executeAction(executionAction, extras, this.#actionRunner, parser)
					// Only await if it is a promise, to avoid unnecessary async pauses
					value = value instanceof Promise ? await value : value

					if (value) {
						// It was handled, so break
						return
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
	}

	/**
	 * Execute a logic feedback
	 */
	executeLogicFeedback(feedback: FeedbackEntityModel, isInverted: boolean, childValues: boolean[]): boolean {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

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

		this.#controlsController.updateFeedbackValues('internal', newValues)
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

		this.#controlsController.updateFeedbackValues('internal', newValues)
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

						showButtonPreview: action.showButtonPreview ?? false,
						supportsChildGroups: action.supportsChildGroups ?? [],

						entityType: EntityModelType.Action,
						showInvert: false,
						feedbackType: null,
						feedbackStyle: undefined,

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

						entityType: EntityModelType.Feedback,
						showButtonPreview: feedback.showButtonPreview ?? false,
						supportsChildGroups: feedback.supportsChildGroups ?? [],

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

	onVariablesChanged(changedVariablesSet: ReadonlySet<string>, fromControlId: string | null): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		const newValues: NewFeedbackValue[] = []

		// Lookup feedbacks
		for (const [id, feedback] of this.#feedbacks) {
			if (!feedback.referencedVariables || !feedback.referencedVariables.size) continue

			// If a specific control is specified, only update feedbacks for that control
			if (fromControlId && feedback.controlId !== fromControlId) continue

			// Check a referenced variable was changed
			if (feedback.referencedVariables.isDisjointFrom(changedVariablesSet)) continue

			newValues.push({
				entityId: id,
				controlId: feedback.controlId,
				value: this.#feedbackGetValue(feedback),
			})
		}

		this.#controlsController.updateFeedbackValues('internal', newValues)
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
