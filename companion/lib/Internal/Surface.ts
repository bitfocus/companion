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

import { combineRgb, CompanionVariableValues } from '@companion-module/base'
import LogController from '../Log/Controller.js'
import debounceFn from 'debounce-fn'
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
import type { ControlsController } from '../Controls/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { RunActionExtras, VariableDefinitionTmp } from '../Instance/Wrapper.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { FeedbackEntitySubType, type ActionEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { InternalModuleUtils } from './Util.js'
import { EventEmitter } from 'events'

const CHOICES_SURFACE_GROUP_WITH_VARIABLES: SomeCompanionInputField[] = [
	{
		type: 'checkbox',
		label: 'Use variables for surface',
		id: 'controller_from_variable',
		default: false,
	},
	{
		type: 'internal:surface_serial',
		label: 'Surface / group',
		id: 'controller',
		default: 'self',
		includeSelf: true,
		isVisibleUi: {
			type: 'expression',
			fn: '!$(options:controller_from_variable)',
		},
	},
	{
		type: 'textinput',
		label: 'Surface / group',
		id: 'controller_variable',
		default: 'self',
		isVisibleUi: {
			type: 'expression',
			fn: '!!$(options:controller_from_variable)',
		},
		useVariables: {
			local: true,
		},
	},
]

const CHOICES_SURFACE_ID_WITH_VARIABLES: SomeCompanionInputField[] = [
	{
		type: 'checkbox',
		label: 'Use expression for surface',
		id: 'controller_from_variable',
		default: false,
	},
	{
		type: 'internal:surface_serial',
		label: 'Surface / group',
		id: 'controller',
		default: 'self',
		includeSelf: true,
		useRawSurfaces: true,
		isVisibleUi: {
			type: 'expression',
			fn: '!$(options:controller_from_variable)',
		},
	},
	{
		type: 'textinput',
		label: 'Surface / group',
		id: 'controller_variable',
		default: 'self',
		isVisibleUi: {
			type: 'expression',
			fn: '!!$(options:controller_from_variable)',
		},
		useVariables: {
			local: true,
		},
	},
]

const CHOICES_PAGE_WITH_VARIABLES: SomeCompanionInputField[] = [
	{
		type: 'checkbox',
		label: 'Use expression for page',
		id: 'page_from_variable',
		default: false,
	},
	{
		type: 'internal:page',
		label: 'Page',
		id: 'page',
		includeStartup: true,
		includeDirection: true,
		default: 0,
		isVisibleUi: {
			type: 'expression',
			fn: '!$(options:page_from_variable)',
		},
	},
	{
		type: 'textinput',
		label: 'Page (expression)',
		id: 'page_variable',
		default: '1',
		isVisibleUi: {
			type: 'expression',
			fn: '!!$(options:page_from_variable)',
		},
		useVariables: {
			local: true,
		},
		isExpression: true,
	},
]

export class InternalSurface extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #logger = LogController.createLogger('Internal/Surface')

	readonly #internalUtils: InternalModuleUtils
	readonly #controlsController: ControlsController
	readonly #surfaceController: SurfaceController
	readonly #pageStore: IPageStore

	/**
	 * Page history for surfaces
	 */
	//readonly #pageHistory = new Map<string, { history: string[]; index: number }>()

	constructor(
		internalUtils: InternalModuleUtils,
		surfaceController: SurfaceController,
		controlsController: ControlsController,
		pageStore: IPageStore
	) {
		super()

		this.#internalUtils = internalUtils
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
		info: RunActionExtras | FeedbackEntityModelExt,
		useVariableFields: boolean
	): string | undefined {
		let surfaceId: string | undefined = options.controller + ''

		if (useVariableFields && options.controller_from_variable) {
			surfaceId = this.#internalUtils.parseVariablesForInternalActionOrFeedback(options.controller_variable, info).text
		}

		surfaceId = surfaceId.trim()

		if (info && surfaceId === 'self' && 'surfaceId' in info) surfaceId = info.surfaceId

		return surfaceId
	}

	#fetchPage(
		options: Record<string, any>,
		extras: RunActionExtras | FeedbackEntityModelExt,
		useVariableFields: boolean,
		surfaceId: string | undefined
	): string | 'back' | 'forward' | '+1' | '-1' | undefined {
		let thePageNumber: number | string | undefined = options.page

		if (useVariableFields && options.page_from_variable) {
			const expressionResult = this.#internalUtils.executeExpressionForInternalActionOrFeedback(
				options.page_variable,
				extras,
				'number'
			)
			if (!expressionResult.ok) throw new Error(expressionResult.error)
			thePageNumber = Number(expressionResult.value)
		}

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

	getVariableDefinitions(): VariableDefinitionTmp[] {
		const variables: VariableDefinitionTmp[] = [
			{
				label: 'XKeys: T-bar position',
				name: 't-bar',
			},
			{
				label: 'XKeys/Contour Shuttle: Shuttle position',
				name: 'shuttle',
			},
			{
				label: 'XKeys/Contour Shuttle: Jog position',
				name: 'jog',
			},
		]

		const surfaceInfos = this.#surfaceController.getDevicesList()
		for (const surfaceGroup of surfaceInfos) {
			if (!surfaceGroup.isAutoGroup) {
				const groupId = surfaceGroup.id.startsWith('group:') ? surfaceGroup.id.slice(6) : surfaceGroup.id
				variables.push(
					{
						label: `Surface Group name: ${surfaceGroup.displayName}`,
						name: `surface_group_${groupId}_name`,
					},
					{
						label: `Surface Group member count: ${surfaceGroup.displayName}`,
						name: `surface_group_${groupId}_surface_count`,
					},
					{
						label: `Surface Group page: ${surfaceGroup.displayName}`,
						name: `surface_group_${groupId}_page`,
					}
				)
			}

			for (const surface of surfaceGroup.surfaces) {
				if (!surface.isConnected) continue

				const surfaceId = surface.id.replaceAll(':', '_') // TODO - more chars

				variables.push(
					{
						label: `Surface name: ${surface.displayName}`,
						name: `surface_${surfaceId}_name`,
					},
					{
						label: `Surface locked: ${surface.displayName}`,
						name: `surface_${surfaceId}_locked`,
					},
					{
						label: `Surface location: ${surface.displayName}`,
						name: `surface_${surfaceId}_location`,
					},
					{
						label: `Surface page: ${surfaceGroup.displayName}`,
						name: `surface_${surfaceId}_page`,
					}
				)
			}
		}

		return variables
	}

	#lastUpdateVariableNames: ReadonlySet<string> = new Set()
	updateVariables(): void {
		const values: CompanionVariableValues = {}

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
		// Upgrade an action. This check is not the safest, but it should be ok
		if (action.options.controller === 'emulator') {
			// Hope that the default emulator still exists
			action.options.controller = 'emulator:emulator'

			return action
		}
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			set_brightness: {
				label: 'Surface: Set to brightness',
				description: undefined,
				options: [
					...CHOICES_SURFACE_ID_WITH_VARIABLES,

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
			},

			set_page: {
				label: 'Surface: Set to page',
				description: undefined,
				options: [...CHOICES_SURFACE_GROUP_WITH_VARIABLES, ...CHOICES_PAGE_WITH_VARIABLES],
			},
			set_page_byindex: {
				label: 'Surface: Set by index to page',
				description: undefined,
				options: [
					{
						type: 'checkbox',
						label: 'Use variables for surface',
						id: 'controller_from_variable',
						default: false,
					},
					{
						type: 'number',
						label: 'Surface / group index',
						id: 'controller',
						tooltip: 'Check the ID column in the surfaces tab',
						min: 0,
						max: 100,
						default: 0,
						range: false,
						isVisibleUi: {
							type: 'expression',
							fn: '!$(options:controller_from_variable)',
						},
					},
					{
						type: 'textinput',
						label: 'Surface / group index',
						id: 'controller_variable',
						tooltip: 'Check the ID column in the surfaces tab',
						default: '0',
						isVisibleUi: {
							type: 'expression',
							fn: '!!$(options:controller_from_variable)',
						},
						useVariables: {
							local: true,
						},
					},

					...CHOICES_PAGE_WITH_VARIABLES,
				],
			},

			inc_page: {
				label: 'Surface: Increment page number',
				description: undefined,
				options: [...CHOICES_SURFACE_GROUP_WITH_VARIABLES],
			},
			dec_page: {
				label: 'Surface: Decrement page number',
				description: undefined,
				options: [...CHOICES_SURFACE_GROUP_WITH_VARIABLES],
			},

			lockout_device: {
				label: 'Surface: Lockout specified surface immediately.',
				description: 'This requires the `PIN Lockout` setting to be enabled and configured',
				options: [...CHOICES_SURFACE_GROUP_WITH_VARIABLES],
			},
			unlockout_device: {
				label: 'Surface: Unlock specified surface immediately.',
				description: 'This requires the `PIN Lockout` setting to be enabled and configured',
				options: [...CHOICES_SURFACE_GROUP_WITH_VARIABLES],
			},

			lockout_all: {
				label: 'Surface: Lockout all immediately.',
				description: 'This requires the `PIN Lockout` setting to be enabled and configured',
				options: [],
			},
			unlockout_all: {
				label: 'Surface: Unlock all immediately.',
				description: 'This requires the `PIN Lockout` setting to be enabled and configured',
				options: [],
			},

			rescan: {
				label: 'Surface: Rescan USB for devices',
				description: undefined,
				options: [],
			},

			surface_set_position: {
				label: 'Surface: Set position',
				description: 'Set the absolute position offset of a surface',
				options: [
					...CHOICES_SURFACE_ID_WITH_VARIABLES,

					{
						type: 'number',
						label: 'X Offset',
						id: 'x_offset',
						default: 0,
						min: 0,
						max: 100,
						step: 1,
					},
					{
						type: 'number',
						label: 'Y Offset',
						id: 'y_offset',
						default: 0,
						min: 0,
						max: 100,
						step: 1,
					},
				],
			},

			surface_adjust_position: {
				label: 'Surface: Adjust position',
				description: 'Adjust the position offset of a surface by a relative amount',
				options: [
					...CHOICES_SURFACE_ID_WITH_VARIABLES,

					{
						type: 'number',
						label: 'X Offset Adjustment',
						id: 'x_adjustment',
						default: 0,
						min: -500,
						max: 500,
						step: 1,
					},
					{
						type: 'number',
						label: 'Y Offset Adjustment',
						id: 'y_adjustment',
						default: 0,
						min: -500,
						max: 500,
						step: 1,
					},
				],
			},
		}
	}

	incrPage(surfaceId: string, forward: boolean): boolean {
		//const surfaceId = this.#fetchSurfaceId({controller: surfaceId}, undefined as unknown as RunActionExtras,  false)
		if (!surfaceId) return true
		this.#changeSurfacePage(surfaceId, forward ? '+1' : '-1')
		return true
	}

	executeAction(action: ControlEntityInstance, extras: RunActionExtras): boolean {
		if (action.definitionId === 'set_brightness') {
			const surfaceId = this.#fetchSurfaceId(action.rawOptions, extras, true)
			if (!surfaceId) return true

			this.#surfaceController.setDeviceBrightness(surfaceId, action.rawOptions.brightness, true)
			return true
		} else if (action.definitionId === 'set_page') {
			const surfaceId = this.#fetchSurfaceId(action.rawOptions, extras, true)
			if (!surfaceId) return true

			const thePage = this.#fetchPage(action.rawOptions, extras, true, surfaceId)
			if (thePage === undefined) return true

			this.#changeSurfacePage(surfaceId, thePage)
			return true
		} else if (action.definitionId === 'set_page_byindex') {
			let surfaceIndex = action.rawOptions.controller
			if (action.rawOptions.controller_from_variable) {
				surfaceIndex = this.#internalUtils.parseVariablesForInternalActionOrFeedback(
					action.rawOptions.controller_variable,
					extras
				).text
			}

			const surfaceIndexNumber = Number(surfaceIndex)
			if (isNaN(surfaceIndexNumber) || surfaceIndexNumber < 0) {
				this.#logger.warn(`Trying to set controller #${surfaceIndex} but it isn't a valid index.`)
				return true
			}

			const surfaceId = this.#surfaceController.getDeviceIdFromIndex(surfaceIndexNumber)
			if (surfaceId === undefined || surfaceId === '') {
				this.#logger.warn(`Trying to set controller #${action.rawOptions.controller} but it isn't available.`)
				return true
			}

			const thePage = this.#fetchPage(action.rawOptions, extras, true, surfaceId)
			if (thePage === undefined) return true

			this.#changeSurfacePage(surfaceId, thePage)
			return true
		} else if (action.definitionId === 'inc_page') {
			const surfaceId = this.#fetchSurfaceId(action.rawOptions, extras, true)
			if (!surfaceId) return true

			this.#changeSurfacePage(surfaceId, '+1')
			return true
		} else if (action.definitionId === 'dec_page') {
			const surfaceId = this.#fetchSurfaceId(action.rawOptions, extras, true)
			if (!surfaceId) return true

			this.#changeSurfacePage(surfaceId, '-1')
			return true
		} else if (action.definitionId === 'lockout_device') {
			if (this.#surfaceController.isPinLockEnabled()) {
				const surfaceId = this.#fetchSurfaceId(action.rawOptions, extras, true)
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
			const surfaceId = this.#fetchSurfaceId(action.rawOptions, extras, true)
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
			const surfaceId = this.#fetchSurfaceId(action.rawOptions, extras, true)
			if (!surfaceId) return true

			const xOffset = Number(action.rawOptions.x_offset)
			const yOffset = Number(action.rawOptions.y_offset)

			if (isNaN(xOffset) || isNaN(yOffset)) {
				this.#logger.warn(`Invalid position offsets: x=${xOffset}, y=${yOffset}`)
				return true
			}

			this.#surfaceController.setDevicePosition(surfaceId, xOffset, yOffset, true)
			return true
		} else if (action.definitionId === 'surface_adjust_position') {
			const surfaceId = this.#fetchSurfaceId(action.rawOptions, extras, true)
			if (!surfaceId) return true

			const xAdjustment = Number(action.rawOptions.x_adjustment)
			const yAdjustment = Number(action.rawOptions.y_adjustment)

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
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(255, 0, 0),
				},
				showInvert: true,
				options: [
					{
						type: 'internal:surface_serial',
						label: 'Surface / group',
						id: 'controller',
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
			},
		}
	}

	executeFeedback(feedback: FeedbackEntityModelExt): boolean | void {
		if (feedback.definitionId == 'surface_on_page') {
			const surfaceId = this.#fetchSurfaceId(feedback.options, feedback, false)
			if (!surfaceId) return false

			const thePage = this.#fetchPage(feedback.options, feedback, false, surfaceId)

			const currentPage = this.#surfaceController.devicePageGet(surfaceId, true)

			return currentPage == thePage
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// actions page_variable handled by generic options visitor
		// actions controller_variable handled by generic options visitor
	}
}
