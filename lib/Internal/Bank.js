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

export default class Bank extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'lib/Internal/Bank')

		// this.internalModule = internalModule

		setImmediate(() => {
			this.system.on('graphics_bank_invalidated', (page, bank) => {
				// TODO - can we make this more specific? This could invalidate a lot of stuff unnecessarily..
				this.internalModule.checkFeedbacks('bank_style', 'bank_pushed')
			})
		})
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
				label: 'When button is pushed/latched',
				description: 'Change style when a button is being pressed or is latched',
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
				],
			},
		}
	}

	executeFeedback(feedback) {
		if (feedback.type === 'bank_style') {
			let thePage = feedback.options.page
			let theBank = feedback.options.bank

			if (feedback.info) {
				if (thePage === 0 || thePage === '0') thePage = feedback.info.page
				if (theBank === 0 || theBank === '0') theBank = feedback.info.bank
			}

			const render = this.graphics.getBank(thePage, theBank)
			if (render?.style) {
				// Return cloned resolved style
				return cloneDeep(render.style)
			} else {
				return {}
			}
		} else if (feedback.type === 'bank_pushed') {
			let thePage = feedback.options.page
			let theBank = feedback.options.bank

			if (feedback.info) {
				if (thePage === 0 || thePage === '0') thePage = feedback.info.page
				if (theBank === 0 || theBank === '0') theBank = feedback.info.bank
			}

			const render = this.graphics.getBank(thePage, theBank)
			if (render?.style) {
				// Return cloned resolved style
				return !!render.style.pushed
			} else {
				return false
			}
		}
	}
}
