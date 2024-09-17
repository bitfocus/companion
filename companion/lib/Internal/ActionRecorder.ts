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

import LogController from '../Log/Controller.js'
import type { InternalController } from './Controller.js'
import type { ActionRecorder } from '../Controls/ActionRecorder.js'
import type { PageController } from '../Page/Controller.js'
import type { FeedbackForVisitor, FeedbackInstanceExt, InternalModuleFragment, InternalVisitor } from './Types.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import type { InternalActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import type { InternalFeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'

export class InternalActionRecorder implements InternalModuleFragment {
	readonly #logger = LogController.createLogger('Internal/ActionRecorder')

	readonly #internalModule: InternalController
	readonly #actionRecorder: ActionRecorder
	readonly #pageController: PageController

	constructor(internalModule: InternalController, actionRecorder: ActionRecorder, pageController: PageController) {
		this.#internalModule = internalModule
		this.#actionRecorder = actionRecorder
		this.#pageController = pageController

		setImmediate(() => {
			this.#internalModule.setVariables({
				action_recorder_action_count: 0,
			})
		})

		this.#actionRecorder.on('sessions_changed', () => {
			this.#internalModule.checkFeedbacks('action_recorder_check_connections')

			const session = this.#actionRecorder.getSession()
			if (session) {
				this.#internalModule.setVariables({
					action_recorder_action_count: session.actions?.length ?? 0,
				})
			}
		})
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			action_recorder_set_recording: {
				label: 'Action Recorder: Set recording',
				description: undefined,
				options: [
					{
						type: 'dropdown',
						label: 'Enable',
						id: 'enable',
						default: 'true',
						choices: [
							{ id: 'toggle', label: 'Toggle' },
							{ id: 'true', label: 'Yes' },
							{ id: 'false', label: 'No' },
						],
					},
				],
			},
			action_recorder_set_connections: {
				label: 'Action Recorder: Set connections',
				description: undefined,
				options: [
					{
						type: 'dropdown',
						label: 'Mode',
						id: 'mode',
						default: 'set',
						choices: [
							{ id: 'set', label: 'Set to the selected connections' },
							{ id: 'add', label: 'Add the selected connections' },
							{ id: 'remove', label: 'Remove the selected connections' },
							{ id: 'toggle', label: 'Toggle the selected connections' },
						],
					},
					{
						type: 'internal:instance_id',
						label: 'Connections',
						id: 'connections',
						multiple: true,
						includeAll: false,
						filterActionsRecorder: true,
						default: [],
					},
				],
			},
			action_recorder_save_to_button: {
				label: 'Action Recorder: Finish recording and save to button',
				description: undefined,
				options: [
					{
						type: 'textinput',
						label: 'Page (0 = this page)',
						id: 'page',
						default: '0',
						useVariables: {
							local: true,
						},
					},
					{
						type: 'textinput',
						label: 'Button (0 = this position)',
						id: 'bank',
						default: '0',
						useVariables: {
							local: true,
						},
					},
					{
						type: 'textinput',
						label: 'Button Step (eg 1, 2)',
						id: 'step',
						default: '1',
						useVariables: {
							local: true,
						},
					},
					{
						type: 'textinput',
						label: 'Action Group (eg press, release, rotate_left, rotate_right, 1000, 2000)',
						id: 'set',
						default: 'press',
						useVariables: {
							local: true,
						},
					},
					{
						type: 'dropdown',
						label: 'Mode',
						id: 'mode',
						default: 'replace',
						choices: [
							{ id: 'replace', label: 'Replace existing actions' },
							{ id: 'append', label: 'Append after existing actions' },
						],
					},
				],
			},
			action_recorder_discard_actions: {
				label: 'Action Recorder: Discard actions',
				description: undefined,
				options: [],
			},
		}
	}

	executeAction(action: ActionInstance, extras: RunActionExtras): boolean {
		if (action.action === 'action_recorder_set_recording') {
			const session = this.#actionRecorder.getSession()
			if (session) {
				let newState = action.options.enable == 'true'
				if (action.options.enable == 'toggle') newState = !session.isRunning

				this.#actionRecorder.setRecording(newState)
			}

			return true
		} else if (action.action === 'action_recorder_set_connections') {
			const session = this.#actionRecorder.getSession()
			if (session) {
				let result = new Set(session.connectionIds)

				const selectedIds = new Set<string>(action.options.connections)

				switch (action.options.mode) {
					case 'set':
						result = selectedIds
						break
					case 'add':
						for (const id of selectedIds) {
							result.add(id)
						}
						break
					case 'remove':
						for (const id of selectedIds) {
							result.delete(id)
						}
						break
					case 'toggle':
						for (const id of selectedIds) {
							if (!result.delete(id)) {
								// It wasnt found, so we should add it
								result.add(id)
							}
						}
						break
				}

				this.#actionRecorder.setSelectedConnectionIds(Array.from(result))
			}

			return true
		} else if (action.action === 'action_recorder_save_to_button') {
			let stepId = this.#internalModule.parseVariablesForInternalActionOrFeedback(action.options.step, extras).text
			let setId = this.#internalModule.parseVariablesForInternalActionOrFeedback(action.options.set, extras).text
			const pageRaw = this.#internalModule.parseVariablesForInternalActionOrFeedback(action.options.page, extras).text
			const bankRaw = this.#internalModule.parseVariablesForInternalActionOrFeedback(action.options.bank, extras).text

			if (setId === 'press') setId = 'down'
			else if (setId === 'release') setId = 'up'

			let page = Number(pageRaw)
			let bank = Number(bankRaw)
			if (!isNaN(page) && !isNaN(bank) && setId && stepId) {
				/** @type {string | null} */
				let controlId = null

				if (page === 0) page = extras.location?.pageNumber ?? 0
				if (bank === 0 && extras.location) {
					controlId = this.#pageController.getControlIdAt({
						...extras.location,
						pageNumber: page,
					})
				} else if (bank > 0) {
					controlId = this.#pageController.getControlIdAtOldBankIndex(page, bank)
				}

				if (!controlId) return true

				// If stepId is a number, it must be a step button. account for the 0 index
				if (!isNaN(Number(stepId))) stepId = `${Number(stepId) - 1}`

				try {
					this.#actionRecorder.saveToControlId(controlId, stepId, setId, action.options.mode)
				} catch (e) {
					// We don't have a good way to present this to the user, so ignore it for now. They should notice that it didnt work
					this.#logger.info(`action_recorder_save_to_button failed: ${e}`)
				}
			}

			return true
		} else if (action.action === 'action_recorder_discard_actions') {
			this.#actionRecorder.discardActions()

			return true
		} else {
			return false
		}
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			action_recorder_check_connections: {
				type: 'boolean',
				label: 'Action Recorder: Check if specified connections are selected',
				description: undefined,
				style: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'internal:instance_id',
						label: 'Connections',
						id: 'connections',
						multiple: true,
						includeAll: false,
						filterActionsRecorder: true,
						default: [],
					},
					{
						type: 'dropdown',
						label: 'Mode',
						id: 'mode',
						default: 'any',
						choices: [
							{ id: 'any', label: 'Any of the selected' },
							{ id: 'all', label: 'All selected' },
						],
					},
					{
						type: 'dropdown',
						label: 'State',
						id: 'state',
						default: 'recording',
						choices: [
							{ id: 'recording', label: 'Recording is running' },
							{ id: 'selected', label: 'Connections are selected' },
						],
					},
				],
			},
		}
	}

	/**
	 * Get an updated value for a feedback
	 */
	executeFeedback(feedback: FeedbackInstanceExt): boolean | void {
		if (feedback.type === 'action_recorder_check_connections') {
			const session = this.#actionRecorder.getSession()
			if (!session) return false

			if (feedback.options.connections.length === 0) {
				// shortcut for when there are no connections selected
				return !!session.isRunning && feedback.options.state === 'recording'
			}

			// check each selected connection
			const matchAll = feedback.options.mode === 'all'
			let matches = matchAll
			for (const id of feedback.options.connections) {
				if (matchAll) {
					matches = matches && session.connectionIds.includes(id)
				} else {
					matches = matches || session.connectionIds.includes(id)
				}
			}

			// check against desired state
			if (feedback.options.state === 'recording') {
				return matches && session.isRunning
			} else {
				return matches
			}
		}
	}

	visitReferences(visitor: InternalVisitor, actions: ActionInstance[], feedbacks: FeedbackForVisitor[]) {
		for (const action of actions) {
			if (action.action === 'action_recorder_set_connections') {
				visitor.visitInstanceIdArray(action.options, 'connections')
			}
		}
		for (const feedback of feedbacks) {
			if (feedback.type === 'action_recorder_check_connections') {
				visitor.visitInstanceIdArray(feedback.options, 'connections', feedback.id)
			}
		}
	}

	/**
	 * @returns {import('../Instance/Wrapper.js').VariableDefinitionTmp[]}
	 */
	getVariableDefinitions() {
		return [
			{
				label: 'Actions Recorder: Action count',
				name: 'action_recorder_action_count',
			},
		]
	}
}
