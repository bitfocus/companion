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
import CoreBase from '../Core/Base.js'
import { rgb } from '../Resources/Util.js'

export default class Instance extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Instance')

		// this.internalModule = internalModule

		this.instance_statuses = {}
		this.instance_errors = 0
		this.instance_warns = 0
		this.instance_oks = 0
	}

	getVariableDefinitions() {
		return [
			{
				label: 'Instances with errors',
				name: 'instance_errors',
			},
			{
				label: 'Instances with warnings',
				name: 'instance_warns',
			},
			{
				label: 'Instances OK',
				name: 'instance_oks',
			},
		]
	}

	getActionDefinitions() {
		return {
			instance_control: {
				label: 'Enable or disable connection',
				options: [
					{
						type: 'internal:instance_id',
						label: 'Connection',
						id: 'instance_id',
					},
					{
						type: 'dropdown',
						label: 'Enable',
						id: 'enable',
						default: 'true',
						choices: [
							{ id: 'true', label: 'Yes' },
							{ id: 'false', label: 'No' },
						],
					},
				],
			},
		}
	}

	getFeedbackDefinitions() {
		return {
			instance_status: {
				type: 'advanced',
				label: 'Companion Connection Status',
				description:
					'Change button color on Connection Status\nDisabled color is not used when "All" connections is selected',
				options: [
					{
						type: 'internal:instance_id',
						label: 'Connection or All',
						id: 'instance_id',
						includeAll: true,
						default: 'all',
					},
					{
						type: 'colorpicker',
						label: 'OK foreground color',
						id: 'ok_fg',
						default: rgb(255, 255, 255),
					},
					{
						type: 'colorpicker',
						label: 'OK background color',
						id: 'ok_bg',
						default: rgb(0, 200, 0),
					},
					{
						type: 'colorpicker',
						label: 'Warning foreground color',
						id: 'warning_fg',
						default: rgb(0, 0, 0),
					},
					{
						type: 'colorpicker',
						label: 'Warning background color',
						id: 'warning_bg',
						default: rgb(255, 255, 0),
					},
					{
						type: 'colorpicker',
						label: 'Error foreground color',
						id: 'error_fg',
						default: rgb(255, 255, 255),
					},
					{
						type: 'colorpicker',
						label: 'Error background color',
						id: 'error_bg',
						default: rgb(200, 0, 0),
					},
					{
						type: 'colorpicker',
						label: 'Disabled foreground color',
						id: 'disabled_fg',
						default: rgb(153, 153, 153),
					},
					{
						type: 'colorpicker',
						label: 'Disabled background color',
						id: 'disabled_bg',
						default: rgb(64, 64, 64),
					},
				],
			},
			instance_custom_state: {
				type: 'boolean',
				label: 'Connection matches specified status',
				description: 'Change style when a connection matches the specified status',
				style: {
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 255, 0),
				},
				options: [
					{
						type: 'internal:instance_id',
						label: 'Connection or All',
						id: 'instance_id',
						includeAll: false,
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
							{ id: null, label: 'Disabled' },
						],
					},
				],
			},
		}
	}

	executeAction(action) {
		if (action.action === 'instance_control') {
			this.registry.instance.enableDisableInstance(action.options.instance_id, action.options.enable == 'true')
			return true
		}
	}

	executeFeedback(feedback) {
		if (feedback.type === 'instance_status') {
			if (feedback.options.instance_id == 'all') {
				if (this.instance_errors > 0) {
					return {
						color: feedback.options.error_fg,
						bgcolor: feedback.options.error_bg,
					}
				}

				if (this.instance_warns > 0) {
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

			const cur_instance = this.instance.getInstanceStatus(feedback.options.instance_id)
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
		} else if (feedback.type === 'instance_custom_state') {
			const selected_status = this.instance_statuses[feedback.options.instance_id]?.category ?? null

			return selected_status == feedback.options.state
		}
	}

	updateVariables() {
		this.internalModule.setVariables({
			instance_errors: this.instance_errors,
			instance_warns: this.instance_warns,
			instance_oks: this.instance_oks,
		})
	}

	calculateInstanceErrors(instance_statuses) {
		let numError = 0
		let numWarn = 0
		let numOk = 0

		for (const status of Object.values(instance_statuses)) {
			if (status.category === 'good') {
				numOk++
			} else if (status.category === 'warning') {
				numWarn++
			} else if (status.category === 'error') {
				numError++
			}
		}

		this.instance_statuses = instance_statuses ?? {}
		this.instance_errors = numError
		this.instance_warns = numWarn
		this.instance_oks = numOk

		this.updateVariables()
		this.internalModule.checkFeedbacks('instance_status', 'instance_custom_state')
	}
}
