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
import { cloneDeep } from 'lodash-es'
import { InternalModuleUtils } from './Util.js'
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	FeedbackEntityModelExt,
	InternalModuleFragment,
	InternalVisitor,
} from './Types.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import type { CompanionVariableValue } from '@companion-module/base'
import type { ControlsController, NewFeedbackValue } from '../Controls/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import type { IPageStore } from '../Page/Store.js'
import LogController from '../Log/Controller.js'
import {
	ActionEntityModel,
	EntityModelType,
	FeedbackEntityModel,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { Complete } from '@companion-module/base/dist/util.js'
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

export class InternalController {
	readonly #logger = LogController.createLogger('Internal/Controller')

	readonly #controlsController: ControlsController
	readonly #pageStore: IPageStore
	readonly #instanceDefinitions: InstanceDefinitions
	readonly #variablesController: VariablesController

	readonly #feedbacks = new Map<string, FeedbackEntityModelExt>()

	readonly #buildingBlocksFragment: InternalBuildingBlocks
	readonly #fragments: InternalModuleFragment[]

	#initialized = false

	constructor(
		controlsController: ControlsController,
		pageStore: IPageStore,
		instanceController: InstanceController,
		variablesController: VariablesController,
		surfaceController: SurfaceController,
		graphicsController: GraphicsController,
		requestExit: (fromInternal: boolean, restart: boolean) => void
	) {
		this.#controlsController = controlsController
		this.#pageStore = pageStore
		this.#instanceDefinitions = instanceController.definitions
		this.#variablesController = variablesController

		const internalUtils = new InternalModuleUtils(controlsController)

		this.#buildingBlocksFragment = new InternalBuildingBlocks(internalUtils)
		this.#fragments = [
			this.#buildingBlocksFragment,
			new InternalActionRecorder(internalUtils, controlsController.actionRecorder, pageStore),
			new InternalInstance(internalUtils, instanceController),
			new InternalTime(internalUtils),
			new InternalControls(internalUtils, graphicsController, controlsController, pageStore),
			new InternalCustomVariables(internalUtils, variablesController),
			new InternalPage(internalUtils, pageStore),
			new InternalSurface(internalUtils, surfaceController, controlsController, pageStore),
			new InternalSystem(internalUtils, variablesController, requestExit),
			new InternalTriggers(internalUtils, controlsController),
			new InternalVariables(internalUtils, controlsController, pageStore),
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
		for (const [controlId, control] of allControls.entries()) {
			if (!control.supportsEntities) continue

			const allEntities = control.entities.getAllEntities()
			for (const entity of allEntities) {
				if (entity.connectionId !== 'internal') continue

				this.entityUpdate(entity.asEntityModel(), controlId)
			}
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
				} catch (e: any) {
					this.#logger.silly(
						`Action upgrade failed: ${JSON.stringify(action)}(${controlId}) - ${e?.message ?? e} ${e?.stack}`
					)
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
				} catch (e: any) {
					this.#logger.silly(
						`Feedback upgrade failed: ${JSON.stringify(feedback)}(${controlId}) - ${e?.message ?? e} ${e?.stack}`
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

		const cloned: FeedbackEntityModelExt = {
			...cloneDeep(feedback),
			controlId,
			location,
			referencedVariables: null,
		}
		this.#feedbacks.set(feedback.id, cloned)

		this.#controlsController.updateFeedbackValues('internal', [
			{
				id: feedback.id,
				controlId: controlId,
				value: this.#feedbackGetValue(cloned),
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
				} catch (e: any) {
					this.#logger.silly(`Feedback forget failed: ${JSON.stringify(entity)} - ${e?.message ?? e} ${e?.stack}`)
				}
			}
		}
	}
	/**
	 * Get an updated value for a feedback
	 */
	#feedbackGetValue(feedback: FeedbackEntityModelExt): any {
		for (const fragment of this.#fragments) {
			if ('executeFeedback' in fragment && typeof fragment.executeFeedback === 'function') {
				let value: ReturnType<Required<InternalModuleFragment>['executeFeedback']> | undefined
				try {
					value = fragment.executeFeedback(feedback)
				} catch (e: any) {
					this.#logger.silly(`Feedback check failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
				}

				if (value && typeof value === 'object' && 'referencedVariables' in value) {
					feedback.referencedVariables = value.referencedVariables

					return value.value
				} else if (value !== undefined) {
					feedback.referencedVariables = null

					return value
				}
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

		for (const fragment of this.#fragments) {
			if ('executeAction' in fragment && typeof fragment.executeAction === 'function') {
				try {
					let value = fragment.executeAction(action, extras, this.#controlsController.actionRunner)
					// Only await if it is a promise, to avoid unnecessary async pauses
					value = value instanceof Promise ? await value : value

					if (value) {
						// It was handled, so break
						return
					}
				} catch (e: any) {
					this.#logger.warn(
						`Action execute failed: ${JSON.stringify(action.asEntityModel(false))}(${JSON.stringify(extras)}) - ${e?.message ?? e} ${
							e?.stack
						}`
					)
				}
			}
		}
	}

	/**
	 * Execute a logic feedback
	 */
	executeLogicFeedback(feedback: FeedbackEntityModel, childValues: boolean[]): boolean {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		return this.#buildingBlocksFragment.executeLogicFeedback(feedback, childValues)
	}

	/**
	 * Set internal variable values
	 */
	#setVariables(variables: Record<string, CompanionVariableValue | undefined>): void {
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
			if (typesSet.size === 0 || typesSet.has(feedback.definitionId)) {
				newValues.push({
					id: id,
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
					id: id,
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
						hasLearn: action.hasLearn ?? false,
						learnTimeout: action.learnTimeout,

						showButtonPreview: action.showButtonPreview ?? false,
						supportsChildGroups: action.supportsChildGroups ?? [],

						entityType: EntityModelType.Action,
						showInvert: false,
						feedbackType: null,
						feedbackStyle: undefined,
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
						showInvert: feedback.showInvert ?? false,
						hasLearn: feedback.hasLearn ?? false,
						learnTimeout: feedback.learnTimeout,

						entityType: EntityModelType.Feedback,
						showButtonPreview: feedback.showButtonPreview ?? false,
						supportsChildGroups: feedback.supportsChildGroups ?? [],
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

	onVariablesChanged(changedVariablesSet: Set<string>, fromControlId: string | null): void {
		if (!this.#initialized) throw new Error(`InternalController is not initialized`)

		// Inform all fragments
		for (const fragment of this.#fragments) {
			if (typeof fragment.onVariablesChanged === 'function') {
				fragment.onVariablesChanged(changedVariablesSet, fromControlId)
			}
		}

		const newValues: NewFeedbackValue[] = []

		// Lookup feedbacks
		for (const [id, feedback] of this.#feedbacks.entries()) {
			if (!feedback.referencedVariables || !feedback.referencedVariables.length) continue

			// If a specific control is specified, only update feedbacks for that control
			if (fromControlId && feedback.controlId !== fromControlId) continue

			// Check a referenced variable was changed
			if (!feedback.referencedVariables.some((variable) => changedVariablesSet.has(variable))) continue

			newValues.push({
				id: id,
				controlId: feedback.controlId,
				value: this.#feedbackGetValue(feedback),
			})
		}

		this.#controlsController.updateFeedbackValues('internal', newValues)
	}

	/**
	 * The bind address has changed
	 */
	updateBindIp(bindIp: string): void {
		for (const fragment of this.#fragments) {
			if (fragment instanceof InternalSystem) {
				fragment.updateBindIp(bindIp)
			}
		}
	}
}
