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
import CoreBase from '../Core/Base.js'
import { rgb } from '../Resources/Util.js'
import { CreateBankControlId } from '../Shared/ControlId.js'

function fetchPageAndBank(options, info) {
	let thePage = options.page
	let theBank = options.bank

	if (info) {
		if (thePage === 0 || thePage === '0' || thePage === undefined) thePage = info.page
		if (theBank === 0 || theBank === '0' || theBank === undefined) theBank = info.bank
	}

	return {
		thePage,
		theBank,
		theControlId: CreateBankControlId(thePage, theBank),
	}
}

export default class Bank extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Bank')

		// this.internalModule = internalModule

		setImmediate(() => {
			this.graphics.on('bank_invalidated', (page, bank) => {
				// TODO - can we make this more specific? This could invalidate a lot of stuff unnecessarily..
				this.internalModule.checkFeedbacks('bank_style', 'bank_pushed', 'bank_current_step')
			})
		})
	}

	getActionDefinitions() {
		return {
			button_pressrelease: {
				label: 'Button press and release',
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which button?',
						id: 'bank',
						default: 0,
					},
				],
			},
			button_pressrelease_condition: {
				label: 'Button Press and Release if Variable meets Condition',
				previewBank: ['page', 'bank'],
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
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which button?',
						id: 'bank',
						default: 0,
					},
				],
			},
			button_pressrelease_condition_variable: {
				label: 'Button Press and Release if Variable meets Condition (Custom Variables)',
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
						label: 'Bank by Custom Variable',
						id: 'bank',
					},
				],
			},
			button_press: {
				label: 'Button Press',
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
				],
			},
			button_release: {
				label: 'Button Release',
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
				],
			},

			button_text: {
				label: 'Button Text',
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'textinput',
						label: 'Button Text',
						id: 'label',
						default: '',
					},
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
				],
			},
			textcolor: {
				label: 'Button Text Color',
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'colorpicker',
						label: 'Text Color',
						id: 'color',
						default: '0',
					},
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
				],
			},
			bgcolor: {
				label: 'Button Background Color',
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'colorpicker',
						label: 'Background Color',
						id: 'color',
						default: '0',
					},
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
				],
			},

			panic_bank: {
				label: 'Abort actions on button',
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
					{
						type: 'checkbox',
						label: 'Skip release actions?',
						id: 'unlatch',
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
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
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
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
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
				previewBank: ['page', 'bank'],
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
				],
			},
			bank_pushed: {
				type: 'boolean',
				label: 'When button is pushed',
				description: 'Change style when a button is being pressed',
				previewBank: ['page', 'bank'],
				style: {
					color: rgb(255, 255, 255),
					bgcolor: rgb(255, 0, 0),
				},
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
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
				previewBank: ['page', 'bank'],
				style: {
					color: rgb(0, 0, 0),
					bgcolor: rgb(0, 255, 0),
				},
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: 0,
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
						default: 0,
					},
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
			const { thePage, theBank, theControlId } = fetchPageAndBank(feedback.options, feedback.info)

			if (!thePage || !theBank || theControlId === feedback.controlId) {
				// Don't recurse on self
				return {}
			}

			const render = this.graphics.getBank(thePage, theBank)
			if (render?.style) {
				// Return cloned resolved style
				return cloneDeep(render.style)
			} else {
				return {}
			}
		} else if (feedback.type === 'bank_pushed') {
			const { theControlId } = fetchPageAndBank(feedback.options, feedback.info)

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
			const { theControlId } = fetchPageAndBank(feedback.options, feedback.info)
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
			const { theControlId } = fetchPageAndBank(action.options, extras)

			this.controls.pressControl(theControlId, true)
			this.controls.pressControl(theControlId, false)
			return true
		} else if (action.action == 'button_pressrelease_condition') {
			const { theControlId } = fetchPageAndBank(action.options, extras)

			const [instanceLabel, variableName] = action.options.variable.split(':', 2)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const condition = this.instance.variable.parseVariables(action.options.value)

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
				this.controls.pressControl(theControlId, true)
				this.controls.pressControl(theControlId, false)
			}
		} else if (action.action == 'button_pressrelease_condition_variable') {
			const [instanceLabel, variableName] = action.options.variable.split(':', 2)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const condition = this.instance.variable.parseVariables(action.options.value)

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
				const theBank = parseInt(this.instance.variable.getCustomVariableValue(action.options.bank))

				if (!isNaN(thePage) && !isNaN(theBank)) {
					const controlId = CreateBankControlId(thePage, theBank)
					this.controls.pressControl(controlId, true)
					this.controls.pressControl(controlId, false)
				}
			}
		} else if (action.action === 'button_press') {
			const { theControlId } = fetchPageAndBank(action.options, extras)

			this.controls.pressControl(theControlId, true)
			return true
		} else if (action.action === 'button_release') {
			const { theControlId } = fetchPageAndBank(action.options, extras)

			this.controls.pressControl(theControlId, false)
			return true
		} else if (action.action === 'bgcolor') {
			const { theControlId } = fetchPageAndBank(action.options, extras)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ bgcolor: action.options.color })
			}
			return true
		} else if (action.action === 'textcolor') {
			const { theControlId } = fetchPageAndBank(action.options, extras)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ color: action.options.color })
			}
			return true
		} else if (action.action === 'button_text') {
			const { theControlId } = fetchPageAndBank(action.options, extras)

			const control = this.controls.getControl(theControlId)
			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ text: action.options.label })
			}

			return true
		} else if (action.action === 'panic_bank') {
			const { theControlId } = fetchPageAndBank(action.options, extras)

			this.controls.actions.abortControlDelayed(theControlId, action.options.unlatch)
			return true
		} else if (action.action === 'panic') {
			this.controls.actions.abortAllDelayed()
			return true
		} else if (action.action == 'bank_current_step') {
			const { theControlId } = fetchPageAndBank(action.options, extras)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepMakeCurrent === 'function') {
				control.stepMakeCurrent(action.options.step)
			}
		} else if (action.action == 'bank_current_step_delta') {
			const { theControlId } = fetchPageAndBank(action.options, extras)

			const control = this.controls.getControl(theControlId)

			if (control && typeof control.stepAdvanceDelta === 'function') {
				control.stepAdvanceDelta(action.options.amount)
			}
		}
	}
}
