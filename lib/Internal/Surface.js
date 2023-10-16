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
import { serializeIsVisibleFn } from '@companion-module/base/dist/internal/base.js'
import LogController from '../Log/Controller.js'

const CHOICES_CONTROLLER = {
	type: 'internal:surface_serial',
	label: 'Surface / controller',
	id: 'controller',
	default: 'self',
	includeSelf: true,
}

const CHOICES_CONTROLLER_WITH_VARIABLES = serializeIsVisibleFn([
	{
		type: 'checkbox',
		label: 'Use variables for surface',
		id: 'controller_from_variable',
		default: false,
	},
	{
		...CHOICES_CONTROLLER,
		isVisible: (options) => !options.controller_from_variable,
	},
	{
		type: 'textinput',
		label: 'Surface / controller',
		id: 'controller_variable',
		default: 'self',
		isVisible: (options) => !!options.controller_from_variable,
		useVariables: true,
	},
])

const CHOICES_PAGE_WITH_VARIABLES = serializeIsVisibleFn([
	{
		type: 'checkbox',
		label: 'Use variables for page',
		id: 'page_from_variable',
		default: false,
	},
	{
		type: 'internal:page',
		label: 'Page',
		id: 'page',
		includeDirection: true,
		default: 0,
		isVisible: (options) => !options.page_from_variable,
	},
	{
		type: 'textinput',
		label: 'Page (expression)',
		id: 'page_variable',
		default: '1',
		isVisible: (options) => !!options.page_from_variable,
		useVariables: true,
	},
])

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

		this.#surfaceController.on('surface_page', () => {
			this.#internalModule.checkFeedbacks('surface_on_page')
		})
	}

	#fetchControllerId(options, info, useVariableFields) {
		let theController = options.controller

		if (useVariableFields && options.controller_from_variable) {
			theController = this.#variableController.parseVariables(options.controller_variable).text
		}

		theController = theController.trim()

		if (info && theController === 'self') theController = info.deviceid

		return theController
	}

	#fetchPage(options, location, useVariableFields) {
		let thePage = options.page

		if (useVariableFields && options.page_from_variable) {
			thePage = this.#variableController.parseExpression(options.page_variable, 'number').value
		}

		if (location) {
			if (thePage === 0 || thePage === '0') thePage = location.pageNumber ?? location.page
		}

		return thePage
	}

	getVariableDefinitions() {
		return [
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
	}

	/**
	 * Perform an upgrade for an action
	 * @param {import('../Instance/Definitions.js').ActionInstance} action
	 * @param {string} _controlId
	 * @returns {import('../Instance/Definitions.js').ActionInstance | void} Updated action if any changes were made
	 */
	actionUpgrade(action, _controlId) {
		// Upgrade an action. This check is not the safest, but it should be ok
		if (action.options.controller === 'emulator') {
			// Hope that the default emulator still exists
			action.options.controller = 'emulator:emulator'

			return action
		}
	}

	getActionDefinitions() {
		return {
			set_brightness: {
				label: 'Surface: Set serialNumber to brightness',
				options: [
					...CHOICES_CONTROLLER_WITH_VARIABLES,

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
				label: 'Surface: Set serialNumber to page',
				options: [...CHOICES_CONTROLLER_WITH_VARIABLES, ...CHOICES_PAGE_WITH_VARIABLES],
			},
			set_page_byindex: {
				label: 'Surface: Set by index to page',
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
				options: [...CHOICES_CONTROLLER_WITH_VARIABLES],
			},
			dec_page: {
				label: 'Surface: Decrement page number',
				options: [...CHOICES_CONTROLLER_WITH_VARIABLES],
			},

			lockout_device: {
				label: 'Surface: Lockout specified surface immediately.',
				options: [...CHOICES_CONTROLLER_WITH_VARIABLES],
			},
			unlockout_device: {
				label: 'Surface: Unlock specified surface immediately.',
				options: [...CHOICES_CONTROLLER_WITH_VARIABLES],
			},

			lockout_all: {
				label: 'Surface: Lockout all immediately.',
				options: [],
			},
			unlockout_all: {
				label: 'Surface: Unlock all immediately.',
				options: [],
			},

			rescan: {
				label: 'Surface: Rescan USB for devices',
				options: [],
			},
		}
	}

	/**
	 * Run a single internal action
	 * @param {import('../Instance/Definitions.js').ActionInstance} action
	 * @param {import('../Instance/Wrapper.js').RunActionExtras} extras
	 * @returns {boolean} Whether the action was handled
	 */
	executeAction(action, extras) {
		if (action.action === 'set_brightness') {
			const theController = this.#fetchControllerId(action.options, extras, true)

			this.#surfaceController.setDeviceBrightness(theController, action.options.brightness, true)
			return true
		} else if (action.action === 'set_page') {
			const theController = this.#fetchControllerId(action.options, extras, true)
			const thePage = this.#fetchPage(action.options, extras, true)

			this.#changeSurfacePage(theController, thePage)
			return true
		} else if (action.action === 'set_page_byindex') {
			const thePage = this.#fetchPage(action.options, extras, true)

			const deviceId = this.#surfaceController.getDeviceIdFromIndex(action.options.controller)
			if (deviceId !== undefined) {
				this.#changeSurfacePage(deviceId, thePage)
			} else {
				this.#logger.warn(`Trying to set controller #${action.options.controller} but it isn't available.`)
			}
			return true
		} else if (action.action === 'inc_page') {
			const theController = this.#fetchControllerId(action.options, extras, true)

			this.#changeSurfacePage(theController, '+1')
			return true
		} else if (action.action === 'dec_page') {
			const theController = this.#fetchControllerId(action.options, extras, true)

			this.#changeSurfacePage(theController, '-1')
			return true
		} else if (action.action === 'lockout_device') {
			if (this.#surfaceController.isPinLockEnabled()) {
				const theController = this.#fetchControllerId(action.options, extras, true)
				if (extras.controlId && extras.deviceid == theController) {
					const control = this.#controlsController.getControl(extras.controlId)
					if (control && typeof control.setPushed === 'function') {
						// Make sure the button doesn't show as pressed
						control.setPushed(false, extras.deviceid)
					}
				}

				setImmediate(() => {
					this.#surfaceController.setDeviceLocked(theController, true, true)
				})
			}
			return true
		} else if (action.action === 'unlockout_device') {
			const theController = this.#fetchControllerId(action.options, extras, true)

			setImmediate(() => {
				this.#surfaceController.setDeviceLocked(theController, false, true)
			})

			return true
		} else if (action.action === 'lockout_all') {
			if (this.#surfaceController.isPinLockEnabled()) {
				if (extras.controlId) {
					const control = this.#controlsController.getControl(extras.controlId)
					if (control && typeof control.setPushed === 'function') {
						// Make sure the button doesn't show as pressed
						control.setPushed(false, extras.deviceid)
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
			this.#surfaceController.triggerRefreshDevices().catch((e) => {
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
				options: [
					{
						type: 'internal:surface_serial',
						label: 'Surface / controller',
						id: 'controller',
					},
					{
						type: 'internal:page',
						label: 'Page',
						id: 'page',
						includeDirection: false,
						default: 0,
					},
				],
			},
		}
	}

	executeFeedback(feedback) {
		if (feedback.type == 'surface_on_page') {
			const theController = this.#fetchControllerId(feedback.options, {}, false)
			const thePage = this.#fetchPage(feedback.options, feedback.location, false)

			const currentPage = this.#surfaceController.devicePageGet(theController, true)

			return currentPage == thePage
		}
	}
	/**
	 *
	 * @param {import('./Controller.js').InternalVisitor} _visitor
	 * @param {import('../Instance/Definitions.js').ActionInstance[]} _actions
	 * @param {import('../Instance/Definitions.js').FeedbackInstance[]} _feedbacks
	 */
	visitReferences(_visitor, _actions, _feedbacks) {
		// actions page_variable handled by generic options visitor
		// actions controller_variable handled by generic options visitor
	}
}
