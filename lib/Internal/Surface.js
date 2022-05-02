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

function fetchPageAndBankAndController(options, info) {
	let thePage = options.page
	let theBank = options.bank
	let theController = options.controller

	if (info) {
		if (thePage === 0 || thePage === '0') thePage = info.page
		if (theBank === 0 || theBank === '0') theBank = info.bank
		if (theController === 'self') theController = info.deviceid
	}

	return {
		thePage,
		theBank,
		theController,
	}
}

export default class Surface extends CoreBase {
	/** Page history for surfaces */
	#pageHistory = new Map()

	constructor(registry, internalModule) {
		super(registry, 'internal', 'lib/Internal/Surface')

		// this.internalModule = internalModule
	}

	getActionDefinitions() {
		return {
			set_brightness: {
				label: 'Set surface with s/n brightness',
				options: [
					{
						type: 'internal:surface_serial',
						label: 'Surface / controller',
						id: 'controller',
					},
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
				label: 'Set surface with s/n to page',
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
						includeDirection: true,
					},
				],
			},
			set_page_byindex: {
				label: 'Set surface with index to page',
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
					{
						type: 'internal:page',
						label: 'Page',
						id: 'page',
						includeDirection: true,
					},
				],
			},

			inc_page: {
				label: 'Increment page number',
				options: [
					{
						type: 'internal:surface_serial',
						label: 'Surface / controller',
						id: 'controller',
					},
				],
			},
			dec_page: {
				label: 'Decrement page number',
				options: [
					{
						type: 'internal:surface_serial',
						label: 'Surface / controller',
						id: 'controller',
					},
				],
			},

			lockout_device: {
				label: 'Trigger a device to lockout immediately.',
				options: [
					{
						type: 'internal:surface_serial',
						label: 'Surface / controller',
						id: 'controller',
					},
				],
			},
			unlockout_device: {
				label: 'Trigger a device to unlock immediately.',
				options: [
					{
						type: 'internal:surface_serial',
						label: 'Surface / controller',
						id: 'controller',
					},
				],
			},

			lockout_all: {
				label: 'Trigger all devices to lockout immediately.',
				options: [],
			},
			unlockout_all: {
				label: 'Trigger all devices to unlock immediately.',
				options: [],
			},

			rescan: {
				label: 'Rescan USB for devices',
				options: [],
			},
		}
	}

	executeAction(action, extras) {
		if (action.action === 'set_brightness') {
			const { theController } = fetchPageAndBankAndController(action.options, extras)

			this.surfaces.setDeviceBrightness(theController, action.options.brightness)
			return true
		} else if (action.action === 'set_page') {
			const { theController, thePage } = fetchPageAndBankAndController(action.options, extras)

			this.#changeSurfacePage(theController, thePage)
			return true
		} else if (action.action === 'set_page_byindex') {
			const { thePage } = fetchPageAndBankAndController(action.options, extras)

			const deviceId = this.surfaces.getDeviceIdFromIndex(action.options.controller)
			if (deviceId !== undefined) {
				this.#changeSurfacePage(deviceId, thePage)
			} else {
				this.log('warn', `Trying to set controller #${action.options.controller} but it isn't available.`)
			}
			return true
		} else if (action.action === 'inc_page') {
			const { theController } = fetchPageAndBankAndController(action.options, extras)

			this.#changeSurfacePage(theController, '+1')
			return true
		} else if (action.action === 'dec_page') {
			const { theController } = fetchPageAndBankAndController(action.options, extras)

			this.#changeSurfacePage(theController, '-1')
			return true
		} else if (action.action === 'lockout_device') {
			if (this.userconfig.getKey('pin_enable')) {
				const { theController } = fetchPageAndBankAndController(action.options, extras)
				if (info && info.page && info.bank && info.deviceid == theController) {
					// Make sure the button doesn't show as pressed
					this.bank.setPushed(info.page, info.bank, false, info.deviceid)
				}
				setImmediate(() => {
					if (this.userconfig.getKey('link_lockouts')) {
						this.surfaces.setAllLocked(true)
					} else {
						this.surfaces.setDeviceLocked(theController, true)
					}
				})
			}
			return true
		} else if (action.action === 'unlockout_device') {
			if (this.userconfig.getKey('pin_enable')) {
				const { theController } = fetchPageAndBankAndController(action.options, extras)
				if (info && info.page && info.bank && info.deviceid == theController) {
					// Make sure the button doesn't show as pressed
					this.bank.setPushed(info.page, info.bank, false, info.deviceid)
				}
				setImmediate(() => {
					if (this.userconfig.getKey('link_lockouts')) {
						this.surfaces.setAllLocked(false)
					} else {
						this.surfaces.setDeviceLocked(theController, false)
					}
				})
			}
			return true
		} else if (action.action === 'lockout_all') {
			if (this.userconfig.getKey('pin_enable')) {
				if (info && info.page && info.bank) {
					// Make sure the button doesn't show as pressed
					this.bank.setPushed(info.page, info.bank, false, info.deviceid)
				}
				setImmediate(() => {
					this.surfaces.setAllLocked(true)
				})
			}
			return true
		} else if (action.action === 'unlockout_all') {
			if (this.userconfig.getKey('pin_enable')) {
				if (info && info.page && info.bank) {
					// Make sure the button doesn't show as pressed
					this.bank.setPushed(info.page, info.bank, false, info.deviceid)
				}
				setImmediate(() => {
					this.surfaces.setAllLocked(false)
				})
			}
			return true
		} else if (action.action === 'rescan') {
			this.surfaces.refreshDevices()
			return true
		}
	}

	#changeSurfacePage(surfaceId, toPage) {
		const currentPage = this.surfaces.devicePageGet(surfaceId)
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
				this.#pageHistory.set(pageHistory)
			}

			if (toPage === 'back' || toPage === 'forward') {
				// determine the 'to' page
				const pageDirection = toPage === 'back' ? -1 : 1
				const pageIndex = pageHistory.index + pageDirection
				const pageTarget = pageHistory.history[pageIndex]

				// change only if pageIndex points to a real page
				if (pageTarget !== undefined) {
					pageHistory.index = pageIndex

					setImmediate(() => {
						this.surfaces.devicePageSet(surfaceId, pageTarget)
					})
				}
			} else {
				let newPage = toPage
				if (newPage === '+1') {
					newPage = currentPage + 1
					if (newPage > 99) newPage = 1
				} else if (newPage === '-1') {
					newPage = currentPage - 1
					if (newPage < 1) newPage = 99
				}
				if (typeof newPage !== 'number') newPage = 1

				// Change page after this runloop
				setImmediate(() => {
					this.surfaces.devicePageSet(surfaceId, newPage)
				})

				// Clear forward page history beyond current index, add new history entry, increment index;
				pageHistory.history = pageHistory.history.slice(0, pageHistory.index + 1)
				pageHistory.history.push(page)
				pageHistory.index += 1

				// Limit the max history
				const maxPageHistory = 100
				if (pageHistory.history.length > maxPageHistory) {
					const startIndex = pageHistory.history.length - maxPageHistory
					const endIndex = pageHistory.history.length
					pageHistory.history = pageHistory.history.slice(startIndex, endIndex)
					pageHistory.index = endIndex
				}
			}
		}
	}
}
