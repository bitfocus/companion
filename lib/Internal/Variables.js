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
	// Subscriptions arent supported in this model for now..
	// #subscriptions = {}
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Variables')

		// this.internalModule = internalModule
	}

	getFeedbackDefinitions() {
		return {
			variable_value: {
				type: 'boolean',
				label: 'Check variable value',
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
				// subscribe: (fb) => {
				// 	if (fb.options.variable) {
				// 		this.#subscriptions[fb.id] = [fb.options.variable]
				// 	}
				// },
				// unsubscribe: (fb) => {
				// 	delete this.#subscriptions[fb.id]
				// },
			},

			variable_variable: {
				type: 'boolean',
				label: 'Compare variable to variable',
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
				// subscribe: (fb) => {
				// 	if (fb.options.variable || fb.options.variable2) {
				// 		this.#subscriptions[fb.id] = [fb.options.variable, fb.options.variable2]
				// 	}
				// },
				// unsubscribe: (fb) => {
				// 	delete this.#subscriptions[fb.id]
				// },
			},
		}
	}

	executeFeedback(feedback) {
		if (feedback.type == 'variable_value') {
			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)

			const value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			return compareValues(feedback.options.op, value, feedback.options.value)
		} else if (feedback.type == 'variable_variable') {
			const [instanceLabel1, variableName1] = SplitVariableId(action.options.variable)
			const [instanceLabel2, variableName2] = SplitVariableId(action.options.variable2)

			const value1 = this.instance.variable.getVariableValue(instanceLabel1, variableName1)
			const value2 = this.instance.variable.getVariableValue(instanceLabel2, variableName2)

			return compareValues(feedback.options.op, value1, value2)
		}
	}

	variablesChanged(changed_variables, removed_variables) {
		// const all_changed_variables = new Set([...removed_variables, ...Object.keys(changed_variables)])

		// const affected_ids = []

		// for (const [id, names] of Object.entries(this.#subscriptions)) {
		// 	for (const name of names) {
		// 		if (all_changed_variables.has(name)) {
		// 			affected_ids.push(id)
		// 			break
		// 		}
		// 	}
		// }

		// if (affected_ids.length > 0) {
		// 	this.internalModule.checkFeedbacksById(...affected_ids)
		// }
		this.internalModule.checkFeedbacks('variable_value', 'variable_variable')
	}
}
