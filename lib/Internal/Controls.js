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
import { formatCoordinate, oldBankIndexToXY, xyToOldBankIndex } from '../Shared/ControlId.js'
import { ButtonStyleProperties } from '../Shared/Style.js'
import debounceFn from 'debounce-fn'

const previewButtonXyFn = ((options, info) => {
	// Note: this is manual, and it can't depend on other functions

	// Can't handle variables
	if (options.page_from_variable || options.x_from_variable || options.y_from_variable) return null
	if (options.x_mode === 'expression' || options.y_mode === 'expression') return null

	let pageNumber = options.page
	let theX = options.x_value
	let theY = options.y_value

	if (pageNumber === 0 || pageNumber === '0') pageNumber = info?.pageNumber ?? null
	if (options.x_mode === 'this' || options.x_use_this) theX = info?.column ?? null
	if (options.y_mode === 'this' || options.y_use_this) theY = info?.row ?? null

	return {
		pageNumber,
		row: theY,
		column: theX,
	}
}).toString()

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

const CHOICES_X = [
	{
		type: 'checkbox',
		label: 'Use this X coordinate',
		id: 'x_use_this',
		default: true,
	},
	{
		type: 'number',
		label: 'X coordinate',
		id: 'x_value',
		isVisible: (options) => !options.x_use_this,
		default: 0,
		step: 1,
		// Temporary range
		min: 0,
		max: 7,
	},
]
const CHOICES_Y = [
	{
		type: 'checkbox',
		label: 'Use this Y coordinate',
		id: 'y_use_this',
		default: true,
	},
	{
		type: 'number',
		label: 'Y Coordinate',
		id: 'y_value',
		isVisible: (options) => !options.y_use_this,
		default: 0,
		step: 1,
		// Temporary range
		min: 0,
		max: 3,
	},
]
const CHOICES_XY = serializeIsVisibleFn([...CHOICES_X, ...CHOICES_Y])
const CHOICES_X_WITH_VARIABLES = serializeIsVisibleFn([
	{
		type: 'dropdown',
		label: 'X coordinate mode',
		id: 'x_mode',
		default: 'this',
		choices: [
			{ id: 'this', label: 'This X coordinate' },
			{ id: 'value', label: 'Use value' },
			{ id: 'expression', label: 'Use expression' },
		],
	},
	{
		type: 'number',
		label: 'X coordinate',
		id: 'x_value',
		isVisible: (options) => options.x_mode === 'value',
		default: 0,
		step: 1,
		// Temporary range
		min: 0,
		max: 7,
	},
	{
		type: 'textinput',
		label: 'X coordinate (expression)',
		id: 'x_expression',
		default: '0',
		isVisible: (options) => options.x_mode === 'expression',
		useVariables: true,
	},
])
const CHOICES_Y_WITH_VARIABLES = serializeIsVisibleFn([
	{
		type: 'dropdown',
		label: 'Y coordinate mode',
		id: 'y_mode',
		default: 'this',
		choices: [
			{ id: 'this', label: 'This Y coordinate' },
			{ id: 'value', label: 'Use value' },
			{ id: 'expression', label: 'Use expression' },
		],
	},
	{
		type: 'number',
		label: 'Y coordinate',
		id: 'y_value',
		isVisible: (options) => options.y_mode === 'value',
		default: 0,
		step: 1,
		// Temporary range
		min: 0,
		max: 3,
	},
	{
		type: 'textinput',
		label: 'Y coordinate (expression)',
		id: 'y_expression',
		default: '0',
		isVisible: (options) => options.y_mode === 'expression',
		useVariables: true,
	},
])
const CHOICES_XY_WITH_VARIABLES = [...CHOICES_X_WITH_VARIABLES, ...CHOICES_Y_WITH_VARIABLES]

const ButtonStylePropertiesExt = [
	...ButtonStyleProperties,
	{ id: 'show_topbar', label: 'Topbar' },
	{ id: 'imageBuffers', label: 'Image buffers' },
]

function defineCoordinateAndLegacyAction(name, commonAction) {
	const placeholderIndex = commonAction.options.findIndex((v) => typeof v === 'string')

	const xyOptions = [...commonAction.options]
	xyOptions.splice(placeholderIndex, 1, ...CHOICES_PAGE_WITH_VARIABLES, ...CHOICES_XY_WITH_VARIABLES)
	const legacyOptions = [...commonAction.options]
	legacyOptions.splice(placeholderIndex, 1, ...CHOICES_PAGE_WITH_VARIABLES, {
		type: 'textinput',
		label: 'Button (expression)',
		id: 'bank_variable',
		default: '1',
		isVisible: (options) => !!options.bank_from_variable,
		useVariables: true,
	})

	return {
		[name]: {
			...commonAction,
			previewButtonFn: previewButtonXyFn,
			options: xyOptions,
		},
		[`${name}_legacy`]: {
			...commonAction,
			label: commonAction.label + ' (Deprecated)',
			description: 'This uses the deprecated bank index, this does not support the full range of buttons',
			options: legacyOptions,
		},
	}
}

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

	#fetchPageAndButton(options, location) {
		let thePage = options.page

		if (options.page_from_variable) {
			thePage = this.instance.variable.parseExpression(options.page_variable, 'number').value
		}
		let bankIndex = this.instance.variable.parseExpression(options.bank_variable, 'number').value

		if (thePage === 0 || thePage === '0') thePage = location?.pageNumber ?? null
		if (bankIndex === 0 || bankIndex === '0')
			bankIndex = location ? xyToOldBankIndex(location.column, location.row) : null

		const xy = oldBankIndexToXY(bankIndex)
		const theLocation = {
			pageNumber: thePage,
			column: xy?.[0] ?? null,
			row: xy?.[1] ?? null,
		}
		const theControlId = this.page.getControlIdAt(theLocation)

		return {
			theControlId,
		}
	}

	#fetchPageAndCoordinate(options, location, useVariableFields) {
		let thePage = options.page
		let theX = options.x_value
		let theY = options.y_value

		if (thePage === 0 || thePage === '0') thePage = location?.pageNumber ?? null
		if (options.x_use_this) theX = location?.column ?? null
		if (options.y_use_this) theY = location?.row ?? null

		switch (options.x_mode) {
			case 'this':
				theX = location?.column ?? null
				break
			case 'value':
				theX = options.x_value
				break
			case 'expression':
				theX = useVariableFields ? this.instance.variable.parseExpression(options.x_expression, 'number').value : null
				break
		}
		switch (options.y_mode) {
			case 'this':
				theY = location?.row ?? null
				break
			case 'value':
				theY = options.y_value
				break
			case 'expression':
				theY = useVariableFields ? this.instance.variable.parseExpression(options.y_expression, 'number').value : null
				break
		}

		const theLocation = {
			pageNumber: thePage,
			column: theX,
			row: theY,
		}

		const theCoordinate = formatCoordinate(theX, theY)
		const theControlId = this.page.getControlIdAt(theLocation)

		return {
			thePage,
			theX,
			theY,
			theCoordinate,
			theControlId,
			theLocation,
		}
	}

	getActionDefinitions() {
		return {
			...defineCoordinateAndLegacyAction('button_pressrelease', {
				label: 'Button: Trigger press and release',
				options: [
					'__CHOICES_BUTTON_PLACEHOLDER__',
					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
					},
				],
			}),
			...defineCoordinateAndLegacyAction('button_pressrelease_if_expression', {
				label: 'Button: Trigger press and release if expression is true',
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '$(internal:time_s) >= 0',
						useVariables: true,
					},

					'__CHOICES_BUTTON_PLACEHOLDER__',

					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
					},
				],
			}),
			...defineCoordinateAndLegacyAction('button_pressrelease_condition', {
				label: 'Button: Trigger press and release if variable meets condition',
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

					'__CHOICES_BUTTON_PLACEHOLDER__',
				],
			}),

			...defineCoordinateAndLegacyAction('button_press', {
				label: 'Button: Trigger press',
				options: [
					'__CHOICES_BUTTON_PLACEHOLDER__',
					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
					},
				],
			}),
			...defineCoordinateAndLegacyAction('button_release', {
				label: 'Button: Trigger release',
				options: [
					'__CHOICES_BUTTON_PLACEHOLDER__',
					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
					},
				],
			}),

			...defineCoordinateAndLegacyAction('button_rotate_left', {
				label: 'Button: Trigger rotate left',
				description: 'Make sure to enable rotary actions for the specified button',
				options: ['__CHOICES_BUTTON_PLACEHOLDER__'],
			}),
			...defineCoordinateAndLegacyAction('button_rotate_right', {
				label: 'Button: Trigger rotate right',
				description: 'Make sure to enable rotary actions for the specified button',
				options: ['__CHOICES_BUTTON_PLACEHOLDER__'],
			}),

			...defineCoordinateAndLegacyAction('button_text', {
				label: 'Button: Set text',
				options: [
					{
						type: 'textinput',
						label: 'Button Text',
						id: 'label',
						default: '',
					},
					'__CHOICES_BUTTON_PLACEHOLDER__',
				],
			}),
			...defineCoordinateAndLegacyAction('textcolor', {
				label: 'Button: Set text color',
				options: [
					{
						type: 'colorpicker',
						label: 'Text Color',
						id: 'color',
						default: '0',
					},
					'__CHOICES_BUTTON_PLACEHOLDER__',
				],
			}),
			...defineCoordinateAndLegacyAction('bgcolor', {
				label: 'Button: Set background color',
				options: [
					{
						type: 'colorpicker',
						label: 'Background Color',
						id: 'color',
						default: '0',
					},
					'__CHOICES_BUTTON_PLACEHOLDER__',
				],
			}),

			...defineCoordinateAndLegacyAction('panic_bank', {
				label: 'Actions: Abort actions on button',
				options: [
					'__CHOICES_BUTTON_PLACEHOLDER__',
					{
						type: 'checkbox',
						label: 'Skip release actions?',
						id: 'unlatch',
						default: false,
					},
				],
			}),
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

			...defineCoordinateAndLegacyAction('bank_current_step', {
				label: 'Button: Set current step',
				options: [
					'__CHOICES_BUTTON_PLACEHOLDER__',
					{
						type: 'number',
						label: 'Step',
						tooltip: 'Which Step?',
						id: 'step',
						default: 1,
						min: 1,
					},
				],
			}),
			...defineCoordinateAndLegacyAction('bank_current_step_condition', {
				label: 'Button: Set current step if variable meets condition',
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

					'__CHOICES_BUTTON_PLACEHOLDER__',

					{
						type: 'number',
						label: 'Step',
						tooltip: 'Which Step?',
						id: 'step',
						default: 1,
						min: 1,
					},
				],
			}),
			...defineCoordinateAndLegacyAction('bank_current_step_if_expression', {
				label: 'Button: Set current step if expression is true',
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '$(internal:time_s) >= 0',
						useVariables: true,
					},
					'__CHOICES_BUTTON_PLACEHOLDER__',
					{
						type: 'number',
						label: 'Step',
						tooltip: 'Which Step?',
						id: 'step',
						default: 1,
						min: 1,
					},
				],
			}),
			...defineCoordinateAndLegacyAction('bank_current_step_delta', {
				label: 'Button: Skip step',
				options: [
					'__CHOICES_BUTTON_PLACEHOLDER__',
					{
						type: 'number',
						label: 'Amount',
						tooltip: 'Negative to go backwards',
						id: 'amount',
						default: 1,
					},
				],
			}),
		}
	}

	getFeedbackDefinitions() {
		return {
			bank_style: {
				type: 'advanced',
				label: 'Button: Use another buttons style',
				description: 'Imitate the style of another button',
				previewButtonFn: previewButtonXyFn,
				options: [
					CHOICES_PAGE,
					...CHOICES_XY,
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
				previewButtonFn: previewButtonXyFn,
				style: {
					color: rgb(255, 255, 255),
					bgcolor: rgb(255, 0, 0),
				},
				options: [
					CHOICES_PAGE,
					...CHOICES_XY,
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
				previewButtonFn: previewButtonXyFn,
				style: {
					color: rgb(0, 0, 0),
					bgcolor: rgb(0, 255, 0),
				},
				options: [
					CHOICES_PAGE,
					...CHOICES_XY,
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
			const { theLocation } = this.#fetchPageAndCoordinate(feedback.options, feedback.location)

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
				return {}
			}

			const render = this.graphics.getBank(theLocation)
			if (render?.style) {
				if (!feedback.options.properties) {
					// TODO populate these properties instead
					return cloneDeep(render.style)
				} else {
					const newStyle = {}

					for (const prop of feedback.options.properties) {
						newStyle[prop] = render.style[prop]
					}

					// Return cloned resolved style
					return cloneDeep(newStyle)
				}
			} else {
				return {}
			}
		} else if (feedback.type === 'bank_pushed') {
			const { theControlId } = this.#fetchPageAndCoordinate(feedback.options, feedback.location)

			const control = this.controls.getControl(theControlId)
			if (control) {
				let isPushed = !!control.pushed

				if (!isPushed && feedback.options.latch_compatability && typeof control.getActiveStepIndex === 'function') {
					// Backwards compatibility for the old 'latching' behaviour
					isPushed = control.getActiveStepIndex() !== 0
				}

				return isPushed
			} else {
				return false
			}
		} else if (feedback.type == 'bank_current_step') {
			const { theControlId } = this.#fetchPageAndCoordinate(feedback.options, feedback.location)

			const theStep = feedback.options.step

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.getActiveStepIndex === 'function') {
				return control.getActiveStepIndex() + 1 === theStep
			} else {
				return false
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

		// Update bank -> coordinates
		if (
			action.action === 'button_pressrelease' ||
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
			action.action === 'bank_current_step_delta'
		) {
			if (action.options.bank_from_variable) {
				action.action += '_legacy'
				changed = true
			} else if (action.options.x_value === undefined && action.options.bank !== undefined) {
				const xy = oldBankIndexToXY(action.options.bank)
				if (!xy) {
					// referencing 'this'

					action.options.x_mode = 'this'
					action.options.y_mode = 'this'
					action.options.x_value = 0
					action.options.y_value = 0
					action.options.x_expression = '0'
					action.options.y_expression = '0'
				} else {
					action.options.x_mode = 'value'
					action.options.y_mode = 'value'
					action.options.x_value = xy[0]
					action.options.y_value = xy[1]
					action.options.x_expression = '0'
					action.options.y_expression = '0'
				}

				delete action.options.bank
				changed = true
			}
		}

		if (changed) return action
	}

	executeAction(action, location) {
		if (action.action === 'button_pressrelease') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)
			const forcePress = !!action.options.force

			this.controls.pressControl(theControlId, true, location.deviceid, forcePress)
			this.controls.pressControl(theControlId, false, location.deviceid, forcePress)
			return true
		} else if (action.action === 'button_pressrelease_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)
			const forcePress = !!action.options.force

			this.controls.pressControl(theControlId, true, location.deviceid, forcePress)
			this.controls.pressControl(theControlId, false, location.deviceid, forcePress)
			return true
		} else if (action.action == 'button_pressrelease_if_expression') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)
			const forcePress = !!action.options.force

			const pressIt = !!this.instance.variable.parseExpression(action.options.expression, 'boolean').value

			if (pressIt) {
				this.controls.pressControl(theControlId, true, location.deviceid, forcePress)
				this.controls.pressControl(theControlId, false, location.deviceid, forcePress)
			}
		} else if (action.action == 'button_pressrelease_if_expression_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)
			const forcePress = !!action.options.force

			const pressIt = !!this.instance.variable.parseExpression(action.options.expression, 'boolean').value

			if (pressIt) {
				this.controls.pressControl(theControlId, true, location.deviceid, forcePress)
				this.controls.pressControl(theControlId, false, location.deviceid, forcePress)
			}
		} else if (action.action == 'button_pressrelease_condition') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)
			const forcePress = !!action.options.force

			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const condition = this.instance.variable.parseVariables(action.options.value).text

			let pressIt = checkCondition(action.options.op, condition, variable_value)

			if (pressIt) {
				this.controls.pressControl(theControlId, true, location.deviceid, forcePress)
				this.controls.pressControl(theControlId, false, location.deviceid, forcePress)
			}
		} else if (action.action == 'button_pressrelease_condition_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)
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
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			this.controls.pressControl(theControlId, true, location.deviceid, !!action.options.force)
			return true
		} else if (action.action === 'button_press_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			this.controls.pressControl(theControlId, true, location.deviceid, !!action.options.force)
			return true
		} else if (action.action === 'button_release') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			this.controls.pressControl(theControlId, false, location.deviceid, !!action.options.force)
			return true
		} else if (action.action === 'button_release_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			this.controls.pressControl(theControlId, false, location.deviceid, !!action.options.force)
			return true
		} else if (action.action === 'button_rotate_left') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			this.controls.rotateControl(theControlId, false, location.deviceid)
			return true
		} else if (action.action === 'button_rotate_left_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			this.controls.rotateControl(theControlId, false, location.deviceid)
			return true
		} else if (action.action === 'button_rotate_right') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			this.controls.rotateControl(theControlId, true, location.deviceid)
			return true
		} else if (action.action === 'button_rotate_right_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			this.controls.rotateControl(theControlId, true, location.deviceid)
			return true
		} else if (action.action === 'bgcolor') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ bgcolor: action.options.color })
			}
			return true
		} else if (action.action === 'bgcolor_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ bgcolor: action.options.color })
			}
			return true
		} else if (action.action === 'textcolor') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ color: action.options.color })
			}
			return true
		} else if (action.action === 'textcolor_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ color: action.options.color })
			}
			return true
		} else if (action.action === 'button_text') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ text: action.options.label })
			}

			return true
		} else if (action.action === 'button_text_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ text: action.options.label })
			}

			return true
		} else if (action.action === 'panic_bank') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			this.controls.actions.abortControlDelayed(theControlId, action.options.unlatch)
			return true
		} else if (action.action === 'panic_bank_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			this.controls.actions.abortControlDelayed(theControlId, action.options.unlatch)
			return true
		} else if (action.action === 'panic_page') {
			const { thePage } = this.#fetchPageAndCoordinate(action.options, location, true)

			this.controls.actions.abortPageDelayed(thePage, action.options.ignoreSelf && location ? [location] : undefined)
			return true
		} else if (action.action === 'panic') {
			this.controls.actions.abortAllDelayed()
			return true
		} else if (action.action == 'bank_current_step') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepMakeCurrent === 'function') {
				control.stepMakeCurrent(action.options.step)
			}
		} else if (action.action == 'bank_current_step_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepMakeCurrent === 'function') {
				control.stepMakeCurrent(action.options.step)
			}
		} else if (action.action == 'bank_current_step_condition') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

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
		} else if (action.action == 'bank_current_step_condition_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

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
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			const pressIt = !!this.instance.variable.parseExpression(action.options.expression, 'boolean').value

			if (pressIt) {
				if (control && typeof control.stepMakeCurrent === 'function') {
					control.stepMakeCurrent(action.options.step)
				}
			}
		} else if (action.action == 'bank_current_step_if_expression_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			const pressIt = !!this.instance.variable.parseExpression(action.options.expression, 'boolean').value

			if (pressIt) {
				if (control && typeof control.stepMakeCurrent === 'function') {
					control.stepMakeCurrent(action.options.step)
				}
			}
		} else if (action.action == 'bank_current_step_delta') {
			const { theControlId } = this.#fetchPageAndCoordinate(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepAdvanceDelta === 'function') {
				control.stepAdvanceDelta(action.options.amount)
			}
		} else if (action.action == 'bank_current_step_delta_legacy') {
			const { theControlId } = this.#fetchPageAndButton(action.options, location, true)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepAdvanceDelta === 'function') {
				control.stepAdvanceDelta(action.options.amount)
			}
		}
	}

	visitReferences(visitor, actions, feedbacks) {
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
