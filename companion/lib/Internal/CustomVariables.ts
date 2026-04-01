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
import type { ActionRunner } from '../Controls/ActionRunner.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import { EventEmitter } from 'events'
import { stringifyVariableValue, type VariableValue } from '@companion-app/shared/Model/Variables.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type {
	CompanionInputFieldCheckboxExtended,
	InternalInputFieldCustomVariable,
} from '@companion-app/shared/Model/Options.js'
import type { CompanionOptionValues } from '@companion-module/host'

const CustomVariableNameOption = {
	type: 'internal:custom_variable',
	label: 'Custom variable',
	id: 'name',
	expressionDescription:
		'The name of the custom variable. Just the portion after the "custom:" prefix. Make sure to wrap it in quotes!',
} as const satisfies InternalInputFieldCustomVariable

const CreateIfNotExistsOption = {
	type: 'checkbox',
	label: 'Create if not exists',
	id: 'create',
	default: false,
	disableAutoExpression: true,
} as const satisfies CompanionInputFieldCheckboxExtended

export class InternalCustomVariables
	extends EventEmitter<InternalModuleFragmentEvents>
	implements InternalModuleFragment
{
	readonly #logger = LogController.createLogger('Internal/CustomVariables')

	readonly #variableController: VariablesController
	readonly #actionRunner: ActionRunner

	constructor(variableController: VariablesController, actionRunner: ActionRunner) {
		super()

		this.#variableController = variableController
		this.#actionRunner = actionRunner
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			custom_variable_set_value: {
				label: 'Custom Variable: Set value',
				description: undefined,
				options: [
					CustomVariableNameOption,
					CreateIfNotExistsOption,
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
			custom_variable_set_from_action_result: {
				label: 'Custom Variable: Set to result of an action',
				description: 'Set a custom variable to the result of executing an action',
				options: [CustomVariableNameOption, CreateIfNotExistsOption],
				optionsSupportExpressions: true,
				supportsChildGroups: [
					{
						type: EntityModelType.Action,
						groupId: 'action_with_result',
						entityTypeLabel: 'action',
						label: 'Action',
						maximumChildren: 1,
					},
				],
			},

			custom_variable_reset_to_default: {
				label: 'Custom Variable: Reset to startup value',
				description: undefined,
				options: [CustomVariableNameOption],
				optionsSupportExpressions: true,
			},
			custom_variable_sync_to_default: {
				label: 'Custom Variable: Write current value to startup value',
				description: undefined,
				options: [CustomVariableNameOption],
				optionsSupportExpressions: true,
			},
		}
	}

	#setOrCreateCustomVariable(
		variableName: string,
		create: CompanionOptionValues['create'],
		value: VariableValue
	): void {
		const customVars = this.#variableController.custom
		if (customVars.hasCustomVariable(variableName)) {
			customVars.setValue(variableName, value)
		} else if (create) {
			customVars.createVariable(variableName, value)
		} else {
			this.#logger.warn(`Custom variable "${variableName}" not found`)
		}
	}

	executeAction(action: ActionForInternalExecution, extras: RunActionExtras): Promise<boolean> | boolean {
		if (action.definitionId === 'custom_variable_set_value') {
			const variableName = stringifyVariableValue(action.options.name)
			if (!variableName) return true

			this.#setOrCreateCustomVariable(variableName, action.options.create, action.options.value)
			return true
		} else if (action.definitionId === 'custom_variable_set_from_action_result') {
			const variableName = stringifyVariableValue(action.options.name)
			if (!variableName) return true

			const childActions = action.rawEntity.getChildren('action_with_result')?.getDirectEntities() ?? []
			if (childActions.length === 0) return true

			return this.#actionRunner.runSingleAction(childActions[0], extras).then(
				(result) => {
					this.#setOrCreateCustomVariable(variableName, action.options.create, result)
					return true
				},
				(e) => {
					this.#logger.error(`Running action to compute result failed: ${e.message}`)
					return true
				}
			)
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
