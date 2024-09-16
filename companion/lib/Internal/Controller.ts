/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import { CoreBase } from '../Core/Base.js'
import { InternalActionRecorder } from './ActionRecorder.js'
import { InternalBuildingBlocks } from './BuildingBlocks.js'
import { InternalInstance } from './Instance.js'
import { InternalTime } from './Time.js'
import { InternalControls } from './Controls.js'
import { InternalCustomVariables } from './CustomVariables.js'
import { InternalSurface } from './Surface.js'
import { InternalSystem } from './System.js'
import { InternalTriggers } from './Triggers.js'
import { InternalVariables } from './Variables.js'
import { cloneDeep } from 'lodash-es'
import { InternalPage } from './Page.js'
import { ParseInternalControlReference } from './Util.js'
import type { Registry } from '../Registry.js'
import type {
	ActionDefinition,
	FeedbackDefinition,
	FeedbackForVisitor,
	FeedbackInstanceExt,
	InternalModuleFragment,
	InternalVisitor,
} from './Types.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { FragmentFeedbackInstance } from '../Controls/Fragments/FragmentFeedbackInstance.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'
import type { NewFeedbackValue } from '../Controls/Controller.js'
import type { VariablesCache } from '../Variables/Util.js'
import type { ParseVariablesResult } from '../Variables/Util.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'

export class InternalController extends CoreBase {
	readonly #feedbacks = new Map<string, import('./Types.js').FeedbackInstanceExt>()

	readonly #buildingBlocksFragment: InternalBuildingBlocks

	readonly fragments: InternalModuleFragment[]

	constructor(registry: Registry) {
		super(registry, 'Internal/Controller')

		this.#buildingBlocksFragment = new InternalBuildingBlocks()

		this.fragments = [
			new InternalActionRecorder(this, registry.controls.actionRecorder, registry.page),
			this.#buildingBlocksFragment,
			new InternalInstance(this, registry.instance),
			new InternalTime(this),
			new InternalControls(this, registry.graphics, registry.controls, registry.page, registry.variables.values),
			new InternalCustomVariables(this, registry.variables),
			new InternalPage(this, registry.page),
			new InternalSurface(this, registry.surfaces, registry.controls, registry.page),
			new InternalSystem(this, registry),
			new InternalTriggers(this, registry.controls),
			new InternalVariables(this, registry.variables.values),
		]

		// Set everything up
		this.#regenerateActions()
		this.#regenerateFeedbacks()
		this.regenerateVariables()
	}

	init(): void {
		// Find all the feedbacks on controls
		const allControls = this.registry.controls.getAllControls()
		for (const [controlId, control] of allControls.entries()) {
			// Discover feedbacks to process
			if (control.supportsFeedbacks) {
				for (let feedback of control.feedbacks.getFlattenedFeedbackInstances('internal')) {
					if (control.feedbacks.feedbackReplace) {
						const newFeedback = this.feedbackUpgrade(feedback, controlId)
						if (newFeedback) {
							feedback = newFeedback
							control.feedbacks.feedbackReplace(newFeedback)
						}
					}

					this.feedbackUpdate(feedback, controlId)
				}
			}

			// Discover actions to process
			if (control.supportsActions) {
				const actions = control.getAllActions()

				for (const action of actions) {
					if (action.instance === 'internal') {
						// Try and run an upgrade
						const newAction = this.actionUpgrade(action, controlId)
						if (newAction) {
							control.actionReplace(newAction)
						}
					}
				}
			}
		}

		// Make all variables values
		for (const fragment of this.fragments) {
			if ('updateVariables' in fragment && typeof fragment.updateVariables === 'function') {
				fragment.updateVariables()
			}
		}
	}

	/**
	 * Perform an upgrade for an action
	 * @param action
	 * @param controlId
	 * @returns Updated action if any changes were made
	 */
	actionUpgrade(action: ActionInstance, controlId: string): ActionInstance | undefined {
		for (const fragment of this.fragments) {
			if ('actionUpgrade' in fragment && typeof fragment.actionUpgrade === 'function') {
				try {
					const newAction = fragment.actionUpgrade(action, controlId)
					if (newAction !== undefined) {
						// newAction.actionId = newAction.action
						// It was handled, so break
						return newAction
					}
				} catch (e: any) {
					this.logger.silly(
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
	feedbackUpgrade(feedback: FeedbackInstance, controlId: string): FeedbackInstance | undefined {
		for (const fragment of this.fragments) {
			if ('feedbackUpgrade' in fragment && typeof fragment.feedbackUpgrade === 'function') {
				try {
					const newFeedback = fragment.feedbackUpgrade(feedback, controlId)
					if (newFeedback !== undefined) {
						// newFeedback.feedbackId = newFeedback.type
						// It was handled, so break
						return newFeedback
					}
				} catch (e: any) {
					this.logger.silly(
						`Feedback upgrade failed: ${JSON.stringify(feedback)}(${controlId}) - ${e?.message ?? e} ${e?.stack}`
					)
				}
			}
		}

		return undefined
	}

	/**
	 * A feedback has changed, and state should be updated
	 */
	feedbackUpdate(feedback: FeedbackInstance, controlId: string): void {
		if (feedback.instance_id !== 'internal') throw new Error(`Feedback is not for internal instance`)
		if (feedback.disabled) return

		const location = this.page.getLocationOfControlId(controlId)

		const cloned: FeedbackInstanceExt = {
			...cloneDeep(feedback),
			controlId,
			location,
			referencedVariables: null,
		}
		this.#feedbacks.set(feedback.id, cloned)

		this.registry.controls.updateFeedbackValues('internal', [
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
	feedbackDelete(feedback: FeedbackInstance): void {
		if (feedback.instance_id !== 'internal') throw new Error(`Feedback is not for internal instance`)

		this.#feedbacks.delete(feedback.id)

		for (const fragment of this.fragments) {
			if ('forgetFeedback' in fragment && typeof fragment.forgetFeedback === 'function') {
				try {
					fragment.forgetFeedback(feedback)
				} catch (e: any) {
					this.logger.silly(`Feedback forget failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
				}
			}
		}
	}
	/**
	 * Get an updated value for a feedback
	 */
	#feedbackGetValue(feedback: FeedbackInstanceExt): any {
		for (const fragment of this.fragments) {
			if ('executeFeedback' in fragment && typeof fragment.executeFeedback === 'function') {
				/** @type {} */
				let value: ReturnType<Required<InternalModuleFragment>['executeFeedback']> | undefined
				try {
					value = fragment.executeFeedback(feedback)
				} catch (e: any) {
					this.logger.silly(`Feedback check failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
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
	visitReferences(
		visitor: InternalVisitor,
		actions: ActionInstance[],
		rawFeedbacks: FeedbackInstance[],
		feedbacks: FragmentFeedbackInstance[]
	): void {
		const internalActions = actions.filter((a) => a.instance === 'internal')

		const simpleInternalFeedbacks: FeedbackForVisitor[] = []

		for (const feedback of rawFeedbacks) {
			if (feedback.instance_id !== 'internal') continue
			simpleInternalFeedbacks.push(feedback)
		}
		for (const feedback of feedbacks) {
			if (feedback.connectionId !== 'internal') continue
			const feedbackInstance = feedback.asFeedbackInstance()
			simpleInternalFeedbacks.push({
				id: feedbackInstance.id,
				type: feedbackInstance.type,
				options: feedback.rawOptions, // Ensure the options is not a copy/clone
			})
		}

		for (const fragment of this.fragments) {
			if ('visitReferences' in fragment && typeof fragment.visitReferences === 'function') {
				fragment.visitReferences(visitor, internalActions, simpleInternalFeedbacks)
			}
		}
	}

	/**
	 * Run a single internal action
	 */
	executeAction(action: ActionInstance, extras: RunActionExtras): void {
		for (const fragment of this.fragments) {
			if ('executeAction' in fragment && typeof fragment.executeAction === 'function') {
				try {
					if (fragment.executeAction(action, extras)) {
						// It was handled, so break
						return
					}
				} catch (e: any) {
					this.logger.warn(
						`Action execute failed: ${JSON.stringify(action)}(${JSON.stringify(extras)}) - ${e?.message ?? e} ${
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
	executeLogicFeedback(feedback: FeedbackInstance, childValues: boolean[]): boolean {
		return this.#buildingBlocksFragment.executeLogicFeedback(feedback, childValues)
	}

	/**
	 * Set internal variable values
	 */
	setVariables(variables: Record<string, CompanionVariableValue | undefined>): void {
		this.registry.variables.values.setVariableValues('internal', variables)
	}
	/**
	 * Recheck all feedbacks of specified types
	 */
	checkFeedbacks(...types: string[]): void {
		const typesSet = new Set(types)

		const newValues: NewFeedbackValue[] = []

		for (const [id, feedback] of this.#feedbacks.entries()) {
			if (typesSet.size === 0 || typesSet.has(feedback.type)) {
				newValues.push({
					id: id,
					controlId: feedback.controlId,
					value: this.#feedbackGetValue(feedback),
				})
			}
		}

		this.registry.controls.updateFeedbackValues('internal', newValues)
	}
	/**
	 * Recheck all feedbacks of specified id
	 */
	checkFeedbacksById(...ids: string[]): void {
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

		this.registry.controls.updateFeedbackValues('internal', newValues)
	}
	#regenerateActions(): void {
		let actions: Record<string, ActionDefinition> = {}

		for (const fragment of this.fragments) {
			if ('getActionDefinitions' in fragment && typeof fragment.getActionDefinitions === 'function') {
				for (const [id, action] of Object.entries(fragment.getActionDefinitions())) {
					actions[id] = {
						...action,
						hasLearn: action.hasLearn ?? false,
						learnTimeout: action.learnTimeout,
					}
				}
			}
		}

		this.registry.instance.definitions.setActionDefinitions('internal', actions)
	}
	#regenerateFeedbacks(): void {
		let feedbacks: Record<string, FeedbackDefinition> = {}

		for (const fragment of this.fragments) {
			if ('getFeedbackDefinitions' in fragment && typeof fragment.getFeedbackDefinitions === 'function') {
				for (const [id, feedback] of Object.entries(fragment.getFeedbackDefinitions())) {
					feedbacks[id] = {
						...feedback,
						showInvert: feedback.showInvert ?? false,
						hasLearn: feedback.hasLearn ?? false,
						learnTimeout: feedback.learnTimeout,
					}
				}
			}
		}

		this.registry.instance.definitions.setFeedbackDefinitions('internal', feedbacks)
	}
	regenerateVariables(): void {
		const variables = []

		for (const fragment of this.fragments) {
			if ('getVariableDefinitions' in fragment && typeof fragment.getVariableDefinitions === 'function') {
				variables.push(...fragment.getVariableDefinitions())
			}
		}

		this.registry.variables.definitions.setVariableDefinitions('internal', variables)
	}

	variablesChanged(all_changed_variables_set: Set<string>): void {
		// Inform all fragments
		for (const fragment of this.fragments) {
			if ('variablesChanged' in fragment && typeof fragment.variablesChanged === 'function') {
				fragment.variablesChanged(all_changed_variables_set)
			}
		}

		const newValues: NewFeedbackValue[] = []

		// Lookup feedbacks
		for (const [id, feedback] of this.#feedbacks.entries()) {
			if (!feedback.referencedVariables || !feedback.referencedVariables.length) continue

			// Check a referenced variable was changed
			if (!feedback.referencedVariables.some((variable) => all_changed_variables_set.has(variable))) continue

			newValues.push({
				id: id,
				controlId: feedback.controlId,
				value: this.#feedbackGetValue(feedback),
			})
		}

		this.registry.controls.updateFeedbackValues('internal', newValues)
	}

	/**
	 * Parse the variables in a string
	 * @param str - String to parse variables in
	 * @param extras
	 * @param injectedVariableValues - Inject some variable values
	 * @returns with variables replaced with values
	 */
	parseVariablesForInternalActionOrFeedback(
		str: string,
		extras: RunActionExtras | FeedbackInstanceExt,
		injectedVariableValues?: VariablesCache
	): ParseVariablesResult {
		const injectedVariableValuesComplete = {
			...('id' in extras ? {} : this.#getInjectedVariablesForLocation(extras)),
			...injectedVariableValues,
		}
		return this.variablesController.values.parseVariables(str, extras?.location, injectedVariableValuesComplete)
	}

	/**
	 * Parse and execute an expression in a string
	 * @param str - String containing the expression to parse
	 * @param extras
	 * @param requiredType - Fail if the result is not of specified type
	 * @param injectedVariableValues - Inject some variable values
	 * @returns result of the expression
	 */
	executeExpressionForInternalActionOrFeedback(
		str: string,
		extras: RunActionExtras | FeedbackInstanceExt,
		requiredType?: string,
		injectedVariableValues?: CompanionVariableValues
	): { value: boolean | number | string | undefined; variableIds: Set<string> } {
		const injectedVariableValuesComplete = {
			...('id' in extras ? {} : this.#getInjectedVariablesForLocation(extras)),
			...injectedVariableValues,
		}
		return this.variablesController.values.executeExpression(
			str,
			extras.location,
			requiredType,
			injectedVariableValuesComplete
		)
	}

	/**
	 *
	 */
	parseInternalControlReferenceForActionOrFeedback(
		extras: RunActionExtras | FeedbackInstanceExt,
		options: Record<string, any>,
		useVariableFields: boolean
	): {
		location: ControlLocation | null
		referencedVariables: string[]
	} {
		const injectedVariableValues = 'id' in extras ? undefined : this.#getInjectedVariablesForLocation(extras)

		return ParseInternalControlReference(
			this.logger,
			this.variablesController.values,
			extras.location,
			options,
			useVariableFields,
			injectedVariableValues
		)
	}

	/**
	 * Variables to inject based on an internal action
	 */
	#getInjectedVariablesForLocation(extras: RunActionExtras): CompanionVariableValues {
		return {
			// Doesn't need to be reactive, it's only for an action
			'$(this:surface_id)': extras.surfaceId,
		}
	}
}
