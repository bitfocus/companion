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

import { SplitVariableId } from '../Resources/Util.js'
import LogController from '../Log/Controller.js'

export default class CustomVariables {
	#logger = LogController.createLogger('Internal/CustomVariables')

	// /**
	//  * @type {import('./Controller.js').default}
	//  * @readonly
	//  */
	// #internalModule

	/**
	 * @type {import('../Variables/Controller.js').VariablesController}
	 * @readonly
	 */
	#variableController

	/**
	 * @param {import('./Controller.js').default} _internalModule
	 * @param {import('../Variables/Controller.js').VariablesController} variableController
	 */
	constructor(_internalModule, variableController) {
		// this.#internalModule = internalModule
		this.#variableController = variableController
	}

	/**
	 * @returns {Record<string, import('./Types.js').InternalActionDefinition>}
	 */
	getActionDefinitions() {
		return {
			custom_variable_set_value: {
				label: 'Custom Variable: Set raw value',
				description: undefined,
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
			custom_variable_create_value: {
				label: 'Custom Variable: Set or Create raw value if not exists',
				description: undefined,
				options: [
					{
						type: 'textinput',
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
				description: undefined,
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
						useVariables: {
							local: true,
						},
						isExpression: true,
					},
				],
			},
			custom_variable_store_variable: {
				label: 'Custom Variable: Store variable value',
				description: undefined,
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
					},
				],
			},

			custom_variable_reset_to_default: {
				label: 'Reset custom variable to startup value',
				description: undefined,
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
				description: undefined,
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

	/**
	 * Perform an upgrade for an action
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance} action
	 * @param {string} _controlId
	 * @returns {import('@companion-app/shared/Model/ActionModel.js').ActionInstance | void} Updated action if any changes were made
	 */
	actionUpgrade(action, _controlId) {
		const variableRegex = /^\$\(([^:$)]+):([^)$]+)\)$/
		const wrapValue = (/** @type {string | number} */ val) => {
			if (!isNaN(Number(val))) {
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
				action.options.order === 'variable_value'
					? `\`${wrappedVariable}${wrappedValue}\``
					: `\`${wrappedValue}${wrappedVariable}\``

			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.value
			delete action.options.order
			delete action.options.result

			return action
		} else if (action.action === 'custom_variable_string_substring_operation') {
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
		} else if (action.action === 'custom_variable_set_via_jsonpath') {
			action.action = 'custom_variable_set_expression'
			action.options.expression = `jsonpath($(internal:custom_${action.options.jsonResultDataVariable}), "${action.options.jsonPath?.replaceAll('"', '\\"')}")`

			action.options.name = action.options.targetVariable

			delete action.options.targetVariable
			delete action.options.jsonResultDataVariable
			delete action.options.jsonPath

			return action
		}
	}

	/**
	 * Run a single internal action
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance} action
	 * @param {import('../Instance/Wrapper.js').RunActionExtras} extras
	 * @returns {boolean} Whether the action was handled
	 */
	executeAction(action, extras) {
		if (action.action === 'custom_variable_set_value') {
			this.#variableController.custom.setValue(action.options.name, action.options.value)
			return true
		} else if (action.action === 'custom_variable_create_value') {
			if (this.#variableController.custom.hasCustomVariable(action.options.name)) {
				this.#variableController.custom.setValue(action.options.name, action.options.value)
			} else {
				this.#variableController.custom.createVariable(action.options.name, action.options.value)
			}
			return true
		} else if (action.action === 'custom_variable_set_expression') {
			try {
				const result = this.#variableController.values.executeExpression(action.options.expression, extras.location)
				this.#variableController.custom.setValue(action.options.name, result.value)
			} catch (/** @type {any} */ error) {
				this.#logger.warn(`${error.toString()}, in expression: "${action.options.expression}"`)
			}

			return true
		} else if (action.action === 'custom_variable_store_variable') {
			const [connectionLabel, variableName] = SplitVariableId(action.options.variable)
			const value = this.#variableController.values.getVariableValue(connectionLabel, variableName)
			this.#variableController.custom.setValue(action.options.name, value)
			return true
		} else if (action.action === 'custom_variable_reset_to_default') {
			this.#variableController.custom.resetValueToDefault(action.options.name)
			return true
		} else if (action.action === 'custom_variable_sync_to_default') {
			this.#variableController.custom.syncValueToDefault(action.options.name)
			return true
		} else {
			return false
		}
	}
	/**
	 *
	 * @param {import('./Types.js').InternalVisitor} visitor
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance[]} actions
	 * @param {import('./Types.js').FeedbackForVisitor[]} _feedbacks
	 */
	visitReferences(visitor, actions, _feedbacks) {
		for (const action of actions) {
			try {
				// custom_variable_set_expression.expression handled by generic options visitor
				if (action.action === 'custom_variable_store_variable') {
					visitor.visitVariableName(action.options, 'variable')
				}
			} catch (e) {
				//Ignore
			}
		}
	}
}
