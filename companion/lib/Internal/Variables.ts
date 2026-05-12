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

import { EventEmitter } from 'node:events'
import { FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { CompanionInputFieldDropdownExtended } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type { LocalVariablesController } from '../Variables/LocalVariablesController.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import type {
	ActionForInternalExecution,
	ActionForVisitor,
	ExecuteFeedbackResultWithReferences,
	FeedbackForInternalExecution,
	FeedbackForVisitor,
	InternalActionDefinition,
	InternalFeedbackDefinition,
	InternalModuleFragment,
	InternalModuleFragmentEvents,
	InternalVisitor,
} from './Types.js'
import { CHOICES_LOCATION } from './Util.js'

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
	readonly #localVariables: LocalVariablesController

	constructor(localVariables: LocalVariablesController) {
		super()

		this.#localVariables = localVariables
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
				optionsSupportExpressions: true,
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
				optionsSupportExpressions: true,
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
						type: 'expression',
						label: 'Expression',
						id: 'expression',
						default: '2 > 1',
						disableAutoExpression: true,
						allowInvalidValues: true,
					},
				],
				optionsSupportExpressions: true,
			},

			expression_value: {
				feedbackType: FeedbackEntitySubType.Value,
				label: 'Evaluate Expression',
				description: 'A dynamic expression that can be used in other fields',
				feedbackStyle: undefined,
				showInvert: false,
				options: [
					{
						type: 'expression',
						label: 'Expression',
						id: 'expression',
						default: '2 > 1',
						disableAutoExpression: true,
						allowInvalidValues: true,
					},
				],
				optionsSupportExpressions: true,
			},
			user_value: {
				feedbackType: FeedbackEntitySubType.Value,
				label: 'User Value',
				description: 'A value that can be used in other fields',
				feedbackStyle: undefined,
				showInvert: false,
				options: [
					{
						type: 'checkbox',
						label: 'Persist value',
						tooltip: 'If enabled, variable value will be saved and restored when Companion restarts.',
						id: 'persist_value',
						default: false,
						disableAutoExpression: true,
					},
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
				],
				optionsSupportExpressions: true,
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
						allowInvalidValues: true,
						disableSanitisation: true,
					},
				],

				optionsSupportExpressions: true,
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
				optionsSupportExpressions: true,
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
				optionsSupportExpressions: true,
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
			const variableName = stringifyVariableValue(feedback.options.variable)
			if (!variableName) return false

			const result = parser.parseVariables(`$(${variableName})`)

			return {
				value: compareValues(feedback.options.op, result.text, stringifyVariableValue(feedback.options.value)),
				referencedVariables: result.variableIds,
			}
		} else if (feedback.definitionId == 'variable_variable') {
			const variableName1 = stringifyVariableValue(feedback.options.variable)
			const variableName2 = stringifyVariableValue(feedback.options.variable2)
			if (!variableName1 || !variableName2) return false

			const result1 = parser.parseVariables(`$(${variableName1})`)
			const result2 = parser.parseVariables(`$(${variableName2})`)

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

	executeAction(action: ActionForInternalExecution, extras: RunActionExtras): boolean {
		if (action.definitionId === 'local_variable_set_value') {
			const { location, name } = action.options
			const localVariable = this.#localVariables.localVariableFor(location, name, extras)
			if (!localVariable) return true

			this.#localVariables.setLocalVariable(localVariable, action.options.value)

			return true
		} else if (action.definitionId === 'local_variable_reset_to_default') {
			const { location, name } = action.options
			const localVariable = this.#localVariables.localVariableFor(location, name, extras)
			if (!localVariable) return true

			this.#localVariables.resetLocalVariable(localVariable)

			return true
		} else if (action.definitionId === 'local_variable_sync_to_default') {
			const { location, name } = action.options
			const localVariable = this.#localVariables.localVariableFor(location, name, extras)
			if (!localVariable) return true

			this.#localVariables.writeLocalVariableStartupValue(localVariable)

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
