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
import debounceFn from 'debounce-fn'
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalVisitor,
	InternalActionDefinition,
	InternalFeedbackDefinition,
	InternalModuleFragmentEvents,
	FeedbackForInternalExecution,
	ActionForInternalExecution,
} from './Types.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import {
	FeedbackEntityModel,
	FeedbackEntitySubType,
	type ActionEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { convertOldSplitOptionToExpression, convertSimplePropertyToExpresionValue } from './Util.js'
import { EventEmitter } from 'events'
import type { VariableDefinition, VariableValues } from '@companion-app/shared/Model/Variables.js'

const CHOICES_SURFACE_ID: SomeCompanionInputField = {
	type: 'internal:surface_serial',
	label: 'Surface / group',
	id: 'surfaceId',
	default: 'self',
	includeSelf: true,
	useRawSurfaces: true,
}

const CHOICES_SURFACE_GROUP: SomeCompanionInputField = {
	type: 'internal:surface_serial',
	label: 'Surface / group',
	id: 'surfaceId',
	default: 'self',
	includeSelf: true,
}

const CHOICES_PAGE: SomeCompanionInputField = {
	type: 'internal:page',
	label: 'Page',
	id: 'page',
	includeStartup: true,
	includeDirection: true,
	default: 0,
}

export class InternalSurface extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #logger = LogController.createLogger('Internal/Surface')

	readonly #controlsController: ControlsController
	readonly #surfaceController: SurfaceController
	readonly #pageStore: IPageStore

	constructor(surfaceController: SurfaceController, controlsController: ControlsController, pageStore: IPageStore) {
		super()

		this.#surfaceController = surfaceController
		this.#controlsController = controlsController
		this.#pageStore = pageStore

		setImmediate(() => {
			this.emit('setVariables', {
				't-bar': 0,
				jog: 0,
				shuttle: 0,
			})
		})

		const debounceUpdateVariableDefinitions = debounceFn(() => this.emit('regenerateVariables'), {
			maxWait: 100,
			wait: 20,
			after: true,
		})
		const debounceUpdateVariables = debounceFn(() => this.updateVariables(), {
			maxWait: 100,
			wait: 20,
			after: true,
		})

		this.#surfaceController.on('surface_page', () => {
			debounceUpdateVariables()
			this.emit('checkFeedbacks', 'surface_on_page')
		})
		this.#surfaceController.on('group_page', () => debounceUpdateVariables())
		this.#surfaceController.on('surface_locked', () => debounceUpdateVariables())

		this.#surfaceController.on('group-add', () => {
			debounceUpdateVariableDefinitions()
			debounceUpdateVariables()
		})
		this.#surfaceController.on('group-delete', () => {
			debounceUpdateVariableDefinitions()
			debounceUpdateVariables()
		})
		this.#surfaceController.on('surface-add', () => {
			debounceUpdateVariableDefinitions()
			debounceUpdateVariables()
		})
		this.#surfaceController.on('surface-delete', () => {
			debounceUpdateVariableDefinitions()
			debounceUpdateVariables()
		})
		this.#surfaceController.on('surface-in-group', () => debounceUpdateVariables())
		this.#surfaceController.on('surface_name', () => debounceUpdateVariables())
		this.#surfaceController.on('group_name', () => debounceUpdateVariables())
	}

	#fetchSurfaceId(
		options: Record<string, any>,
		info: RunActionExtras | FeedbackForInternalExecution
	): string | undefined {
		let surfaceId: string | undefined = String(options.surfaceId).trim()

		if (info && surfaceId === 'self' && 'surfaceId' in info) surfaceId = info.surfaceId

		return surfaceId
	}

	#fetchPage(
		options: Record<string, any>,
		extras: RunActionExtras | FeedbackForInternalExecution,
		surfaceId: string | undefined
	): string | 'back' | 'forward' | '+1' | '-1' | undefined {
		let thePageNumber: number | string | undefined = options.page

		if (extras.location) {
			if (thePageNumber === 0 || thePageNumber === '0')
				// @ts-expect-error handle non-standard page property, for backwards compatibility
				thePageNumber = extras.location.pageNumber ?? extras.location.page
		}

		if (thePageNumber === 'startup') {
			const thePageId = surfaceId && this.#surfaceController.devicePageGetStartup(surfaceId)
			return thePageId || this.#pageStore.getFirstPageId()
		}
		if (thePageNumber === 'back' || thePageNumber === 'forward' || thePageNumber === '+1' || thePageNumber === '-1') {
			return thePageNumber
		}

		return this.#pageStore.getPageInfo(Number(thePageNumber))?.id
	}

	getVariableDefinitions(): VariableDefinition[] {
		const variables: VariableDefinition[] = []

		const surfaceInfos = this.#surfaceController.getDevicesList()
		for (const surfaceGroup of surfaceInfos) {
			if (!surfaceGroup.isAutoGroup) {
				const groupId = surfaceGroup.id.startsWith('group:') ? surfaceGroup.id.slice(6) : surfaceGroup.id
				variables.push(
					{
						description: `Surface Group name: ${surfaceGroup.displayName}`,
						name: `surface_group_${groupId}_name`,
					},
					{
						description: `Surface Group member count: ${surfaceGroup.displayName}`,
						name: `surface_group_${groupId}_surface_count`,
					},
					{
						description: `Surface Group page: ${surfaceGroup.displayName}`,
						name: `surface_group_${groupId}_page`,
					}
				)
			}

			for (const surface of surfaceGroup.surfaces) {
				if (!surface.isConnected) continue

				const surfaceId = surface.id.replaceAll(':', '_') // TODO - more chars

				variables.push(
					{
						description: `Surface name: ${surface.displayName}`,
						name: `surface_${surfaceId}_name`,
					},
					{
						description: `Surface locked: ${surface.displayName}`,
						name: `surface_${surfaceId}_locked`,
					},
					{
						description: `Surface location: ${surface.displayName}`,
						name: `surface_${surfaceId}_location`,
					},
					{
						description: `Surface page: ${surfaceGroup.displayName}`,
						name: `surface_${surfaceId}_page`,
					}
				)
			}
		}

		return variables
	}

	#lastUpdateVariableNames: ReadonlySet<string> = new Set()
	updateVariables(): void {
		const values: VariableValues = {}

		const surfaceInfos = this.#surfaceController.getDevicesList()
		for (const surfaceGroup of surfaceInfos) {
			let surfaceCount = 0

			for (const surface of surfaceGroup.surfaces) {
				if (!surface.isConnected) continue

				surfaceCount++

				const surfaceId = surface.id.replaceAll(':', '_') // TODO - more chars
				values[`surface_${surfaceId}_name`] = surface.name || surface.id
				values[`surface_${surfaceId}_locked`] = surface.locked
				values[`surface_${surfaceId}_location`] = surface.location ?? 'Local'

				const surfacePageId = this.#surfaceController.devicePageGet(surface.id)
				values[`surface_${surfaceId}_page`] = (surfacePageId && this.#pageStore.getPageNumber(surfacePageId)) || '0'
			}

			if (!surfaceGroup.isAutoGroup) {
				const groupId = surfaceGroup.id.startsWith('group:') ? surfaceGroup.id.slice(6) : surfaceGroup.id
				values[`surface_group_${groupId}_name`] = surfaceGroup.displayName
				values[`surface_group_${groupId}_surface_count`] = surfaceCount

				const surfaceGroupPageId = this.#surfaceController.devicePageGet(surfaceGroup.id)
				values[`surface_group_${groupId}_page`] =
					(surfaceGroupPageId && this.#pageStore.getPageNumber(surfaceGroupPageId)) || '0'
			}
		}

		const idsBeingSetThisRun = new Set(
			Object.entries(values)
				.filter(([_key, value]) => value !== undefined)
				.map(([key]) => key)
		)

		// Clear any variables which were set last run, but not this time
		for (const variableName of this.#lastUpdateVariableNames) {
			if (!idsBeingSetThisRun.has(variableName)) {
				values[variableName] = undefined
			}
		}

		this.#lastUpdateVariableNames = idsBeingSetThisRun

		this.emit('setVariables', values)
	}

	actionUpgrade(action: ActionEntityModel, _controlId: string): void | ActionEntityModel {
		let changed = false

		// Upgrade an action. This check is not the safest, but it should be ok
		if (action.options.controller === 'emulator') {
			// Hope that the default emulator still exists
			action.options.controller = 'emulator:emulator'

			changed = true
		}

		if (
			!action.options.surfaceId &&
			(action.definitionId === 'set_brightness' ||
				action.definitionId === 'set_page' ||
				action.definitionId === 'inc_page' ||
				action.definitionId === 'dec_page' ||
				action.definitionId === 'lockout_device' ||
				action.definitionId === 'unlockout_device' ||
				action.definitionId === 'surface_set_position' ||
				action.definitionId === 'surface_adjust_position')
		) {
			changed = true

			convertOldSplitOptionToExpression(
				action.options,
				{
					useVariables: 'controller_from_variable',
					simple: 'controller',
					variable: 'controller_variable',
					result: 'surfaceId',
				},
				false
			)
		}

		if (action.definitionId === 'set_brightness') {
			changed = convertSimplePropertyToExpresionValue(action.options, 'brightness') || changed
		}

		if (
			(action.definitionId === 'set_page' || action.definitionId === 'set_page_byindex') &&
			action.options.page_from_variable !== undefined
		) {
			changed = true

			convertOldSplitOptionToExpression(
				action.options,
				{
					useVariables: 'page_from_variable',
					simple: 'page',
					variable: 'page_variable',
					result: 'page',
				},
				true
			)
		}

		if (action.definitionId === 'set_page_byindex' && action.options.controller_from_variable !== undefined) {
			changed = true

			convertOldSplitOptionToExpression(
				action.options,
				{
					useVariables: 'controller_from_variable',
					simple: 'controller',
					variable: 'controller_variable',
					result: 'surfaceId',
				},
				true
			)
		}

		if (action.definitionId === 'surface_set_position') {
			changed = convertSimplePropertyToExpresionValue(action.options, 'x_offset') || changed
			changed = convertSimplePropertyToExpresionValue(action.options, 'y_offset') || changed
		}
		if (action.definitionId === 'surface_adjust_position') {
			changed = convertSimplePropertyToExpresionValue(action.options, 'x_adjustment') || changed
			changed = convertSimplePropertyToExpresionValue(action.options, 'y_adjustment') || changed
		}

		if (changed) return action
	}

	feedbackUpgrade(feedback: FeedbackEntityModel, _controlId: string): FeedbackEntityModel | void {
		let changed = false

		if (feedback.definitionId === 'surface_on_page') {
			changed = convertSimplePropertyToExpresionValue(feedback.options, 'surfaceId', 'controller', 'self') || changed
		}
		if (feedback.definitionId === 'surface_on_page') {
			changed = convertSimplePropertyToExpresionValue(feedback.options, 'page') || changed
		}

		if (changed) return feedback
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			set_brightness: {
				label: 'Surface: Set to brightness',
				description: undefined,
				options: [
					CHOICES_SURFACE_GROUP,

					{
						type: 'number',
						label: 'Brightness',
						id: 'brightness',
						default: 100,
						min: 0,
						max: 100,
						step: 1,
						range: true,
					},
				],

				internalUsesAutoParser: true,
			},

			set_page: {
				label: 'Surface: Set to page',
				description: undefined,
				options: [CHOICES_SURFACE_GROUP, CHOICES_PAGE],

				internalUsesAutoParser: true,
			},
			set_page_byindex: {
				label: 'Surface: Set by index to page',
				description: undefined,
				options: [
					{
						type: 'number',
						label: 'Surface / group index',
						id: 'surfaceIndex',
						tooltip: 'Check the ID column in the surfaces tab',
						min: 0,
						max: 100,
						default: 0,
						range: false,
					},

					CHOICES_PAGE,
				],

				internalUsesAutoParser: true,
			},

			inc_page: {
				label: 'Surface: Increment page number',
				description: undefined,
				options: [CHOICES_SURFACE_GROUP],

				internalUsesAutoParser: true,
			},
			dec_page: {
				label: 'Surface: Decrement page number',
				description: undefined,
				options: [CHOICES_SURFACE_GROUP],

				internalUsesAutoParser: true,
			},

			lockout_device: {
				label: 'Surface: Lockout specified surface immediately.',
				description: 'This requires the `PIN Lockout` setting to be enabled and configured',
				options: [CHOICES_SURFACE_GROUP],

				internalUsesAutoParser: true,
			},
			unlockout_device: {
				label: 'Surface: Unlock specified surface immediately.',
				description: 'This requires the `PIN Lockout` setting to be enabled and configured',
				options: [CHOICES_SURFACE_GROUP],

				internalUsesAutoParser: true,
			},

			lockout_all: {
				label: 'Surface: Lockout all immediately.',
				description: 'This requires the `PIN Lockout` setting to be enabled and configured',
				options: [],

				internalUsesAutoParser: true,
			},
			unlockout_all: {
				label: 'Surface: Unlock all immediately.',
				description: 'This requires the `PIN Lockout` setting to be enabled and configured',
				options: [],

				internalUsesAutoParser: true,
			},

			rescan: {
				label: 'Surface: Rescan USB for devices',
				description: undefined,
				options: [],

				internalUsesAutoParser: true,
			},

			surface_set_position: {
				label: 'Surface: Set offset',
				description: 'Set the absolute offset of a surface relative to the button grid',
				options: [
					CHOICES_SURFACE_ID,

					{
						type: 'number',
						label: 'Horizontal Offset',
						id: 'x_offset',
						default: 0,
						min: 0,
						max: 100,
						step: 1,
					},
					{
						type: 'number',
						label: 'Vertical Offset',
						id: 'y_offset',
						default: 0,
						min: 0,
						max: 100,
						step: 1,
					},
				],

				internalUsesAutoParser: true,
			},

			surface_adjust_position: {
				label: 'Surface: Adjust offset',
				description: 'Adjust the offset of a surface relative to the button grid by a relative amount',
				options: [
					CHOICES_SURFACE_ID,

					{
						type: 'number',
						label: 'Horizontal Offset Adjustment',
						id: 'x_adjustment',
						default: 0,
						min: -100,
						max: 100,
						step: 1,
					},
					{
						type: 'number',
						label: 'Vertical Offset Adjustment',
						id: 'y_adjustment',
						default: 0,
						min: -100,
						max: 100,
						step: 1,
					},
				],

				internalUsesAutoParser: true,
			},
		}
	}

	executeAction(action: ActionForInternalExecution, extras: RunActionExtras): boolean {
		if (action.definitionId === 'set_brightness') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras)
			if (!surfaceId) return true

			this.#surfaceController.setDeviceBrightness(surfaceId, Number(action.options.brightness), true)
			return true
		} else if (action.definitionId === 'set_page') {
			console.log('set', action.options)
			const surfaceId = this.#fetchSurfaceId(action.options, extras)
			if (!surfaceId) return true

			const thePage = this.#fetchPage(action.options, extras, surfaceId)
			console.log('set', thePage)

			if (thePage === undefined) return true

			this.#changeSurfacePage(surfaceId, thePage)
			return true
		} else if (action.definitionId === 'set_page_byindex') {
			const surfaceIndexNumber = Number(action.options.surfaceIndex)
			if (isNaN(surfaceIndexNumber) || surfaceIndexNumber < 0) {
				this.#logger.warn(`Trying to set controller #${action.options.surfaceIndex} but it isn't a valid index.`)
				return true
			}

			const surfaceId = this.#surfaceController.getDeviceIdFromIndex(surfaceIndexNumber)
			if (surfaceId === undefined || surfaceId === '') {
				this.#logger.warn(`Trying to set controller #${action.options.controller} but it isn't available.`)
				return true
			}

			const thePage = this.#fetchPage(action.options, extras, surfaceId)
			if (thePage === undefined) return true

			this.#changeSurfacePage(surfaceId, thePage)
			return true
		} else if (action.definitionId === 'inc_page') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras)
			if (!surfaceId) return true

			this.#changeSurfacePage(surfaceId, '+1')
			return true
		} else if (action.definitionId === 'dec_page') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras)
			if (!surfaceId) return true

			this.#changeSurfacePage(surfaceId, '-1')
			return true
		} else if (action.definitionId === 'lockout_device') {
			if (this.#surfaceController.isPinLockEnabled()) {
				const surfaceId = this.#fetchSurfaceId(action.options, extras)
				if (!surfaceId) return true

				if (extras.controlId && extras.surfaceId == surfaceId) {
					const control = this.#controlsController.getControl(extras.controlId)
					if (control && control.supportsPushed) {
						// Make sure the button doesn't show as pressed
						control.setPushed(false, extras.surfaceId)
					}
				}

				setImmediate(() => {
					this.#surfaceController.setSurfaceOrGroupLocked(surfaceId, true, true)
				})
			}
			return true
		} else if (action.definitionId === 'unlockout_device') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras)
			if (!surfaceId) return true

			setImmediate(() => {
				this.#surfaceController.setSurfaceOrGroupLocked(surfaceId, false, true)
			})

			return true
		} else if (action.definitionId === 'lockout_all') {
			if (this.#surfaceController.isPinLockEnabled()) {
				if (extras.controlId) {
					const control = this.#controlsController.getControl(extras.controlId)
					if (control && control.supportsPushed) {
						// Make sure the button doesn't show as pressed
						control.setPushed(false, extras.surfaceId)
					}
				}

				setImmediate(() => {
					this.#surfaceController.setAllLocked(true)
				})
			}
			return true
		} else if (action.definitionId === 'unlockout_all') {
			setImmediate(() => {
				this.#surfaceController.setAllLocked(false)
			})
			return true
		} else if (action.definitionId === 'rescan') {
			this.#surfaceController.triggerRefreshDevices().catch(() => {
				// TODO
			})
			return true
		} else if (action.definitionId === 'surface_set_position') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras)
			if (!surfaceId) return true

			const xOffset = Number(action.options.x_offset)
			const yOffset = Number(action.options.y_offset)

			if (isNaN(xOffset) || isNaN(yOffset)) {
				this.#logger.warn(`Invalid position offsets: x=${xOffset}, y=${yOffset}`)
				return true
			}

			this.#surfaceController.setDevicePosition(surfaceId, xOffset, yOffset, true)
			return true
		} else if (action.definitionId === 'surface_adjust_position') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras)
			if (!surfaceId) return true

			const xAdjustment = Number(action.options.x_adjustment)
			const yAdjustment = Number(action.options.y_adjustment)

			if (isNaN(xAdjustment) || isNaN(yAdjustment)) {
				this.#logger.warn(`Invalid position adjustments: x=${xAdjustment}, y=${yAdjustment}`)
				return true
			}

			this.#surfaceController.adjustDevicePosition(surfaceId, xAdjustment, yAdjustment, true)
			return true
		} else {
			return false
		}
	}

	/**
	 * Change the page of a surface
	 */
	#changeSurfacePage(
		surfaceId: string,
		toPage: string | 'back' | 'forward' | '+1' | '-1',
		defer = !(surfaceId in ['back', 'forward'])
	): void {
		const groupId = this.#surfaceController.getGroupIdFromDeviceId(surfaceId)
		if (!groupId) return
		this.#surfaceController.devicePageSet(groupId, toPage, true, defer)
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			surface_on_page: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'Surface: When on the selected page',
				description: 'Change style when a surface is on the selected page',
				feedbackStyle: {
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				showInvert: true,
				options: [
					{
						type: 'internal:surface_serial',
						label: 'Surface / group',
						id: 'surfaceId',
						includeSelf: false,
						default: '',
					},
					{
						type: 'internal:page',
						label: 'Page',
						id: 'page',
						includeStartup: true,
						includeDirection: false,
						default: 0,
					},
				],
				internalUsesAutoParser: true,
			},
		}
	}

	executeFeedback(feedback: FeedbackForInternalExecution): boolean | void {
		if (feedback.definitionId == 'surface_on_page') {
			const surfaceId = this.#fetchSurfaceId(feedback.options, feedback)
			if (!surfaceId) return false

			const thePage = this.#fetchPage(feedback.options, feedback, surfaceId)

			const currentPage = this.#surfaceController.devicePageGet(surfaceId, true)

			return currentPage == thePage
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
