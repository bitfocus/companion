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

import LogController from '../Log/Controller.js'
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	FeedbackEntityModelExt,
	InternalModuleFragment,
	InternalVisitor,
	InternalFeedbackDefinition,
	InternalActionDefinition,
	ExecuteFeedbackResultWithReferences,
	InternalModuleFragmentEvents,
} from './Types.js'
import type { CompanionInputFieldDropdown } from '@companion-module/base'
import {
	FeedbackEntitySubType,
	SomeSocketEntityLocation,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ControlsController } from '../Controls/Controller.js'
import { CHOICES_DYNAMIC_LOCATION } from './Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import type { PageController } from '../Page/Controller.js'
import { isInternalUserValueFeedback, type ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { ControlEntityListPoolBase } from '../Controls/Entities/EntityListPoolBase.js'
import { VARIABLE_UNKNOWN_VALUE } from '../Variables/Util.js'
import { serializeIsVisibleFnSingle } from '../Resources/Util.js'
import type { InternalModuleUtils } from './Util.js'
import { EventEmitter } from 'events'

const COMPARISON_OPERATION: CompanionInputFieldDropdown = {
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

function compareValues(op: any, value: any, value2: any): boolean {
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

export class InternalVariables extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #internalUtils: InternalModuleUtils
	readonly #controlsController: ControlsController
	readonly #pagesController: PageController

	/**
	 * The dependencies of variables that should retrigger each feedback
	 */
	#variableSubscriptions = new Map<string, { controlId: string; variables: Set<string> }>()

	constructor(
		internalUtils: InternalModuleUtils,
		controlsController: ControlsController,
		pagesController: PageController
	) {
		super()

		this.#internalUtils = internalUtils
		this.#controlsController = controlsController
		this.#pagesController = pagesController
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			variable_value: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Variable: Check value',
				description: 'Change style based on the value of a variable',
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'internal:variable',
						label: 'Variable',
						tooltip: 'What variable to act on?',
						id: 'variable',
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
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Variable: Compare two variables',
				description: 'Change style based on a variable compared to another variable',
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'internal:variable',
						label: 'Compare Variable',
						tooltip: 'What variable to act on?',
						id: 'variable',
					},
					COMPARISON_OPERATION,
					{
						type: 'internal:variable',
						label: 'Against Variable',
						tooltip: 'What variable to compare with?',
						id: 'variable2',
					},
				],
			},

			check_expression: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Variable: Check boolean expression',
				description: 'Change style based on a boolean expression',
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '2 > 1',
						useVariables: {
							local: true,
						},
						isExpression: true,
					},
				],
			},
			expression_value: {
				feedbackType: FeedbackEntitySubType.Value,
				label: 'Evaluate Expression',
				description: 'A dynamic expression that can be used in other fields',
				feedbackStyle: undefined,
				showInvert: false,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '2 > 1',
						useVariables: {
							local: true,
						},
						isExpression: true,
					},
				],
			},
			user_value: {
				feedbackType: FeedbackEntitySubType.Value,
				label: 'User Value',
				description: 'A value that can be used in other fields',
				feedbackStyle: undefined,
				showInvert: false,
				options: [
					serializeIsVisibleFnSingle({
						type: 'textinput',
						label: 'Startup Value',
						id: 'startup_value',
						default: '1',
						isVisible: (options) => !options.persist_value,
					}),
					{
						type: 'checkbox',
						label: 'Persist value',
						tooltip: 'If enabled, variable value will be saved and restored when Companion restarts.',
						id: 'persist_value',
						default: false,
					},
				],
			},
		}
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			local_variable_set_value: {
				label: 'Local Variable: Set raw value',
				description: undefined,
				options: [
					...CHOICES_DYNAMIC_LOCATION,

					{
						type: 'textinput',
						label: 'Local variable',
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
			local_variable_set_expression: {
				label: 'Local Variable: Set with expression',
				description: undefined,
				options: [
					...CHOICES_DYNAMIC_LOCATION,

					{
						type: 'textinput',
						label: 'Local variable',
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

			local_variable_reset_to_default: {
				label: 'Local Variable: Reset to startup value',
				description: undefined,
				options: [
					...CHOICES_DYNAMIC_LOCATION,

					{
						type: 'textinput',
						label: 'Local variable',
						id: 'name',
					},
				],
			},
			local_variable_sync_to_default: {
				label: 'Local Variable: Write current value to startup value',
				description: undefined,
				options: [
					...CHOICES_DYNAMIC_LOCATION,

					{
						type: 'textinput',
						label: 'Local variable',
						id: 'name',
					},
				],
			},
		}
	}

	/**
	 * Get an updated value for a feedback
	 */
	executeFeedback(feedback: FeedbackEntityModelExt): boolean | ExecuteFeedbackResultWithReferences | void {
		if (feedback.definitionId == 'variable_value') {
			const result = this.#internalUtils.parseVariablesForInternalActionOrFeedback(
				`$(${feedback.options.variable})`,
				feedback
			)

			this.#variableSubscriptions.set(feedback.id, { controlId: feedback.controlId, variables: result.variableIds })

			return compareValues(feedback.options.op, result.text, feedback.options.value)
		} else if (feedback.definitionId == 'variable_variable') {
			const result1 = this.#internalUtils.parseVariablesForInternalActionOrFeedback(
				`$(${feedback.options.variable})`,
				feedback
			)
			const result2 = this.#internalUtils.parseVariablesForInternalActionOrFeedback(
				`$(${feedback.options.variable2})`,
				feedback
			)

			this.#variableSubscriptions.set(feedback.id, {
				controlId: feedback.controlId,
				variables: new Set([...result1.variableIds, ...result2.variableIds]),
			})

			return compareValues(feedback.options.op, result1.text, result2.text)
		} else if (feedback.definitionId == 'check_expression') {
			const parser = this.#controlsController.createVariablesAndExpressionParser(feedback.location, null)
			const res = parser.executeExpression(feedback.options.expression, 'boolean')

			this.#variableSubscriptions.set(feedback.id, { controlId: feedback.controlId, variables: res.variableIds })

			if (res.ok) {
				return !!res.value
			} else {
				const logger = LogController.createLogger(`Internal/Variables/${feedback.controlId}`)
				logger.warn(`Failed to execute expression "${feedback.options.expression}": ${res.error}`)

				return false
			}
		} else if (feedback.definitionId == 'expression_value') {
			const parser = this.#controlsController.createVariablesAndExpressionParser(feedback.location, null)
			const res = parser.executeExpression(feedback.options.expression, undefined)

			if (res.ok) {
				return {
					value: res.value,
					referencedVariables: Array.from(res.variableIds),
				}
			} else {
				const logger = LogController.createLogger(`Internal/Variables/${feedback.controlId}`)
				logger.warn(`Failed to execute expression "${feedback.options.expression}": ${res.error}`)

				return {
					value: VARIABLE_UNKNOWN_VALUE,
					referencedVariables: Array.from(res.variableIds),
				}
			}
		} else if (feedback.definitionId == 'user_value') {
			// Not used
			return false
		}
	}

	forgetFeedback(feedback: FeedbackEntityModel): void {
		this.#variableSubscriptions.delete(feedback.id)
	}

	#fetchLocationAndControlId(
		options: Record<string, any>,
		extras: RunActionExtras | FeedbackEntityModelExt,
		useVariableFields = false
	): {
		theControlId: string | null
		theLocation: ControlLocation | null
		referencedVariables: string[]
	} {
		const result = this.#internalUtils.parseInternalControlReferenceForActionOrFeedback(
			extras,
			options,
			useVariableFields
		)

		const theControlId = result.location ? this.#pagesController.getControlIdAt(result.location) : null

		return {
			theControlId,
			theLocation: result.location,
			referencedVariables: Array.from(result.referencedVariables),
		}
	}

	#updateLocalVariableValue(
		action: ControlEntityInstance,
		extras: RunActionExtras,
		updateValue: (
			entityPool: ControlEntityListPoolBase,
			listId: SomeSocketEntityLocation,
			variableEntity: ControlEntityInstance
		) => void
	) {
		if (!action.rawOptions.name) return

		const { theControlId } = this.#fetchLocationAndControlId(action.rawOptions, extras, true)
		if (!theControlId) return

		const control = this.#controlsController.getControl(theControlId)
		if (!control || !control.supportsEntities) return

		const variableEntity = control.entities
			.getAllEntities()
			.find((ent) => ent.rawLocalVariableName === action.rawOptions.name)
		if (!variableEntity) return

		const localVariableName = variableEntity.localVariableName
		if (!localVariableName) return

		if (!isInternalUserValueFeedback(variableEntity)) return

		updateValue(control.entities, 'local-variables', variableEntity) // TODO - dynamic listId
	}

	executeAction(action: ControlEntityInstance, extras: RunActionExtras): boolean {
		if (action.definitionId === 'local_variable_set_value') {
			this.#updateLocalVariableValue(action, extras, (entityPool, listId, variableEntity) => {
				entityPool.entitySetVariableValue(listId, variableEntity.id, action.rawOptions.value)
			})

			return true
		} else if (action.definitionId === 'local_variable_set_expression') {
			this.#updateLocalVariableValue(action, extras, (entityPool, listId, variableEntity) => {
				const result = this.#internalUtils.executeExpressionForInternalActionOrFeedback(
					action.rawOptions.expression,
					extras
				)
				if (result.ok) {
					entityPool.entitySetVariableValue(listId, variableEntity.id, result.value)
				} else {
					const logger = LogController.createLogger(`Internal/Variables/${extras.controlId}`)
					logger.warn(`${result.error}, in expression: "${action.rawOptions.expression}"`)
				}
			})

			return true
		} else if (action.definitionId === 'local_variable_reset_to_default') {
			this.#updateLocalVariableValue(action, extras, (entityPool, listId, variableEntity) => {
				entityPool.entitySetVariableValue(listId, variableEntity.id, variableEntity.rawOptions.startup_value)
			})

			return true
		} else if (action.definitionId === 'local_variable_sync_to_default') {
			this.#updateLocalVariableValue(action, extras, (entityPool, listId, variableEntity) => {
				entityPool.entrySetOptions(listId, variableEntity.id, 'startup_value', variableEntity.feedbackValue)
			})

			return true
		}
		return false
	}

	/**
	 * Some variables have been changed
	 */
	onVariablesChanged(changedVariablesSet: Set<string>, fromControlId: string | null): void {
		/**
		 * Danger: It is important to not do any debounces here.
		 * Doing so will cause triggers which are 'on variable change' with a condition to check the variable value to break
		 */

		const affectedFeedbackIds: string[] = []
		for (const [id, { controlId, variables }] of this.#variableSubscriptions.entries()) {
			// Skip if the changes are local variables from a different control
			if (fromControlId && controlId !== fromControlId) continue

			for (const name of variables) {
				if (changedVariablesSet.has(name)) {
					affectedFeedbackIds.push(id)
					break
				}
			}
		}
		if (affectedFeedbackIds.length > 0) {
			this.emit('checkFeedbacksById', ...affectedFeedbackIds)
		}
	}

	/**
	 *
	 */
	visitReferences(visitor: InternalVisitor, _actions: ActionForVisitor[], feedbacks: FeedbackForVisitor[]): void {
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
