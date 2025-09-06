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

import type {
	ActionForVisitor,
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalVisitor,
	InternalFeedbackDefinition,
	InternalActionDefinition,
	ExecuteFeedbackResultWithReferences,
	InternalModuleFragmentEvents,
	FeedbackForInternalExecution,
	ActionForInternalExecution,
} from './Types.js'
import {
	ActionEntityModel,
	FeedbackEntitySubType,
	SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import type { IPageStore } from '../Page/Store.js'
import { isInternalUserValueFeedback, type ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { ControlEntityListPoolBase } from '../Controls/Entities/EntityListPoolBase.js'
import {
	CHOICES_LOCATION,
	convertOldLocationToExpressionOrValue,
	convertSimplePropertyToExpresionValue,
	ParseLocationString,
} from './Util.js'
import { EventEmitter } from 'events'
import type { ControlsController } from '../Controls/Controller.js'
import type { CompanionInputFieldDropdownExtended, ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'

const COMPARISON_OPERATION: CompanionInputFieldDropdownExtended = {
	type: 'dropdown',
	label: 'Operation',
	id: 'op',
	default: 'eq',
	choices: [
		{ id: 'eq', label: '=' },
		{ id: 'ne', label: '!=' },
		{ id: 'gt', label: '>' },
		{ id: 'lt', label: '<' },
	],
	disableAutoExpression: true,
}

function compareValues(op: any, value: any, value2: any): boolean {
	switch (op) {
		case 'gt':
			return value > parseFloat(value2)
		case 'lt':
			return value < parseFloat(value2)
		case 'ne':
			return value2 + '' != value + ''
		default:
			return value2 + '' == value + ''
	}
}

export class InternalVariables extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #controlsController: ControlsController
	readonly #pageStore: IPageStore

	constructor(controlsController: ControlsController, pageStore: IPageStore) {
		super()

		this.#controlsController = controlsController
		this.#pageStore = pageStore
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			variable_value: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Variable: Check value',
				description: 'Change style based on the value of a variable',
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'internal:variable',
						label: 'Variable',
						tooltip: 'What variable to act on?',
						id: 'variable',
						supportsLocal: true,
						disableAutoExpression: true,
					},
					COMPARISON_OPERATION,
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},

			variable_variable: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Variable: Compare two variables',
				description: 'Change style based on a variable compared to another variable',
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'internal:variable',
						label: 'Compare Variable',
						tooltip: 'What variable to act on?',
						id: 'variable',
						supportsLocal: true,
						disableAutoExpression: true,
					},
					COMPARISON_OPERATION,
					{
						type: 'internal:variable',
						label: 'Against Variable',
						tooltip: 'What variable to compare with?',
						id: 'variable2',
						supportsLocal: true,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},

			check_expression: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Variable: Check boolean expression',
				description: 'Change style based on a boolean expression',
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '2 > 1',
						useVariables: {
							local: true,
						},
						isExpression: true,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},

			expression_value: {
				feedbackType: FeedbackEntitySubType.Value,
				label: 'Evaluate Expression',
				description: 'A dynamic expression that can be used in other fields',
				feedbackStyle: undefined,
				showInvert: false,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '2 > 1',
						useVariables: {
							local: true,
						},
						isExpression: true,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},
			user_value: {
				feedbackType: FeedbackEntitySubType.Value,
				label: 'User Value',
				description: 'A value that can be used in other fields',
				feedbackStyle: undefined,
				showInvert: false,
				options: [
					{
						type: 'textinput',
						label: 'Startup Value',
						id: 'startup_value',
						default: '1',
						isVisibleUi: {
							type: 'expression',
							fn: '!$(options:persist_value)',
						},
						disableAutoExpression: true,
					},
					{
						type: 'checkbox',
						label: 'Persist value',
						tooltip: 'If enabled, variable value will be saved and restored when Companion restarts.',
						id: 'persist_value',
						default: false,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},
		}
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			local_variable_set_value: {
				label: 'Local Variable: Set value',
				description: undefined,
				options: [
					CHOICES_LOCATION,
					{
						type: 'textinput',
						label: 'Local variable',
						id: 'name',
					},
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						description: 'The raw value will be written to the variable',
						expressionDescription: 'The expression will be executed with the result written to the variable',
					},
				],
				internalUsesAutoParser: true,
			},

			local_variable_reset_to_default: {
				label: 'Local Variable: Reset to startup value',
				description: undefined,
				options: [
					CHOICES_LOCATION,
					{
						type: 'textinput',
						label: 'Local variable',
						id: 'name',
					},
				],
				internalUsesAutoParser: true,
			},
			local_variable_sync_to_default: {
				label: 'Local Variable: Write current value to startup value',
				description: undefined,
				options: [
					CHOICES_LOCATION,
					{
						type: 'textinput',
						label: 'Local variable',
						id: 'name',
					},
				],
				internalUsesAutoParser: true,
			},
		}
	}

	/**
	 * Get an updated value for a feedback
	 */
	executeFeedback(
		feedback: FeedbackForInternalExecution,
		parser: VariablesAndExpressionParser
	): boolean | ExecuteFeedbackResultWithReferences | void {
		if (feedback.definitionId == 'variable_value') {
			const result = parser.parseVariables(`$(${feedback.options.variable})`)

			return {
				value: compareValues(feedback.options.op, result.text, feedback.options.value),
				referencedVariables: Array.from(result.variableIds),
			}
		} else if (feedback.definitionId == 'variable_variable') {
			const result1 = parser.parseVariables(`$(${feedback.options.variable})`)
			const result2 = parser.parseVariables(`$(${feedback.options.variable2})`)

			return {
				value: compareValues(feedback.options.op, result1.text, result2.text),
				referencedVariables: [...result1.variableIds, ...result2.variableIds],
			}
		} else if (feedback.definitionId == 'check_expression') {
			return !!feedback.options.expression
		} else if (feedback.definitionId == 'expression_value') {
			return feedback.options.expression as any
		} else if (feedback.definitionId == 'user_value') {
			// Not used
			return false
		}
	}

	actionUpgrade(action: ActionEntityModel, _controlId: string): void | ActionEntityModel {
		let changed = false

		if (action.definitionId === 'local_variable_set_value') {
			changed = convertOldLocationToExpressionOrValue(action.options) || changed
			changed = convertSimplePropertyToExpresionValue(action.options, 'name') || changed
			changed = convertSimplePropertyToExpresionValue(action.options, 'value') || changed
		} else if (action.definitionId === 'local_variable_set_expression') {
			changed = convertOldLocationToExpressionOrValue(action.options) || changed
			changed = convertSimplePropertyToExpresionValue(action.options, 'name') || changed

			// Rename to the combined action
			action.definitionId = 'local_variable_set_value'
			action.options.value = {
				isExpression: true,
				value: action.options.expression,
			} satisfies ExpressionOrValue<any>
			delete action.options.expression

			changed = true
		} else if (
			action.definitionId === 'local_variable_reset_to_default' ||
			action.definitionId === 'local_variable_sync_to_default'
		) {
			changed = convertOldLocationToExpressionOrValue(action.options) || changed
			changed = convertSimplePropertyToExpresionValue(action.options, 'name') || changed
		}

		if (changed) return action
	}

	#fetchLocationAndControlIdNew(
		options: Record<string, any>,
		extras: RunActionExtras | FeedbackForInternalExecution
	): {
		theControlId: string | null
		theLocation: ControlLocation | null
	} {
		const location = ParseLocationString(String(options.location), extras.location)
		const theControlId = location ? this.#pageStore.getControlIdAt(location) : null

		return {
			theControlId,
			theLocation: location,
		}
	}

	#updateLocalVariableValue(
		action: ActionForInternalExecution,
		extras: RunActionExtras,
		updateValue: (
			entityPool: ControlEntityListPoolBase,
			listId: SomeSocketEntityLocation,
			variableEntity: ControlEntityInstance
		) => void
	) {
		if (!action.options.name) return

		const { theControlId } = this.#fetchLocationAndControlIdNew(action.options, extras)
		if (!theControlId) return

		const control = this.#controlsController.getControl(theControlId)
		if (!control || !control.supportsEntities) return

		const variableEntity = control.entities
			.getAllEntities()
			.find((ent) => ent.rawLocalVariableName === action.options.name)
		if (!variableEntity) return

		const localVariableName = variableEntity.localVariableName
		if (!localVariableName) return

		if (!isInternalUserValueFeedback(variableEntity)) return

		updateValue(control.entities, 'local-variables', variableEntity) // TODO - dynamic listId
	}

	executeAction(action: ActionForInternalExecution, extras: RunActionExtras): boolean {
		if (action.definitionId === 'local_variable_set_value') {
			this.#updateLocalVariableValue(action, extras, (entityPool, listId, variableEntity) => {
				entityPool.entitySetVariableValue(listId, variableEntity.id, action.options.value)
			})

			return true
		} else if (action.definitionId === 'local_variable_reset_to_default') {
			this.#updateLocalVariableValue(action, extras, (entityPool, listId, variableEntity) => {
				entityPool.entitySetVariableValue(listId, variableEntity.id, variableEntity.rawOptions.startup_value)
			})

			return true
		} else if (action.definitionId === 'local_variable_sync_to_default') {
			this.#updateLocalVariableValue(action, extras, (entityPool, listId, variableEntity) => {
				entityPool.entrySetOptions(listId, variableEntity.id, 'startup_value', variableEntity.feedbackValue)
			})

			return true
		}
		return false
	}

	/**
	 *
	 */
	visitReferences(visitor: InternalVisitor, _actions: ActionForVisitor[], feedbacks: FeedbackForVisitor[]): void {
		for (const feedback of feedbacks) {
			try {
				// check_expression.expression handled by generic options visitor

				if (feedback.type === 'variable_value') {
					visitor.visitVariableName(feedback.options, 'variable', feedback.id)
				} else if (feedback.type === 'variable_variable') {
					visitor.visitVariableName(feedback.options, 'variable', feedback.id)
					visitor.visitVariableName(feedback.options, 'variable2', feedback.id)
				}
			} catch (_e) {
				//Ignore
			}
		}
	}
}
