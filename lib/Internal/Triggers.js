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
import { CreateTriggerControlId, ParseControlId } from '../Shared/ControlId.js'
import debounceFn from 'debounce-fn'

export default class Triggers extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Triggers')

		// this.internalModule = internalModule

		const debounceCheckFeedbacks = debounceFn(
			() => {
				this.internalModule.checkFeedbacks('trigger_enabled')
			},
			{
				maxWait: 100,
				wait: 20,
				after: true,
			}
		)

		this.controls.triggers.on('trigger_enabled', () => debounceCheckFeedbacks())
	}

	getActionDefinitions() {
		return {
			trigger_enabled: {
				label: 'Trigger: Enable or disable trigger',
				options: [
					{
						type: 'internal:trigger',
						label: 'Trigger',
						id: 'trigger_id',
					},
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
		}
	}

	actionUpgrade(action, controlId) {
		if (action.action === 'trigger_enabled' && !isNaN(Number(action.options.trigger_id))) {
			action.options.trigger_id = CreateTriggerControlId(action.options.trigger_id)

			return action
		}
	}

	executeAction(action) {
		if (action.action === 'trigger_enabled') {
			const parsedControlId = ParseControlId(action.options.trigger_id)
			if (parsedControlId?.type === 'trigger') {
				const control = this.controls.getControl(action.options.trigger_id)
				if (!control) return false

				let newState = action.options.enable == 'true'
				if (action.options.enable == 'toggle') newState = !control.options.enabled

				control.optionsSetField('enabled', newState)
			}

			return true
		}
	}

	getFeedbackDefinitions() {
		return {
			trigger_enabled: {
				type: 'boolean',
				label: 'Trigger: When enabled or disabled',
				style: {
					color: rgb(255, 255, 255),
					bgcolor: rgb(255, 0, 0),
				},
				options: [
					{
						type: 'internal:trigger',
						label: 'Trigger',
						id: 'trigger_id',
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

	executeFeedback(feedback) {
		if (feedback.type === 'trigger_enabled') {
			const parsedControlId = ParseControlId(feedback.options.trigger_id)
			if (parsedControlId?.type === 'trigger') {
				const control = this.controls.getControl(feedback.options.trigger_id)
				if (!control) return false

				const state = control.options.enabled
				const target = feedback.options.enable == 'true'
				return state == target
			} else {
				return false
			}
		}
	}
}
