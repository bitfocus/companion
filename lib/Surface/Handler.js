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
import { oldBankIndexToXY } from '../Shared/ControlId.js'
import { cloneDeep } from 'lodash-es'

const PINCODE_NUMBER_POSITIONS = [
	// 0
	[4, 1],
	// 1 2 3
	[1, 2],
	[2, 2],
	[3, 2],
	// 4 5 6
	[1, 1],
	[2, 1],
	[3, 1],
	// 7 8 9
	[1, 0],
	[2, 0],
	[3, 0],
]
const PINCODE_CODE_POSITION = [0, 1]

const PINCODE_NUMBER_POSITIONS_SKIP_FIRST_COL = [
	// 0
	[4, 1],
	// 1 2 3
	[1, 2],
	[2, 2],
	[3, 2],
	// 4 5 6
	[1, 1],
	[2, 1],
	[3, 1],
	// 7 8 9
	[1, 0],
	[2, 0],
	[3, 0],
]

class SurfaceHandler extends CoreBase {
	static PanelDefaults = {
		// defaults from the panel - TODO properly
		brightness: 100,
		rotation: 0,

		// companion owned defaults
		use_last_page: true,
		never_lock: false,
		page: 1,
		xOffset: 0,
		yOffset: 0,
	}

	/**
	 * Current pincode entry if locked
	 */
	currentPincodeEntry = ''

	/** Currently pressed buttons, and what they are keeping pressed  */
	#currentButtonPresses = {}

	/**
	 * Whether the surface is currently locked
	 */
	isSurfaceLocked = false

	/**
	 * Calculated info about the panel
	 */
	panelInfo = {
		xOffsetMax: 0,
		yOffsetMax: 0,
	}

	/**
	 * Xkeys: How many pages of colours it has asked for
	 */
	#xkeysPageCount = 0

	constructor(registry, integrationType, panel, isLocked) {
		super(registry, `device(${panel.info.deviceId})`, `Surface/Handler/${panel.info.deviceId}`)
		this.logger.silly('loading for ' + panel.info.devicepath)

		this.panel = panel
		this.isSurfaceLocked = isLocked
		this.pincodeNumberPositions = PINCODE_NUMBER_POSITIONS
		this.pincodeCodePosition = PINCODE_CODE_POSITION

		// some surfaces need different positions for the pincode numbers
		if (
			this.panel.info.type === 'Loupedeck Live' ||
			this.panel.info.type === 'Loupedeck Live S' ||
			this.panel.info.type === 'Razer Stream Controller' ||
			this.panel.info.type === 'Razer Stream Controller X'
		) {
			this.pincodeNumberPositions = PINCODE_NUMBER_POSITIONS_SKIP_FIRST_COL
			this.pincodeCodePosition = [4, 2]
		}
		if (this.panel.info.type === 'Loupedeck CT') {
			this.pincodeNumberPositions = PINCODE_NUMBER_POSITIONS_SKIP_FIRST_COL
			this.pincodeCodePosition = [2, 4]
		}

		this.currentPage = 1 // The current page of the device

		// Fill in max offsets
		this.updateMaxOffset()

		{
			const rawConfig = this.db.getKey('deviceconfig', {})
			this.panelconfig = rawConfig[this.deviceId]
			if (!this.panelconfig) {
				this.panelconfig = {}
				this.logger.silly(`Creating config for newly discovered device ${this.deviceId}`)

				rawConfig[this.deviceId] = this.panelconfig
				this.db.setKey('deviceconfig', rawConfig)
			} else {
				this.logger.silly(`Reusing config for device ${this.deviceId} was on page ${this.currentPage}`)
			}
		}

		// Persist the type in the db for use when it is disconnected
		this.panelconfig.type = this.panel.info.type || 'Unknown'
		this.panelconfig.integrationType = integrationType

		if (!this.panelconfig.config) {
			this.panelconfig.config = cloneDeep(SurfaceHandler.PanelDefaults)
			if (typeof this.panel.getDefaultConfig === 'function') {
				Object.assign(this.panelconfig.config, this.panel.getDefaultConfig())
			}
		}

		if (this.panelconfig.config.xOffset === undefined || this.panelconfig.config.yOffset === undefined) {
			// Fill in missing default offsets
			this.panelconfig.config.xOffset = 0
			this.panelconfig.config.yOffset = 0
		}

		if (this.panelconfig.config.use_last_page === undefined) {
			// Fill in the new field based on previous behaviour:
			// If a page had been chosen, then it would start on that
			this.panelconfig.config.use_last_page = this.panelconfig.config.page === undefined
		}

		if (this.panelconfig.config.use_last_page) {
			if (this.panelconfig.page !== undefined) {
				// use last page if defined
				this.currentPage = this.panelconfig.page
			}
		} else {
			if (this.panelconfig.config.page !== undefined) {
				// use startup page if defined
				this.currentPage = this.panelconfig.page = this.panelconfig.config.page
			}
		}

		if (this.panelconfig.config.never_lock) {
			// if device can't be locked, then make sure it isnt already locked
			this.isSurfaceLocked = false
		}

		this.onButtonDrawn = this.onButtonDrawn.bind(this)

		this.graphics.on('button_drawn', this.onButtonDrawn)

		this.panel.on('click', this.#onDeviceClick.bind(this))
		this.panel.on('rotate', this.#onDeviceRotate.bind(this))
		this.panel.on('remove', this.#onDeviceRemove.bind(this))
		this.panel.on('resized', this.#onDeviceResized.bind(this))

		// subscribe to some xkeys specific events
		this.panel.on('xkeys-subscribePage', this.#onXkeysSubscribePages.bind(this))
		this.panel.on('xkeys-setVariable', this.#onXkeysSetVariable.bind(this))

		setImmediate(() => {
			this.saveConfig()

			if (this.panel.setConfig) {
				const config = this.panelconfig.config
				this.panel.setConfig(config, true)
			}

			this.surfaces.emit('surface_page', this.deviceId, this.currentPage)

			this.drawPage()
		})
	}

	updateMaxOffset() {
		const gridSize = this.panel.gridSize
		if (gridSize.columns && gridSize.rows) {
			const maxRows = Math.ceil(global.MAX_BUTTONS / global.MAX_BUTTONS_PER_ROW)
			this.panelInfo.xOffsetMax = Math.max(Math.floor(global.MAX_BUTTONS_PER_ROW - gridSize.columns), 0)
			this.panelInfo.yOffsetMax = Math.max(Math.floor(maxRows - gridSize.rows), 0)
		}
	}

	get deviceId() {
		return this.panel.info.deviceId
	}

	#deviceIncreasePage() {
		this.currentPage++
		if (this.currentPage >= 100) {
			this.currentPage = 1
		}
		if (this.currentPage <= 0) {
			this.currentPage = 99
		}

		this.#storeNewDevicePage(this.currentPage)
	}

	#deviceDecreasePage() {
		this.currentPage--
		if (this.currentPage >= 100) {
			this.currentPage = 1
		}
		if (this.currentPage <= 0) {
			this.currentPage = 99
		}

		this.#storeNewDevicePage(this.currentPage)
	}

	drawPage() {
		if (this.panel) {
			if (this.isSurfaceLocked) {
				const buffers = this.graphics.getImagesForPincode(this.currentPincodeEntry)
				this.panel.clearDeck()

				this.panel.draw(this.pincodeCodePosition[0], this.pincodeCodePosition[1], buffers.code)

				this.pincodeNumberPositions.forEach(([x, y], i) => {
					if (buffers[i]) {
						this.panel.draw(x, y, buffers[i])
					}
				})
			} else if (this.#xkeysPageCount > 0) {
				this.#xkeysDrawPages()
			} else if (this.panel.info.type === 'Loupedeck CT') {
				const gridSize = this.panel.gridSize

				for (let y = 0; y < gridSize.rows; y += 1) {
					let pageNumber = this.currentPage
					if (y >= gridSize.rows) pageNumber += 1
					if (pageNumber > 99) pageNumber = 1

					for (let x = 0; x < gridSize.columns; x += 1) {
						const image = this.graphics.getBank({
							pageNumber,
							column: x,
							row: y % 4,
						})

						this.panel.draw(x, y, image)
					}
				}
			} else {
				const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelInfo.xOffsetMax)
				const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelInfo.yOffsetMax)

				const gridSize = this.panel.gridSize

				for (let y = 0; y < gridSize.rows; y++) {
					for (let x = 0; x < gridSize.columns; x++) {
						const image = this.graphics.getBank({
							pageNumber: this.currentPage,
							column: x + xOffset,
							row: y + yOffset,
						})

						this.panel.draw(x, y, image)
					}
				}
			}
		}
	}

	getPanelConfig() {
		return this.panelconfig.config
	}

	getPanelInfo() {
		return this.panelInfo
	}

	setLocked(locked) {
		// skip if surface can't be locked
		if (this.panelconfig.config.never_lock) return

		// If it changed, redraw
		if (this.isSurfaceLocked != locked) {
			this.isSurfaceLocked = !!locked

			this.drawPage()
		}
	}

	onButtonDrawn(location, render) {
		// If device is locked ignore updates. pincode updates are handled separately
		if (this.isSurfaceLocked) return

		if (this.#xkeysPageCount > 0) {
			// xkeys mode
			const pageOffset = location.pageNumber - this.currentPage
			if (pageOffset >= 0 && pageOffset < this.#xkeysPageCount) {
				this.panel.drawColor(pageOffset, location.column, location.row, render.style?.bgcolor || 0)
			}
		} else if (
			this.panel.info.type === 'Loupedeck CT' &&
			(location.pageNumber - this.currentPage == 1 || (location.pageNumber == 1 && this.currentPage == 99)) &&
			location.row < 3 // lower half of CT has only 3 rows, zero based
		) {
			// Loupdeck CT lower half, draw button with row offset by 4
			this.panel.draw(location.column, location.row + 4, render)
		} else if (location.pageNumber == this.currentPage) {
			// normal mode
			const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelInfo.xOffsetMax)
			const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelInfo.yOffsetMax)

			this.panel.draw(location.column - xOffset, location.row - yOffset, render)
		}
	}

	setBrightness(brightness) {
		if (this.panel) {
			if (this.panel.setConfig) {
				const config = {
					...this.panelconfig.config,
					brightness: brightness,
				}

				setImmediate(() => {
					this.panel.setConfig(config)
				})
			}
		}
	}

	#onDeviceRemove() {
		if (!this.panel) return
		this.surfaces.removeDevice(this.panel.info.devicepath)
	}

	#onDeviceResized() {
		if (!this.panel) return

		this.drawPage()

		this.updateMaxOffset()
	}

	#onDeviceClick(x, y, pressed, pageOffset) {
		if (this.panel) {
			if (!this.isSurfaceLocked) {
				this.emit('interaction')

				// Translate key for offset
				const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelInfo.xOffsetMax)
				const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelInfo.yOffsetMax)

				const coordinate = `${x + xOffset}/${y + yOffset}`

				let thisPage = this.currentPage

				if (pressed) {
					// Track what page was pressed for this key
					this.#currentButtonPresses[coordinate] = thisPage
				} else {
					// Release the same page that was previously pressed
					thisPage = this.#currentButtonPresses[coordinate] ?? thisPage
					delete this.#currentButtonPresses[coordinate]
				}

				// allow the xkeys and loupedeck CT to span pages
				thisPage += pageOffset ?? 0
				// loop at page 99
				if (thisPage > 99) thisPage = 1

				const controlId = this.page.getControlIdAt({
					pageNumber: thisPage,
					column: x + xOffset,
					row: y + yOffset,
				})

				this.controls.pressControl(controlId, pressed, this.deviceId)
				this.logger.debug(`Button ${thisPage}/${x + xOffset}/${y + yOffset} ${pressed ? 'pressed' : 'released'}`)
			} else {
				if (pressed) {
					const pressCode = this.pincodeNumberPositions.findIndex((pos) => pos[0] == x && pos[1] == y)
					if (pressCode !== -1) {
						this.currentPincodeEntry += pressCode.toString()
					}

					if (this.currentPincodeEntry == this.userconfig.getKey('pin').toString()) {
						this.isSurfaceLocked = false
						this.currentPincodeEntry = ''

						this.emit('unlocked')

						this.drawPage()
					} else if (this.currentPincodeEntry.length >= this.userconfig.getKey('pin').toString().length) {
						this.currentPincodeEntry = ''
					}
				}

				if (this.isSurfaceLocked) {
					// Update lockout button
					const datap = this.graphics.getImagesForPincode(this.currentPincodeEntry)
					this.panel.draw(this.pincodeCodePosition[0], this.pincodeCodePosition[1], datap.code)
				}
			}
		}
	}

	#onDeviceRotate(x, y, direction, pageOffset) {
		if (this.panel) {
			if (!this.isSurfaceLocked) {
				this.emit('interaction')

				// Translate key for offset
				const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelInfo.xOffsetMax)
				const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelInfo.yOffsetMax)

				let thisPage = this.currentPage

				// allow the xkeys and loupedeck CT to span pages
				thisPage += pageOffset ?? 0
				// loop at page 99
				if (thisPage > 99) thisPage = 1

				const controlId = this.page.getControlIdAt({
					pageNumber: thisPage,
					column: x + xOffset,
					row: y + yOffset,
				})

				this.controls.rotateControl(controlId, direction, this.deviceId)
				this.logger.debug(`Rotary ${thisPage}/${x + xOffset}/${y + yOffset} rotated ${direction ? 'right' : 'left'}`)
			} else {
				// Ignore when locked out
			}
		}
	}

	#onXkeysSubscribePages(pageCount) {
		this.#xkeysPageCount = pageCount

		this.#xkeysDrawPages()
	}

	#xkeysDrawPages() {
		for (let page = 0; page < this.#xkeysPageCount; page++) {
			for (let bank = 0; bank < global.MAX_BUTTONS; bank++) {
				const xy = oldBankIndexToXY(bank)
				if (xy) {
					const render = this.graphics.getBank({
						pageNumber: this.currentPage + page,
						column: xy[0],
						row: xy[1],
					})

					this.panel.drawColor(page, ...xy, render.style?.bgcolor || 0)
				}
			}
		}
	}

	#onXkeysSetVariable(name, value) {
		this.instance.variable.setVariableValues('internal', {
			[name]: value,
		})
	}

	doPageDown() {
		if (this.userconfig.getKey('page_direction_flipped') === true) {
			this.#deviceIncreasePage()
		} else {
			this.#deviceDecreasePage()
		}
	}

	setCurrentPage(page, defer = false) {
		this.currentPage = page
		if (this.currentPage == 100) {
			this.currentPage = 1
		}
		if (this.currentPage == 0) {
			this.currentPage = 99
		}
		this.#storeNewDevicePage(this.currentPage, defer)
	}

	getCurrentPage() {
		return this.currentPage
	}

	doPageUp() {
		if (this.userconfig.getKey('page_direction_flipped') === true) {
			this.#deviceDecreasePage()
		} else {
			this.#deviceIncreasePage()
		}
	}

	resetConfig() {
		this.setPanelConfig(cloneDeep(SurfaceHandler.PanelDefaults))
	}

	saveConfig() {
		const deviceConfig = this.db.getKey('deviceconfig', {})
		deviceConfig[this.deviceId] = this.panelconfig
		this.db.setKey('deviceconfig', deviceConfig)
	}

	setPanelConfig(newconfig) {
		if (!newconfig.use_last_page && newconfig.page !== undefined && newconfig.page !== this.panelconfig.config.page) {
			// Startup page has changed, so change over to it
			this.#storeNewDevicePage(newconfig.page)
		}

		let redraw = false
		if (newconfig.xOffset != this.panelconfig.config.xOffset || newconfig.yOffset != this.panelconfig.config.yOffset)
			redraw = true
		if (newconfig.rotation != this.panelconfig.config.rotation) redraw = true

		if (newconfig.never_lock && newconfig.never_lock != this.panelconfig.config.never_lock) {
			this.isSurfaceLocked = false
			redraw = true
		}

		this.panelconfig.config = newconfig
		this.saveConfig()

		if (this.panel.setConfig) {
			this.panel.setConfig(newconfig)
		}

		if (redraw) {
			this.drawPage()
		}
	}

	setPanelName(newname) {
		if (typeof newname === 'string') {
			this.panelconfig.name = newname

			// save it
			this.saveConfig()
		}
	}

	#storeNewDevicePage(newpage, defer = false) {
		this.panelconfig.page = this.currentPage = newpage
		this.saveConfig()

		this.surfaces.emit('surface_page', this.deviceId, newpage)

		if (defer) {
			setImmediate(() => {
				this.drawPage()
			})
		} else {
			this.drawPage()
		}
	}

	unload(purge) {
		this.logger.error(this.panel.info.type + ' disconnected')
		this.logger.silly('unloading for ' + this.panel.info.devicepath)
		this.graphics.off('button_drawn', this.onButtonDrawn)

		try {
			this.panel.quit()
		} catch (e) {}

		const deviceId = this.deviceId

		delete this.panel.device
		delete this.panel

		if (purge && deviceId) {
			this.panelconfig = undefined

			const deviceConfig = this.db.getKey('deviceconfig', {})
			delete deviceConfig[deviceId]
			this.db.setKey('deviceconfig', deviceConfig)
		}
	}
}

export default SurfaceHandler
