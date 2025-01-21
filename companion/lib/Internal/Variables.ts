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
import type { InternalController } from './Controller.js'
import type { VariablesValues } from '../Variables/Values.js'
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	FeedbackInstanceExt,
	InternalModuleFragment,
	InternalVisitor,
	InternalFeedbackDefinition,
} from './Types.js'
import type { CompanionInputFieldDropdown } from '@companion-module/base'

const COMPARISON_OPERATION: CompanionInputFieldDropdown = {
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

export class InternalVariables implements InternalModuleFragment {
	readonly #internalModule: InternalController
	readonly #variableController: VariablesValues

	/**
	 * The dependencies of variables that should retrigger each feedback
	 */
	#variableSubscriptions = new Map<string, string[]>()

	constructor(internalModule: InternalController, variableController: VariablesValues) {
		this.#internalModule = internalModule
		this.#variableController = variableController
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			variable_value: {
				type: 'boolean',
				label: 'Variable: Check value',
				description: 'Change style based on the value of a variable',
				style: {
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
					},
					COMPARISON_OPERATION,
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
					},
				],

				// TODO
				// learn: (fb) => {
				// 	let value = ''
				// 	const id = fb.options.variable.split(':')
				// 	self.system.emit('variable_get', id[0], id[1], (v) => (value = v))

				// 	return {
				// 		...fb.options,
				// 		value: value,
				// 	}
				// },
			},

			variable_variable: {
				type: 'boolean',
				label: 'Variable: Compare two variables',
				description: 'Change style based on a variable compared to another variable',
				style: {
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
					},
					COMPARISON_OPERATION,
					{
						type: 'internal:variable',
						label: 'Against Variable',
						tooltip: 'What variable to compare with?',
						id: 'variable2',
					},
				],
			},

			check_expression: {
				type: 'boolean',
				label: 'Variable: Check boolean expression',
				description: 'Change style based on a boolean expression',
				style: {
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
					},
				],
			},
		}
	}

	/**
	 * Get an updated value for a feedback
	 */
	executeFeedback(feedback: FeedbackInstanceExt): boolean | void {
		if (feedback.type == 'variable_value') {
			const result = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				`$(${feedback.options.variable})`,
				feedback
			)

			this.#variableSubscriptions.set(feedback.id, result.variableIds)

			return compareValues(feedback.options.op, result.text, feedback.options.value)
		} else if (feedback.type == 'variable_variable') {
			const result1 = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				`$(${feedback.options.variable})`,
				feedback
			)
			const result2 = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				`$(${feedback.options.variable2})`,
				feedback
			)

			this.#variableSubscriptions.set(feedback.id, [...result1.variableIds, ...result2.variableIds])

			return compareValues(feedback.options.op, result1.text, result2.text)
		} else if (feedback.type == 'check_expression') {
			const res = this.#variableController.executeExpression(feedback.options.expression, feedback.location, 'boolean')

			this.#variableSubscriptions.set(feedback.id, Array.from(res.variableIds))

			if (res.ok) {
				return !!res.value
			} else {
				const logger = LogController.createLogger(`Internal/Variables/${feedback.controlId}`)
				logger.warn(`Failed to execute expression "${feedback.options.expression}": ${res.error}`)

				return false
			}
		}
	}

	forgetFeedback(feedback: FeedbackInstanceExt): void {
		this.#variableSubscriptions.delete(feedback.id)
	}

	/**
	 * Some variables have been changed
	 */
	variablesChanged(all_changed_variables_set: Set<string>): void {
		/**
		 * Danger: It is important to not do any debounces here.
		 * Doing so will cause triggers which are 'on variable change' with a condition to check the variable value to break
		 */

		const affected_ids: string[] = []
		for (const [id, names] of this.#variableSubscriptions.entries()) {
			for (const name of names) {
				if (all_changed_variables_set.has(name)) {
					affected_ids.push(id)
					break
				}
			}
		}
		if (affected_ids.length > 0) {
			this.#internalModule.checkFeedbacksById(...affected_ids)
		}
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
			} catch (e) {
				//Ignore
			}
		}
	}
}
