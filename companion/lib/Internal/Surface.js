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

import { combineRgb } from '@companion-module/base'
import LogController from '../Log/Controller.js'
import { serializeIsVisibleFnSingle } from '../Resources/Util.js'
import debounceFn from 'debounce-fn'

/** @type {import('./Types.js').InternalActionInputField[]} */
const CHOICES_SURFACE_GROUP_WITH_VARIABLES = [
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

/** @type {import('./Types.js').InternalActionInputField[]} */
const CHOICES_SURFACE_ID_WITH_VARIABLES = [
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

/** @type {import('./Types.js').InternalActionInputField[]} */
const CHOICES_PAGE_WITH_VARIABLES = [
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

export default class Surface {
	#logger = LogController.createLogger('Internal/Surface')

	/**
	 * @type {import('./Controller.js').default}
	 * @readonly
	 */
	#internalModule

	/**
	 * @type {import('../Controls/Controller.js').default}
	 * @readonly
	 */
	#controlsController

	/**
	 * @type {import('../Surface/Controller.js').default}
	 * @readonly
	 */
	#surfaceController

	/**
	 * @type {import('../Instance/Variable.js').default}
	 * @readonly
	 */
	#variableController

	/** Page history for surfaces */
	#pageHistory = new Map()

	/**
	 * @param {import('./Controller.js').default} internalModule
	 * @param {import('../Surface/Controller.js').default} surfaceController
	 * @param {import('../Controls/Controller.js').default} controlsController
	 * @param {import('../Instance/Variable.js').default} variableController
	 */
	constructor(internalModule, surfaceController, controlsController, variableController) {
		this.#internalModule = internalModule
		this.#surfaceController = surfaceController
		this.#controlsController = controlsController
		this.#variableController = variableController

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

	/**
	 * @param {Record<string, any>} options
	 * @param {import('../Instance/Wrapper.js').RunActionExtras | undefined} info
	 * @param {boolean} useVariableFields
	 * @returns {string | undefined}
	 */
	#fetchSurfaceId(options, info, useVariableFields) {
		/** @type {string | undefined} */
		let surfaceId = options.controller + ''

		if (useVariableFields && options.controller_from_variable) {
			surfaceId = this.#variableController.parseVariables(options.controller_variable, info?.location).text
		}

		surfaceId = surfaceId.trim()

		if (info && surfaceId === 'self') surfaceId = info.surfaceId

		return surfaceId
	}

	/**
	 * @param {Record<string, any>} options
	 * @param {import('../Resources/Util.js').ControlLocation | undefined} location
	 * @param {boolean} useVariableFields
	 * @param {string | undefined} surfaceId
	 * @returns {number | 'back' | 'forward' | '+1' | '-1' | undefined}
	 */
	#fetchPage(options, location, useVariableFields, surfaceId) {
		/** @type {number | string | undefined} */
		let thePage = options.page

		if (useVariableFields && options.page_from_variable) {
			thePage = Number(this.#variableController.parseExpression(options.page_variable, location, 'number').value)
		}

		if (location) {
			// @ts-ignore
			if (thePage === 0 || thePage === '0') thePage = location.pageNumber ?? location.page
		}

		if (thePage === 'startup') {
			thePage = surfaceId && this.#surfaceController.devicePageGetStartup(surfaceId)
		}
		if (thePage === 'back' || thePage === 'forward' || thePage === '+1' || thePage === '-1') {
			return thePage
		}

		return Number(thePage) || undefined
	}

	/**
	 * @returns {import('../Instance/Wrapper.js').VariableDefinitionTmp[]}
	 */
	getVariableDefinitions() {
		/** @type {import('../Instance/Wrapper.js').VariableDefinitionTmp[]} */
		const variables = [
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

	updateVariables() {
		/** @type {import('@companion-module/base').CompanionVariableValues} */
		const values = {}

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

	/**
	 * Perform an upgrade for an action
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance} action
	 * @param {string} _controlId
	 * @returns {import('@companion-app/shared/Model/ActionModel.js').ActionInstance | void} Updated action if any changes were made
	 */
	actionUpgrade(action, _controlId) {
		// Upgrade an action. This check is not the safest, but it should be ok
		if (action.options.controller === 'emulator') {
			// Hope that the default emulator still exists
			action.options.controller = 'emulator:emulator'

			return action
		}
	}

	/**
	 * @returns {Record<string, import('./Types.js').InternalActionDefinition>}
	 */
	getActionDefinitions() {
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
						type: 'number',
						label: 'Surface / controller',
						id: 'controller',
						tooltip: 'Emulator is 0, all other controllers in order of type and serial-number',
						min: 0,
						max: 100,
						default: 0,
						range: false,
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

	/**
	 * Run a single internal action
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance} action
	 * @param {import('../Instance/Wrapper.js').RunActionExtras} extras
	 * @returns {boolean} Whether the action was handled
	 */
	executeAction(action, extras) {
		if (action.action === 'set_brightness') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras, true)
			if (!surfaceId) return true

			this.#surfaceController.setDeviceBrightness(surfaceId, action.options.brightness, true)
			return true
		} else if (action.action === 'set_page') {
			const surfaceId = this.#fetchSurfaceId(action.options, extras, true)
			if (!surfaceId) return true

			const thePage = this.#fetchPage(action.options, extras.location, true, surfaceId)
			if (thePage === undefined) return true

			this.#changeSurfacePage(surfaceId, thePage)
			return true
		} else if (action.action === 'set_page_byindex') {
			const surfaceId = this.#surfaceController.getDeviceIdFromIndex(action.options.controller)
			if (surfaceId === undefined) {
				this.#logger.warn(`Trying to set controller #${action.options.controller} but it isn't available.`)
				return true
			}

			const thePage = this.#fetchPage(action.options, extras.location, true, surfaceId)
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
	 * @param {string} surfaceId
	 * @param {number | 'back' | 'forward' | '+1' | '-1'} toPage
	 */
	#changeSurfacePage(surfaceId, toPage) {
		const currentPage = this.#surfaceController.devicePageGet(surfaceId, true)
		if (currentPage === undefined) {
			// Bad surfaceId
		} else {
			// no history yet
			// start with the current (from) page
			let pageHistory = this.#pageHistory.get(surfaceId)
			if (!pageHistory) {
				pageHistory = {
					history: [currentPage],
					index: 0,
				}
				this.#pageHistory.set(surfaceId, pageHistory)
			}

			if (toPage === 'back' || toPage === 'forward') {
				// determine the 'to' page
				const pageDirection = toPage === 'back' ? -1 : 1
				const pageIndex = pageHistory.index + pageDirection
				const pageTarget = pageHistory.history[pageIndex]

				// change only if pageIndex points to a real page
				if (pageTarget !== undefined) {
					pageHistory.index = pageIndex

					this.#surfaceController.devicePageSet(surfaceId, pageTarget, true)
				}
			} else {
				let newPage = toPage
				if (newPage === '+1') {
					newPage = currentPage + 1
					if (newPage > 99) newPage = 1
				} else if (newPage === '-1') {
					newPage = currentPage - 1
					if (newPage < 1) newPage = 99
				} else {
					newPage = Number(newPage)
				}
				if (isNaN(newPage)) newPage = 1

				// Change page
				this.#surfaceController.devicePageSet(surfaceId, newPage, true, true)

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

	getFeedbackDefinitions() {
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

	/**
	 * Get an updated value for a feedback
	 * @param {import('./Types.js').FeedbackInstanceExt} feedback
	 * @returns {boolean | void}
	 */
	executeFeedback(feedback) {
		if (feedback.type == 'surface_on_page') {
			const surfaceId = this.#fetchSurfaceId(feedback.options, undefined, false)
			if (!surfaceId) return false

			const thePage = this.#fetchPage(feedback.options, feedback.location, false, surfaceId)

			const currentPage = this.#surfaceController.devicePageGet(surfaceId, true)

			return currentPage == thePage
		}
	}
	/**
	 *
	 * @param {import('./Types.js').InternalVisitor} _visitor
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance[]} _actions
	 * @param {import('@companion-app/shared/Model/FeedbackModel.js').FeedbackInstance[]} _feedbacks
	 */
	visitReferences(_visitor, _actions, _feedbacks) {
		// actions page_variable handled by generic options visitor
		// actions controller_variable handled by generic options visitor
	}
}
