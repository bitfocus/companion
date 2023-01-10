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
				label: 'Set custom variable to value',
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
				label: 'Set custom variable with expression',
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
				label: 'Store variable value to custom variable',
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
				label: 'Set custom variable from a stored JSONresult via a JSONpath expression',
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
			custom_variable_math_operation: {
				label: 'Modify Variable Value with Math Operation',
				options: [
					{
						type: 'internal:variable',
						label: 'Variable',
						id: 'variable',
						default: 'internal:time_hms',
					},
					{
						type: 'dropdown',
						label: 'Operation',
						id: 'operation',
						default: 'plus',
						choices: [
							{ id: 'plus', label: 'Variable Plus Value' },
							{ id: 'minus', label: 'Variable Minus Value' },
							{ id: 'minus_opposite', label: 'Value Minus Variable' },
							{ id: 'multiply', label: 'Variable Multiplied By Value' },
							{ id: 'divide', label: 'Variable Divided By Value' },
							{ id: 'divide_opposite', label: 'Value Divided By Variable' },
						],
					},
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						useVariables: true,
					},
					{
						type: 'internal:custom_variable',
						label: 'Resulting Variable',
						id: 'result',
					},
				],
			},
			custom_variable_math_int_operation: {
				label: 'Modify Variable Value with Math Convert To Int Operation',
				options: [
					{
						type: 'internal:variable',
						label: 'Variable',
						id: 'variable',
						default: 'internal:time_hms',
					},
					{
						type: 'number',
						label: 'Radix',
						id: 'radix',
						default: 10,
						min: 2,
						max: 36,
						step: 1,
						range: true,
					},
					{
						type: 'internal:custom_variable',
						label: 'Resulting Variable',
						id: 'result',
					},
				],
			},
			custom_variable_string_trim_operation: {
				label: 'Modify Variable Value with String Trim Operation',
				options: [
					{
						type: 'internal:variable',
						label: 'Variable',
						id: 'variable',
						default: 'internal:time_hms',
					},
					{
						type: 'internal:custom_variable',
						label: 'Resulting Variable',
						id: 'result',
					},
				],
			},
			custom_variable_string_concat_operation: {
				label: 'Modify Variable Value with String Concatenation Operation',
				options: [
					{
						type: 'internal:variable',
						label: 'Variable',
						id: 'variable',
						default: 'internal:time_hms',
					},
					{
						type: 'textinput',
						label: 'Combine with Value',
						id: 'value',
						default: '',
						useVariables: true,
					},
					{
						type: 'dropdown',
						label: 'Order',
						id: 'order',
						default: 'variable_value',
						choices: [
							{ id: 'variable_value', label: 'Variable + Value' },
							{ id: 'value_variable', label: 'Value + Variable' },
						],
					},
					{
						type: 'internal:custom_variable',
						label: 'Resulting Variable',
						id: 'result',
					},
				],
			},
			custom_variable_string_substring_operation: {
				label: 'Modify Variable Value with String Substring Operation',
				options: [
					{
						type: 'internal:variable',
						label: 'Variable',
						id: 'variable',
						default: 'internal:time_hms',
					},
					{
						type: 'textinput',
						label: 'Start of Substring',
						id: 'start',
						default: '',
						useVariables: true,
					},
					{
						type: 'textinput',
						label: 'End of Substring',
						id: 'end',
						default: '',
						useVariables: true,
					},
					{
						type: 'internal:custom_variable',
						label: 'Resulting Variable',
						id: 'result',
					},
				],
			},
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
		} else if (action.action == 'custom_variable_math_operation') {
			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const variable_value_number = Number(variable_value)
			const operation_value = this.instance.variable.parseVariables(action.options.value).text
			const operation_value_number = Number(operation_value)
			let value = variable_value_number
			switch (action.options.operation) {
				case 'plus':
					value = variable_value_number + operation_value_number
					break
				case 'minus':
					value = variable_value_number - operation_value_number
					break
				case 'minus_opposite':
					value = operation_value_number - variable_value_number
					break
				case 'multiply':
					value = variable_value_number * operation_value_number
					break
				case 'divide':
					value = variable_value_number / operation_value_number
					break
				case 'divide_opposite':
					value = operation_value_number / variable_value_number
					break
			}

			this.instance.variable.custom.setValue(action.options.result, value)
		} else if (action.action == 'custom_variable_math_int_operation') {
			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)
			const value = parseInt(variable_value, action.options.radix)

			this.instance.variable.custom.setValue(action.options.result, value)
		} else if (action.action == 'custom_variable_string_trim_operation') {
			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)
			const value = variable_value.trim()

			this.instance.variable.custom.setValue(action.options.result, value)
		} else if (action.action == 'custom_variable_string_concat_operation') {
			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const operation_value = this.instance.variable.parseVariables(action.options.value).text

			let value = ''
			if (action.options.order == 'variable_value') {
				value = variable_value.toString() + operation_value.toString()
			} else {
				value = operation_value.toString() + variable_value.toString()
			}

			this.instance.variable.custom.setValue(action.options.result, value)
		} else if (action.action == 'custom_variable_string_substring_operation') {
			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName) + ''

			const start = Number(this.instance.variable.parseVariables(action.options.start).text)
			const end = Number(this.instance.variable.parseVariables(action.options.end).text)
			const value = variable_value.substring(start, end)

			this.instance.variable.custom.setValue(action.options.result, value)
		}
	}
}
