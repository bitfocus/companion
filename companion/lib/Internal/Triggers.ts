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

import { EventEmitter } from 'node:events'
import debounceFn from 'debounce-fn'
import { FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type {
	ActionForInternalExecution,
	ActionForVisitor,
	FeedbackForInternalExecution,
	FeedbackForVisitor,
	InternalActionDefinition,
	InternalActionResult,
	InternalFeedbackDefinition,
	InternalModuleFragment,
	InternalModuleFragmentEvents,
	InternalVisitor,
} from './Types.js'

export class InternalTriggers extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #controlsController: ControlsController

	constructor(controlsController: ControlsController) {
		super()

		this.#controlsController = controlsController

		const debounceCheckFeedbacks = debounceFn(
			() => {
				this.emit('checkFeedbacks', 'trigger_enabled')
			},
			{
				maxWait: 100,
				wait: 20,
				after: true,
			}
		)
		this.#controlsController.triggerEvents.on('trigger_enabled', () => debounceCheckFeedbacks())

		const debounceCheckFeedbackCollections = debounceFn(
			() => {
				this.emit('checkFeedbacks', 'trigger_collection_enabled')
			},
			{
				maxWait: 100,
				wait: 20,
				after: true,
			}
		)
		this.#controlsController.triggerEvents.on('trigger_collections_enabled', () => debounceCheckFeedbackCollections())
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
						default: 'toggle',
						choices: [
							{ id: 'toggle', label: 'Toggle' },
							{ id: 'true', label: 'Yes' },
							{ id: 'false', label: 'No' },
						],
					},
				],

				optionsSupportExpressions: false,
			},
			trigger_collection_enabled: {
				label: 'Trigger: Enable or disable trigger collection',
				description: undefined,
				options: [
					{
						type: 'internal:trigger_collection',
						label: 'Collection',
						id: 'collection_id',
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

				optionsSupportExpressions: false,
			},
		}
	}

	executeAction(action: ActionForInternalExecution, _extras: RunActionExtras): InternalActionResult {
		switch (action.definitionId) {
			case 'trigger_enabled': {
				const triggerId = stringifyVariableValue(action.options.trigger_id)
				if (!triggerId) break

				const control = this.#controlsController.getControl(triggerId)
				if (!control || control.type !== 'trigger' || !control.supportsOptions) return null

				let newState = action.options.enable == 'true'
				if (action.options.enable == 'toggle') newState = !control.options.enabled

				control.optionsSetField('enabled', newState)

				break
			}
			case 'trigger_collection_enabled': {
				const collectionId = stringifyVariableValue(action.options.collection_id)
				if (!collectionId) break

				let newState: boolean | 'toggle' = action.options.enable == 'true'
				if (action.options.enable == 'toggle') newState = 'toggle'

				this.#controlsController.setTriggerCollectionEnabled(collectionId, newState)

				break
			}
			default:
				return null
		}

		return { result: undefined }
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			trigger_enabled: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Trigger: When enabled or disabled',
				description: undefined,
				feedbackStyle: {
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

				optionsSupportExpressions: false,
			},
			trigger_collection_enabled: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Trigger: When collection enabled or disabled',
				description: undefined,
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'internal:trigger_collection',
						label: 'Collection',
						id: 'collection_id',
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

				optionsSupportExpressions: false,
			},
		}
	}

	executeFeedback(feedback: FeedbackForInternalExecution): boolean | void {
		if (feedback.definitionId === 'trigger_enabled') {
			const triggerId = stringifyVariableValue(feedback.options.trigger_id)
			if (!triggerId) return false

			const control = this.#controlsController.getControl(triggerId)
			if (!control || control.type !== 'trigger' || !control.supportsOptions) return false

			const state = control.options.enabled
			const target = feedback.options.enable == 'true'
			return state == target
		} else if (feedback.definitionId === 'trigger_collection_enabled') {
			const collectionId = stringifyVariableValue(feedback.options.collection_id)
			if (!collectionId) return false

			const state = this.#controlsController.isTriggerCollectionEnabled(collectionId, true)
			const target = feedback.options.enable == 'true'
			return state == target
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
