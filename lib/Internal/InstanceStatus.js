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

import CoreBase from '../Core/Base.js'
import { rgb } from '../Resources/Util.js'

export default class InstanceStatus extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'lib/Internal/InstanceStatus')

		// this.internalModule = internalModule

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

	getFeedbackDefinitions() {
		return {
			instance_status: {
				type: 'advanced',
				label: 'Companion Instance Status',
				description:
					'Change button color on Instance Status\nDisabled color is not used when "All" instances is selected',
				options: [
					{
						type: 'internal:instance_id',
						label: 'Instance or All',
						id: 'instance_id',
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
				if (cur_instance[0] == 2) {
					return {
						color: feedback.options.error_fg,
						bgcolor: feedback.options.error_bg,
					}
				}

				if (cur_instance[0] == 1) {
					return {
						color: feedback.options.warning_fg,
						bgcolor: feedback.options.warning_bg,
					}
				}

				if (cur_instance[0] == 0) {
					return {
						color: feedback.options.ok_fg,
						bgcolor: feedback.options.ok_bg,
					}
				}

				if (cur_instance[0] == -1 || cur_instance[0] == null) {
					return {
						color: feedback.options.disabled_fg,
						bgcolor: feedback.options.disabled_bg,
					}
				}
			}
			// disabled has no 'status' entry
			if (feedback.options.instance_id != 'bitfocus-companion') {
				return {
					color: feedback.options.disabled_fg,
					bgcolor: feedback.options.disabled_bg,
				}
			}

			return {}
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

		// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		for (const i in instance_statuses) {
			let inn = instance_statuses[i]

			if (inn[0] === 0) {
				numOk++
			} else if (inn[0] === 1) {
				numWarn++
			} else if (inn[0] === 2) {
				numError++
			}
		}

		this.instance_errors = numError
		this.instance_warns = numWarn
		this.instance_oks = numOk

		this.updateVariables()
		this.internalModule.checkFeedbacks('instance_status')
	}
}
