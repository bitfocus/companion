/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import LogController from '../Log/Controller.js'
import type { ActionRecorder } from '../Instance/ActionRecorder.js'
import type { IPageStore } from '../Page/Store.js'
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	FeedbackForInternalExecution,
	InternalModuleFragment,
	InternalVisitor,
	InternalActionDefinition,
	InternalFeedbackDefinition,
	InternalModuleFragmentEvents,
	ActionForInternalExecution,
} from './Types.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import { FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { EventEmitter } from 'events'
import { stringifyVariableValue, type VariableDefinition } from '@companion-app/shared/Model/Variables.js'
import { CompanionFieldVariablesSupport } from '@companion-app/shared/Model/Options.js'

export class InternalActionRecorder
	extends EventEmitter<InternalModuleFragmentEvents>
	implements InternalModuleFragment
{
	readonly #logger = LogController.createLogger('Internal/ActionRecorder')

	readonly #actionRecorder: ActionRecorder
	readonly #pageStore: IPageStore

	constructor(actionRecorder: ActionRecorder, pageStore: IPageStore) {
		super()

		this.#actionRecorder = actionRecorder
		this.#pageStore = pageStore

		setImmediate(() => {
			this.emit('setVariables', {
				action_recorder_action_count: 0,
			})
		})

		this.#actionRecorder.on('sessions_changed', () => {
			this.emit('checkFeedbacks', 'action_recorder_check_connections')

			const session = this.#actionRecorder.getSession()
			if (session) {
				this.emit('setVariables', {
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
						expressionDescription: `Valid values are 'true', 'false', or 'toggle'`,
					},
				],
				optionsSupportExpressions: true,
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
						disableAutoExpression: true,
					},
					{
						type: 'internal:connection_id',
						label: 'Connections',
						id: 'connections',
						multiple: true,
						includeAll: false,
						filterActionsRecorder: true,
						default: [],
						disableAutoExpression: true,
					},
				],
				optionsSupportExpressions: true,
			},
			action_recorder_save_to_button: {
				label: 'Action Recorder: Finish recording and save to button',
				description: undefined,
				options: [
					{
						type: 'textinput',
						label: 'Page',
						description: '(0 = this page)',
						id: 'page',
						default: '0',
						useVariables: CompanionFieldVariablesSupport.InternalParser,
					},
					{
						type: 'textinput',
						label: 'Button',
						description: '(0 = this position)',
						id: 'bank',
						default: '0',
						useVariables: CompanionFieldVariablesSupport.InternalParser,
					},
					{
						type: 'textinput',
						label: 'Button Step',
						description: 'eg 1, 2',
						id: 'step',
						default: '1',
						useVariables: CompanionFieldVariablesSupport.InternalParser,
					},
					{
						type: 'textinput',
						label: 'Action Group',
						description: 'eg press, release, rotate_left, rotate_right, 1000, 2000',
						id: 'set',
						default: 'press',
						useVariables: CompanionFieldVariablesSupport.InternalParser,
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
						expressionDescription: 'Valid values are "replace" or "append"',
						disableAutoExpression: true,
					},
				],
				optionsSupportExpressions: true,
			},
			action_recorder_discard_actions: {
				label: 'Action Recorder: Discard actions',
				description: undefined,
				options: [],
				optionsSupportExpressions: true,
			},
		}
	}

	executeAction(action: ActionForInternalExecution, extras: RunActionExtras): boolean {
		if (action.definitionId === 'action_recorder_set_recording') {
			const session = this.#actionRecorder.getSession()
			if (session) {
				const rawEnable =
					typeof action.options.enable === 'string' ? action.options.enable.trim().toLowerCase() : action.options.enable

				let newState = typeof rawEnable === 'boolean' ? rawEnable : rawEnable == 'true'
				if (rawEnable == 'toggle') newState = !session.isRunning

				this.#actionRecorder.setRecording(newState)
			}

			return true
		} else if (action.definitionId === 'action_recorder_set_connections') {
			const session = this.#actionRecorder.getSession()
			if (session) {
				let result = new Set(session.connectionIds)

				const selectedIds = new Set<string>()
				if (Array.isArray(action.options.connections)) {
					for (const connectionId of action.options.connections) {
						if (typeof connectionId === 'string' && connectionId) {
							selectedIds.add(connectionId)
						}
					}
				}

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
		} else if (action.definitionId === 'action_recorder_save_to_button') {
			let stepId = stringifyVariableValue(action.options.step)
			let setId = stringifyVariableValue(action.options.set)

			if (setId === 'press') setId = 'down'
			else if (setId === 'release') setId = 'up'

			let page = Number(action.options.page)
			const bank = Number(action.options.bank)
			if (!isNaN(page) && !isNaN(bank) && setId && stepId) {
				let controlId: string | null = null

				if (page === 0) page = extras.location?.pageNumber ?? 0
				if (bank === 0 && extras.location) {
					controlId = this.#pageStore.getControlIdAt({
						...extras.location,
						pageNumber: page,
					})
				} else if (bank > 0) {
					controlId = this.#pageStore.getControlIdAtOldBankIndex(page, bank)
				}

				if (!controlId) return true

				// If stepId is a number, it must be a step button. account for the 0 index
				if (!isNaN(Number(stepId))) stepId = `${Number(stepId) - 1}`

				try {
					const setIdSafe = validateActionSetId(setId as any)
					if (setIdSafe === undefined) throw new Error('Invalid setId')

					this.#actionRecorder.saveToControlId(controlId, stepId, setIdSafe, action.options.mode as any)
				} catch (e) {
					// We don't have a good way to present this to the user, so ignore it for now. They should notice that it didnt work
					this.#logger.info(`action_recorder_save_to_button failed: ${e}`)
				}
			}

			return true
		} else if (action.definitionId === 'action_recorder_discard_actions') {
			this.#actionRecorder.discardActions()

			return true
		} else {
			return false
		}
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			action_recorder_check_connections: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Action Recorder: Check if specified connections are selected',
				description: undefined,
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'internal:connection_id',
						label: 'Connections',
						id: 'connections',
						multiple: true,
						includeAll: false,
						filterActionsRecorder: true,
						default: [],
						disableAutoExpression: true,
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
						disableAutoExpression: true,
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
						disableAutoExpression: true,
					},
				],
				optionsSupportExpressions: true,
			},
		}
	}

	/**
	 * Get an updated value for a feedback
	 */
	executeFeedback(feedback: FeedbackForInternalExecution): boolean | void {
		if (feedback.definitionId === 'action_recorder_check_connections') {
			const session = this.#actionRecorder.getSession()
			if (!session) return false

			const connectionIds = feedback.options.connections as string[]

			if (!Array.isArray(connectionIds) || connectionIds.length === 0) {
				// shortcut for when there are no connections selected
				return !!session.isRunning && feedback.options.state === 'recording'
			}

			// check each selected connection
			const matchAll = feedback.options.mode === 'all'
			let matches = matchAll
			for (const id of connectionIds) {
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

	visitReferences(visitor: InternalVisitor, actions: ActionForVisitor[], feedbacks: FeedbackForVisitor[]): void {
		for (const action of actions) {
			if (action.action === 'action_recorder_set_connections') {
				visitor.visitConnectionIdArray(action.options, 'connections')
			}
		}
		for (const feedback of feedbacks) {
			if (feedback.type === 'action_recorder_check_connections') {
				visitor.visitConnectionIdArray(feedback.options, 'connections', feedback.id)
			}
		}
	}

	getVariableDefinitions(): VariableDefinition[] {
		return [
			{
				description: 'Actions Recorder: Action count',
				name: 'action_recorder_action_count',
			},
		]
	}
}
