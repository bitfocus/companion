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

import { rgb } from '../Resources/Util.js'
import { CreateTriggerControlId } from '../Shared/ControlId.js'
import debounceFn from 'debounce-fn'

export default class Triggers {
	/**
	 * @type {import('../Controls/Controller.js').default}
	 * @readonly
	 */
	#controlsController

	/**
	 * @type {import('./Controller.js').default}
	 * @readonly
	 */
	#internalModule

	/**
	 * @param {import('./Controller.js').default} internalModule
	 * @param {import('../Controls/Controller.js').default} controlsController
	 */
	constructor(internalModule, controlsController) {
		this.#internalModule = internalModule
		this.#controlsController = controlsController

		const debounceCheckFeedbacks = debounceFn(
			() => {
				this.#internalModule.checkFeedbacks('trigger_enabled')
			},
			{
				maxWait: 100,
				wait: 20,
				after: true,
			}
		)

		this.#controlsController.triggers.on('trigger_enabled', () => debounceCheckFeedbacks())
	}

	/**
	 * @returns {Record<string, import('./Types.js').InternalActionDefinition>}
	 */
	getActionDefinitions() {
		return {
			trigger_enabled: {
				label: 'Trigger: Enable or disable trigger',
				description: undefined,
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

	/**
	 * Perform an upgrade for an action
	 * @param {import('../Shared/Model/ActionModel.js').ActionInstance} action
	 * @param {string} _controlId
	 * @returns {import('../Shared/Model/ActionModel.js').ActionInstance | void} Updated action if any changes were made
	 */
	actionUpgrade(action, _controlId) {
		if (action.action === 'trigger_enabled' && !isNaN(Number(action.options.trigger_id))) {
			action.options.trigger_id = CreateTriggerControlId(action.options.trigger_id)

			return action
		}
	}

	/**
	 * Run a single internal action
	 * @param {import('../Shared/Model/ActionModel.js').ActionInstance} action
	 * @param {import('../Instance/Wrapper.js').RunActionExtras} _extras
	 * @returns {boolean} Whether the action was handled
	 */
	executeAction(action, _extras) {
		if (action.action === 'trigger_enabled') {
			const control = this.#controlsController.getControl(action.options.trigger_id)
			if (!control || control.type !== 'trigger' || !control.supportsOptions) return false

			let newState = action.options.enable == 'true'
			if (action.options.enable == 'toggle') newState = !control.options.enabled

			control.optionsSetField('enabled', newState)

			return true
		} else {
			return false
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

	/**
	 * Get an updated value for a feedback
	 * @param {import('./Types.js').FeedbackInstanceExt} feedback
	 * @returns {boolean | void}
	 */
	executeFeedback(feedback) {
		if (feedback.type === 'trigger_enabled') {
			const control = this.#controlsController.getControl(feedback.options.trigger_id)
			if (!control || control.type !== 'trigger' || !control.supportsOptions) return false

			const state = control.options.enabled
			const target = feedback.options.enable == 'true'
			return state == target
		}
	}
}
