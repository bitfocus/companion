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

import { JSONPath } from 'jsonpath-plus'
import CoreBase from '../Core/Base.js'
import { SplitVariableId } from '../Resources/Util.js'

export default class CustomVariables extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/CustomVariables')

		// this.internalModule = internalModule
	}

	getActionDefinitions() {
		return {
			custom_variable_set_value: {
				label: 'Custom Variable: Set raw value',
				options: [
					{
						type: 'internal:custom_variable',
						label: 'Custom variable',
						id: 'name',
					},
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
					},
				],
			},
			custom_variable_set_expression: {
				label: 'Custom Variable: Set with expression',
				options: [
					{
						type: 'internal:custom_variable',
						label: 'Custom variable',
						id: 'name',
					},
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '',
						useVariables: true,
					},
				],
			},
			custom_variable_store_variable: {
				label: 'Custom Variable: Store variable value',
				options: [
					{
						type: 'internal:custom_variable',
						label: 'Custom variable',
						id: 'name',
					},
					{
						type: 'internal:variable',
						id: 'variable',
						label: 'Variable to store value from',
						tooltip: 'What variable to store in the custom variable?',
						default: 'internal:time_hms',
					},
				],
			},
			custom_variable_set_via_jsonpath: {
				label: 'Custom Variable: Set from a stored JSONresult via a JSONpath expression',
				options: [
					{
						type: 'internal:custom_variable',
						label: 'JSON Result Data Variable',
						id: 'jsonResultDataVariable',
					},
					{
						type: 'textinput',
						label: 'Path (like $.age)',
						id: 'jsonPath',
						default: '',
					},
					{
						type: 'internal:custom_variable',
						label: 'Target Variable',
						id: 'targetVariable',
					},
				],
			},

			custom_variable_reset_to_default: {
				label: 'Reset custom variable to startup value',
				options: [
					{
						type: 'internal:custom_variable',
						label: 'Custom variable',
						id: 'name',
					},
				],
			},
			custom_variable_sync_to_default: {
				label: 'Write custom variable current value to startup value',
				options: [
					{
						type: 'internal:custom_variable',
						label: 'Custom variable',
						id: 'name',
					},
				],
			},
		}
	}

	actionUpgrade(action, controlId) {
		const variableRegex = /^\$\(([^:$)]+):([^)$]+)\)$/
		const wrapValue = (val) => {
			if (!isNaN(val)) {
				return Number(val)
			} else if (typeof val === 'string' && val.trim().match(variableRegex)) {
				return val.trim()
			} else {
				return `parseVariables("${val}")`
			}
		}

		if (action.action === 'custom_variable_math_operation') {
			let op = '???'
			let reverse = false
			switch (action.options.operation) {
				case 'plus':
					op = '+'
					break
				case 'minus':
					op = '-'
					break
				case 'minus_opposite':
					op = '-'
					reverse = true
					break
				case 'multiply':
					op = '*'
					break
				case 'divide':
					op = '/'
					break
				case 'divide_opposite':
					op = '/'
					reverse = true
					break
			}

			action.action = 'custom_variable_set_expression'

			const parts = [`$(${action.options.variable})`, op, wrapValue(action.options.value)]
			if (reverse) parts.reverse()

			action.options.expression = parts.join(' ')
			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.operation
			delete action.options.value
			delete action.options.result

			return action
		} else if (action.action === 'custom_variable_math_int_operation') {
			action.action = 'custom_variable_set_expression'
			action.options.expression = `fromRadix($(${action.options.variable}), ${action.options.radix || 2})`
			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.radix
			delete action.options.result

			return action
		} else if (action.action === 'custom_variable_string_trim_operation') {
			action.action = 'custom_variable_set_expression'
			action.options.expression = `trim($(${action.options.variable}))`
			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.result

			return action
		} else if (action.action === 'custom_variable_string_concat_operation') {
			action.action = 'custom_variable_set_expression'

			const wrappedValue =
				action.options.value.indexOf('$(') !== -1 ? `\${${wrapValue(action.options.value)}}` : action.options.value
			const wrappedVariable = `\${$(${action.options.variable})}`

			action.options.expression =
				action.options.order == 'variable_value'
					? `\`${wrappedVariable}${wrappedValue}\``
					: `\`${wrappedValue}${wrappedVariable}\``

			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.value
			delete action.options.order
			delete action.options.result

			return action
		} else if (action.action == 'custom_variable_string_substring_operation') {
			action.action = 'custom_variable_set_expression'

			action.options.expression = `substr($(${action.options.variable}), ${wrapValue(
				action.options.start
			)}, ${wrapValue(action.options.end)})`

			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.start
			delete action.options.end
			delete action.options.result

			return action
		}
	}

	executeAction(action, extras) {
		if (action.action === 'custom_variable_set_value') {
			this.instance.variable.custom.setValue(action.options.name, action.options.value)
			return true
		} else if (action.action === 'custom_variable_set_expression') {
			this.instance.variable.custom.setValueToExpression(action.options.name, action.options.expression)
			return true
		} else if (action.action === 'custom_variable_store_variable') {
			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const value = this.instance.variable.getVariableValue(instanceLabel, variableName)
			this.instance.variable.custom.setValue(action.options.name, value)
			return true
		} else if (action.action === 'custom_variable_set_via_jsonpath') {
			// extract value from the stored json response data, assign to target variable

			// get the json response data from the custom variable that holds the data
			const jsonResultData = this.instance.variable.getCustomVariableValue(action.options.jsonResultDataVariable)

			// recreate a json object from stored json result data string
			let objJson = ''
			try {
				objJson = JSON.parse(jsonResultData)
			} catch (e) {
				this.logger.error(
					`custom_variable_set_via_jsonpath: Cannot create JSON object, malformed JSON data (${e.message})`
				)
				return
			}

			// extract the value via the given standard JSONPath expression
			let valueToSet = ''
			try {
				valueToSet = JSONPath(action.options.jsonPath, objJson)
			} catch (e) {
				this.logger.error(`custom_variable_set_via_jsonpath: Cannot extract JSON value (${e.message})`)
				return
			}

			try {
				if (typeof valueToSet !== 'number' && typeof valueToSet !== 'string' && valueToSet) {
					valueToSet = JSON.stringify(valueToSet)
				}
			} catch (e) {
				this.logger.error(`custom_variable_set_via_jsonpath: Cannot stringify JSON value (${e.message})`)
				return
			}

			this.instance.variable.custom.setValue(action.options.targetVariable, valueToSet)

			return true
		} else if (action.action == 'custom_variable_reset_to_default') {
			this.instance.variable.custom.resetValueToDefault(action.options.name)
			return true
		} else if (action.action == 'custom_variable_sync_to_default') {
			this.instance.variable.custom.syncValueToDefault(action.options.name)
			return true
		}
	}
}
