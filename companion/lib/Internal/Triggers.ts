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

import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import debounceFn from 'debounce-fn'
import type { FeedbackForVisitor, FeedbackInstanceExt, InternalModuleFragment, InternalVisitor } from './Types.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { InternalController } from './Controller.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import type { InternalActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import type { InternalFeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'

export class InternalTriggers implements InternalModuleFragment {
	readonly #controlsController: ControlsController
	readonly #internalModule: InternalController

	constructor(internalModule: InternalController, controlsController: ControlsController) {
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

	getActionDefinitions(): Record<string, InternalActionDefinition> {
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

	actionUpgrade(action: ActionInstance, _controlId: string): ActionInstance | void {
		if (action.action === 'trigger_enabled' && !isNaN(Number(action.options.trigger_id))) {
			action.options.trigger_id = CreateTriggerControlId(action.options.trigger_id)

			return action
		}
	}

	executeAction(action: ActionInstance, _extras: RunActionExtras): boolean {
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

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			trigger_enabled: {
				type: 'boolean',
				label: 'Trigger: When enabled or disabled',
				description: undefined,
				style: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
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

	executeFeedback(feedback: FeedbackInstanceExt): boolean | void {
		if (feedback.type === 'trigger_enabled') {
			const control = this.#controlsController.getControl(feedback.options.trigger_id)
			if (!control || control.type !== 'trigger' || !control.supportsOptions) return false

			const state = control.options.enabled
			const target = feedback.options.enable == 'true'
			return state == target
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionInstance[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
