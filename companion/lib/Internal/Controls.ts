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

import { cloneDeep } from 'lodash-es'
import { SplitVariableId, serializeIsVisibleFnSingle } from '../Resources/Util.js'
import { oldBankIndexToXY, ParseControlId } from '@companion-app/shared/ControlId.js'
import { ButtonStyleProperties } from '@companion-app/shared/Style.js'
import debounceFn from 'debounce-fn'
import type {
	FeedbackForVisitor,
	FeedbackInstanceExt,
	InternalModuleFragment,
	InternalVisitor,
	ExecuteFeedbackResultWithReferences,
} from './Types.js'
import type { CompanionVariableValue } from '@companion-module/base'
import type { InternalController } from './Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { VariablesValues } from '../Variables/Values.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { InternalActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import type { InternalFeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import type { InternalActionInputField, InternalFeedbackInputField } from '@companion-app/shared/Model/Options.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

const CHOICES_DYNAMIC_LOCATION: InternalFeedbackInputField[] = [
	{
		type: 'dropdown',
		label: 'Target',
		id: 'location_target',
		default: 'this',
		choices: [
			{ id: 'this', label: 'This button' },
			{ id: 'text', label: 'From text' },
			{ id: 'expression', label: 'From expression' },
		],
	},
	serializeIsVisibleFnSingle({
		type: 'textinput',
		label: 'Location (text with variables)',
		tooltip: 'eg 1/0/0 or $(this:page)/$(this:row)/$(this:column)',
		id: 'location_text',
		default: '$(this:page)/$(this:row)/$(this:column)',
		isVisible: (options) => options.location_target === 'text',
		useVariables: {
			local: true,
		},
	}),
	serializeIsVisibleFnSingle({
		type: 'textinput',
		label: 'Location (expression)',
		tooltip: 'eg `1/0/0` or `${$(this:page) + 1}/${$(this:row)}/${$(this:column)}`',
		id: 'location_expression',
		default: `concat($(this:page), '/', $(this:row), '/', $(this:column))`,
		isVisible: (options) => options.location_target === 'expression',
		useVariables: {
			local: true,
		},
		isExpression: true,
	}),
]

const CHOICES_STEP_WITH_VARIABLES: InternalActionInputField[] = [
	{
		type: 'checkbox',
		label: 'Use variables for step',
		id: 'step_from_expression',
		default: false,
	},
	serializeIsVisibleFnSingle({
		type: 'number',
		label: 'Step',
		tooltip: 'Which Step?',
		id: 'step',
		default: 1,
		min: 1,
		max: Number.MAX_SAFE_INTEGER,
		isVisible: (options) => !options.step_from_expression,
	}),
	serializeIsVisibleFnSingle({
		type: 'textinput',
		label: 'Step (expression)',
		id: 'step_expression',
		default: '1',
		isVisible: (options) => !!options.step_from_expression,
		useVariables: {
			local: true,
		},
		isExpression: true,
	}),
]

const ButtonStylePropertiesExt = [
	...ButtonStyleProperties,
	{ id: 'show_topbar', label: 'Topbar' },
	{ id: 'imageBuffers', label: 'Image buffers' },
]

function checkCondition(
	op: string,
	condition: CompanionVariableValue,
	variable_value: CompanionVariableValue | undefined
): boolean {
	let variable_value_number = Number(variable_value)
	let condition_number = Number(condition)

	if (op == 'eq') {
		return variable_value?.toString() == condition.toString()
	} else if (op == 'ne') {
		return variable_value?.toString() !== condition.toString()
	} else if (op == 'gt') {
		return variable_value_number > condition_number
	} else if (op == 'lt') {
		return variable_value_number < condition_number
	} else {
		return false
	}
}

export class InternalControls implements InternalModuleFragment {
	readonly #internalModule: InternalController
	readonly #graphicsController: GraphicsController
	readonly #controlsController: ControlsController
	readonly #pagesController: PageController
	readonly #variableController: VariablesValues

	constructor(
		internalModule: InternalController,
		graphicsController: GraphicsController,
		controlsController: ControlsController,
		pagesController: PageController,
		variableController: VariablesValues
	) {
		this.#internalModule = internalModule
		this.#graphicsController = graphicsController
		this.#controlsController = controlsController
		this.#pagesController = pagesController
		this.#variableController = variableController

		const debounceCheckFeedbacks = debounceFn(
			() => {
				// TODO - can we make this more specific? This could invalidate a lot of stuff unnecessarily..
				this.#internalModule.checkFeedbacks('bank_style', 'bank_pushed', 'bank_current_step')
			},
			{
				maxWait: 100,
				wait: 20,
				after: true,
			}
		)

		setImmediate(() => {
			this.#graphicsController.on('button_drawn', () => debounceCheckFeedbacks())
		})
	}

	#fetchPage(options: Record<string, any>, extras: RunActionExtras): { thePage: number | null } {
		let thePage = options.page

		if (options.page_from_variable) {
			thePage = this.#internalModule.executeExpressionForInternalActionOrFeedback(
				options.page_variable,
				extras,
				'number'
			).value
		}

		if (thePage === 0 || thePage === '0') thePage = extras.location?.pageNumber ?? null

		return {
			thePage,
		}
	}

	#fetchLocationAndControlId(
		options: Record<string, any>,
		extras: RunActionExtras | FeedbackInstanceExt,
		useVariableFields = false
	): {
		theControlId: string | null
		theLocation: ControlLocation | null
		referencedVariables: string[]
	} {
		const result = this.#internalModule.parseInternalControlReferenceForActionOrFeedback(
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

	#fetchStep(options: Record<string, any>, extras: RunActionExtras): number {
		let theStep = options.step

		if (options.step_from_expression) {
			theStep = this.#internalModule.executeExpressionForInternalActionOrFeedback(
				options.step_expression,
				extras,
				'number'
			).value
		}

		return theStep
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			button_pressrelease: {
				label: 'Button: Trigger press and release',
				description: undefined,
				showButtonPreview: true,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
					},
				],
			},
			button_pressrelease_if_expression: {
				label: 'Button: Trigger press and release if expression is true',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '$(internal:time_s) >= 0',
						useVariables: {
							local: true,
						},
						isExpression: true,
					},

					...CHOICES_DYNAMIC_LOCATION,

					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
					},
				],
			},
			button_pressrelease_condition: {
				label: 'Button: Trigger press and release if variable meets condition',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						type: 'internal:variable',
						id: 'variable',
						label: 'Variable to check',
					},
					{
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
					},
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						useVariables: {
							local: true,
						},
					},

					...CHOICES_DYNAMIC_LOCATION,
				],
			},
			button_press_condition: {
				label: 'Button: Trigger press if variable meets condition',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						type: 'internal:variable',
						id: 'variable',
						label: 'Variable to check',
					},
					{
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
					},
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						useVariables: {
							local: true,
						},
					},

					...CHOICES_DYNAMIC_LOCATION,
				],
			},
			button_release_condition: {
				label: 'Button: Trigger release if variable meets condition',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						type: 'internal:variable',
						id: 'variable',
						label: 'Variable to check',
					},
					{
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
					},
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						useVariables: {
							local: true,
						},
					},

					...CHOICES_DYNAMIC_LOCATION,
				],
			},

			button_press: {
				label: 'Button: Trigger press',
				description: undefined,
				showButtonPreview: true,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
					},
				],
			},
			button_release: {
				label: 'Button: Trigger release',
				description: undefined,
				showButtonPreview: true,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
					},
				],
			},

			button_rotate_left: {
				label: 'Button: Trigger rotate left',
				description: 'Make sure to enable rotary actions for the specified button',
				showButtonPreview: true,
				options: [...CHOICES_DYNAMIC_LOCATION],
			},
			button_rotate_right: {
				label: 'Button: Trigger rotate right',
				description: 'Make sure to enable rotary actions for the specified button',
				showButtonPreview: true,
				options: [...CHOICES_DYNAMIC_LOCATION],
			},

			button_text: {
				label: 'Button: Set text',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						type: 'textinput',
						label: 'Button Text',
						id: 'label',
						default: '',
					},
					...CHOICES_DYNAMIC_LOCATION,
				],
			},
			textcolor: {
				label: 'Button: Set text color',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						type: 'colorpicker',
						label: 'Text Color',
						id: 'color',
						default: '0',
					},
					...CHOICES_DYNAMIC_LOCATION,
				],
			},
			bgcolor: {
				label: 'Button: Set background color',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						type: 'colorpicker',
						label: 'Background Color',
						id: 'color',
						default: '0',
					},
					...CHOICES_DYNAMIC_LOCATION,
				],
			},

			panic_bank: {
				label: 'Actions: Abort delayed actions on a button',
				description: undefined,
				showButtonPreview: true,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'checkbox',
						label: 'Skip release actions?',
						id: 'unlatch',
						default: false,
					},
				],
			},
			panic_page: {
				label: 'Actions: Abort all delayed actions on a page',
				description: undefined,
				options: [
					{
						type: 'checkbox',
						label: 'Use variables for page',
						id: 'page_from_variable',
						default: false,
					},
					serializeIsVisibleFnSingle({
						type: 'internal:page',
						label: 'Page',
						id: 'page',
						includeStartup: false,
						includeDirection: false,
						default: 0,
						isVisible: (options) => !options.page_from_variable,
					}),
					serializeIsVisibleFnSingle({
						type: 'textinput',
						label: 'Page (expression)',
						id: 'page_variable',
						default: '1',
						isVisible: (options) => !!options.page_from_variable,
						useVariables: {
							local: true,
						},
						isExpression: true,
					}),
					{
						type: 'checkbox',
						label: 'Skip this button?',
						id: 'ignoreSelf',
						default: false,
					},
				],
			},
			panic_trigger: {
				label: 'Actions: Abort delayed actions on a trigger',
				description: undefined,
				options: [
					{
						type: 'internal:trigger',
						label: 'Trigger',
						id: 'trigger_id',
						includeSelf: true,
						default: 'self',
					},
				],
			},
			panic: {
				label: 'Actions: Abort all delayed actions on buttons and triggers',
				description: undefined,
				options: [],
			},

			bank_current_step: {
				label: 'Button: Set current step',
				description: undefined,
				showButtonPreview: true,
				options: [...CHOICES_DYNAMIC_LOCATION, ...CHOICES_STEP_WITH_VARIABLES],
			},
			bank_current_step_condition: {
				label: 'Button: Set current step if variable meets condition',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						type: 'internal:variable',
						id: 'variable',
						label: 'Variable to check',
					},
					{
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
					},
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						useVariables: {
							local: true,
						},
					},

					...CHOICES_DYNAMIC_LOCATION,
					...CHOICES_STEP_WITH_VARIABLES,
				],
			},
			bank_current_step_if_expression: {
				label: 'Button: Set current step if expression is true',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '$(internal:time_s) >= 0',
						useVariables: {
							local: true,
						},
						isExpression: true,
					},
					...CHOICES_DYNAMIC_LOCATION,
					...CHOICES_STEP_WITH_VARIABLES,
				],
			},
			bank_current_step_delta: {
				label: 'Button: Skip step',
				description: undefined,
				showButtonPreview: true,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'number',
						label: 'Amount',
						tooltip: 'Negative to go backwards',
						id: 'amount',
						default: 1,
						min: Number.MIN_SAFE_INTEGER,
						max: Number.MAX_SAFE_INTEGER,
					},
				],
			},
		}
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			bank_style: {
				type: 'advanced',
				label: 'Button: Use another buttons style',
				description: 'Imitate the style of another button',
				showButtonPreview: true,
				style: undefined,
				showInvert: false,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						id: 'properties',
						label: 'Properties',
						type: 'multidropdown',
						minSelection: 1,
						choices: ButtonStylePropertiesExt,
						default: ButtonStylePropertiesExt.map((p) => p.id),
					},
				],
			},
			bank_pushed: {
				type: 'boolean',
				label: 'Button: When pushed',
				description: 'Change style when a button is being pressed',
				showButtonPreview: true,
				style: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'checkbox',
						label: 'Treat stepped as pressed? (latch compatibility)',
						id: 'latch_compatability',
						default: false,
					},
				],
			},
			bank_current_step: {
				type: 'boolean',
				label: 'Button: Check step',
				description: 'Change style based on the current step of a button',
				showButtonPreview: true,
				style: {
					color: 0x000000,
					bgcolor: 0x00ff00,
				},
				showInvert: true,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'number',
						label: 'Step',
						tooltip: 'Which Step?',
						id: 'step',
						default: 1,
						min: 1,
						max: Number.MAX_SAFE_INTEGER,
					},
				],
			},
		}
	}

	feedbackUpgrade(feedback: FeedbackInstance, _controlId: string): FeedbackInstance | void {
		let changed = false

		if (feedback.options.bank !== undefined) {
			if (feedback.options.bank == 0 && feedback.options.page == 0) {
				feedback.options.location_target = 'this'

				delete feedback.options.bank
				delete feedback.options.page
				changed = true
			} else {
				const xy = oldBankIndexToXY(feedback.options.bank)

				let pageNumber = feedback.options.page
				if (pageNumber == 0) pageNumber = `$(this:page)`

				const buttonId = xy ? `${xy[1]}/${xy[0]}` : `$(this:row)/$(this:column)`

				feedback.options.location_target = 'text'
				feedback.options.location_text = `${pageNumber}/${buttonId}`

				delete feedback.options.bank
				delete feedback.options.page
				changed = true
			}
		}

		if (changed) return feedback
	}

	executeFeedback(feedback: FeedbackInstanceExt): ExecuteFeedbackResultWithReferences | void {
		if (feedback.type === 'bank_style') {
			const { theLocation, referencedVariables } = this.#fetchLocationAndControlId(feedback.options, feedback, true)

			if (
				!feedback.location ||
				!theLocation ||
				!theLocation.pageNumber ||
				typeof theLocation.column !== 'number' ||
				typeof theLocation.row !== 'number' ||
				(theLocation.pageNumber === feedback.location.pageNumber &&
					theLocation.column === feedback.location.column &&
					theLocation.row === feedback.location.row)
			) {
				// Don't recurse on self
				return {
					referencedVariables,
					value: {},
				}
			}

			const render = this.#graphicsController.getCachedRender(theLocation)
			if (render?.style && typeof render.style === 'object') {
				if (!feedback.options.properties) {
					// TODO populate these properties instead
					return {
						value: cloneDeep(render.style),
						referencedVariables,
					}
				} else {
					/** @type {Record<string, any>} */
					const newStyle = {}

					for (const prop of feedback.options.properties) {
						// @ts-ignore
						newStyle[prop] = render.style[prop]
					}

					// Return cloned resolved style
					return {
						value: cloneDeep(newStyle),
						referencedVariables,
					}
				}
			} else {
				return {
					referencedVariables,
					value: {},
				}
			}
		} else if (feedback.type === 'bank_pushed') {
			const { theControlId, referencedVariables } = this.#fetchLocationAndControlId(feedback.options, feedback, true)

			const control = theControlId && this.#controlsController.getControl(theControlId)
			if (control && control.supportsPushed) {
				let isPushed = !!control.pushed

				if (!isPushed && feedback.options.latch_compatability && control.supportsSteps) {
					// Backwards compatibility for the old 'latching' behaviour
					isPushed = control.getActiveStepIndex() !== 0
				}

				return {
					referencedVariables,
					value: isPushed,
				}
			} else {
				return {
					referencedVariables,
					value: false,
				}
			}
		} else if (feedback.type == 'bank_current_step') {
			const { theControlId } = this.#fetchLocationAndControlId(feedback.options, feedback, true)

			const theStep = feedback.options.step

			const control = theControlId && this.#controlsController.getControl(theControlId)
			if (control && control.supportsSteps) {
				return {
					referencedVariables: [],
					value: control.getActiveStepIndex() + 1 === theStep,
				}
			} else {
				return {
					referencedVariables: [],
					value: false,
				}
			}
		}
	}

	actionUpgrade(action: ActionInstance, _controlId: string): ActionInstance | void {
		let changed = false
		if (
			action.action === 'button_pressrelease' ||
			action.action === 'button_pressrelease_if_expression' ||
			action.action === 'button_pressrelease_condition' ||
			action.action === 'button_pressrelease_condition_variable' ||
			action.action === 'button_press' ||
			action.action === 'button_release'
		) {
			if (action.options.force === undefined) {
				action.options.force = true

				changed = true
			}
		}

		if (action.action === 'button_pressrelease_condition_variable') {
			action.action = 'button_pressrelease_condition'

			// Also mangle the page & bank inputs
			action.options.page_from_variable = true
			action.options.bank_from_variable = true
			action.options.page_variable = `$(${action.options.page})`
			delete action.options.page
			action.options.bank_variable = `$(${action.options.bank})`
			delete action.options.bank

			changed = true
		}

		// Update bank -> location
		if (
			action.options.location_target === undefined &&
			(action.action === 'button_pressrelease' ||
				action.action === 'button_press' ||
				action.action === 'button_pressrelease_if_expression' ||
				action.action === 'button_pressrelease_condition' ||
				action.action === 'button_press' ||
				action.action === 'button_release' ||
				action.action === 'button_rotate_left' ||
				action.action === 'button_rotate_right' ||
				action.action === 'button_text' ||
				action.action === 'textcolor' ||
				action.action === 'bgcolor' ||
				action.action === 'panic_bank' ||
				action.action === 'bank_current_step' ||
				action.action === 'bank_current_step_condition' ||
				action.action === 'bank_current_step_if_expression' ||
				action.action === 'bank_current_step_delta')
		) {
			const oldOptions = { ...action.options }
			delete action.options.bank
			delete action.options.bank_variable
			delete action.options.bank_from_variable
			delete action.options.page
			delete action.options.page_variable
			delete action.options.page_from_variable

			if (oldOptions.bank == 0 && oldOptions.page == 0) {
				action.options.location_target = 'this'

				changed = true
			} else {
				const xy = oldBankIndexToXY(oldOptions.bank)

				let pageNumber = oldOptions.page_from_variable ? oldOptions.page_variable : oldOptions.page
				if (pageNumber == 0) pageNumber = `$(this:page)`

				if (oldOptions.bank_from_variable || oldOptions.page_from_variable) {
					const column = xy ? xy[0] : '$(this:column)'
					const row = xy ? xy[1] : '$(this:row)'

					action.options.location_target = 'expression'
					action.options.location_expression = oldOptions.bank_from_variable
						? `concat(${pageNumber}, '/bank', ${oldOptions.bank_variable})`
						: `concat(${pageNumber}, '/', ${row}, '/', ${column})`
				} else {
					const buttonId = xy ? `${xy[1]}/${xy[0]}` : `$(this:row)/$(this:column)`

					action.options.location_target = 'text'
					action.options.location_text = `${pageNumber}/${buttonId}`
				}

				changed = true
			}
		}

		if (changed) return action
	}

	executeAction(action: ActionInstance, extras: RunActionExtras): boolean {
		if (action.action === 'button_pressrelease') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const forcePress = !!action.options.force

			this.#controlsController.pressControl(theControlId, true, extras.surfaceId, forcePress)
			this.#controlsController.pressControl(theControlId, false, extras.surfaceId, forcePress)
			return true
		} else if (action.action == 'button_pressrelease_if_expression') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const forcePress = !!action.options.force

			const pressIt = !!this.#internalModule.executeExpressionForInternalActionOrFeedback(
				action.options.expression,
				extras,
				'boolean'
			).value

			if (pressIt) {
				this.#controlsController.pressControl(theControlId, true, extras.surfaceId, forcePress)
				this.#controlsController.pressControl(theControlId, false, extras.surfaceId, forcePress)
			}
			return true
		} else if (action.action == 'button_pressrelease_condition') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const forcePress = !!action.options.force

			const [connectionLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.#variableController.getVariableValue(connectionLabel, variableName)

			const condition = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				action.options.value,
				extras
			).text

			let pressIt = checkCondition(action.options.op, condition, variable_value)

			if (pressIt) {
				this.#controlsController.pressControl(theControlId, true, extras.surfaceId, forcePress)
				this.#controlsController.pressControl(theControlId, false, extras.surfaceId, forcePress)
			}
			return true
		} else if (action.action == 'button_press_condition') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const forcePress = !!action.options.force

			const [connectionLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.#variableController.getVariableValue(connectionLabel, variableName)

			const condition = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				action.options.value,
				extras
			).text

			let pressIt = checkCondition(action.options.op, condition, variable_value)

			if (pressIt) {
				this.#controlsController.pressControl(theControlId, true, extras.surfaceId, forcePress)
			}
			return true
		} else if (action.action == 'button_release_condition') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const forcePress = !!action.options.force

			const [connectionLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.#variableController.getVariableValue(connectionLabel, variableName)

			const condition = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				action.options.value,
				extras
			).text

			let pressIt = checkCondition(action.options.op, condition, variable_value)

			if (pressIt) {
				this.#controlsController.pressControl(theControlId, false, extras.surfaceId, forcePress)
			}
			return true
		} else if (action.action === 'button_press') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			this.#controlsController.pressControl(theControlId, true, extras.surfaceId, !!action.options.force)
			return true
		} else if (action.action === 'button_release') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			this.#controlsController.pressControl(theControlId, false, extras.surfaceId, !!action.options.force)
			return true
		} else if (action.action === 'button_rotate_left') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			this.#controlsController.rotateControl(theControlId, false, extras.surfaceId)
			return true
		} else if (action.action === 'button_rotate_right') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			this.#controlsController.rotateControl(theControlId, true, extras.surfaceId)
			return true
		} else if (action.action === 'bgcolor') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)
			if (control && control.supportsStyle) {
				control.styleSetFields({ bgcolor: action.options.color })
			}
			return true
		} else if (action.action === 'textcolor') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)
			if (control && control.supportsStyle) {
				control.styleSetFields({ color: action.options.color })
			}
			return true
		} else if (action.action === 'button_text') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)
			if (control && control.supportsStyle) {
				control.styleSetFields({ text: action.options.label })
			}

			return true
		} else if (action.action === 'panic_bank') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			this.#controlsController.actions.abortControlDelayed(theControlId, action.options.unlatch)
			return true
		} else if (action.action === 'panic_page') {
			const { thePage } = this.#fetchPage(action.options, extras)
			if (thePage === null) return true

			this.#controlsController.actions.abortPageDelayed(
				thePage,
				action.options.ignoreSelf && extras.location ? [extras.location] : undefined
			)
			return true
		} else if (action.action === 'panic_trigger') {
			let controlId = action.options.trigger_id
			if (controlId === 'self') controlId = extras.controlId

			if (controlId && ParseControlId(controlId)?.type === 'trigger') {
				this.#controlsController.actions.abortControlDelayed(controlId, false)
			}

			return true
		} else if (action.action === 'panic') {
			this.#controlsController.actions.abortAllDelayed()
			return true
		} else if (action.action == 'bank_current_step') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const theStep = this.#fetchStep(action.options, extras)

			const control = this.#controlsController.getControl(theControlId)

			if (control && control.supportsSteps) {
				control.stepMakeCurrent(theStep)
			}
			return true
		} else if (action.action == 'bank_current_step_condition') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const theStep = this.#fetchStep(action.options, extras)

			const control = this.#controlsController.getControl(theControlId)

			const [connectionLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.#variableController.getVariableValue(connectionLabel, variableName)

			const condition = this.#internalModule.parseVariablesForInternalActionOrFeedback(
				action.options.value,
				extras
			).text

			let pressIt = checkCondition(action.options.op, condition, variable_value)

			if (pressIt) {
				if (control && control.supportsSteps) {
					control.stepMakeCurrent(theStep)
				}
			}
			return true
		} else if (action.action == 'bank_current_step_if_expression') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const theStep = this.#fetchStep(action.options, extras)

			const control = this.#controlsController.getControl(theControlId)

			const pressIt = !!this.#internalModule.executeExpressionForInternalActionOrFeedback(
				action.options.expression,
				extras,
				'boolean'
			).value

			if (pressIt) {
				if (control && control.supportsSteps) {
					control.stepMakeCurrent(theStep)
				}
			}
			return true
		} else if (action.action == 'bank_current_step_delta') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras, true)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)

			if (control && control.supportsSteps) {
				control.stepAdvanceDelta(action.options.amount)
			}
			return true
		} else {
			return false
		}
	}

	visitReferences(visitor: InternalVisitor, actions: ActionInstance[], _feedbacks: FeedbackForVisitor[]): void {
		for (const action of actions) {
			try {
				// any expression/variables fields are handled by generic options visitor

				if (action.action === 'button_pressrelease_condition') {
					visitor.visitVariableName(action.options, 'variable')

					// value handled by generic options visitor
				}
			} catch (e) {
				//Ignore
			}
		}
	}
}
