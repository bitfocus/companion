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

import debounceFn from 'debounce-fn'
import type { InstanceController } from '../Instance/Controller.js'
import type { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import type { RunActionExtras, VariableDefinitionTmp } from '../Instance/Wrapper.js'
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	FeedbackEntityModelExt,
	InternalModuleFragment,
	InternalVisitor,
	InternalActionDefinition,
	InternalFeedbackDefinition,
	InternalModuleFragmentEvents,
} from './Types.js'
import type { CompanionFeedbackButtonStyleResult, CompanionVariableValues } from '@companion-module/base'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import { EventEmitter } from 'events'
import type { InternalModuleUtils } from './Util.js'

export class InternalInstance extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #instanceController: InstanceController

	#instanceStatuses: Record<string, ConnectionStatusEntry> = {}
	#instancesTotal: number = 0
	#instancesDisabled: number = 0
	#instancesError: number = 0
	#instancesWarning: number = 0
	#instancesOk: number = 0

	#debounceCheckFeedbacks = debounceFn(
		(): void => {
			this.emit('checkFeedbacks', 'instance_status', 'instance_custom_state')
		},
		{
			maxWait: 100,
			wait: 20,
			after: true,
		}
	)

	#debounceRegenerateVariables = debounceFn(
		(): void => {
			this.emit('regenerateVariables')
			this.updateVariables()
		},
		{
			maxWait: 100,
			wait: 20,
			after: true,
		}
	)

	constructor(_internalUrils: InternalModuleUtils, instanceController: InstanceController) {
		super()

		this.#instanceController = instanceController

		this.#instanceController.status.on('status_change', this.#calculateInstanceErrors.bind(this))
		this.#instanceController.on('connection_added', this.#debounceRegenerateVariables.bind(this))
		this.#instanceController.on('connection_updated', this.#debounceRegenerateVariables.bind(this))
		this.#instanceController.on('connection_deleted', this.#debounceRegenerateVariables.bind(this))
	}

	getVariableDefinitions(): VariableDefinitionTmp[] {
		const variables: VariableDefinitionTmp[] = [
			{
				label: 'Connection: Count total',
				name: 'instance_total',
			},
			{
				label: 'Connection: Count disabled',
				name: 'instance_disabled',
			},
			{
				label: 'Connection: Count errors',
				name: 'instance_errors',
			},
			{
				label: 'Connection: Count warnings',
				name: 'instance_warns',
			},
			{
				label: 'Connection: Count OK',
				name: 'instance_oks',
			},
		]

		const connectionIds = this.#instanceController.getAllInstanceIds()
		for (const connectionId of connectionIds) {
			const label = this.#instanceController.getLabelForInstance(connectionId)
			if (label) {
				variables.push({
					label: `Connection Status: ${label}`,
					name: `connection_${label}_status`,
				})
			}
		}

		return variables
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			instance_control: {
				label: 'Connection: Enable or disable connection',
				description: undefined,
				options: [
					{
						type: 'internal:connection_id',
						label: 'Connection',
						id: 'instance_id',
						multiple: false,
						includeGroups: true,
					},
					{
						type: 'dropdown',
						label: 'Enable',
						id: 'enable',
						default: 'toggle',
						choices: [
							{ id: 'toggle', label: 'Toggle' },
							{ id: 'true', label: 'Yes' },
							{ id: 'false', label: 'No' },
						],
					},
				],
			},
		}
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			instance_status: {
				feedbackType: 'advanced',
				label: 'Connection: Check Status',
				description:
					'Change button color on Connection Status\nDisabled color is not used when "All" connections is selected',
				feedbackStyle: undefined,
				showInvert: false,
				options: [
					{
						type: 'internal:connection_id',
						label: 'Connection or All',
						id: 'instance_id',
						includeAll: true,
						includeGroups: true,
						multiple: false,
					},
					{
						type: 'colorpicker',
						label: 'OK foreground color',
						id: 'ok_fg',
						default: 0xffffff,
					},
					{
						type: 'colorpicker',
						label: 'OK background color',
						id: 'ok_bg',
						default: 0x00c800,
					},
					{
						type: 'colorpicker',
						label: 'Warning foreground color',
						id: 'warning_fg',
						default: 0x000000,
					},
					{
						type: 'colorpicker',
						label: 'Warning background color',
						id: 'warning_bg',
						default: 0xffff00,
					},
					{
						type: 'colorpicker',
						label: 'Error foreground color',
						id: 'error_fg',
						default: 0xffffff,
					},
					{
						type: 'colorpicker',
						label: 'Error background color',
						id: 'error_bg',
						default: 0xc80000,
					},
					{
						type: 'colorpicker',
						label: 'Disabled foreground color',
						id: 'disabled_fg',
						default: 0x999999,
					},
					{
						type: 'colorpicker',
						label: 'Disabled background color',
						id: 'disabled_bg',
						default: 0x404040,
					},
				],
			},
			instance_custom_state: {
				feedbackType: 'boolean',
				label: 'Connection: When matches specified status',
				description: 'Change style when a connection matches the specified status',
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0x00ff00,
				},
				showInvert: true,
				options: [
					{
						type: 'internal:connection_id',
						label: 'Connection',
						id: 'instance_id',
						includeAll: false,
						multiple: false,
					},
					{
						type: 'dropdown',
						label: 'State',
						id: 'state',
						default: 'good',
						choices: [
							{ id: 'good', label: 'OK' },
							{ id: 'warning', label: 'Warning' },
							{ id: 'error', label: 'Error' },
							{ id: null as any, label: 'Disabled' },
						],
					},
				],
			},
		}
	}

	executeAction(action: ControlEntityInstance, _extras: RunActionExtras): boolean {
		if (action.definitionId === 'instance_control') {
			const connectionId = action.rawOptions.instance_id
			if (connectionId.startsWith('group:')) {
				// Get the group ID by removing the 'group:' prefix
				let groupId = connectionId.substring(6)
				if (groupId === 'ungrouped') groupId = null

				const connectionIds = this.#instanceController.getConnectionsIdsInGroup(groupId)
				if (!connectionIds || connectionIds.length === 0) {
					// No connections found in the group
					return true
				}

				// Determine the new state for all connections in the group
				let newState = action.rawOptions.enable === 'true'

				if (action.rawOptions.enable === 'toggle') {
					// For toggle, we'll check if all are enabled and if so, disable all
					// Otherwise, enable all (if mixed or all disabled)
					const configs = connectionIds
						.map((id) => this.#instanceController.getInstanceConfig(id))
						.filter((config) => !!config)

					newState = !configs.every((config) => !!config.enabled)
				}

				// Apply the action to all connections in the group
				for (const id of connectionIds) {
					this.#instanceController.enableDisableInstance(id, newState)
				}

				return true
			}

			let newState = action.rawOptions.enable == 'true'
			if (action.rawOptions.enable == 'toggle') {
				const curState = this.#instanceController.getConnectionStatus(connectionId)

				newState = !curState?.category
			}

			this.#instanceController.enableDisableInstance(connectionId, newState)
			return true
		} else {
			return false
		}
	}

	executeFeedback(feedback: FeedbackEntityModelExt): CompanionFeedbackButtonStyleResult | boolean | void {
		if (feedback.definitionId === 'instance_status') {
			if (feedback.options.instance_id == 'all') {
				if (this.#instancesError > 0) {
					return {
						color: feedback.options.error_fg,
						bgcolor: feedback.options.error_bg,
					}
				}

				if (this.#instancesWarning > 0) {
					return {
						color: feedback.options.warning_fg,
						bgcolor: feedback.options.warning_bg,
					}
				}

				return {
					color: feedback.options.ok_fg,
					bgcolor: feedback.options.ok_bg,
				}
			}

			// Check if this is for a group of connections
			if (feedback.options.instance_id.startsWith('group:')) {
				// Get the group ID by removing the 'group:' prefix
				let groupId: string | null = feedback.options.instance_id.substring(6)
				if (groupId === 'ungrouped') groupId = null

				// Get all connections in this group
				const connectionIds = this.#instanceController.getConnectionsIdsInGroup(groupId)
				if (!connectionIds || connectionIds.length === 0) {
					// No connections found in the group, treat as disabled
					return {
						color: feedback.options.disabled_fg,
						bgcolor: feedback.options.disabled_bg,
					}
				}

				// Check status of all connections in the group
				let hasError = false
				let hasWarning = false
				let hasOk = false

				for (const id of connectionIds) {
					const status = this.#instanceStatuses[id]?.category
					if (status === 'error') {
						hasError = true
					} else if (status === 'warning') {
						hasWarning = true
					} else if (status === 'good') {
						hasOk = true
					}
				}

				// Prioritize errors, then warnings, then OK status
				if (hasError) {
					return {
						color: feedback.options.error_fg,
						bgcolor: feedback.options.error_bg,
					}
				} else if (hasWarning) {
					return {
						color: feedback.options.warning_fg,
						bgcolor: feedback.options.warning_bg,
					}
				} else if (hasOk) {
					return {
						color: feedback.options.ok_fg,
						bgcolor: feedback.options.ok_bg,
					}
				} else {
					// All connections are disabled
					return {
						color: feedback.options.disabled_fg,
						bgcolor: feedback.options.disabled_bg,
					}
				}
			}

			const cur_instance = this.#instanceController.getConnectionStatus(feedback.options.instance_id)
			if (cur_instance !== undefined) {
				switch (cur_instance.category) {
					case 'error':
						return {
							color: feedback.options.error_fg,
							bgcolor: feedback.options.error_bg,
						}
					case 'warning':
						return {
							color: feedback.options.warning_fg,
							bgcolor: feedback.options.warning_bg,
						}
					case 'good':
						return {
							color: feedback.options.ok_fg,
							bgcolor: feedback.options.ok_bg,
						}
					default:
						return {
							color: feedback.options.disabled_fg,
							bgcolor: feedback.options.disabled_bg,
						}
				}
			}
			// disabled has no 'status' entry
			return {
				color: feedback.options.disabled_fg,
				bgcolor: feedback.options.disabled_bg,
			}
		} else if (feedback.definitionId === 'instance_custom_state') {
			const selected_status = this.#instanceStatuses[String(feedback.options.instance_id)]?.category ?? null

			return selected_status == feedback.options.state
		}
	}

	updateVariables(): void {
		const values: CompanionVariableValues = {
			instance_total: this.#instancesTotal,
			instance_disabled: this.#instancesDisabled,
			instance_errors: this.#instancesError,
			instance_warns: this.#instancesWarning,
			instance_oks: this.#instancesOk,
		}

		const connectionIds = this.#instanceController.getAllInstanceIds()
		for (const connectionId of connectionIds) {
			const label = this.#instanceController.getLabelForInstance(connectionId)
			if (label) {
				const status = this.#instanceStatuses[connectionId]

				let statusMessage = status?.category
				if (statusMessage === null) statusMessage = 'disabled'

				values[`connection_${label}_status`] = statusMessage ?? ''
			}
		}

		this.emit('setVariables', values)
	}

	#calculateInstanceErrors(instanceStatuses: Record<string, ConnectionStatusEntry>): void {
		let numTotal = 0
		let numDisabled = 0
		let numError = 0
		let numWarn = 0
		let numOk = 0

		for (const status of Object.values(instanceStatuses)) {
			numTotal++

			if (status.category === null) {
				numDisabled++
			} else if (status.category === 'good') {
				numOk++
			} else if (status.category === 'warning') {
				numWarn++
			} else if (status.category === 'error') {
				numError++
			}
		}

		this.#instanceStatuses = instanceStatuses
		this.#instancesTotal = numTotal
		this.#instancesDisabled = numDisabled
		this.#instancesError = numError
		this.#instancesWarning = numWarn
		this.#instancesOk = numOk

		this.updateVariables()
		this.#debounceCheckFeedbacks()
	}

	visitReferences(visitor: InternalVisitor, actions: ActionForVisitor[], feedbacks: FeedbackForVisitor[]): void {
		for (const action of actions) {
			try {
				if (action.action === 'instance_control') {
					if (String(action.options.instance_id).startsWith('group:')) {
						// Future
					} else {
						visitor.visitConnectionId(action.options, 'instance_id')
					}
				}
			} catch (e) {
				//Ignore
			}
		}
		for (const feedback of feedbacks) {
			try {
				if (feedback.type === 'instance_status') {
					if (feedback.options.instance_id !== 'all') {
						if (String(feedback.options.instance_id).startsWith('group:')) {
							// Future
						} else {
							visitor.visitConnectionId(feedback.options, 'instance_id', feedback.id)
						}
					}
				} else if (feedback.type === 'instance_custom_state') {
					visitor.visitConnectionId(feedback.options, 'instance_id', feedback.id)
				}
			} catch (e) {
				//Ignore
			}
		}
	}
}
