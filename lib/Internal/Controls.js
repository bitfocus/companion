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

import { serializeIsVisibleFn } from '@companion-module/base/dist/internal/base.js'
import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import { SplitVariableId, rgb } from '../Resources/Util.js'
import { oldBankIndexToXY } from '../Shared/ControlId.js'
import { ButtonStyleProperties } from '../Shared/Style.js'
import debounceFn from 'debounce-fn'
import { ParseInternalControlReference } from './Util.js'

const CHOICES_PAGE = {
	type: 'internal:page',
	label: 'Page',
	id: 'page',
	includeDirection: true,
	default: 0,
}
const CHOICES_PAGE_WITH_VARIABLES = serializeIsVisibleFn([
	{
		type: 'checkbox',
		label: 'Use variables for page',
		id: 'page_from_variable',
		default: false,
	},
	{
		...CHOICES_PAGE,
		isVisible: (options) => !options.page_from_variable,
	},
	{
		type: 'textinput',
		label: 'Page (expression)',
		id: 'page_variable',
		default: '1',
		isVisible: (options) => !!options.page_from_variable,
		useVariables: true,
	},
])

const CHOICES_DYNAMIC_LOCATION = serializeIsVisibleFn([
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
	{
		type: 'textinput',
		label: 'Location (text with variables)',
		id: 'location_text',
		default: '$(this:page)/$(this:row)/$(this:column)',
		isVisible: (options) => options.location_target === 'text',
		useVariables: true,
		useInternalLocationVariables: true,
	},
	{
		type: 'textinput',
		label: 'Location (expression)',
		id: 'location_expression',
		default: `concat($(this:page), '/', $(this:row), '/', $(this:column))`,
		isVisible: (options) => options.location_target === 'expression',
		useVariables: true,
		useInternalLocationVariables: true,
	},
])

const ButtonStylePropertiesExt = [
	...ButtonStyleProperties,
	{ id: 'show_topbar', label: 'Topbar' },
	{ id: 'imageBuffers', label: 'Image buffers' },
]

function checkCondition(op, condition, variable_value) {
	let variable_value_number = Number(variable_value)
	let condition_number = Number(condition)

	if (op == 'eq') {
		return variable_value.toString() == condition.toString()
	} else if (op == 'ne') {
		return variable_value.toString() !== condition.toString()
	} else if (op == 'gt') {
		return variable_value_number > condition_number
	} else if (op == 'lt') {
		return variable_value_number < condition_number
	} else {
		return false
	}
}

export default class Controls extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Controls')

		// this.internalModule = internalModule

		const debounceCheckFeedbacks = debounceFn(
			() => {
				// TODO - can we make this more specific? This could invalidate a lot of stuff unnecessarily..
				this.internalModule.checkFeedbacks('bank_style', 'bank_pushed', 'bank_current_step')
			},
			{
				maxWait: 100,
				wait: 20,
				after: true,
			}
		)

		setImmediate(() => {
			this.graphics.on('button_drawn', () => debounceCheckFeedbacks())
		})
	}

	#fetchPage(options, location) {
		let thePage = options.page

		thePage = this.instance.variable.parseExpression(options.page_variable, 'number').value

		if (thePage === 0 || thePage === '0') thePage = location?.pageNumber ?? null

		return {
			thePage,
		}
	}

	#fetchLocationAndControlId(options, pressLocation, useVariableFields) {
		const result = ParseInternalControlReference(this, pressLocation, options, useVariableFields)

		// TODO - validate theLocation

		const theControlId = result.location ? this.page.getControlIdAt(result.location) : undefined

		return {
			theControlId,
			theLocation: result.location,
			referencedVariables: Array.from(result.referencedVariables),
		}
	}

	getActionDefinitions() {
		return {
			button_pressrelease: {
				label: 'Button: Trigger press and release',
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
				showButtonPreview: true,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '$(internal:time_s) >= 0',
						useVariables: true,
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
						useVariables: true,
					},

					...CHOICES_DYNAMIC_LOCATION,
				],
			},

			button_press: {
				label: 'Button: Trigger press',
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
				options: ['__CHOICES_BUTTON_PLACEHOLDER__'],
			},
			button_rotate_right: {
				label: 'Button: Trigger rotate right',
				description: 'Make sure to enable rotary actions for the specified button',
				showButtonPreview: true,
				options: ['__CHOICES_BUTTON_PLACEHOLDER__'],
			},

			button_text: {
				label: 'Button: Set text',
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
				label: 'Actions: Abort actions on button',
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
				options: [
					...CHOICES_PAGE_WITH_VARIABLES,
					{
						type: 'checkbox',
						label: 'Skip this button?',
						id: 'ignoreSelf',
						default: false,
					},
				],
			},
			panic: {
				label: 'Actions: Abort all delayed actions',
				options: [],
			},

			bank_current_step: {
				label: 'Button: Set current step',
				showButtonPreview: true,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'number',
						label: 'Step',
						tooltip: 'Which Step?',
						id: 'step',
						default: 1,
						min: 1,
					},
				],
			},
			bank_current_step_condition: {
				label: 'Button: Set current step if variable meets condition',
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
						useVariables: true,
					},

					...CHOICES_DYNAMIC_LOCATION,

					{
						type: 'number',
						label: 'Step',
						tooltip: 'Which Step?',
						id: 'step',
						default: 1,
						min: 1,
					},
				],
			},
			bank_current_step_if_expression: {
				label: 'Button: Set current step if expression is true',
				showButtonPreview: true,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '$(internal:time_s) >= 0',
						useVariables: true,
					},
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'number',
						label: 'Step',
						tooltip: 'Which Step?',
						id: 'step',
						default: 1,
						min: 1,
					},
				],
			},
			bank_current_step_delta: {
				label: 'Button: Skip step',
				showButtonPreview: true,
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'number',
						label: 'Amount',
						tooltip: 'Negative to go backwards',
						id: 'amount',
						default: 1,
					},
				],
			},
		}
	}

	getFeedbackDefinitions() {
		return {
			bank_style: {
				type: 'advanced',
				label: 'Button: Use another buttons style',
				description: 'Imitate the style of another button',
				showButtonPreview: true,
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
					color: rgb(255, 255, 255),
					bgcolor: rgb(255, 0, 0),
				},
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
				description: 'Change style based on the current step of a bank',
				showButtonPreview: true,
				style: {
					color: rgb(0, 0, 0),
					bgcolor: rgb(0, 255, 0),
				},
				options: [
					...CHOICES_DYNAMIC_LOCATION,
					{
						type: 'number',
						label: 'Step',
						tooltip: 'Which Step?',
						id: 'step',
						default: 1,
						min: 1,
					},
				],
			},
		}
	}

	feedbackUpgrade(feedback, controlId) {
		let changed = false

		if (feedback.options.bank !== undefined) {
			const xy = oldBankIndexToXY(feedback.options.bank)
			if (feedback.options.bank == 0) {
				feedback.options.x_use_this = true
				feedback.options.x_value = 0
				feedback.options.y_use_this = true
				feedback.options.y_value = 0

				delete feedback.options.bank
				changed = true
			} else if (xy) {
				feedback.options.x_use_this = false
				feedback.options.x_value = xy[0]
				feedback.options.y_use_this = false
				feedback.options.y_value = xy[1]

				delete feedback.options.bank
				changed = true
			}
		}

		if (changed) return action
	}

	executeFeedback(feedback) {
		if (feedback.type === 'bank_style') {
			const { theLocation, referencedVariables } = this.#fetchLocationAndControlId(
				feedback.options,
				feedback.location,
				true
			)

			if (
				!feedback.location ||
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

			const render = this.graphics.getBank(theLocation)
			if (render?.style) {
				if (!feedback.options.properties) {
					// TODO populate these properties instead
					return {
						value: cloneDeep(render.style),
						referencedVariables,
					}
				} else {
					const newStyle = {}

					for (const prop of feedback.options.properties) {
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
			const { theControlId, referencedVariables } = this.#fetchLocationAndControlId(feedback.options, feedback.location)

			const control = this.controls.getControl(theControlId)
			if (control) {
				let isPushed = !!control.pushed

				if (!isPushed && feedback.options.latch_compatability && typeof control.getActiveStepIndex === 'function') {
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
			const { theControlId } = this.#fetchLocationAndControlId(feedback.options, feedback.location)

			const theStep = feedback.options.step

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.getActiveStepIndex === 'function') {
				return {
					referencedVariables,
					value: control.getActiveStepIndex() + 1 === theStep,
				}
			} else {
				return {
					referencedVariables,
					value: false,
				}
			}
		}
	}

	actionUpgrade(action, controlId) {
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

	executeAction(action, location) {
		if (action.action === 'button_pressrelease') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)
			const forcePress = !!action.options.force

			this.controls.pressControl(theControlId, true, location.deviceid, forcePress)
			this.controls.pressControl(theControlId, false, location.deviceid, forcePress)
			return true
		} else if (action.action == 'button_pressrelease_if_expression') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)
			const forcePress = !!action.options.force

			const pressIt = !!this.instance.variable.parseExpression(action.options.expression, 'boolean').value

			if (pressIt) {
				this.controls.pressControl(theControlId, true, location.deviceid, forcePress)
				this.controls.pressControl(theControlId, false, location.deviceid, forcePress)
			}
		} else if (action.action == 'button_pressrelease_condition') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)
			const forcePress = !!action.options.force

			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const condition = this.instance.variable.parseVariables(action.options.value).text

			let pressIt = checkCondition(action.options.op, condition, variable_value)

			if (pressIt) {
				this.controls.pressControl(theControlId, true, location.deviceid, forcePress)
				this.controls.pressControl(theControlId, false, location.deviceid, forcePress)
			}
		} else if (action.action === 'button_press') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			this.controls.pressControl(theControlId, true, location.deviceid, !!action.options.force)
			return true
		} else if (action.action === 'button_release') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			this.controls.pressControl(theControlId, false, location.deviceid, !!action.options.force)
			return true
		} else if (action.action === 'button_rotate_left') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			this.controls.rotateControl(theControlId, false, location.deviceid)
			return true
		} else if (action.action === 'button_rotate_right') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			this.controls.rotateControl(theControlId, true, location.deviceid)
			return true
		} else if (action.action === 'bgcolor') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ bgcolor: action.options.color })
			}
			return true
		} else if (action.action === 'textcolor') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ color: action.options.color })
			}
			return true
		} else if (action.action === 'button_text') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ text: action.options.label })
			}

			return true
		} else if (action.action === 'panic_bank') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			this.controls.actions.abortControlDelayed(theControlId, action.options.unlatch)
			return true
		} else if (action.action === 'panic_page') {
			const { thePage } = this.#fetchPage(action.options, location)

			this.controls.actions.abortPageDelayed(thePage, action.options.ignoreSelf && location ? [location] : undefined)
			return true
		} else if (action.action === 'panic') {
			this.controls.actions.abortAllDelayed()
			return true
		} else if (action.action == 'bank_current_step') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepMakeCurrent === 'function') {
				control.stepMakeCurrent(action.options.step)
			}
		} else if (action.action == 'bank_current_step_condition') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const condition = this.instance.variable.parseVariables(action.options.value).text

			let pressIt = checkCondition(action.options.op, condition, variable_value)

			if (pressIt) {
				if (control && typeof control.stepMakeCurrent === 'function') {
					control.stepMakeCurrent(action.options.step)
				}
			}
		} else if (action.action == 'bank_current_step_if_expression') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			const pressIt = !!this.instance.variable.parseExpression(action.options.expression, 'boolean').value

			if (pressIt) {
				if (control && typeof control.stepMakeCurrent === 'function') {
					control.stepMakeCurrent(action.options.step)
				}
			}
		} else if (action.action == 'bank_current_step_delta') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepAdvanceDelta === 'function') {
				control.stepAdvanceDelta(action.options.amount)
			}
		}
	}

	visitReferences(visitor, actions, feedbacks) {
		// TODO-coordinate check this for the updated actions
		for (const action of actions) {
			try {
				// page_variable handled by generic options visitor
				// bank_variable handled by generic options visitor

				// button_pressrelease_if_expression.expression handled by generic options visitor
				// button_text.label handled by generic options visitor

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
