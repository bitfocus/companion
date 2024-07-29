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

import { combineRgb } from '@companion-module/base'
import LogController from '../Log/Controller.js'

export default class BuildingBlocks {
	#logger = LogController.createLogger('Internal/BuildingBlocks')

	// /**
	//  * @type {import('./Controller.js').default}
	//  * @readonly
	//  */
	// #internalModule

	// /**
	//  * @param {import('./Controller.js').default} internalModule
	//  */
	// constructor(internalModule) {
	// 	this.#internalModule = internalModule
	// }

	/**
	 *
	 * @returns {Record<string, import('./Types.js').InternalFeedbackDefinition>}
	 */
	getFeedbackDefinitions() {
		return {
			logic_and: {
				type: 'boolean',
				label: 'Logic: AND',
				description: 'Test if multiple conditions are true',
				style: {
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(255, 0, 0),
				},
				showInvert: true,
				options: [],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildFeedbacks: true,
			},
			logic_or: {
				type: 'boolean',
				label: 'Logic: OR',
				description: 'Test if one or more of multiple conditions is true',
				style: {
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(255, 0, 0),
				},
				showInvert: true,
				options: [],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildFeedbacks: true,
			},
			logic_xor: {
				type: 'boolean',
				label: 'Logic: XOR',
				description: 'Test if only one of multiple conditions is true',
				style: {
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(255, 0, 0),
				},
				showInvert: true,
				options: [],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildFeedbacks: true,
			},
		}
	}

	/**
	 * Execute a logic feedback
	 * @param {import('../Controls/IControlFragments.js').FeedbackInstance} feedback
	 * @param {boolean[]} childValues
	 * @returns {boolean}
	 */
	executeLogicFeedback(feedback, childValues) {
		if (feedback.type === 'logic_and') {
			if (childValues.length === 0) return !!feedback.isInverted

			return childValues.reduce((acc, val) => acc && val, true) === !feedback.isInverted
		} else if (feedback.type === 'logic_or') {
			return childValues.reduce((acc, val) => acc || val, false)
		} else if (feedback.type === 'logic_xor') {
			const isSingleTrue = childValues.reduce((acc, val) => acc + (val ? 1 : 0), 0) === 1
			return isSingleTrue === !feedback.isInverted
		} else {
			this.#logger.warn(`Unexpected logic feedback type "${feedback.type}"`)
			return false
		}
	}
}
