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

import LogController from '../Log/Controller.js'
import type {
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalVisitor,
	InternalActionDefinition,
	ActionForVisitor,
	InternalModuleFragmentEvents,
	ActionForInternalExecution,
} from './Types.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type { ActionEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { convertSimplePropertyToExpressionValue } from './Util.js'
import { EventEmitter } from 'events'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'

export class InternalCustomVariables
	extends EventEmitter<InternalModuleFragmentEvents>
	implements InternalModuleFragment
{
	readonly #logger = LogController.createLogger('Internal/CustomVariables')

	readonly #variableController: VariablesController

	constructor(variableController: VariablesController) {
		super()

		this.#variableController = variableController
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			custom_variable_set_value: {
				label: 'Custom Variable: Set value',
				description: undefined,
				options: [
					{
						type: 'internal:custom_variable',
						label: 'Custom variable',
						id: 'name',
						expressionDescription:
							'The name of the custom variable. Just the portion after the "custom:" prefix. Make sure to wrap it in quotes!',
					},
					{
						type: 'checkbox',
						label: 'Create if not exists',
						id: 'create',
						default: false,
						disableAutoExpression: true,
					},
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						description: 'The raw value will be written to the variable',
						expressionDescription: 'The expression will be executed with the result written to the variable',
					},
				],
				optionsSupportExpressions: true,
			},

			custom_variable_reset_to_default: {
				label: 'Custom Variable: Reset to startup value',
				description: undefined,
				options: [
					{
						type: 'internal:custom_variable',
						label: 'Custom variable',
						id: 'name',
						expressionDescription:
							'The name of the custom variable. Just the portion after the "custom:" prefix. Make sure to wrap it in quotes!',
					},
				],
				optionsSupportExpressions: true,
			},
			custom_variable_sync_to_default: {
				label: 'Custom Variable: Write current value to startup value',
				description: undefined,
				options: [
					{
						type: 'internal:custom_variable',
						label: 'Custom variable',
						id: 'name',
						expressionDescription:
							'The name of the custom variable. Just the portion after the "custom:" prefix. Make sure to wrap it in quotes!',
					},
				],
				optionsSupportExpressions: true,
			},
		}
	}

	actionUpgrade(action: ActionEntityModel, _controlId: string): ActionEntityModel | void {
		const variableRegex = /^\$\(([^:$)]+):([^)$]+)\)$/
		const wrapValue = (val: string | number) => {
			if (!isNaN(Number(val))) {
				return Number(val)
			} else if (typeof val === 'string' && val.trim().match(variableRegex)) {
				return val.trim()
			} else {
				return `parseVariables("${val}")`
			}
		}

		let changed = false

		// Consolidation for use expressions
		if (action.definitionId === 'custom_variable_math_operation') {
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

			action.definitionId = 'custom_variable_set_expression'

			const parts = [`$(${action.options.variable})`, op, wrapValue(action.options.value)]
			if (reverse) parts.reverse()

			action.options.expression = parts.join(' ')
			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.operation
			delete action.options.value
			delete action.options.result

			changed = true
		} else if (action.definitionId === 'custom_variable_math_int_operation') {
			action.definitionId = 'custom_variable_set_expression'
			action.options.expression = `fromRadix($(${action.options.variable}), ${action.options.radix || 2})`
			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.radix
			delete action.options.result

			changed = true
		} else if (action.definitionId === 'custom_variable_string_trim_operation') {
			action.definitionId = 'custom_variable_set_expression'
			action.options.expression = `trim($(${action.options.variable}))`
			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.result

			changed = true
		} else if (action.definitionId === 'custom_variable_string_concat_operation') {
			action.definitionId = 'custom_variable_set_expression'

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

			changed = true
		} else if (action.definitionId === 'custom_variable_string_substring_operation') {
			action.definitionId = 'custom_variable_set_expression'

			action.options.expression = `substr($(${action.options.variable}), ${wrapValue(
				action.options.start
			)}, ${wrapValue(action.options.end)})`

			action.options.name = action.options.result
			delete action.options.variable
			delete action.options.start
			delete action.options.end
			delete action.options.result

			changed = true
		} else if (action.definitionId === 'custom_variable_set_via_jsonpath') {
			action.definitionId = 'custom_variable_set_expression'
			action.options.expression = `jsonpath($(custom:${action.options.jsonResultDataVariable}), "${action.options.jsonPath?.replaceAll('"', '\\"')}")`

			action.options.name = action.options.targetVariable

			delete action.options.targetVariable
			delete action.options.jsonResultDataVariable
			delete action.options.jsonPath

			changed = true
		}

		// Conversion to auto-expressions
		if (
			action.definitionId === 'custom_variable_sync_to_default' ||
			action.definitionId === 'custom_variable_reset_to_default'
		) {
			changed = convertSimplePropertyToExpressionValue(action.options, 'name') || changed
		} else if (action.definitionId === 'custom_variable_set_value') {
			changed = convertSimplePropertyToExpressionValue(action.options, 'name') || changed
			changed = convertSimplePropertyToExpressionValue(action.options, 'value') || changed
		} else if (action.definitionId === 'custom_variable_set_expression') {
			changed = convertSimplePropertyToExpressionValue(action.options, 'name') || changed

			// Rename to the combined action
			action.definitionId = 'custom_variable_set_value'
			action.options.value = {
				isExpression: true,
				value: action.options.expression,
			} satisfies ExpressionOrValue<any>
			delete action.options.expression

			changed = true
		} else if (action.definitionId === 'custom_variable_create_value') {
			changed = convertSimplePropertyToExpressionValue(action.options, 'name') || changed
			changed = convertSimplePropertyToExpressionValue(action.options, 'value') || changed

			// Rename to the combined action
			action.definitionId = 'custom_variable_set_value'
			action.options.create = true

			changed = true
		} else if (action.definitionId === 'custom_variable_store_variable') {
			changed = convertSimplePropertyToExpressionValue(action.options, 'name') || changed

			// Rename to the combined action
			action.definitionId = 'custom_variable_set_value'
			action.options.create = false
			action.options.value = {
				isExpression: true,
				value: `$(${action.options.variable})`,
			} satisfies ExpressionOrValue<any>
			delete action.options.variable

			changed = true
		}

		if (changed) return action
	}

	executeAction(action: ActionForInternalExecution, _extras: RunActionExtras): boolean {
		if (action.definitionId === 'custom_variable_set_value') {
			const variableName = stringifyVariableValue(action.options.name)
			if (!variableName) return true

			if (this.#variableController.custom.hasCustomVariable(variableName)) {
				this.#variableController.custom.setValue(variableName, action.options.value)
			} else if (action.options.create) {
				this.#variableController.custom.createVariable(variableName, action.options.value)
			} else {
				this.#logger.warn(`Custom variable "${variableName}" not found`)
			}
			return true
		} else if (action.definitionId === 'custom_variable_reset_to_default') {
			const variableName = stringifyVariableValue(action.options.name)
			if (!variableName) return true

			this.#variableController.custom.resetValueToDefault(variableName)
			return true
		} else if (action.definitionId === 'custom_variable_sync_to_default') {
			const variableName = stringifyVariableValue(action.options.name)
			if (!variableName) return true

			this.#variableController.custom.syncValueToDefault(variableName)
			return true
		} else {
			return false
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
