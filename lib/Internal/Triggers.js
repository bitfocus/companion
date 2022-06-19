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

export default class Triggers extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Triggers')

		// this.internalModule = internalModule

		this.registry.triggers.on('list_refresh', () => {
			this.internalModule.checkFeedbacks('trigger_enabled')
		})
	}

	getActionDefinitions() {
		return {
			trigger_enabled: {
				label: 'Enable or disable trigger',
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

	executeAction(action) {
		if (action.action === 'trigger_enabled') {
			const trigger = this.triggers.get_trigger(action.options.trigger_id)
			if (!trigger) return false

			let newState = action.options.enable == 'true'
			if (action.options.enable == 'toggle') newState = !!trigger.disabled

			this.triggers.set_enabled(action.options.trigger_id, newState)

			return true
		}
	}

	getFeedbackDefinitions() {
		return {
			trigger_enabled: {
				type: 'boolean',
				label: 'Check if trigger is enabled or disabled',
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
			const trigger = this.triggers.get_trigger(feedback.options.trigger_id)
			if (!trigger) return false

			const state = !trigger.disabled
			const target = feedback.options.enable == 'true'
			return state == target
		}
	}
}
