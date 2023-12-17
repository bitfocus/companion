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
import { SurfaceGroup } from './Group.js'
import { EventEmitter } from 'events'
import { ImageResult } from '../Graphics/ImageResult.js'

/**
 * @type {[number, number][]}
 */
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
/**
 * @type {[number, number]}
 */
const PINCODE_CODE_POSITION = [0, 1]

/**
 * @type {[number, number][]}
 */
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

/**
 * @typedef {{
 *   deviceId: string
 *   devicePath: string
 *   type: string
 *   configFields: string[]
 *   location?: string
 * }} SurfacePanelInfo
 * @typedef {{
 *   info: SurfacePanelInfo
 *   gridSize: import('./Util.js').GridSize
 *   clearDeck(): void
 *   draw(x: number, y: number, render: ImageResult): void
 *   drawColor?: (pageOffset: number, x: number, y: number, color: number) => void
 *   setConfig(config: any, force?: boolean): void
 *   getDefaultConfig?: () => any
 *   quit(): void
 * } & EventEmitter} SurfacePanel
 */

/**
 * Get the display name of a surface
 * @param {Record<string, any>} config
 * @param {string} surfaceId
 * @returns {string}
 */
export function getSurfaceName(config, surfaceId) {
	return `${config?.name || config?.type || 'Unknown'} (${surfaceId})`
}

class SurfaceHandler extends CoreBase {
	static PanelDefaults = {
		// defaults from the panel - TODO properly
		brightness: 100,
		rotation: 0,

		// companion owned defaults
		never_lock: false,
		xOffset: 0,
		yOffset: 0,
		groupId: null,
	}

	/**
	 * Currently pressed buttons, and what they are keeping pressed
	 * @type {Record<string, number>}
	 * @access private
	 */
	#currentButtonPresses = {}

	/**
	 * Current page of the surface
	 * @type {number}
	 * @access private
	 */
	#currentPage = 1

	/**
	 * Current pincode entry if locked
	 * @type {string}
	 * @access private
	 */
	#currentPincodeEntry = ''

	/**
	 * Whether the surface is currently locked
	 * @type {boolean}
	 * @access private
	 */
	#isSurfaceLocked = false

	/**
	 * Positions of pincode numbers
	 * @type {[number, number][]}
	 * @access private
	 */
	#pincodeNumberPositions

	/**
	 * Position of pincode 'button'
	 * @type {[number, number]}
	 * @access private
	 */
	#pincodeCodePosition

	/**
	 * Config for this surface
	 * @type {Record<string, any>}
	 * @access private
	 */
	#surfaceConfig

	/**
	 * Xkeys: How many pages of colours it has asked for
	 * @type {number}
	 * @access private
	 */
	#xkeysPageCount = 0

	/**
	 * Grid size of the panel
	 * @type {import('./Util.js').GridSize}
	 * @access public
	 */
	get panelGridSize() {
		const rotation = this.#surfaceConfig.config.rotation
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

	/**
	 *
	 * @param {import('../Registry.js').default} registry
	 * @param {string} integrationType
	 * @param {SurfacePanel} panel
	 * @param {any | undefined} surfaceConfig
	 */
	constructor(registry, integrationType, panel, surfaceConfig) {
		super(registry, `surface(${panel.info.deviceId})`, `Surface/Handler/${panel.info.deviceId}`)
		this.logger.silly('loading for ' + panel.info.devicePath)

		this.panel = panel
		this.#surfaceConfig = surfaceConfig ?? {}

		this.#pincodeNumberPositions = PINCODE_NUMBER_POSITIONS
		this.#pincodeCodePosition = PINCODE_CODE_POSITION

		// some surfaces need different positions for the pincode numbers
		if (
			this.panel.info.type === 'Loupedeck Live' ||
			this.panel.info.type === 'Loupedeck Live S' ||
			this.panel.info.type === 'Razer Stream Controller' ||
			this.panel.info.type === 'Razer Stream Controller X'
		) {
			this.#pincodeNumberPositions = PINCODE_NUMBER_POSITIONS_SKIP_FIRST_COL
			this.#pincodeCodePosition = [4, 2]
		}
		if (this.panel.info.type === 'Loupedeck CT') {
			this.#pincodeNumberPositions = PINCODE_NUMBER_POSITIONS_SKIP_FIRST_COL
			this.#pincodeCodePosition = [3, 4]
		}

		// Persist the type in the db for use when it is disconnected
		this.#surfaceConfig.type = this.panel.info.type || 'Unknown'
		this.#surfaceConfig.integrationType = integrationType
		this.#surfaceConfig.gridSize = this.panel.gridSize

		if (!this.#surfaceConfig.config) {
			this.#surfaceConfig.config = cloneDeep(SurfaceHandler.PanelDefaults)
			if (typeof this.panel.getDefaultConfig === 'function') {
				Object.assign(this.#surfaceConfig.config, this.panel.getDefaultConfig())
			}
		}

		if (this.#surfaceConfig.config.xOffset === undefined || this.#surfaceConfig.config.yOffset === undefined) {
			// Fill in missing default offsets
			this.#surfaceConfig.config.xOffset = 0
			this.#surfaceConfig.config.yOffset = 0
		}

		if (!this.#surfaceConfig.groupConfig) {
			// Fill in the new field based on previous behaviour:
			// If a page had been chosen, then it would start on that
			const use_last_page = this.#surfaceConfig.config.use_last_page ?? this.#surfaceConfig.config.page === undefined
			this.#surfaceConfig.groupConfig = {
				page: this.#surfaceConfig.page,
				startup_page: this.#surfaceConfig.config.page,
				use_last_page: use_last_page,
			}
		}
		// Forget old values
		delete this.#surfaceConfig.config.use_last_page
		delete this.#surfaceConfig.config.page
		delete this.#surfaceConfig.page

		if (this.#surfaceConfig.config.never_lock) {
			// if device can't be locked, then make sure it isnt already locked
			this.#isSurfaceLocked = false
		}

		this.graphics.on('button_drawn', this.#onButtonDrawn)

		this.panel.on('click', this.#onDeviceClick.bind(this))
		this.panel.on('rotate', this.#onDeviceRotate.bind(this))
		this.panel.on('remove', this.#onDeviceRemove.bind(this))
		this.panel.on('resized', this.#onDeviceResized.bind(this))
		this.panel.on('setVariable', this.#onSetVariable.bind(this))

		// subscribe to some xkeys specific events
		this.panel.on('xkeys-subscribePage', this.#onXkeysSubscribePages.bind(this))

		setImmediate(() => {
			this.#saveConfig()

			if (this.panel.setConfig) {
				const config = this.#surfaceConfig.config
				this.panel.setConfig(config, true)
			}

			this.#drawPage()
		})
	}

	/**
	 * Get the current groupId this surface belongs to
	 * @returns {string | null}
	 */
	getGroupId() {
		return this.#surfaceConfig.groupId
	}
	/**
	 * Set the current groupId of this surface
	 * @param {string | null} groupId
	 * @returns {void}
	 */
	setGroupId(groupId) {
		this.#surfaceConfig.groupId = groupId
		this.#saveConfig()
	}

	#getCurrentOffset() {
		return {
			xOffset: this.#surfaceConfig.config.xOffset,
			yOffset: this.#surfaceConfig.config.yOffset,
		}
	}

	get surfaceId() {
		return this.panel.info.deviceId
	}

	get displayName() {
		return getSurfaceName(this.#surfaceConfig, this.surfaceId)
	}

	#drawPage() {
		if (this.panel) {
			if (this.#isSurfaceLocked) {
				const buffers = this.graphics.getImagesForPincode(this.#currentPincodeEntry)
				this.panel.clearDeck()

				this.panel.draw(this.#pincodeCodePosition[0], this.#pincodeCodePosition[1], buffers.code)

				this.#pincodeNumberPositions.forEach(([x, y], i) => {
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
						const image = this.graphics.getCachedRenderOrGeneratePlaceholder({
							pageNumber: this.#currentPage,
							column: x + xOffset,
							row: y + yOffset,
						})

						this.#drawButtonTransformed(x, y, image)
					}
				}
			}
		}
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {ImageResult} image
	 * @returns {void}
	 */
	#drawButtonTransformed(x, y, image) {
		const [transformedX, transformedY] = rotateXYForPanel(x, y, this.panelGridSize, this.#surfaceConfig.config.rotation)

		this.panel.draw(transformedX, transformedY, image)
	}

	/**
	 * Get the panel configuration
	 * @returns {any}
	 */
	getPanelConfig() {
		return this.#surfaceConfig.config
	}

	/**
	 * Set the surface as locked
	 * @param {boolean} locked
	 * @param {skipDraw=} locked
	 * @returns {void}
	 */
	setLocked(locked, skipDraw = false) {
		// skip if surface can't be locked
		if (this.#surfaceConfig.config.never_lock) return

		// If it changed, redraw
		if (this.#isSurfaceLocked != locked) {
			this.#isSurfaceLocked = !!locked

			if (!skipDraw) {
				this.#drawPage()
			}
		}
	}

	/**
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @param {import('../Graphics/ImageResult.js').ImageResult} render
	 * @returns {void}
	 */
	#onButtonDrawn = (location, render) => {
		// If surface is locked ignore updates. pincode updates are handled separately
		if (this.#isSurfaceLocked) return

		if (this.#xkeysPageCount > 0) {
			// xkeys mode
			const pageOffset = location.pageNumber - this.#currentPage
			if (this.panel.drawColor && pageOffset >= 0 && pageOffset < this.#xkeysPageCount) {
				const [transformedX, transformedY] = rotateXYForPanel(
					location.column,
					location.row,
					this.panelGridSize,
					this.#surfaceConfig.config.rotation
				)

				this.panel.drawColor(pageOffset, transformedX, transformedY, render.bgcolor)
			}
		} else if (location.pageNumber == this.#currentPage) {
			// normal mode
			const { xOffset, yOffset } = this.#getCurrentOffset()

			this.#drawButtonTransformed(location.column - xOffset, location.row - yOffset, render)
		}
	}

	/**
	 * Set the brightness of the panel
	 * @param {number} brightness 0-100
	 * @returns {void}
	 */
	setBrightness(brightness) {
		if (this.panel) {
			if (this.panel.setConfig) {
				const config = {
					...this.#surfaceConfig.config,
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
			this.surfaces.removeDevice(this.panel.info.devicePath)
		} catch (e) {
			this.logger.error(`Remove failed: ${e}`)
		}
	}

	#onDeviceResized() {
		if (!this.panel) return

		this.#surfaceConfig.gridSize = this.panel.gridSize
		this.#saveConfig()

		this.#drawPage()
	}

	/**
	 *
	 * @param {number} x
	 * @param {number} y
	 * @param {boolean} pressed
	 * @param {number | undefined} pageOffset
	 * @returns {void}
	 */
	#onDeviceClick(x, y, pressed, pageOffset) {
		if (!this.panel) return
		try {
			if (!this.#isSurfaceLocked) {
				this.emit('interaction')

				const [x2, y2] = unrotateXYForPanel(x, y, this.panelGridSize, this.#surfaceConfig.config.rotation)

				// Translate key for offset
				const { xOffset, yOffset } = this.#getCurrentOffset()

				const coordinate = `${y2 + yOffset}/${x2 + xOffset}`

				let thisPage = this.#currentPage

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
				if (controlId) {
					this.controls.pressControl(controlId, pressed, this.surfaceId)
				}
				this.logger.debug(`Button ${thisPage}/${coordinate} ${pressed ? 'pressed' : 'released'}`)
			} else {
				if (pressed) {
					const pressCode = this.#pincodeNumberPositions.findIndex((pos) => pos[0] == x && pos[1] == y)
					if (pressCode !== -1) {
						this.#currentPincodeEntry += pressCode.toString()
					}

					if (this.#currentPincodeEntry == this.userconfig.getKey('pin').toString()) {
						this.#currentPincodeEntry = ''

						this.emit('unlocked')
					} else if (this.#currentPincodeEntry.length >= this.userconfig.getKey('pin').toString().length) {
						this.#currentPincodeEntry = ''
					}
				}

				if (this.#isSurfaceLocked) {
					// Update lockout button
					const datap = this.graphics.getImagesForPincode(this.#currentPincodeEntry)
					this.panel.draw(this.#pincodeCodePosition[0], this.#pincodeCodePosition[1], datap.code)
				}
			}
		} catch (e) {
			this.logger.error(`Click failed: ${e}`)
		}
	}

	/**
	 *
	 * @param {number} x
	 * @param {number} y
	 * @param {boolean} direction
	 * @param {number | undefined} pageOffset
	 * @returns {void}
	 */
	#onDeviceRotate(x, y, direction, pageOffset) {
		if (!this.panel) return
		try {
			if (!this.#isSurfaceLocked) {
				this.emit('interaction')

				const [x2, y2] = unrotateXYForPanel(x, y, this.panelGridSize, this.#surfaceConfig.config.rotation)

				// Translate key for offset
				const { xOffset, yOffset } = this.#getCurrentOffset()

				let thisPage = this.#currentPage

				// allow the xkeys (legacy mode) to span pages
				thisPage += pageOffset ?? 0
				// loop at page 99
				if (thisPage > 99) thisPage = 1

				const controlId = this.page.getControlIdAt({
					pageNumber: thisPage,
					column: x2 + xOffset,
					row: y2 + yOffset,
				})
				if (controlId) {
					this.controls.rotateControl(controlId, direction, this.surfaceId)
				}
				this.logger.debug(`Rotary ${thisPage}/${x2 + xOffset}/${y2 + yOffset} rotated ${direction ? 'right' : 'left'}`)
			} else {
				// Ignore when locked out
			}
		} catch (e) {
			this.logger.error(`Click failed: ${e}`)
		}
	}

	/**
	 * Set the value of a variable
	 * @param {string} name
	 * @param {string | number} value
	 * @returns {void}
	 */
	#onSetVariable(name, value) {
		this.instance.variable.setVariableValues('internal', {
			[name]: value,
		})
	}

	/**
	 * XKeys: Subscribe to additional pages for color information
	 * @param {number} pageCount
	 * @returns {void}
	 */
	#onXkeysSubscribePages(pageCount) {
		this.#xkeysPageCount = pageCount

		this.#xkeysDrawPages()
	}

	/**
	 * XKeys: Draw additional pages color information
	 * @returns {void}
	 */
	#xkeysDrawPages() {
		if (!this.panel || !this.panel.drawColor) return

		for (let page = 0; page < this.#xkeysPageCount; page++) {
			for (let bank = 0; bank < LEGACY_MAX_BUTTONS; bank++) {
				const xy = oldBankIndexToXY(bank)
				if (xy) {
					const render = this.graphics.getCachedRenderOrGeneratePlaceholder({
						pageNumber: this.#currentPage + page,
						column: xy[0],
						row: xy[1],
					})

					const [transformedX, transformedY] = rotateXYForPanel(
						...xy,
						this.panelGridSize,
						this.#surfaceConfig.config.rotation
					)

					this.panel.drawColor(page, transformedX, transformedY, render.bgcolor)
				}
			}
		}
	}

	/**
	 * Reset the config of this surface to defaults
	 */
	resetConfig() {
		this.#surfaceConfig.groupConfig = cloneDeep(SurfaceGroup.DefaultOptions)
		this.#surfaceConfig.groupId = null
		this.setPanelConfig(cloneDeep(SurfaceHandler.PanelDefaults))
	}

	/**
	 * Trigger a save of the config
	 */
	#saveConfig() {
		this.emit('configUpdated', this.#surfaceConfig)
	}

	/**
	 * Get the 'SurfaceGroup' config for this surface, when run as an auto group
	 * @returns {import('./Group.js').SurfaceGroupConfig}
	 */
	getGroupConfig() {
		if (this.getGroupId()) throw new Error('Cannot retrieve the config from a non-auto surface')

		return this.#surfaceConfig.groupConfig
	}

	/**
	 * Get the full config blob for this surface
	 * @returns {any}
	 */
	getFullConfig() {
		return this.#surfaceConfig
	}

	/**
	 * Set and save the 'SurfaceGroup' config for this surface, when run as an auto group
	 * @param {import('./Group.js').SurfaceGroupConfig} groupConfig
	 * @returns {void}
	 */
	saveGroupConfig(groupConfig) {
		if (this.getGroupId()) throw new Error('Cannot save the config for a non-auto surface')

		this.#surfaceConfig.groupConfig = groupConfig
		this.#saveConfig()
	}

	/**
	 * Update the panel configuration
	 * @param {*} newconfig
	 * @returns {void}
	 */
	setPanelConfig(newconfig) {
		let redraw = false
		if (
			newconfig.xOffset != this.#surfaceConfig.config.xOffset ||
			newconfig.yOffset != this.#surfaceConfig.config.yOffset
		)
			redraw = true
		if (newconfig.rotation != this.#surfaceConfig.config.rotation) redraw = true

		if (newconfig.never_lock && newconfig.never_lock != this.#surfaceConfig.config.never_lock) {
			this.#isSurfaceLocked = false
			redraw = true
		}

		this.#surfaceConfig.config = newconfig
		this.#saveConfig()

		if (this.panel.setConfig) {
			this.panel.setConfig(newconfig)
		}

		if (redraw) {
			this.#drawPage()
		}
	}

	/**
	 * Set the name of the surface
	 * @param {string} newname
	 * @returns {void}
	 */
	setPanelName(newname) {
		if (typeof newname === 'string') {
			this.#surfaceConfig.name = newname

			// save it
			this.#saveConfig()

			this.surfaces.emit('surface_name', this.surfaceId, this.#surfaceConfig.name)
		}
	}

	/**
	 * Update to a new page number
	 * @param {number} newpage
	 * @param {boolean} defer
	 * @returns {void}
	 */
	storeNewDevicePage(newpage, defer = false) {
		this.#currentPage = newpage

		this.surfaces.emit('surface_page', this.surfaceId, newpage)

		if (defer) {
			setImmediate(() => {
				this.#drawPage()
			})
		} else {
			this.#drawPage()
		}
	}

	/**
	 * Unload this surface handler
	 * @param {boolean} purge Purge the configuration
	 * @returns {void}
	 */
	unload(purge = false) {
		this.logger.error(this.panel.info.type + ' disconnected')
		this.logger.silly('unloading for ' + this.panel.info.devicePath)
		this.graphics.off('button_drawn', this.#onButtonDrawn)

		try {
			this.panel.quit()
		} catch (e) {}

		// Fetch the surfaceId before destroying the panel
		const surfaceId = this.surfaceId

		// delete this.panel.device
		// delete this.panel

		if (purge && surfaceId) {
			this.#surfaceConfig = {}

			this.emit('configUpdated', undefined)
		}
	}
}

export default SurfaceHandler
