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

function fetchPageAndBank(options, info) {
	let thePage = options.page
	let theBank = options.bank

	if (info) {
		if (thePage === 0 || thePage === '0') thePage = info.page
		if (theBank === 0 || theBank === '0') theBank = info.bank
	}

	return {
		thePage,
		theBank,
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
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which button?',
						id: 'bank',
					},
				],
			},
			button_pressrelease_condition: {
				label: 'Button Press/Release if Variable meets Condition',
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
						type: 'textwithvariables',
						label: 'Value',
						id: 'value',
						default: '',
					},
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which button?',
						id: 'bank',
					},
				],
			},
			button_pressrelease_condition_variable: {
				label: 'Button Press/Release if Variable meets Condition (Custom Variables)',
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
						type: 'textwithvariables',
						label: 'Value',
						id: 'value',
						default: '',
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
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
					},
				],
			},
			button_release: {
				label: 'Button Release',
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
					},
				],
			},

			button_text: {
				label: 'Button Text',
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
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
					},
				],
			},
			textcolor: {
				label: 'Button Text Color',
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
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
					},
				],
			},
			bgcolor: {
				label: 'Button Background Color',
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
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
					},
				],
			},

			panic_bank: {
				label: 'Abort actions on button',
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
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
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
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
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
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
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
					},
				],
			},
			bank_pushed: {
				type: 'boolean',
				label: 'When button is pushed',
				description: 'Change style when a button is being pressed',
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
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
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
					},
					{
						type: 'internal:bank',
						label: 'Bank',
						tooltip: 'Which Button?',
						id: 'bank',
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
			const { thePage, theBank } = fetchPageAndBank(feedback.options, feedback.info)

			const render = this.graphics.getBank(thePage, theBank)
			if (render?.style) {
				// Return cloned resolved style
				return cloneDeep(render.style)
			} else {
				return {}
			}
		} else if (feedback.type === 'bank_pushed') {
			const { thePage, theBank } = fetchPageAndBank(feedback.options, feedback.info)

			const render = this.graphics.getBank(thePage, theBank)
			if (render?.style) {
				let isPushed = !!render.style.pushed

				if (!isPushed && feedback.options.latch_compatability && render.style === 'step') {
					// Backwards compatability for the old 'latching' behaviour
					isPushed = this.bank.action.getBankActiveStep(thePage, theBank) !== 0
				}

				return isPushed
			} else {
				return false
			}
		} else if (feedback.type == 'bank_current_step') {
			const { thePage, theBank } = fetchPageAndBank(feedback.options, feedback.info)
			const theStep = feedback.options.step

			return this.bank.action.getBankActiveStep(thePage, theBank) + 1 === theStep
		}
	}

	executeAction(action, extras) {
		if (action.action === 'button_pressrelease') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			this.bank.action.pressBank(thePage, theBank, true)
			this.bank.action.pressBank(thePage, theBank, false)
			return true
		} else if (action.action == 'button_pressrelease_condition') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			const [instanceLabel, variableName] = action.options.variable.split(':', 2)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const condition = this.instance.variable.parseVariables(action.options.value)

			let variable_value_number = Number(variable_value)
			let condition_number = Number(condition)
			let pressIt = false
			if (opt.op == 'eq') {
				if (variable_value.toString() == condition.toString()) {
					pressIt = true
				}
			} else if (opt.op == 'ne') {
				if (variable_value.toString() !== condition.toString()) {
					pressIt = true
				}
			} else if (opt.op == 'gt') {
				if (variable_value_number > condition_number) {
					pressIt = true
				}
			} else if (opt.op == 'lt') {
				if (variable_value_number < condition_number) {
					pressIt = true
				}
			}

			if (pressIt) {
				this.bank.action.pressBank(thePage, theBank, true)
				this.bank.action.pressBank(thePage, theBank, false)
			}
		} else if (action.action == 'button_pressrelease_condition_variable') {
			const [instanceLabel, variableName] = action.options.variable.split(':', 2)
			const variable_value = this.instance.variable.getVariableValue(instanceLabel, variableName)

			const condition = this.instance.variable.parseVariables(action.options.value)

			let variable_value_number = Number(variable_value)
			let condition_number = Number(condition)
			let pressIt = false
			if (opt.op == 'eq') {
				if (variable_value.toString() == condition.toString()) {
					pressIt = true
				}
			} else if (opt.op == 'ne') {
				if (variable_value.toString() !== condition.toString()) {
					pressIt = true
				}
			} else if (opt.op == 'gt') {
				if (variable_value_number > condition_number) {
					pressIt = true
				}
			} else if (opt.op == 'lt') {
				if (variable_value_number < condition_number) {
					pressIt = true
				}
			}

			if (pressIt) {
				const page_id = opt.page.split(':', 2)
				const thePage = parseInt(this.instance.variable.getVariableValue(page_id[0], page_id[1]))

				const bank_id = opt.bank.split(':', 2)
				const theBank = parseInt(this.instance.variable.getVariableValue(bank_id[0], bank_id[1]))

				this.bank.action.pressBank(thePage, theBank, true)
				this.bank.action.pressBank(thePage, theBank, false)
			}
		} else if (action.action === 'button_press') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			this.bank.action.pressBank(thePage, theBank, true)
			return true
		} else if (action.action === 'button_release') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			this.bank.action.pressBank(thePage, theBank, false)
			return true
		} else if (action.action === 'bgcolor') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			this.bank.changeField(thePage, theBank, 'bgcolor', action.options.color)
			return true
		} else if (action.action === 'textcolor') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			this.bank.changeField(thePage, theBank, 'color', action.options.color)
			return true
		} else if (action.action === 'button_text') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			this.bank.changeField(thePage, theBank, 'text', action.options.label)
			return true
		} else if (action.action === 'panic_bank') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			this.bank.action.abortBank(thePage, theBank, action.options.unlatch)
			return true
		} else if (action.action === 'panic') {
			this.bank.action.abortAll()
			return true
		} else if (action.action == 'bank_current_step') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			this.bank.action.onBankStepSet(thePage, theBank, action.options.step)
		} else if (action.action == 'bank_current_step_delta') {
			const { thePage, theBank } = fetchPageAndBank(action.options, extras)

			this.bank.action.onBankStepDelta(thePage, theBank, action.options.amount)
		}
	}
}
