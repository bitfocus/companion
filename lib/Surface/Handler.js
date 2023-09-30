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
import { LEGACY_MAX_BUTTONS } from '../Util/Constants.js'
import { rotateXYForPanel, unrotateXYForPanel } from './Util.js'

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
	[5, 1],
	// 1 2 3
	[2, 2],
	[3, 2],
	[4, 2],
	// 4 5 6
	[2, 1],
	[3, 1],
	[4, 1],
	// 7 8 9
	[2, 0],
	[3, 0],
	[4, 0],
]

export function getSurfaceName(config, deviceId) {
	return `${config?.name || config?.type || 'Unknown'} (${deviceId})`
}

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
		groupId: null,
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
	panelInfo = {}

	/**
	 * Xkeys: How many pages of colours it has asked for
	 */
	#xkeysPageCount = 0

	get panelGridSize() {
		const rotation = this.panelconfig.config.rotation
		if (rotation === 'surface90' || rotation === 'surface-90') {
			const rawGridSize = this.panel.gridSize

			return {
				rows: rawGridSize.columns,
				columns: rawGridSize.rows,
			}
		} else {
			return this.panel.gridSize
		}
	}

	constructor(registry, integrationType, panel, isLocked) {
		super(registry, `device(${panel.info.deviceId})`, `Surface/Handler/${panel.info.deviceId}`)
		this.logger.silly('loading for ' + panel.info.devicePath)

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
			this.pincodeCodePosition = [3, 4]
		}

		this.currentPage = 1 // The current page of the device

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
		this.panel.on('setVariable', this.#onSetVariable.bind(this))

		// subscribe to some xkeys specific events
		this.panel.on('xkeys-subscribePage', this.#onXkeysSubscribePages.bind(this))

		setImmediate(() => {
			this.saveConfig()

			if (this.panel.setConfig) {
				const config = this.panelconfig.config
				this.panel.setConfig(config, true)
			}

			// TODO-group
			this.surfaces.emit('surface_page', this.deviceId, this.currentPage)

			this.drawPage()
		})
	}

	getGroupId() {
		return this.panelconfig.groupId
	}
	setGroupId(groupId) {
		this.panelconfig.groupId = groupId
		this.saveConfig()
	}

	#getCurrentOffset() {
		return {
			xOffset: this.panelconfig.config.xOffset,
			yOffset: this.panelconfig.config.yOffset,
		}
	}

	get deviceId() {
		return this.panel.info.deviceId
	}

	get displayName() {
		return getSurfaceName(this.panelconfig, this.deviceId)
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
			} else {
				const { xOffset, yOffset } = this.#getCurrentOffset()

				const gridSize = this.panelGridSize

				for (let y = 0; y < gridSize.rows; y++) {
					for (let x = 0; x < gridSize.columns; x++) {
						const image = this.graphics.getBank({
							pageNumber: this.currentPage,
							column: x + xOffset,
							row: y + yOffset,
						})

						this.#drawButtonTransformed(x, y, image)
					}
				}
			}
		}
	}

	#drawButtonTransformed(x, y, image) {
		const [transformedX, transformedY] = rotateXYForPanel(x, y, this.panelGridSize, this.panelconfig.config.rotation)

		this.panel.draw(transformedX, transformedY, image)
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
				const [transformedX, transformedY] = rotateXYForPanel(
					location.column,
					location.row,
					this.panelGridSize,
					this.panelconfig.config.rotation
				)

				this.panel.drawColor(pageOffset, transformedX, transformedY, render.style?.bgcolor || 0)
			}
		} else if (location.pageNumber == this.currentPage) {
			// normal mode
			const { xOffset, yOffset } = this.#getCurrentOffset()

			this.#drawButtonTransformed(location.column - xOffset, location.row - yOffset, render)
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

		try {
			this.surfaces.removeDevice(this.panel.info.devicepath)
		} catch (e) {
			this.logger.error(`Remove failed: ${e}`)
			console.log(e, e.stack, e.message)
		}
	}

	#onDeviceResized() {
		if (!this.panel) return

		this.drawPage()
	}

	#onDeviceClick(x, y, pressed, pageOffset) {
		if (!this.panel) return
		try {
			if (!this.isSurfaceLocked) {
				this.emit('interaction')

				const [x2, y2] = unrotateXYForPanel(x, y, this.panelGridSize, this.panelconfig.config.rotation)

				// Translate key for offset
				const { xOffset, yOffset } = this.#getCurrentOffset()

				const coordinate = `${y2 + yOffset}/${x2 + xOffset}`

				let thisPage = this.currentPage

				if (pressed) {
					// Track what page was pressed for this key
					this.#currentButtonPresses[coordinate] = thisPage
				} else {
					// Release the same page that was previously pressed
					thisPage = this.#currentButtonPresses[coordinate] ?? thisPage
					delete this.#currentButtonPresses[coordinate]
				}

				// allow the xkeys (legacy mode) to span pages
				thisPage += pageOffset ?? 0
				// loop at page 99
				if (thisPage > 99) thisPage = 1

				const controlId = this.page.getControlIdAt({
					pageNumber: thisPage,
					column: x2 + xOffset,
					row: y2 + yOffset,
				})

				this.controls.pressControl(controlId, pressed, this.deviceId)
				this.logger.debug(`Button ${thisPage}/${coordinate} ${pressed ? 'pressed' : 'released'}`)
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
		} catch (e) {
			this.logger.error(`Click failed: ${e}`)
		}
	}

	#onDeviceRotate(x, y, direction, pageOffset) {
		if (!this.panel) return
		try {
			if (!this.isSurfaceLocked) {
				this.emit('interaction')

				const [x2, y2] = unrotateXYForPanel(x, y, this.panelGridSize, this.panelconfig.config.rotation)

				// Translate key for offset
				const { xOffset, yOffset } = this.#getCurrentOffset()

				let thisPage = this.currentPage

				// allow the xkeys (legacy mode) to span pages
				thisPage += pageOffset ?? 0
				// loop at page 99
				if (thisPage > 99) thisPage = 1

				const controlId = this.page.getControlIdAt({
					pageNumber: thisPage,
					column: x2 + xOffset,
					row: y2 + yOffset,
				})

				this.controls.rotateControl(controlId, direction, this.deviceId)
				this.logger.debug(`Rotary ${thisPage}/${x2 + xOffset}/${y2 + yOffset} rotated ${direction ? 'right' : 'left'}`)
			} else {
				// Ignore when locked out
			}
		} catch (e) {
			this.logger.error(`Click failed: ${e}`)
		}
	}

	#onSetVariable(name, value) {
		this.instance.variable.setVariableValues('internal', {
			[name]: value,
		})
	}

	#onXkeysSubscribePages(pageCount) {
		this.#xkeysPageCount = pageCount

		this.#xkeysDrawPages()
	}

	#xkeysDrawPages() {
		if (!this.panel) return

		for (let page = 0; page < this.#xkeysPageCount; page++) {
			for (let bank = 0; bank < LEGACY_MAX_BUTTONS; bank++) {
				const xy = oldBankIndexToXY(bank)
				if (xy) {
					const render = this.graphics.getBank({
						pageNumber: this.currentPage + page,
						column: xy[0],
						row: xy[1],
					})

					const [transformedX, transformedY] = rotateXYForPanel(
						...xy,
						this.panelGridSize,
						this.panelconfig.config.rotation
					)

					this.panel.drawColor(page, transformedX, transformedY, render.style?.bgcolor || 0)
				}
			}
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
			this.storeNewDevicePage(newconfig.page)
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

	storeNewDevicePage(newpage, defer = false) {
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
		this.logger.silly('unloading for ' + this.panel.info.devicePath)
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
