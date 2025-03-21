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

import LogController from '../Log/Controller.js'
import type {
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalVisitor,
	InternalFeedbackDefinition,
	InternalActionDefinition,
	ActionForVisitor,
	InternalModuleFragmentEvents,
} from './Types.js'
import type { ActionRunner } from '../Controls/ActionRunner.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import { EntityModelType, FeedbackEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { InternalModuleUtils } from './Util.js'
import { EventEmitter } from 'events'

export class InternalBuildingBlocks
	extends EventEmitter<InternalModuleFragmentEvents>
	implements InternalModuleFragment
{
	readonly #logger = LogController.createLogger('Internal/BuildingBlocks')

	readonly #internalUtils: InternalModuleUtils

	constructor(internalUtils: InternalModuleUtils) {
		super()

		this.#internalUtils = internalUtils
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			logic_operator: {
				feedbackType: 'boolean',
				label: 'Logic: Operation',
				description: 'Combine multiple conditions',
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'dropdown',
						label: 'Operation',
						id: 'operation',
						default: 'and',
						choices: [
							{ id: 'and', label: 'AND' },
							{ id: 'or', label: 'OR' },
							{ id: 'xor', label: 'XOR' },
						],
					},
				],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildGroups: [
					{
						type: EntityModelType.Feedback,
						booleanFeedbacksOnly: true,
						groupId: 'default',
						entityTypeLabel: 'condition',
						label: '',
					},
				],
			},

			logic_conditionalise_advanced: {
				feedbackType: 'advanced',
				label: 'Conditionalise existing feedbacks',
				description: "Make 'advanced' feedbacks conditional",
				feedbackStyle: undefined,
				showInvert: false,
				options: [],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildGroups: [
					{
						type: EntityModelType.Feedback,
						booleanFeedbacksOnly: true,
						groupId: 'children',
						entityTypeLabel: 'condition',
						label: 'Condition',
						hint: 'This feedback will only execute when all of the conditions are true',
					},
					{
						type: EntityModelType.Feedback,
						groupId: 'feedbacks',
						entityTypeLabel: 'feedback',
						label: 'Feedbacks',
					},
				],
			},
		}
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			action_group: {
				label: 'Action Group',
				description: 'Execute a group of actions',
				options: [
					{
						type: 'dropdown',
						label: 'Execution mode',
						id: 'execution_mode',
						default: 'inherit',
						choices: [
							{ id: 'inherit', label: 'Inherit' },
							{ id: 'concurrent', label: 'Concurrent' },
							{ id: 'sequential', label: 'Sequential' },
						],
						tooltip:
							`Using "Sequential" will run the actions one after the other, waiting for each to complete before starting the next.\n` +
							`If the module doesn't support it for a particular action, the following action will start immediately.`,
					},
				],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildGroups: [
					{
						type: EntityModelType.Action,
						groupId: 'default',
						entityTypeLabel: 'action',
						label: '',
					},
				],
			},
			wait: {
				label: 'Wait',
				description: 'Wait for a specified amount of time',
				options: [
					{
						type: 'textinput',
						label: 'Time expression (ms)',
						id: 'time',
						default: '1000',
						useVariables: { local: true },
						isExpression: true,
					},
				],
				hasLearn: false,
				learnTimeout: undefined,
			},
			logic_if: {
				label: 'Logic: If statement',
				description: 'Execute some actions if a condition is true',
				options: [],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildGroups: [
					{
						type: EntityModelType.Feedback,
						booleanFeedbacksOnly: true,
						groupId: 'condition',
						label: 'When True',
						entityTypeLabel: 'condition',
					},
					{
						type: EntityModelType.Action,
						groupId: 'actions',
						label: 'Then',
						entityTypeLabel: 'action',
					},
					{
						type: EntityModelType.Action,
						groupId: 'else_actions',
						label: 'Else',
						entityTypeLabel: 'action',
					},
				],
			},
		}
	}

	feedbackUpgrade(feedback: FeedbackEntityModel, _controlId: string): FeedbackEntityModel | void {
		if (feedback.definitionId === 'logic_and') {
			feedback.definitionId = 'logic_operator'
			feedback.options = { operation: 'and' }

			return feedback
		} else if (feedback.definitionId === 'logic_or') {
			feedback.definitionId = 'logic_operator'
			feedback.options = { operation: 'or' }

			return feedback
		} else if (feedback.definitionId === 'logic_xor') {
			feedback.definitionId = 'logic_operator'
			feedback.options = { operation: 'xor' }

			return feedback
		}
	}

	/**
	 * Execute a logic feedback
	 */
	executeLogicFeedback(feedback: FeedbackEntityModel, childValues: boolean[]): boolean {
		if (feedback.definitionId === 'logic_operator') {
			switch (feedback.options.operation) {
				case 'and':
					return booleanAnd(!!feedback.isInverted, childValues)
				case 'or':
					return childValues.reduce((acc, val) => acc || val, false)
				case 'xor':
					const isSingleTrue = childValues.reduce((acc, val) => acc + (val ? 1 : 0), 0) === 1
					return isSingleTrue === !feedback.isInverted
				default:
					this.#logger.warn(`Unexpected operation: ${feedback.options.operation}`)
					return false
			}
		} else if (feedback.definitionId === 'logic_conditionalise_advanced') {
			return booleanAnd(!!feedback.isInverted, childValues)
		} else {
			this.#logger.warn(`Unexpected logic feedback type "${feedback.type}"`)
			return false
		}
	}

	executeAction(
		action: ControlEntityInstance,
		extras: RunActionExtras,
		actionRunner: ActionRunner
	): Promise<boolean> | boolean {
		if (action.definitionId === 'wait') {
			if (extras.abortDelayed.aborted) return true

			const expressionResult = this.#internalUtils.executeExpressionForInternalActionOrFeedback(
				action.rawOptions.time,
				extras,
				'number'
			)
			if (!expressionResult.ok) {
				this.#logger.error(`Failed to parse delay: ${expressionResult.error}`)
			}

			let delay = expressionResult.ok ? Number(expressionResult.value) : 0

			if (!isNaN(delay) && delay > 0) {
				// Perform the wait
				return new Promise((resolve) => setTimeout(resolve, delay)).then(() => true)
			} else {
				// No wait, return immediately
				return true
			}
		} else if (action.definitionId === 'action_group') {
			if (extras.abortDelayed.aborted) return true

			let executeSequential = false
			switch (action.rawOptions.execution_mode) {
				case 'sequential':
					executeSequential = true
					break
				case 'concurrent':
					executeSequential = false
					break
				case 'inherit':
					executeSequential = extras.executionMode === 'sequential'
					break
				default:
					this.#logger.error(`Unknown execution mode: ${action.rawOptions.execution_mode}`)
			}

			const newExtras: RunActionExtras = {
				...extras,
				executionMode: executeSequential ? 'sequential' : 'concurrent',
			}

			const childActions = action.getChildren('default')?.getDirectEntities() ?? []

			return actionRunner
				.runMultipleActions(childActions, newExtras, executeSequential)
				.catch((e) => {
					this.#logger.error(`Failed to run actions: ${e.message}`)
				})
				.then(() => true)
		} else if (action.definitionId === 'logic_if') {
			if (extras.abortDelayed.aborted) return true

			const conditionValues = action.getChildren('condition')?.getChildBooleanFeedbackValues() ?? []

			const executeGroup = booleanAnd(false, conditionValues) ? 'actions' : 'else_actions'
			const childActions = action.getChildren(executeGroup)?.getDirectEntities() ?? []
			const executeSequential = extras.executionMode === 'sequential'

			return actionRunner
				.runMultipleActions(childActions, extras, executeSequential)
				.catch((e) => {
					this.#logger.error(`Failed to run actions: ${e.message}`)
				})
				.then(() => true)
		} else {
			return false
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}

function booleanAnd(isInverted: boolean, childValues: boolean[]): boolean {
	if (childValues.length === 0) return isInverted

	return childValues.reduce((acc, val) => acc && val, true) === !isInverted
}
