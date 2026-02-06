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

import LogController from '../Log/Controller.js'
import type {
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalVisitor,
	InternalFeedbackDefinition,
	InternalActionDefinition,
	ActionForVisitor,
	InternalModuleFragmentEvents,
	ActionForInternalExecution,
} from './Types.js'
import type { ActionRunner } from '../Controls/ActionRunner.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { EventEmitter } from 'events'
import { setTimeout } from 'node:timers/promises'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'

export class InternalBuildingBlocks
	extends EventEmitter<InternalModuleFragmentEvents>
	implements InternalModuleFragment
{
	readonly #logger = LogController.createLogger('Internal/BuildingBlocks')

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			logic_operator: {
				feedbackType: FeedbackEntitySubType.Boolean,
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
						disableAutoExpression: true,
					},
				],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildGroups: [
					{
						type: EntityModelType.Feedback,
						feedbackListType: FeedbackEntitySubType.Boolean,
						groupId: 'default',
						entityTypeLabel: 'condition',
						label: '',
					},
				],
				optionsSupportExpressions: true,
			},

			logic_conditionalise_advanced: {
				feedbackType: FeedbackEntitySubType.Advanced,
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
						feedbackListType: FeedbackEntitySubType.Boolean,
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
				optionsSupportExpressions: true,
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
						disableAutoExpression: true,
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
				optionsSupportExpressions: true,
			},
			wait: {
				label: 'Wait',
				description: 'Wait for a specified amount of time',
				options: [
					{
						type: 'expression',
						label: 'Time expression (ms)',
						id: 'time',
						default: '1000',
						disableAutoExpression: true,
						allowInvalidValues: true,
					},
				],
				hasLearn: false,
				learnTimeout: undefined,
				optionsSupportExpressions: true,
			},
			logic_if: {
				label: 'Logic: If statement',
				description: 'Execute some actions if all of the configured conditions are true',
				options: [],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildGroups: [
					{
						type: EntityModelType.Feedback,
						feedbackListType: FeedbackEntitySubType.Boolean,
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
				optionsSupportExpressions: true,
			},
			logic_while: {
				label: 'Logic: While loop',
				description: 'Execute some actions repeatedly while all of the configured conditions are true',
				options: [],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildGroups: [
					{
						type: EntityModelType.Feedback,
						feedbackListType: FeedbackEntitySubType.Boolean,
						groupId: 'condition',
						label: 'While True',
						entityTypeLabel: 'condition',
					},
					{
						type: EntityModelType.Action,
						groupId: 'actions',
						label: 'Repeat',
						entityTypeLabel: 'action',
					},
				],
				optionsSupportExpressions: true,
			},
		}
	}

	/**
	 * Execute a logic feedback
	 */
	executeLogicFeedback(feedback: FeedbackEntityModel, isInverted: boolean, childValues: boolean[]): boolean {
		if (feedback.definitionId === 'logic_operator') {
			switch (
				feedback.options.operation?.value // This can't be an expression
			) {
				case 'and':
					return booleanAnd(isInverted, childValues)
				case 'or':
					return childValues.reduce((acc, val) => acc || val, false) === !isInverted
				case 'xor': {
					const isSingleTrue = childValues.reduce((acc, val) => acc + (val ? 1 : 0), 0) === 1
					return isSingleTrue === !isInverted
				}
				default:
					this.#logger.warn(`Unexpected operation: ${stringifyVariableValue(feedback.options.operation?.value)}`)
					return false
			}
		} else if (feedback.definitionId === 'logic_conditionalise_advanced') {
			return booleanAnd(isInverted, childValues)
		} else {
			this.#logger.warn(`Unexpected logic feedback type "${feedback.type}"`)
			return false
		}
	}

	executeAction(
		action: ActionForInternalExecution,
		extras: RunActionExtras,
		actionRunner: ActionRunner
	): Promise<boolean> | boolean {
		if (action.definitionId === 'wait') {
			if (extras.abortDelayed.aborted) return true

			const delay = Number(action.options.time)

			if (!isNaN(delay) && delay > 0) {
				// Perform the wait
				return setTimeout(delay, true, { signal: extras.abortDelayed }).catch(() => {
					this.#logger.debug(`Aborted wait on ${extras.location ? formatLocation(extras.location) : extras.controlId}`)

					// Discard error
					return true
				})
			} else {
				// No wait, return immediately
				return true
			}
		} else if (action.definitionId === 'action_group') {
			if (extras.abortDelayed.aborted) return true

			let executeSequential = false
			switch (action.options.execution_mode) {
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
					this.#logger.error(`Unknown execution mode: ${stringifyVariableValue(action.options.execution_mode)}`)
			}

			const newExtras: RunActionExtras = {
				...extras,
				executionMode: executeSequential ? 'sequential' : 'concurrent',
			}

			const childActions = action.rawEntity.getChildren('default')?.getDirectEntities() ?? []

			return actionRunner
				.runMultipleActions(childActions, newExtras, executeSequential)
				.catch((e) => {
					this.#logger.error(`Failed to run actions: ${e.message}`)
				})
				.then(() => true)
		} else if (action.definitionId === 'logic_if') {
			if (extras.abortDelayed.aborted) return true

			const conditionValues = action.rawEntity.getChildren('condition')?.getChildBooleanFeedbackValues() ?? []

			const executeGroup = booleanAnd(false, conditionValues) ? 'actions' : 'else_actions'
			const childActions = action.rawEntity.getChildren(executeGroup)?.getDirectEntities() ?? []
			const executeSequential = extras.executionMode === 'sequential'

			return actionRunner
				.runMultipleActions(childActions, extras, executeSequential)
				.catch((e) => {
					this.#logger.error(`Failed to run actions: ${e.message}`)
				})
				.then(() => true)
		} else if (action.definitionId === 'logic_while') {
			if (extras.abortDelayed.aborted) return true

			return Promise.resolve().then(async () => {
				while (!extras.abortDelayed.aborted) {
					const conditionValues = action.rawEntity.getChildren('condition')?.getChildBooleanFeedbackValues() ?? []
					if (!booleanAnd(false, conditionValues)) break

					const childActions = action.rawEntity.getChildren('actions')?.getDirectEntities() ?? []
					const executeSequential = extras.executionMode === 'sequential'

					if (extras.abortDelayed.aborted) break

					await actionRunner.runMultipleActions(childActions, extras, executeSequential).catch((e) => {
						this.#logger.error(`Failed to run actions: ${e.message}`)
					})

					// Yield to event loop to prevent tight loop
					await setTimeout(1)
				}
				return true
			})
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
