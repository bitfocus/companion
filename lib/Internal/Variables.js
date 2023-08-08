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

import CoreBase from '../Core/Base.js'
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

export default class Variables extends CoreBase {
	/**
	 * The dependencies of variables that should retrigger each feedback
	 * @type{Record<string, string[]>}
	 */
	#variableSubscriptions = {}

	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Variables')

		// this.internalModule = internalModule
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
				options: [
					{
						type: 'internal:variable',
						label: 'Variable',
						tooltip: 'What variable to act on?',
						id: 'variable',
						default: 'internal:time_hms',
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
				options: [
					{
						type: 'internal:variable',
						label: 'Compare Variable',
						tooltip: 'What variable to act on?',
						id: 'variable',
						default: 'internal:time_hms',
					},
					COMPARISON_OPERATION,
					{
						type: 'internal:variable',
						label: 'Against Variable',
						tooltip: 'What variable to compare with?',
						id: 'variable2',
						default: 'internal:time_hms',
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
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '2 > 1',
						useVariables: true,
					},
				],
			},
		}
	}

	executeFeedback(feedback) {
		if (feedback.type == 'variable_value') {
			const result = this.instance.variable.parseVariables(`$(${feedback.options.variable})`)

			this.#variableSubscriptions[feedback.id] = result.variableIds

			return compareValues(feedback.options.op, result.text, feedback.options.value)
		} else if (feedback.type == 'variable_variable') {
			const result1 = this.instance.variable.parseVariables(`$(${feedback.options.variable})`)
			const result2 = this.instance.variable.parseVariables(`$(${feedback.options.variable2})`)

			this.#variableSubscriptions[feedback.id] = [...result1.variableIds, ...result2.variableIds]

			return compareValues(feedback.options.op, result1.text, result2.text)
		} else if (feedback.type == 'check_expression') {
			try {
				const res = this.instance.variable.parseExpression(feedback.options.expression, 'boolean')

				this.#variableSubscriptions[feedback.id] = res.variableIds

				return res.value
			} catch (e) {
				this.logger.warn(`Failed to execute expression "${feedback.options.expression}": ${e}`)

				return false
			}
		}
	}

	forgetFeedback(feedback) {
		delete this.#variableSubscriptions[feedback.id]
	}

	variablesChanged(all_changed_variables_set) {
		/**
		 * Danger: It is important to not do any debounces here.
		 * Doing so will cause triggers which are 'on variable change' with a condition to check the variable value to break
		 */

		const affected_ids = []
		for (const [id, names] of Object.entries(this.#variableSubscriptions)) {
			for (const name of names) {
				if (all_changed_variables_set.has(name)) {
					affected_ids.push(id)
					break
				}
			}
		}
		if (affected_ids.length > 0) {
			this.internalModule.checkFeedbacksById(...affected_ids)
		}
	}

	visitReferences(visitor, actions, feedbacks) {
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
