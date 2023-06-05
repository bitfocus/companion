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
import { ButtonStyleProperties } from '../Shared/Style.js'
import debounceFn from 'debounce-fn'

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

const ButtonStylePropertiesExt = [
	...ButtonStyleProperties,
	{ id: 'show_topbar', label: 'Topbar' },
	{ id: 'imageBuffers', label: 'Image buffers' },
]

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
			this.graphics.on('bank_invalidated', (page, bank) => debounceCheckFeedbacks())
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
				options: [
					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
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
				previewControlIdFn: previewControlIdFn,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '$(internal:time_s) >= 0',
						useVariables: true,
					},

					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,

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

			button_press: {
				label: 'Button: Trigger press',
				previewControlIdFn: previewControlIdFn,
				options: [
					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
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
				previewControlIdFn: previewControlIdFn,
				options: [
					...CHOICES_PAGE_WITH_VARIABLES,
					...CHOICES_BUTTON_WITH_VARIABLES,
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
				label: 'Button: Set text',
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
				label: 'Button: Set text color',
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
				label: 'Button: Set background color',
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
				label: 'Actions: Abort actions on button',
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
			bank_current_step_condition: {
				label: 'Button: Set current step if variable meets condition',
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
				previewControlIdFn: previewControlIdFn,
				options: [
					{
						type: 'textinput',
						label: 'Expression',
						id: 'expression',
						default: '$(internal:time_s) >= 0',
						useVariables: true,
					},
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
				label: 'Button: Skip step',
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
				label: 'Button: Use another buttons style',
				description: 'Imitate the style of another button',
				previewControlIdFn: previewControlIdFn,
				options: [
					CHOICES_PAGE,
					CHOICES_BUTTON,
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
			const { theControlId } = this.#fetchPageAndButton(feedback.options, feedback.info)

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

		if (changed) return action
	}

	executeAction(action, extras) {
		if (action.action === 'button_pressrelease') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)
			const forcePress = !!action.options.force

			this.controls.pressControl(theControlId, true, extras.deviceid, forcePress)
			this.controls.pressControl(theControlId, false, extras.deviceid, forcePress)
			return true
		} else if (action.action == 'button_pressrelease_if_expression') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)
			const forcePress = !!action.options.force

			const pressIt = !!this.instance.variable.parseExpression(action.options.expression, 'boolean').value

			if (pressIt) {
				this.controls.pressControl(theControlId, true, extras.deviceid, forcePress)
				this.controls.pressControl(theControlId, false, extras.deviceid, forcePress)
			}
		} else if (action.action == 'button_pressrelease_condition') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)
			const forcePress = !!action.options.force

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
				this.controls.pressControl(theControlId, true, extras.deviceid, forcePress)
				this.controls.pressControl(theControlId, false, extras.deviceid, forcePress)
			}
		} else if (action.action === 'button_press') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			this.controls.pressControl(theControlId, true, extras.deviceid, !!action.options.force)
			return true
		} else if (action.action === 'button_release') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			this.controls.pressControl(theControlId, false, extras.deviceid, !!action.options.force)
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
		} else if (action.action == 'bank_current_step_condition') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			const control = this.controls.getControl(theControlId)

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
				if (control && typeof control.stepMakeCurrent === 'function') {
					control.stepMakeCurrent(action.options.step)
				}
			}
		} else if (action.action == 'bank_current_step_if_expression') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

			const control = this.controls.getControl(theControlId)

			const pressIt = !!this.instance.variable.parseExpression(action.options.expression, 'boolean').value

			if (pressIt) {
				if (control && typeof control.stepMakeCurrent === 'function') {
					control.stepMakeCurrent(action.options.step)
				}
			}
		} else if (action.action == 'bank_current_step_delta') {
			const { theControlId } = this.#fetchPageAndButton(action.options, extras, true)

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
