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
import { EventEmitter } from 'events'
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
						allowInvalidValues: true,
						disableSanitisation: true,
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
