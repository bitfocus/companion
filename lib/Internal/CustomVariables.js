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

import jp from 'jsonpath'
import CoreBase from '../Core/Base.js'

export default class Bank extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'lib/Internal/CustomVariables')

		// this.internalModule = internalModule
	}

	getActionDefinitions() {
		return {
			custom_variable_set_value: {
				label: 'Set custom variable value',
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
				label: 'Set custom variable expression',
				options: [
					{
						type: 'internal:custom_variable',
						label: 'Custom variable',
						id: 'name',
					},
					{
						type: 'textwithvariables',
						label: 'Expression',
						id: 'expression',
						default: '',
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
			const [instanceLabel, variableName] = action.options.variable.split(':', 2)
			const value = this.instance.variable.getVariableValue(instanceLabel, variableName)
			this.instance.variable.custom.setValue(action.options.name, value)
			return true
		} else if (action.action === 'custom_variable_set_via_jsonpath') {
			// extract value from the stored json response data, assign to target variable

			// get the json response data from the custom variable that holds the data
			const variableName = `custom_${action.options.jsonResultDataVariable}`
			const jsonResultData = this.instance.variable.getVariableValue('internal', variableName)

			// recreate a json object from stored json result data string
			let objJson = ''
			try {
				objJson = JSON.parse(jsonResultData)
			} catch (e) {
				this.log(
					'error',
					`custom_variable_set_via_jsonpath: Cannot create JSON object, malformed JSON data (${e.message})`
				)
				return
			}

			// extract the value via the given standard JSONPath expression
			let valueToSet = ''
			try {
				valueToSet = jp.query(objJson, action.options.jsonPath)
			} catch (error) {
				self.log('error', `custom_variable_set_via_jsonpath: Cannot extract JSON value (${e.message})`)
				return
			}

			this.instance.variable.custom.setValue(action.options.targetVariable, valueToSet)

			return true
		}
	}
}
