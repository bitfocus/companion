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

import { EventEmitter } from 'node:events'
import {
	CustomVariableCreateIfNotExistsOption,
	CustomVariableSelectorOption,
} from '@companion-app/shared/CustomVariable.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import LogController from '../Log/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import type {
	ActionForInternalExecution,
	ActionForVisitor,
	FeedbackForVisitor,
	InternalActionDefinition,
	InternalActionResult,
	InternalModuleFragment,
	InternalModuleFragmentEvents,
	InternalVisitor,
} from './Types.js'

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
					CustomVariableSelectorOption,
					CustomVariableCreateIfNotExistsOption,
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						description: 'Supports $(this:value) for the current value of this variable.',
						expressionDescription:
							'Supports $(this:value) for the current value of this variable. The expression result is written to the variable.',
						allowInvalidValues: true,
						disableSanitisation: true,
						deferParsing: true,
						contextVariables: [{ value: 'this:value', label: 'Current value of this variable' }],
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

	executeAction(
		action: ActionForInternalExecution,
		_extras: RunActionExtras,
		parser: VariablesAndExpressionParser
	): InternalActionResult {
		switch (action.definitionId) {
			case 'custom_variable_set_value': {
				const variableName = stringifyVariableValue(action.options.name)
				if (variableName) {
					const currentValue = this.#variableController.custom.getValue(variableName)
					const childParser = parser.createChildParser({ 'this:value': currentValue })
					const rawValue = action.rawEntity.rawOptions['value']
					const { value } = childParser.parseEntityOption(rawValue, { allowExpression: true, parseVariables: true })

					if (this.#variableController.custom.hasCustomVariable(variableName)) {
						this.#variableController.custom.setValue(variableName, value)
					} else if (action.options.create) {
						this.#variableController.custom.createVariable(variableName, value)
					} else {
						this.#logger.warn(`Custom variable "${variableName}" not found`)
					}
				}
				break
			}
			case 'custom_variable_reset_to_default': {
				const variableName = stringifyVariableValue(action.options.name)
				if (variableName) {
					this.#variableController.custom.resetValueToDefault(variableName)
				}
				break
			}
			case 'custom_variable_sync_to_default': {
				const variableName = stringifyVariableValue(action.options.name)
				if (variableName) {
					this.#variableController.custom.syncValueToDefault(variableName)
				}
				break
			}
			default:
				return null
		}

		return { result: undefined }
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
