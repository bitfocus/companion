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
import { CreateBankControlId } from '../Shared/ControlId.js'

const previewControlIdFn = ((options, info) => {
	// Note: this is manual, but it can't depend on other functions

	// Can't handle variables
	if (options.page_from_variable || options.bank_from_variable) return null

	let thePage = options.page
	let theButton = options.bank

	if (info) {
		if (thePage === 0 || thePage === '0') thePage = info.page
		if (theButton === 0 || theButton === '0') theButton = info.bank
	}

	return `bank:${thePage}-${theButton}`
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

const CHOICES_BUTTON = {
	type: 'internal:bank',
	label: 'Button',
	tooltip: 'Which Button?',
	id: 'bank',
	default: 0,
}
const CHOICES_BUTTON_WITH_VARIABLES = serializeIsVisibleFn([
	{
		type: 'checkbox',
		label: 'Use variables for button',
		id: 'bank_from_variable',
		default: false,
	},
	{
		...CHOICES_BUTTON,
		isVisible: (options) => !options.bank_from_variable,
	},
	{
		type: 'textinput',
		label: 'Button (expression)',
		id: 'bank_variable',
		default: '1',
		isVisible: (options) => !!options.bank_from_variable,
		useVariables: true,
	},
])

export default class Controls extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Controls')

		// this.internalModule = internalModule

		setImmediate(() => {
			this.graphics.on('bank_invalidated', (page, bank) => {
				// TODO - can we make this more specific? This could invalidate a lot of stuff unnecessarily..
				this.internalModule.checkFeedbacks('bank_style', 'bank_pushed', 'bank_current_step')
			})
		})
	}

	#fetchPageAndButton(options, info, useVariableFields) {
		let thePage = options.page
		let theButton = options.bank

		if (useVariableFields) {
			if (options.page_from_variable) {
				thePage = this.instance.variable.parseExpression(options.page_variable, 'number').value
			}
			if (options.bank_from_variable) {
				theButton = this.instance.variable.parseExpression(options.bank_variable, 'number').value
			}
		}

		if (info) {
			if (thePage === 0 || thePage === '0') thePage = info.page
			if (theButton === 0 || theButton === '0') theButton = info.bank
		}

		return {
			thePage,
			theButton,
			theControlId: CreateBankControlId(thePage, theButton),
		}
	}

	getActionDefinitions() {
		return {
			button_pressrelease: {
				label: 'Button: Trigger press and release',
				previewControlIdFn: previewControlIdFn,
				options: [...CHOICES_PAGE_WITH_VARIABLES, ...CHOICES_BUTTON_WITH_VARIABLES],
			},
			button_pressrelease_condition: {
				label: 'Button: Trigger press and release if variable meets condition',
				previewControlIdFn: previewControlIdFn,
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

					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
				],
			},
			button_pressrelease_condition_variable: {
				label: 'Button: Trigger press and release if variable meets condition (Custom Variables)',
				options: [
					{
						type: 'internal:variable',
						id: 'variable',
						label: 'Variable to check',
						default: 'internal:time_hms',
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
					{
						type: 'internal:custom_variable',
						label: 'Page by Custom Variable',
						id: 'page',
					},
					{
						type: 'internal:custom_variable',
						label: 'Button by Custom Variable',
						id: 'bank',
					},
				],
			},
			button_press: {
				label: 'Button: Trigger press',
				previewControlIdFn: previewControlIdFn,
				options: [...CHOICES_PAGE_WITH_VARIABLES, ...CHOICES_BUTTON_WITH_VARIABLES],
			},
			button_release: {
				label: 'Button: Trigger release',
				previewControlIdFn: previewControlIdFn,
				options: [...CHOICES_PAGE_WITH_VARIABLES, ...CHOICES_BUTTON_WITH_VARIABLES],
			},
			button_rotate_left: {
				label: 'Button: Trigger rotate left',
				description: 'Make sure to enable rotary actions for the specified button',
				previewControlIdFn: previewControlIdFn,
				options: [...CHOICES_PAGE_WITH_VARIABLES, ...CHOICES_BUTTON_WITH_VARIABLES],
			},
			button_rotate_right: {
				label: 'Button: Trigger rotate right',
				description: 'Make sure to enable rotary actions for the specified button',
				previewControlIdFn: previewControlIdFn,
				options: [...CHOICES_PAGE_WITH_VARIABLES, ...CHOICES_BUTTON_WITH_VARIABLES],
			},

			button_text: {
				label: 'Button Text',
				previewControlIdFn: previewControlIdFn,
				options: [
					{
						type: 'textinput',
						label: 'Button Text',
						id: 'label',
						default: '',
					},
					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
				],
			},
			textcolor: {
				label: 'Button Text Color',
				previewControlIdFn: previewControlIdFn,
				options: [
					{
						type: 'colorpicker',
						label: 'Text Color',
						id: 'color',
						default: '0',
					},
					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
				],
			},
			bgcolor: {
				label: 'Button Background Color',
				previewControlIdFn: previewControlIdFn,
				options: [
					{
						type: 'colorpicker',
						label: 'Background Color',
						id: 'color',
						default: '0',
					},
					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
				],
			},

			panic_bank: {
				label: 'Abort actions on button',
				previewControlIdFn: previewControlIdFn,
				options: [
					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
					{
						type: 'checkbox',
						label: 'Skip release actions?',
						id: 'unlatch',
						default: false,
					},
				],
			},
			panic_page: {
				label: 'Abort all delayed actions on a page',
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
				label: 'Abort all delayed actions',
				options: [],
			},

			bank_current_step: {
				label: 'Set bank step',
				previewControlIdFn: previewControlIdFn,
				options: [
					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
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
				label: 'Skip bank step',
				previewControlIdFn: previewControlIdFn,
				options: [
					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
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
				label: 'Use another buttons style',
				description: 'Imitate the style of another button',
				previewControlIdFn: previewControlIdFn,
				options: [CHOICES_PAGE, CHOICES_BUTTON],
			},
			bank_pushed: {
				type: 'boolean',
				label: 'When button is pushed',
				description: 'Change style when a button is being pressed',
				previewControlIdFn: previewControlIdFn,
				style: {
					color: rgb(255, 255, 255),
					bgcolor: rgb(255, 0, 0),
				},
				options: [
					CHOICES_PAGE,
					CHOICES_BUTTON,
					{
						type: 'checkbox',
						label: 'Treat stepped as pressed? (latch compatability)',
						id: 'latch_compatability',
						default: false,
					},
				],
			},
			bank_current_step: {
				type: 'boolean',
				label: 'Check bank step',
				description: 'Change style based on the current step of a bank',
				previewControlIdFn: previewControlIdFn,
				style: {
					color: rgb(0, 0, 0),
					bgcolor: rgb(0, 255, 0),
				},
				options: [
					CHOICES_PAGE,
					CHOICES_BUTTON,
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

	executeFeedback(feedback) {
		if (feedback.type === 'bank_style') {
			const { thePage, theButton, theControlId } = this.#fetchPageAndButton(feedback.options, feedback.info)

			if (!thePage || !theButton || theControlId === feedback.controlId) {
				// Don't recurse on self
				return {}
			}

			const render = this.graphics.getBank(thePage, theButton)
			if (render?.style) {
				// Return cloned resolved style
				return cloneDeep(render.style)
			} else {
				return {}
			}
		} else if (feedback.type === 'bank_pushed') {
			const { theControlId } = this.#fetchPageAndButton(feedback.options, feedback.info)

			const control = this.controls.getControl(theControlId)
			if (control) {
				let isPushed = !!control.pushed

				if (!isPushed && feedback.options.latch_compatability && typeof control.getActiveStepIndex === 'function') {
					// Backwards compatability for the old 'latching' behaviour
					isPushed = control.getActiveStepIndex() !== 0
				}

				return isPushed
			} else {
				return false
			}
		} else if (feedback.type == 'bank_current_step') {
			const { theControlId } = this.#fetchPageAndButton(feedback.options, feedback.info)
			const theStep = feedback.options.step

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.getActiveStepIndex === 'function') {
				return control.getActiveStepIndex() + 1 === theStep
			} else {
				return false
			}
		}
	}

	executeAction(action, extras) {
		if (action.action === 'button_pressrelease') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			this.controls.pressControl(theControlId, true, extras.deviceid)
			this.controls.pressControl(theControlId, false, extras.deviceid)
			return true
		} else if (action.action == 'button_pressrelease_condition') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const condition = this.instance.variable.parseVariables(action.options.value).text

			let variable_value_number = Number(variable_value)
			let condition_number = Number(condition)
			let pressIt = false
			if (action.options.op == 'eq') {
				if (variable_value.toString() == condition.toString()) {
					pressIt = true
				}
			} else if (action.options.op == 'ne') {
				if (variable_value.toString() !== condition.toString()) {
					pressIt = true
				}
			} else if (action.options.op == 'gt') {
				if (variable_value_number > condition_number) {
					pressIt = true
				}
			} else if (action.options.op == 'lt') {
				if (variable_value_number < condition_number) {
					pressIt = true
				}
			}

			if (pressIt) {
				this.controls.pressControl(theControlId, true, extras.deviceid)
				this.controls.pressControl(theControlId, false, extras.deviceid)
			}
		} else if (action.action == 'button_pressrelease_condition_variable') {
			const [instanceLabel, variableName] = SplitVariableId(action.options.variable)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const condition = this.instance.variable.parseVariables(action.options.value).text

			let variable_value_number = Number(variable_value)
			let condition_number = Number(condition)
			let pressIt = false
			if (action.options.op == 'eq') {
				if (variable_value.toString() == condition.toString()) {
					pressIt = true
				}
			} else if (action.options.op == 'ne') {
				if (variable_value.toString() !== condition.toString()) {
					pressIt = true
				}
			} else if (action.options.op == 'gt') {
				if (variable_value_number > condition_number) {
					pressIt = true
				}
			} else if (action.options.op == 'lt') {
				if (variable_value_number < condition_number) {
					pressIt = true
				}
			}

			if (pressIt) {
				const thePage = parseInt(this.instance.variable.getCustomVariableValue(action.options.page))
				const theButton = parseInt(this.instance.variable.getCustomVariableValue(action.options.bank))

				if (!isNaN(thePage) && !isNaN(theButton)) {
					const controlId = CreateBankControlId(thePage, theButton)
					this.controls.pressControl(controlId, true, extras.deviceid)
					this.controls.pressControl(controlId, false, extras.deviceid)
				}
			}
		} else if (action.action === 'button_press') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			this.controls.pressControl(theControlId, true, extras.deviceid)
			return true
		} else if (action.action === 'button_release') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			this.controls.pressControl(theControlId, false, extras.deviceid)
			return true
		} else if (action.action === 'button_rotate_left') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			this.controls.rotateControl(theControlId, false, extras.deviceid)
			return true
		} else if (action.action === 'button_rotate_right') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			this.controls.rotateControl(theControlId, true, extras.deviceid)
			return true
		} else if (action.action === 'bgcolor') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ bgcolor: action.options.color })
			}
			return true
		} else if (action.action === 'textcolor') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ color: action.options.color })
			}
			return true
		} else if (action.action === 'button_text') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ text: action.options.label })
			}

			return true
		} else if (action.action === 'panic_bank') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			this.controls.actions.abortControlDelayed(theControlId, action.options.unlatch)
			return true
		} else if (action.action === 'panic_page') {
			const { thePage, theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			this.controls.actions.abortPageDelayed(thePage, action.options.ignoreSelf ? [theControlId] : undefined)
			return true
		} else if (action.action === 'panic') {
			this.controls.actions.abortAllDelayed()
			return true
		} else if (action.action == 'bank_current_step') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepMakeCurrent === 'function') {
				control.stepMakeCurrent(action.options.step)
			}
		} else if (action.action == 'bank_current_step_delta') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepAdvanceDelta === 'function') {
				control.stepAdvanceDelta(action.options.amount)
			}
		}
	}
}
