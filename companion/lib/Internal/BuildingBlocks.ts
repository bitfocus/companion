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

import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import LogController from '../Log/Controller.js'
import type {
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalVisitor,
	InternalFeedbackDefinition,
	InternalActionDefinition,
	ActionForVisitor,
} from './Types.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { ActionRunner } from '../Controls/ActionRunner.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'

export class InternalBuildingBlocks implements InternalModuleFragment {
	readonly #logger = LogController.createLogger('Internal/BuildingBlocks')

	readonly #actionRunner: ActionRunner

	constructor(actionRunner: ActionRunner) {
		this.#actionRunner = actionRunner
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			logic_and: {
				type: 'boolean',
				label: 'Logic: AND',
				description: 'Test if multiple conditions are true',
				style: {
					color: 0xffffff,
					bgcolor: 0xff0000,
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
					color: 0xffffff,
					bgcolor: 0xff0000,
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
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildFeedbacks: true,
			},
		}
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			action_group: {
				label: 'Action Group',
				description: 'Execute a group of actions',
				options: [
					{
						type: 'dropdown',
						label: 'Execution mode',
						id: 'execution_mode',
						default: 'concurrent',
						choices: [
							{ id: 'concurrent', label: 'Concurrent' },
							{ id: 'sequential', label: 'Sequential' },
						],
						tooltip:
							'Using "Sequential" will run the actions one after the other, waiting for each to complete before starting the next. This doesn\'t work for all modules.',
					},
				],
				hasLearn: false,
				learnTimeout: undefined,
				supportsChildActionGroups: ['default'],
			},
			wait: {
				label: 'Wait',
				description: 'Wait for a specified amount of time',
				options: [
					{
						type: 'textinput',
						label: 'Time (ms)',
						id: 'time',
						default: '1000',
					},
				],
				hasLearn: false,
				learnTimeout: undefined,
			},
		}
	}

	/**
	 * Execute a logic feedback
	 */
	executeLogicFeedback(feedback: FeedbackInstance, childValues: boolean[]): boolean {
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

	executeAction(action: ActionInstance, extras: RunActionExtras): Promise<boolean> | boolean {
		if (action.action === 'wait') {
			return Promise.resolve().then(async () => {
				if (extras.abortDelayed.aborted) return true

				const delay = Number(action.options.time)
				if (!isNaN(delay) && delay > 0) {
					// Perform the wait
					await new Promise((resolve) => setTimeout(resolve, delay))
				}

				return true
			})
		} else if (action.action === 'action_group') {
			return Promise.resolve().then(async () => {
				if (extras.abortDelayed.aborted) return true

				const executeSequential = action.options.execution_mode === 'sequential'

				if (extras.abortDelayed.aborted) return true

				await this.#actionRunner
					.runMultipleActions(action.children?.['default'] ?? [], extras, executeSequential)
					.catch((e) => {
						this.#logger.error(`Failed to run actions: ${e.message}`)
					})

				return true
			})
		} else {
			return false
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
