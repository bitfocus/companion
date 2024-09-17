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

import { combineRgb, CompanionVariableValues } from '@companion-module/base'
import LogController from '../Log/Controller.js'
import { serializeIsVisibleFnSingle } from '../Resources/Util.js'
import debounceFn from 'debounce-fn'
import type { FeedbackForVisitor, FeedbackInstanceExt, InternalModuleFragment, InternalVisitor } from './Types.js'
import type { InternalController } from './Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { RunActionExtras, VariableDefinitionTmp } from '../Instance/Wrapper.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { InternalActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import type { InternalFeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import type { InternalActionInputField } from '@companion-app/shared/Model/Options.js'

const CHOICES_SURFACE_GROUP_WITH_VARIABLES: InternalActionInputField[] = [
	{
		type: 'checkbox',
		label: 'Use variables for surface',
		id: 'controller_from_variable',
		default: false,
	},
	serializeIsVisibleFnSingle({
		type: 'internal:surface_serial',
		label: 'Surface / group',
		id: 'controller',
		default: 'self',
		includeSelf: true,
		isVisible: (options) => !options.controller_from_variable,
	}),
	serializeIsVisibleFnSingle({
		type: 'textinput',
		label: 'Surface / group',
		id: 'controller_variable',
		default: 'self',
		isVisible: (options) => !!options.controller_from_variable,
		useVariables: {
			local: true,
		},
	}),
]

const CHOICES_SURFACE_ID_WITH_VARIABLES: InternalActionInputField[] = [
	{
		type: 'checkbox',
		label: 'Use variables for surface',
		id: 'controller_from_variable',
		default: false,
	},
	serializeIsVisibleFnSingle({
		type: 'internal:surface_serial',
		label: 'Surface / group',
		id: 'controller',
		default: 'self',
		includeSelf: true,
		useRawSurfaces: true,
		isVisible: (options) => !options.controller_from_variable,
	}),
	serializeIsVisibleFnSingle({
		type: 'textinput',
		label: 'Surface / group',
		id: 'controller_variable',
		default: 'self',
		isVisible: (options) => !!options.controller_from_variable,
		useVariables: {
			local: true,
		},
	}),
]

const CHOICES_PAGE_WITH_VARIABLES: InternalActionInputField[] = [
	{
		type: 'checkbox',
		label: 'Use variables for page',
		id: 'page_from_variable',
		default: false,
	},
	serializeIsVisibleFnSingle({
		type: 'internal:page',
		label: 'Page',
		id: 'page',
		includeStartup: true,
		includeDirection: true,
		default: 0,
		isVisible: (options) => !options.page_from_variable,
	}),
	serializeIsVisibleFnSingle({
		type: 'textinput',
		label: 'Page (expression)',
		id: 'page_variable',
		default: '1',
		isVisible: (options) => !!options.page_from_variable,
		useVariables: {
			local: true,
		},
		isExpression: true,
	}),
]

export class InternalSurface implements InternalModuleFragment {
	readonly #logger = LogController.createLogger('Internal/Surface')

	readonly #internalModule: InternalController
	readonly #controlsController: ControlsController
	readonly #surfaceController: SurfaceController
	readonly #pageController: PageController

	/**
	 * Page history for surfaces
	 */
	readonly #pageHistory = new Map<string, { history: string[]; index: number }>()

	constructor(
		internalModule: InternalController,
		surfaceController: SurfaceController,
		controlsController: ControlsController,
		pageController: PageController
	) {
		this.#internalModule = internalModule
		this.#surfaceController = surfaceController
		this.#controlsController = controlsController
		this.#pageController = pageController

		setImmediate(() => {
			this.#internalModule.setVariables({
				't-bar': 0,
				jog: 0,
				shuttle: 0,
			})
		})

		const debounceUpdateVariableDefinitions = debounceFn(() => this.#internalModule.regenerateVariables(), {
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
			this.#internalModule.checkFeedbacks('surface_on_page')
		})
		this.#surfaceController.on('group_page', () => debounceUpdateVariables())

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
		info: RunActionExtras | FeedbackInstanceExt,
		useVariableFields: boolean
	): string | undefined {
		let surfaceId: string | undefined = options.controller + ''

		if (useVariableFields && options.controller_from_variable) {
			surfaceId = this.#internalModule.parseVariablesForInternalActionOrFeedback(options.controller_variable, info).text
		}

		surfaceId = surfaceId.trim()

		if (info && surfaceId === 'self' && 'surfaceId' in info) surfaceId = info.surfaceId

		return surfaceId
	}

	#fetchPage(
		options: Record<string, any>,
		extras: RunActionExtras | FeedbackInstanceExt,
		useVariableFields: boolean,
		surfaceId: string | undefined
	): string | 'back' | 'forward' | '+1' | '-1' | undefined {
		let thePageNumber: number | string | undefined = options.page

		if (useVariableFields && options.page_from_variable) {
			thePageNumber = Number(
				this.#internalModule.executeExpressionForInternalActionOrFeedback(options.page_variable, extras, 'number').value
			)
		}

		if (extras.location) {
			if (thePageNumber === 0 || thePageNumber === '0')
				// @ts-ignore
				thePageNumber = extras.location.pageNumber ?? extras.location.page
		}

		if (thePageNumber === 'startup') {
			const thePageId = surfaceId && this.#surfaceController.devicePageGetStartup(surfaceId)
			return thePageId || this.#pageController.getFirstPageId()
		}
		if (thePageNumber === 'back' || thePageNumber === 'forward' || thePageNumber === '+1' || thePageNumber === '-1') {
			return thePageNumber
		}

		return this.#pageController.getPageInfo(Number(thePageNumber))?.id
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
				values[`surface_${surfaceId}_location`] = surface.location ?? ''
				values[`surface_${surfaceId}_page`] = this.#surfaceController.devicePageGet(surface.id)
			}

			if (!surfaceGroup.isAutoGroup) {
				const groupId = surfaceGroup.id.startsWith('group:') ? surfaceGroup.id.slice(6) : surfaceGroup.id
				values[`surface_group_${groupId}_name`] = surfaceGroup.displayName
				values[`surface_group_${groupId}_surface_count`] = surfaceCount
				values[`surface_group_${groupId}_page`] = this.#surfaceController.devicePageGet(surfaceGroup.id)
			}
		}

		this.#internalModule.setVariables(values)
	}

	actionUpgrade(action: ActionInstance, _controlId: string): void | ActionInstance {
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
					serializeIsVisibleFnSingle({
						type: 'number',
						label: 'Surface / group index',
						id: 'controller',
						tooltip: 'Check the ID column in the surfaces tab',
						min: 0,
						max: 100,
						default: 0,
						range: false,
						isVisible: (options) => !options.controller_from_variable,
					}),
					serializeIsVisibleFnSingle({
						type: 'textinput',
						label: 'Surface / group index',
						id: 'controller_variable',
						tooltip: 'Check the ID column in the surfaces tab',
						default: '0',
						isVisible: (options) => !!options.controller_from_variable,
						useVariables: {
							local: true,
						},
					}),

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
				description: undefined,
				options: [...CHOICES_SURFACE_GROUP_WITH_VARIABLES],
			},
			unlockout_device: {
				label: 'Surface: Unlock specified surface immediately.',
				description: undefined,
				options: [...CHOICES_SURFACE_GROUP_WITH_VARIABLES],
			},

			lockout_all: {
				label: 'Surface: Lockout all immediately.',
				description: undefined,
				options: [],
			},
			unlockout_all: {
				label: 'Surface: Unlock all immediately.',
				description: undefined,
				options: [],
			},

			rescan: {
				label: 'Surface: Rescan USB for devices',
				description: undefined,
				options: [],
			},
		}
	}

	executeAction(action: ActionInstance, extras: RunActionExtras): boolean {
		if (action.action === 'set_brightness') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras, true)
			if (!surfaceId) return true

			this.#surfaceController.setDeviceBrightness(surfaceId, action.options.brightness, true)
			return true
		} else if (action.action === 'set_page') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras, true)
			if (!surfaceId) return true

			const thePage = this.#fetchPage(action.options, extras, true, surfaceId)
			if (thePage === undefined) return true

			this.#changeSurfacePage(surfaceId, thePage)
			return true
		} else if (action.action === 'set_page_byindex') {
			let surfaceIndex = action.options.controller
			if (action.options.controller_from_variable) {
				surfaceIndex = this.#internalModule.parseVariablesForInternalActionOrFeedback(
					action.options.controller_variable,
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
				this.#logger.warn(`Trying to set controller #${action.options.controller} but it isn't available.`)
				return true
			}

			const thePage = this.#fetchPage(action.options, extras, true, surfaceId)
			if (thePage === undefined) return true

			this.#changeSurfacePage(surfaceId, thePage)
			return true
		} else if (action.action === 'inc_page') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras, true)
			if (!surfaceId) return true

			this.#changeSurfacePage(surfaceId, '+1')
			return true
		} else if (action.action === 'dec_page') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras, true)
			if (!surfaceId) return true

			this.#changeSurfacePage(surfaceId, '-1')
			return true
		} else if (action.action === 'lockout_device') {
			if (this.#surfaceController.isPinLockEnabled()) {
				const surfaceId = this.#fetchSurfaceId(action.options, extras, true)
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
		} else if (action.action === 'unlockout_device') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras, true)
			if (!surfaceId) return true

			setImmediate(() => {
				this.#surfaceController.setSurfaceOrGroupLocked(surfaceId, false, true)
			})

			return true
		} else if (action.action === 'lockout_all') {
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
		} else if (action.action === 'unlockout_all') {
			setImmediate(() => {
				this.#surfaceController.setAllLocked(false)
			})
			return true
		} else if (action.action === 'rescan') {
			this.#surfaceController.triggerRefreshDevices().catch(() => {
				// TODO
			})
			return true
		} else {
			return false
		}
	}

	/**
	 * Change the page of a surface
	 */
	#changeSurfacePage(surfaceId: string, toPage: string | 'back' | 'forward' | '+1' | '-1'): void {
		const groupId = this.#surfaceController.getGroupIdFromDeviceId(surfaceId)
		if (!groupId) return

		const currentPage = this.#surfaceController.devicePageGet(groupId, true)
		if (currentPage === undefined) {
			// Bad groupId
		} else {
			// no history yet
			// start with the current (from) page
			let pageHistory = this.#pageHistory.get(groupId)
			if (!pageHistory) {
				pageHistory = {
					history: [currentPage],
					index: 0,
				}
				this.#pageHistory.set(groupId, pageHistory)
			}

			if (toPage === 'back' || toPage === 'forward') {
				// determine the 'to' page
				const pageDirection = toPage === 'back' ? -1 : 1
				const pageIndex = pageHistory.index + pageDirection
				const pageTarget = pageHistory.history[pageIndex]

				// change only if pageIndex points to a real page
				if (pageTarget !== undefined) {
					pageHistory.index = pageIndex

					this.#surfaceController.devicePageSet(groupId, pageTarget, true)
				}
			} else {
				let newPage: string | null = toPage
				if (newPage === '+1') {
					newPage = this.#pageController.getOffsetPageId(currentPage, 1)
				} else if (newPage === '-1') {
					newPage = this.#pageController.getOffsetPageId(currentPage, -1)
				} else {
					newPage = String(newPage)
				}
				if (!newPage || !this.#pageController.isPageIdValid(newPage)) newPage = this.#pageController.getFirstPageId()

				// Change page
				this.#surfaceController.devicePageSet(groupId, newPage, true, true)

				// Clear forward page history beyond current index, add new history entry, increment index;
				pageHistory.history = pageHistory.history.slice(0, pageHistory.index + 1)
				pageHistory.history.push(newPage)
				pageHistory.index += 1

				// Limit the max history
				const maxPageHistory = 100
				if (pageHistory.history.length > maxPageHistory) {
					const startIndex = pageHistory.history.length - maxPageHistory
					pageHistory.history = pageHistory.history.slice(startIndex)
					pageHistory.index = pageHistory.history.length - 1
				}
			}
		}
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			surface_on_page: {
				type: 'boolean',
				label: 'Surface: When on the selected page',
				description: 'Change style when a surface is on the selected page',
				style: {
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

	executeFeedback(feedback: FeedbackInstanceExt): boolean | void {
		if (feedback.type == 'surface_on_page') {
			const surfaceId = this.#fetchSurfaceId(feedback.options, feedback, false)
			if (!surfaceId) return false

			const thePage = this.#fetchPage(feedback.options, feedback, false, surfaceId)

			const currentPage = this.#surfaceController.devicePageGet(surfaceId, true)

			return currentPage == thePage
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionInstance[], _feedbacks: FeedbackForVisitor[]): void {
		// actions page_variable handled by generic options visitor
		// actions controller_variable handled by generic options visitor
	}
}
