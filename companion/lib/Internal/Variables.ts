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
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	FeedbackEntityModelExt,
	InternalModuleFragment,
	InternalVisitor,
	InternalFeedbackDefinition,
} from './Types.js'
import type { CompanionInputFieldDropdown } from '@companion-module/base'
import type { FeedbackEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlsController } from '../Controls/Controller.js'

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
	readonly #controlsController: ControlsController

	/**
	 * The dependencies of variables that should retrigger each feedback
	 */
	#variableSubscriptions = new Map<string, { controlId: string; variables: Set<string> }>()

	constructor(internalModule: InternalController, controlsController: ControlsController) {
		this.#internalModule = internalModule
		this.#controlsController = controlsController
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			variable_value: {
				feedbackType: 'boolean',
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
				feedbackType: 'boolean',
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
				feedbackType: 'boolean',
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
					},
				],
			},
		}
	}

	/**
	 * Get an updated value for a feedback
	 */
	executeFeedback(feedback: FeedbackEntityModelExt): boolean | void {
		if (feedback.definitionId == 'variable_value') {
			const result = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				`$(${feedback.options.variable})`,
				feedback
			)

			this.#variableSubscriptions.set(feedback.id, { controlId: feedback.controlId, variables: result.variableIds })

			return compareValues(feedback.options.op, result.text, feedback.options.value)
		} else if (feedback.definitionId == 'variable_variable') {
			const result1 = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				`$(${feedback.options.variable})`,
				feedback
			)
			const result2 = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				`$(${feedback.options.variable2})`,
				feedback
			)

			this.#variableSubscriptions.set(feedback.id, {
				controlId: feedback.controlId,
				variables: new Set([...result1.variableIds, ...result2.variableIds]),
			})

			return compareValues(feedback.options.op, result1.text, result2.text)
		} else if (feedback.definitionId == 'check_expression') {
			const parser = this.#controlsController.createVariablesAndExpressionParser(feedback.location, null)
			const res = parser.executeExpression(feedback.options.expression, 'boolean')

			this.#variableSubscriptions.set(feedback.id, { controlId: feedback.controlId, variables: res.variableIds })

			if (res.ok) {
				return !!res.value
			} else {
				const logger = LogController.createLogger(`Internal/Variables/${feedback.controlId}`)
				logger.warn(`Failed to execute expression "${feedback.options.expression}": ${res.error}`)

				return false
			}
		}
	}

	forgetFeedback(feedback: FeedbackEntityModel): void {
		this.#variableSubscriptions.delete(feedback.id)
	}

	/**
	 * Some variables have been changed
	 */
	onVariablesChanged(changedVariablesSet: Set<string>, fromControlId: string | null): void {
		/**
		 * Danger: It is important to not do any debounces here.
		 * Doing so will cause triggers which are 'on variable change' with a condition to check the variable value to break
		 */

		const affectedFeedbackIds: string[] = []
		for (const [id, { controlId, variables }] of this.#variableSubscriptions.entries()) {
			// Skip if the changes are local variables from a different control
			if (fromControlId && controlId !== fromControlId) continue

			for (const name of variables) {
				if (changedVariablesSet.has(name)) {
					affectedFeedbackIds.push(id)
					break
				}
			}
		}
		if (affectedFeedbackIds.length > 0) {
			this.#internalModule.checkFeedbacksById(...affectedFeedbackIds)
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
