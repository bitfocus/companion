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

import { formatLocation, oldBankIndexToXY, ParseControlId } from '@companion-app/shared/ControlId.js'
import { ButtonStyleProperties } from '@companion-app/shared/Style.js'
import debounceFn from 'debounce-fn'
import type {
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalVisitor,
	ActionForVisitor,
	InternalActionDefinition,
	InternalFeedbackDefinition,
	InternalModuleFragmentEvents,
	FeedbackForInternalExecution,
	ActionForInternalExecution,
} from './Types.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type ActionEntityModel,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { nanoid } from 'nanoid'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'
import {
	CHOICES_LOCATION,
	convertOldLocationToExpressionOrValue,
	convertOldSplitOptionToExpression,
	convertSimplePropertyToExpresionValue,
	ParseLocationString,
} from './Util.js'
import { EventEmitter } from 'events'
import { parseColorToNumber } from '../Resources/Util.js'
import type { CompanionFeedbackButtonStyleResult } from '@companion-module/base'

const ButtonStylePropertiesExt = [
	...ButtonStyleProperties,
	{ id: 'show_topbar', label: 'Topbar' },
	{ id: 'imageBuffers', label: 'Image buffers' },
]

export class InternalControls extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #graphicsController: GraphicsController
	readonly #controlsController: ControlsController
	readonly #pageStore: IPageStore

	/**
	 * The dependencies of locations that should retrigger each feedback when buttons are drawn
	 */
	#buttonDrawnSubscriptions = new Map<string, string>()

	/**
	 * The dependencies of locations that should retrigger each feedback when push state changes
	 */
	#pushStateSubscriptions = new Map<string, string>()

	constructor(
		graphicsController: GraphicsController,
		controlsController: ControlsController,
		pageStore: IPageStore,
		controlEvents: EventEmitter<ControlCommonEvents>
	) {
		super()

		this.#graphicsController = graphicsController
		this.#controlsController = controlsController
		this.#pageStore = pageStore

		const pendingLocationInvalidations = new Set<string>()
		const debounceCheckFeedbacks = debounceFn(
			() => {
				// Find all feedbacks that are affected by the pending location invalidations
				const affectedIds: string[] = []
				for (const [id, locationStr] of this.#buttonDrawnSubscriptions.entries()) {
					if (pendingLocationInvalidations.has(locationStr)) {
						affectedIds.push(id)
					}
				}

				// Remove the pending invalidations
				pendingLocationInvalidations.clear()

				if (affectedIds.length > 0) {
					this.emit('checkFeedbacksById', ...affectedIds)
				}
			},
			{
				maxWait: 100,
				wait: 20,
				after: true,
			}
		)

		setImmediate(() => {
			this.#graphicsController.on('button_drawn', (location) => {
				pendingLocationInvalidations.add(formatLocation(location))
				debounceCheckFeedbacks()
			})
		})

		controlEvents.on('updateButtonState', (controlLocation) => {
			// This needs to be synchronous so that it is possible to use bank_pushed inside in the condition of a logic_while

			const controlLocationStr = formatLocation(controlLocation)

			// Find all feedbacks that are affected by the pending location invalidations
			const affectedIds: string[] = []
			for (const [id, locationStr] of this.#pushStateSubscriptions.entries()) {
				if (locationStr === controlLocationStr) {
					affectedIds.push(id)
				}
			}

			if (affectedIds.length > 0) {
				this.emit('checkFeedbacksById', ...affectedIds)
			}
		})
	}

	#fetchPage(options: Record<string, any>, extras: RunActionExtras): { thePage: number | null } {
		let thePage = options.page

		if (thePage === 0 || thePage === '0') thePage = extras.location?.pageNumber ?? null

		return {
			thePage,
		}
	}

	#fetchLocationAndControlId(
		options: Record<string, any>,
		extras: RunActionExtras | FeedbackForInternalExecution
	): {
		theControlId: string | null
		theLocation: ControlLocation | null
	} {
		const location = ParseLocationString(String(options.location), extras.location)
		const theControlId = location ? this.#pageStore.getControlIdAt(location) : null

		return {
			theControlId,
			theLocation: location,
		}
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			button_pressrelease: {
				label: 'Button: Trigger press and release',
				description: undefined,
				showButtonPreview: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},
			button_press: {
				label: 'Button: Trigger press',
				description: undefined,
				showButtonPreview: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},
			button_release: {
				label: 'Button: Trigger release',
				description: undefined,
				showButtonPreview: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'checkbox',
						label: 'Force press if already pressed',
						id: 'force',
						default: false,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},

			button_rotate_left: {
				label: 'Button: Trigger rotate left',
				description: 'Make sure to enable rotary actions for the specified button',
				showButtonPreview: true,
				options: [CHOICES_LOCATION],
				internalUsesAutoParser: true,
			},
			button_rotate_right: {
				label: 'Button: Trigger rotate right',
				description: 'Make sure to enable rotary actions for the specified button',
				showButtonPreview: true,
				options: [CHOICES_LOCATION],
				internalUsesAutoParser: true,
			},

			button_text: {
				label: 'Button: Set text',
				description:
					"Avoid this if you can. It's better to either set the text to a custom variable, or to use a feedback to dynamically override the text",
				showButtonPreview: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'textinput',
						label: 'Button Text',
						id: 'label',
						default: '',
					},
				],
				internalUsesAutoParser: true,
			},
			textcolor: {
				label: 'Button: Set text color',
				description: "Avoid this if you can. It's better to dynamically change the color with a feedback",
				showButtonPreview: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'colorpicker',
						label: 'Text Color',
						id: 'color',
						default: '0x000000',
						description: 'This can be an integer or hex in the format 0xffffff',
					},
				],
				internalUsesAutoParser: true,
			},
			bgcolor: {
				label: 'Button: Set background color',
				description: "Avoid this if you can. It's better to dynamically change the color with a feedback",
				showButtonPreview: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'colorpicker',
						label: 'Background Color',
						id: 'color',
						default: '0x000000',
						description: 'This can be an integer or hex in the format 0xffffff',
					},
				],
				internalUsesAutoParser: true,
			},

			panic_bank: {
				label: 'Actions: Abort button runs',
				description: undefined,
				showButtonPreview: true,
				options: [
					{
						...CHOICES_LOCATION,
						description: 'In the format 1/0/0. this-run or this-all-runs is also accepted as special modes',
						expressionDescription:
							'In the format `1/0/0`. `this-run` or `this-all-runs` is also accepted as special modes',
					},
					{
						type: 'checkbox',
						label: 'Skip release actions?',
						id: 'unlatch',
						default: false,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},
			panic_page: {
				label: 'Actions: Abort all button runs on a page',
				description: undefined,
				options: [
					{
						type: 'internal:page',
						label: 'Page',
						id: 'page',
						includeStartup: false,
						includeDirection: false,
						default: 0,
					},
					{
						type: 'checkbox',
						label: 'Except this button',
						tooltip: 'When checked, actions on the current button will not be aborted',
						id: 'ignoreSelf',
						default: false,
						disableAutoExpression: true,
					},
					{
						type: 'checkbox',
						label: 'Ignore current run',
						tooltip: 'When checked, the current run will not be aborted',
						id: 'ignoreCurrent',
						default: true,
						isVisibleUi: {
							type: 'expression',
							fn: '!$(options:ignoreSelf)',
						},
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},
			panic_trigger: {
				label: 'Actions: Abort trigger runs',
				description: undefined,
				options: [
					{
						type: 'internal:trigger',
						label: 'Trigger',
						id: 'trigger_id',
						includeSelf: 'abort',
						default: 'self',
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},
			panic: {
				label: 'Actions: Abort all button and trigger runs',
				description: undefined,
				options: [
					{
						type: 'checkbox',
						label: 'Ignore current run',
						tooltip: 'When checked, the current run will not be aborted',
						id: 'ignoreCurrent',
						default: true,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},

			bank_current_step: {
				label: 'Button: Set current step',
				description: undefined,
				showButtonPreview: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'textinput',
						label: 'Button Step',
						description: 'eg 1, 2',
						id: 'step',
						default: '1',
						useVariables: {
							local: true,
						},
					},
				],
				internalUsesAutoParser: true,
			},
			bank_current_step_delta: {
				label: 'Button: Skip step',
				description: undefined,
				showButtonPreview: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'number',
						label: 'Amount',
						tooltip: 'Negative to go backwards',
						id: 'amount',
						default: 1,
						min: Number.MIN_SAFE_INTEGER,
						max: Number.MAX_SAFE_INTEGER,
					},
				],
				internalUsesAutoParser: true,
			},
		}
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			bank_style: {
				feedbackType: FeedbackEntitySubType.Advanced,
				label: 'Button: Use another buttons style',
				description: 'Imitate the style of another button',
				showButtonPreview: true,
				feedbackStyle: undefined,
				showInvert: false,
				options: [
					CHOICES_LOCATION,
					{
						id: 'properties',
						label: 'Properties',
						type: 'multidropdown',
						minSelection: 1,
						choices: ButtonStylePropertiesExt,
						default: ButtonStylePropertiesExt.map((p) => p.id),
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},
			bank_pushed: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Button: When pushed',
				description: 'Change style when a button is being pressed',
				showButtonPreview: true,
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'checkbox',
						label: 'Treat stepped as pressed? (latch compatibility)',
						id: 'latch_compatability',
						default: false,
						disableAutoExpression: true,
					},
				],
				internalUsesAutoParser: true,
			},
			bank_current_step: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Button: Check step',
				description: 'Change style based on the current step of a button',
				showButtonPreview: true,
				feedbackStyle: {
					color: 0x000000,
					bgcolor: 0x00ff00,
				},
				showInvert: true,
				options: [
					CHOICES_LOCATION,
					{
						type: 'number',
						label: 'Step',
						tooltip: 'Which Step?',
						id: 'step',
						default: 1,
						min: 1,
						max: Number.MAX_SAFE_INTEGER,
					},
				],
				internalUsesAutoParser: true,
			},
		}
	}

	feedbackUpgrade(feedback: FeedbackEntityModel, _controlId: string): FeedbackEntityModel | void {
		let changed = false

		if (feedback.options.bank !== undefined) {
			if (feedback.options.bank == 0 && feedback.options.page == 0) {
				feedback.options.location_target = 'this'

				delete feedback.options.bank
				delete feedback.options.page
				changed = true
			} else {
				const xy = oldBankIndexToXY(feedback.options.bank)

				let pageNumber = feedback.options.page
				if (pageNumber == 0) pageNumber = `$(this:page)`

				const buttonId = xy ? `${xy[1]}/${xy[0]}` : `$(this:row)/$(this:column)`

				feedback.options.location_target = 'text'
				feedback.options.location_text = `${pageNumber}/${buttonId}`

				delete feedback.options.bank
				delete feedback.options.page
				changed = true
			}
		}

		if (feedback.definitionId === 'bank_style' || feedback.definitionId === 'bank_pushed') {
			changed = convertOldLocationToExpressionOrValue(feedback.options) || changed
		} else if (feedback.definitionId === 'bank_current_step') {
			changed = convertOldLocationToExpressionOrValue(feedback.options) || changed
			changed = convertSimplePropertyToExpresionValue(feedback.options, 'step') || changed
		}

		if (changed) return feedback
	}

	executeFeedback(feedback: FeedbackForInternalExecution): CompanionFeedbackButtonStyleResult | boolean | void {
		if (feedback.definitionId === 'bank_style') {
			const { theLocation } = this.#fetchLocationAndControlId(feedback.options, feedback)

			if (
				!feedback.location ||
				!theLocation ||
				!theLocation.pageNumber ||
				typeof theLocation.column !== 'number' ||
				typeof theLocation.row !== 'number' ||
				(theLocation.pageNumber === feedback.location.pageNumber &&
					theLocation.column === feedback.location.column &&
					theLocation.row === feedback.location.row)
			) {
				this.#buttonDrawnSubscriptions.delete(feedback.id)
				// Don't recurse on self
				return {}
			}

			this.#buttonDrawnSubscriptions.set(feedback.id, formatLocation(theLocation))

			const render = this.#graphicsController.getCachedRender(theLocation)
			if (render?.style && typeof render.style === 'object') {
				if (!feedback.options.properties) {
					// TODO populate these properties instead
					return structuredClone(render.style as any)
				} else {
					const newStyle: Record<string, any> = {}

					for (const prop of feedback.options.properties as any) {
						// @ts-expect-error mismatch in prop type
						newStyle[prop] = render.style[prop]
					}

					// Return cloned resolved style
					return structuredClone(newStyle)
				}
			} else {
				return {}
			}
		} else if (feedback.definitionId === 'bank_pushed') {
			const { theControlId, theLocation } = this.#fetchLocationAndControlId(feedback.options, feedback)

			if (theLocation) {
				this.#pushStateSubscriptions.set(feedback.id, formatLocation(theLocation))
			} else {
				this.#pushStateSubscriptions.delete(feedback.id)
			}

			const control = theControlId && this.#controlsController.getControl(theControlId)
			if (control && control.supportsPushed) {
				let isPushed = !!control.pushed

				if (!isPushed && feedback.options.latch_compatability && control.supportsActionSets) {
					// Backwards compatibility for the old 'latching' behaviour
					isPushed = control.actionSets.getActiveStepIndex() !== 0
				}

				return isPushed
			} else {
				return false
			}
		} else if (feedback.definitionId == 'bank_current_step') {
			const { theControlId, theLocation } = this.#fetchLocationAndControlId(feedback.options, feedback)

			if (theLocation) {
				this.#buttonDrawnSubscriptions.set(feedback.id, formatLocation(theLocation))
			} else {
				this.#buttonDrawnSubscriptions.delete(feedback.id)
			}

			const theStep = feedback.options.step

			const control = theControlId && this.#controlsController.getControl(theControlId)
			if (control && control.supportsActionSets) {
				return control.actionSets.getActiveStepIndex() + 1 === Number(theStep)
			} else {
				return false
			}
		}
	}

	forgetFeedback(feedback: FeedbackEntityModel): void {
		this.#buttonDrawnSubscriptions.delete(feedback.id)
		this.#pushStateSubscriptions.delete(feedback.id)
	}

	actionUpgrade(action: ActionEntityModel, controlId: string): ActionEntityModel | void {
		let changed = false
		if (
			action.definitionId === 'button_pressrelease' ||
			action.definitionId === 'button_pressrelease_if_expression' ||
			action.definitionId === 'button_pressrelease_condition' ||
			action.definitionId === 'button_pressrelease_condition_variable' ||
			action.definitionId === 'button_press' ||
			action.definitionId === 'button_release'
		) {
			if (action.options.force === undefined) {
				action.options.force = true

				changed = true
			}
		}

		if (action.definitionId === 'button_pressrelease_condition_variable') {
			action.definitionId = 'button_pressrelease_condition'

			// Also mangle the page & bank inputs
			action.options.page_from_variable = true
			action.options.bank_from_variable = true
			action.options.page_variable = `$(${action.options.page})`
			delete action.options.page
			action.options.bank_variable = `$(${action.options.bank})`
			delete action.options.bank

			changed = true
		}

		// Update bank -> location
		if (
			action.options.location_target === undefined &&
			(action.definitionId === 'button_pressrelease' ||
				action.definitionId === 'button_press' ||
				action.definitionId === 'button_pressrelease_if_expression' ||
				action.definitionId === 'button_pressrelease_condition' ||
				action.definitionId === 'button_press' ||
				action.definitionId === 'button_release' ||
				action.definitionId === 'button_rotate_left' ||
				action.definitionId === 'button_rotate_right' ||
				action.definitionId === 'button_text' ||
				action.definitionId === 'textcolor' ||
				action.definitionId === 'bgcolor' ||
				action.definitionId === 'panic_bank' ||
				action.definitionId === 'bank_current_step' ||
				action.definitionId === 'bank_current_step_condition' ||
				action.definitionId === 'bank_current_step_if_expression' ||
				action.definitionId === 'bank_current_step_delta')
		) {
			const oldOptions = { ...action.options }
			delete action.options.bank
			delete action.options.bank_variable
			delete action.options.bank_from_variable
			delete action.options.page
			delete action.options.page_variable
			delete action.options.page_from_variable

			if (oldOptions.bank == 0 && oldOptions.page == 0) {
				action.options.location_target = 'this'

				changed = true
			} else {
				const xy = oldBankIndexToXY(oldOptions.bank)

				let pageNumber = oldOptions.page_from_variable ? oldOptions.page_variable : oldOptions.page
				if (pageNumber == 0) pageNumber = `$(this:page)`

				if (oldOptions.bank_from_variable || oldOptions.page_from_variable) {
					const column = xy ? xy[0] : '$(this:column)'
					const row = xy ? xy[1] : '$(this:row)'

					action.options.location_target = 'expression'
					action.options.location_expression = oldOptions.bank_from_variable
						? `concat(${pageNumber}, '/bank', ${oldOptions.bank_variable})`
						: `concat(${pageNumber}, '/', ${row}, '/', ${column})`
				} else {
					const buttonId = xy ? `${xy[1]}/${xy[0]}` : `$(this:row)/$(this:column)`

					action.options.location_target = 'text'
					action.options.location_text = `${pageNumber}/${buttonId}`
				}

				changed = true
			}
		}

		if (
			action.definitionId === 'button_pressrelease_if_expression' ||
			action.definitionId === 'bank_current_step_if_expression'
		) {
			const newChildAction: ActionEntityModel = {
				type: EntityModelType.Action,
				id: nanoid(),
				definitionId: action.definitionId.slice(0, -'_if_expression'.length),
				connectionId: 'internal',
				options: {
					...action.options,
				},
				upgradeIndex: undefined,
			}
			delete newChildAction.options.expression

			const newExpressionFeedback: FeedbackEntityModel = {
				type: EntityModelType.Feedback,
				id: nanoid(),
				definitionId: 'check_expression',
				connectionId: 'internal',
				options: {
					expression: action.options.expression,
				},
				upgradeIndex: undefined,
			}

			return {
				type: EntityModelType.Action,
				id: action.id,
				definitionId: 'logic_if',
				connectionId: 'internal',
				options: {},
				children: {
					condition: [newExpressionFeedback],
					actions: [newChildAction],
					else_actions: [],
				},
				upgradeIndex: undefined,
			} satisfies ActionEntityModel
		} else if (
			action.definitionId === 'button_pressrelease_condition' ||
			action.definitionId === 'button_press_condition' ||
			action.definitionId === 'button_release_condition' ||
			action.definitionId === 'bank_current_step_condition'
		) {
			const newChildAction: ActionEntityModel = {
				type: EntityModelType.Action,
				id: nanoid(),
				definitionId: action.definitionId.slice(0, -'_condition'.length),
				connectionId: 'internal',
				options: {
					...action.options,
				},
				upgradeIndex: undefined,
			}
			delete newChildAction.options.variable
			delete newChildAction.options.op
			delete newChildAction.options.value

			// Ensure the new child action is fully upgraded
			this.actionUpgrade(newChildAction, controlId)

			const newExpressionFeedback: FeedbackEntityModel = {
				type: EntityModelType.Feedback,
				id: nanoid(),
				definitionId: 'variable_value',
				connectionId: 'internal',
				options: {
					variable: action.options.variable,
					op: action.options.op,
					value: action.options.value,
				},
				upgradeIndex: undefined,
			}

			// TODO - recursive upgrade this new feedback?

			return {
				type: EntityModelType.Action,
				id: action.id,
				definitionId: 'logic_if',
				connectionId: 'internal',
				options: {},
				children: {
					condition: [newExpressionFeedback],
					actions: [newChildAction],
					else_actions: [],
				},
				upgradeIndex: undefined,
			} satisfies ActionEntityModel
		}

		if (action.definitionId === 'panic_page' && !isExpressionOrValue(action.options.page)) {
			convertOldSplitOptionToExpression(
				action.options,
				{
					useVariables: 'page_from_variable',
					variable: 'page_variable',
					simple: 'page',
					result: 'page',
				},
				true
			)
			changed = true
		} else if (
			action.definitionId === 'button_pressrelease' ||
			action.definitionId === 'button_press' ||
			action.definitionId === 'button_release' ||
			action.definitionId === 'button_rotate_left' ||
			action.definitionId === 'button_rotate_right' ||
			action.definitionId === 'panic_bank'
		) {
			changed = convertOldLocationToExpressionOrValue(action.options) || changed
		} else if (action.definitionId === 'button_text') {
			changed = convertOldLocationToExpressionOrValue(action.options) || changed
			changed = convertSimplePropertyToExpresionValue(action.options, 'label') || changed
		} else if (action.definitionId === 'bgcolor' || action.definitionId === 'textcolor') {
			changed = convertOldLocationToExpressionOrValue(action.options) || changed
			changed = convertSimplePropertyToExpresionValue(action.options, 'color') || changed
		} else if (action.definitionId === 'bank_current_step_delta') {
			changed = convertOldLocationToExpressionOrValue(action.options) || changed
			changed = convertSimplePropertyToExpresionValue(action.options, 'amount') || changed
		} else if (action.definitionId === 'bank_current_step') {
			changed = convertOldLocationToExpressionOrValue(action.options) || changed

			if (action.options.step === undefined) {
				convertOldSplitOptionToExpression(
					action.options,
					{
						useVariables: 'step_from_expression',
						variable: 'step_expression',
						simple: 'step',
						result: 'step',
					},
					true
				)
				changed = true
			}
		}

		// Note: some fixups above return directly, when wrapping the action inside a logic_if. But the new child should be recursively updated
		if (changed) return action
	}

	executeAction(action: ActionForInternalExecution, extras: RunActionExtras): boolean {
		if (action.definitionId === 'button_pressrelease') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			const forcePress = !!action.options.force

			this.#controlsController.pressControl(theControlId, true, extras.surfaceId, forcePress)
			this.#controlsController.pressControl(theControlId, false, extras.surfaceId, forcePress)
			return true
		} else if (action.definitionId === 'button_press') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			this.#controlsController.pressControl(theControlId, true, extras.surfaceId, !!action.options.force)
			return true
		} else if (action.definitionId === 'button_release') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			this.#controlsController.pressControl(theControlId, false, extras.surfaceId, !!action.options.force)
			return true
		} else if (action.definitionId === 'button_rotate_left') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			this.#controlsController.rotateControl(theControlId, false, extras.surfaceId)
			return true
		} else if (action.definitionId === 'button_rotate_right') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			this.#controlsController.rotateControl(theControlId, true, extras.surfaceId)
			return true
		} else if (action.definitionId === 'bgcolor') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)
			if (control && control.supportsStyle) {
				const color = parseColorToNumber(action.options.color as any) || 0
				control.styleSetFields({ bgcolor: color })
			}
			return true
		} else if (action.definitionId === 'textcolor') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)
			if (control && control.supportsStyle) {
				const color = parseColorToNumber(action.options.color as any) || 0
				control.styleSetFields({ color: color })
			}
			return true
		} else if (action.definitionId === 'button_text') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)
			if (control && control.supportsStyle) {
				control.styleSetFields({ text: action.options.label })
			}

			return true
		} else if (action.definitionId === 'panic_bank') {
			// Special case handling for special modes
			const rawControlId = String(action.options.location).trim().toLowerCase()
			if (rawControlId === 'this-run') {
				const control = this.#controlsController.getControl(extras.controlId)
				if (control && control.supportsActions) {
					control.abortDelayedActionsSingle(Boolean(action.options.unlatch), extras.abortDelayed)
				}

				return true
			} else if (rawControlId === 'this-all-runs') {
				const control = this.#controlsController.getControl(extras.controlId)
				if (control && control.supportsActions) {
					control.abortDelayedActions(Boolean(action.options.unlatch), null)
				}

				return true
			}

			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)
			if (control && control.supportsActions) {
				control.abortDelayedActions(
					Boolean(action.options.unlatch),
					theControlId === extras.controlId ? extras.abortDelayed : null
				)
			}

			return true
		} else if (action.definitionId === 'panic_page') {
			const { thePage } = this.#fetchPage(action.options, extras)
			if (thePage === null) return true

			const controlIdsOnPage = this.#pageStore.getAllControlIdsOnPage(thePage)
			for (const controlId of controlIdsOnPage) {
				if (action.options.ignoreSelf && controlId === extras.controlId) continue

				const control = this.#controlsController.getControl(controlId)
				if (control && control.supportsActions) {
					control.abortDelayedActions(false, action.options.ignoreCurrent ? extras.abortDelayed : null)
				}
			}

			return true
		} else if (action.definitionId === 'panic_trigger') {
			const rawControlId = String(action.options.trigger_id)
			let controlId = rawControlId
			if (controlId === 'self' || controlId?.startsWith('self:')) controlId = extras.controlId

			if (controlId && ParseControlId(controlId)?.type === 'trigger') {
				const control = this.#controlsController.getControl(controlId)
				if (control && control.supportsActions) {
					if (rawControlId === 'self') {
						control.abortDelayedActions(false, extras.abortDelayed)
					} else if (rawControlId === 'self:only-this-run') {
						control.abortDelayedActionsSingle(false, extras.abortDelayed)
					} else {
						control.abortDelayedActions(false, null)
					}
				}
			}

			return true
		} else if (action.definitionId === 'panic') {
			this.#controlsController.abortAllDelayedActions(action.options.ignoreCurrent ? extras.abortDelayed : null)
			return true
		} else if (action.definitionId == 'bank_current_step') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)

			if (control && control.supportsActionSets) {
				control.actionSets.stepMakeCurrent(Number(action.options.step))
			}
			return true
		} else if (action.definitionId == 'bank_current_step_delta') {
			const { theControlId } = this.#fetchLocationAndControlId(action.options, extras)
			if (!theControlId) return true

			const control = this.#controlsController.getControl(theControlId)

			if (control && control.supportsActionSets) {
				control.actionSets.stepAdvanceDelta(Number(action.options.amount))
			}
			return true
		} else {
			return false
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
