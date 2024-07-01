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
import { rgb } from '../Resources/Util.js'

const COMPARISON_OPERATION = {
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

/**
 * @param {any} op
 * @param {any} value
 * @param {any} value2
 * @returns {boolean}
 */
function compareValues(op, value, value2) {
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

export default class Variables {
	#logger = LogController.createLogger('Internal/Variables')

	/**
	 * @type {import('./Controller.js').default}
	 * @readonly
	 */
	#internalModule

	/**
	 * @type {import('../Instance/Variable.js').default}
	 * @readonly
	 */
	#variableController

	/**
	 * The dependencies of variables that should retrigger each feedback
	 * @type {Map<string, string[]>}
	 */
	#variableSubscriptions = new Map()

	/**
	 * @param {import('./Controller.js').default} internalModule
	 * @param {import('../Instance/Variable.js').default} variableController
	 */
	constructor(internalModule, variableController) {
		this.#internalModule = internalModule
		this.#variableController = variableController
	}

	getFeedbackDefinitions() {
		return {
			variable_value: {
				type: 'boolean',
				label: 'Variable: Check value',
				description: 'Change style based on the value of a variable',
				style: {
					color: rgb(255, 255, 255),
					bgcolor: rgb(255, 0, 0),
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
					color: rgb(255, 255, 255),
					bgcolor: rgb(255, 0, 0),
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
					color: rgb(255, 255, 255),
					bgcolor: rgb(255, 0, 0),
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
	 * @param {import('./Types.js').FeedbackInstanceExt} feedback
	 * @returns {boolean | void}
	 */
	executeFeedback(feedback) {
		if (feedback.type == 'variable_value') {
			const result = this.#variableController.parseVariables(`$(${feedback.options.variable})`, null)

			this.#variableSubscriptions.set(feedback.id, result.variableIds)

			return compareValues(feedback.options.op, result.text, feedback.options.value)
		} else if (feedback.type == 'variable_variable') {
			const result1 = this.#variableController.parseVariables(`$(${feedback.options.variable})`, null)
			const result2 = this.#variableController.parseVariables(`$(${feedback.options.variable2})`, null)

			this.#variableSubscriptions.set(feedback.id, [...result1.variableIds, ...result2.variableIds])

			return compareValues(feedback.options.op, result1.text, result2.text)
		} else if (feedback.type == 'check_expression') {
			try {
				const res = this.#variableController.parseExpression(feedback.options.expression, feedback.location, 'boolean')

				this.#variableSubscriptions.set(feedback.id, Array.from(res.variableIds))

				return !!res.value
			} catch (e) {
				this.#logger.warn(`Failed to execute expression "${feedback.options.expression}": ${e}`)

				return false
			}
		}
	}

	/**
	 * @param {import('@companion-app/shared/Model/FeedbackModel.js').FeedbackInstance} feedback
	 * @returns {void}
	 */
	forgetFeedback(feedback) {
		this.#variableSubscriptions.delete(feedback.id)
	}

	/**
	 * Some variables have been changed
	 * @param {Set<string>} all_changed_variables_set
	 * @returns {void}
	 */
	variablesChanged(all_changed_variables_set) {
		/**
		 * Danger: It is important to not do any debounces here.
		 * Doing so will cause triggers which are 'on variable change' with a condition to check the variable value to break
		 */

		const affected_ids = []
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
	 * @param {import('./Types.js').InternalVisitor} visitor
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance[]} _actions
	 * @param {import('@companion-app/shared/Model/FeedbackModel.js').FeedbackInstance[]} feedbacks
	 */
	visitReferences(visitor, _actions, feedbacks) {
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
