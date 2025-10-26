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
 */

import { cloneDeep } from 'lodash-es'
import { rotateXYForPanel, unrotateXYForPanel } from './Util.js'
import { SurfaceGroup } from './Group.js'
import { EventEmitter } from 'events'
import type { ImageResult } from '../Graphics/ImageResult.js'
import LogController, { Logger } from '../Log/Controller.js'
import type {
	SurfaceGroupConfig,
	GridSize,
	SurfaceConfig,
	SurfacePanelConfig,
} from '@companion-app/shared/Model/Surfaces.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { SurfaceController } from './Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DrawButtonItem, SurfaceHandlerDependencies, SurfacePanel, UpdateEvents } from './Types.js'
import type { CompanionVariableValue } from '@companion-module/base'
import { PanelDefaults } from './Config.js'
import debounceFn from 'debounce-fn'

const PINCODE_NUMBER_POSITIONS: [number, number][] = [
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

const PINCODE_NUMBER_POSITIONS_SKIP_FIRST_COL: [number, number][] = [
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

const PINCODE_NUMBER_POSITIONS_SDS: [number, number][] = [
	// 0 1 2 3 4
	[2, 1],
	[3, 1],
	[4, 1],
	[5, 1],
	[6, 1],
	// 5 6 7 8 9
	[2, 0],
	[3, 0],
	[4, 0],
	[5, 0],
	[6, 0],
]

/**
 * Get the display name of a surface
 */
export function getSurfaceName(config: Record<string, any>, surfaceId: string): string {
	return `${config?.name || config?.type || 'Unknown'} (${surfaceId})`
}

interface SurfaceHandlerEvents {
	interaction: []
	unlocked: []
	configUpdated: [SurfaceConfig | undefined]
}

export class SurfaceHandler extends EventEmitter<SurfaceHandlerEvents> {
	/**
	 * Currently pressed buttons, and what they are keeping pressed
	 */
	readonly #currentButtonPresses = new Map<string, ControlLocation>()

	/**
	 * Current page of the surface
	 */
	#currentPageId: string

	/**
	 * Current pincode entry if locked
	 */
	#currentPincodeEntry: string = ''

	/**
	 * Whether the surface is currently locked
	 */
	#isSurfaceLocked: boolean = false

	/**
	 * Positions of pincode numbers
	 */
	readonly #pincodeNumberPositions: [number, number][]

	/**
	 * Position of pincode 'button'
	 */
	readonly #pincodeCodePosition: [number, number]

	/**
	 * Config for this surface
	 */
	#surfaceConfig: SurfaceConfig

	/**
	 * Whether the surface is locked
	 */
	get isLocked(): boolean {
		return this.#isSurfaceLocked
	}

	/**
	 * Grid size of the panel
	 */
	get panelGridSize(): GridSize {
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

	#logger: Logger

	/**
	 * The core controls controller
	 */
	readonly #controls: ControlsController
	/**
	 * The core graphics controller
	 */
	readonly #graphics: GraphicsController
	/**
	 * The core page controller
	 */
	readonly #pageStore: IPageStore
	/**
	 * The core device controller
	 */
	readonly #surfaces: SurfaceController
	/**
	 * The core user config manager
	 */
	readonly #userconfig: DataUserConfig

	/**
	 * The core variable controller
	 */
	readonly #variables: VariablesController

	readonly #updateEvents: EventEmitter<UpdateEvents>

	readonly panel: SurfacePanel

	constructor(
		surfaceController: SurfaceController,
		deps: SurfaceHandlerDependencies,
		updateEvents: EventEmitter<UpdateEvents>,
		panel: SurfacePanel,
		surfaceConfig: SurfaceConfig
	) {
		super()

		this.#logger = LogController.createLogger(`Surface/Handler/${panel.info.deviceId}`)
		this.#logger.silly('loading for ' + panel.info.devicePath)

		this.#surfaces = surfaceController
		this.#controls = deps.controls
		this.#graphics = deps.graphics
		this.#pageStore = deps.pageStore
		this.#userconfig = deps.userconfig
		this.#variables = deps.variables
		this.#updateEvents = updateEvents

		this.panel = panel
		this.#surfaceConfig = surfaceConfig

		this.#currentPageId = this.#pageStore.getFirstPageId()

		// Setup logger to use the name
		this.#recreateLogger()

		this.#pincodeNumberPositions = PINCODE_NUMBER_POSITIONS
		this.#pincodeCodePosition = [0, 1]

		// some surfaces need different positions for the pincode numbers
		if (
			this.panel.info.type === 'Loupedeck Live' ||
			this.panel.info.type === 'Loupedeck Live S' ||
			this.panel.info.type === 'Razer Stream Controller' ||
			this.panel.info.type === 'Razer Stream Controller X'
		) {
			this.#pincodeNumberPositions = PINCODE_NUMBER_POSITIONS_SKIP_FIRST_COL
			this.#pincodeCodePosition = [4, 2]
		} else if (this.panel.info.type === 'Loupedeck CT') {
			this.#pincodeNumberPositions = PINCODE_NUMBER_POSITIONS_SKIP_FIRST_COL
			this.#pincodeCodePosition = [3, 4]
		} else if (this.panel.info.type === 'Stream Deck Studio' || this.panel.info.type === 'Elgato Stream Deck Studio') {
			this.#pincodeNumberPositions = PINCODE_NUMBER_POSITIONS_SDS
			this.#pincodeCodePosition = [1, 0]
		} else if (this.panel.info.type === 'Mirabox Stream Dock N4') {
			this.#pincodeNumberPositions = [
				[4, 1],
				[0, 0],
				[1, 0],
				[2, 0],
				[3, 0],
				[4, 0],
				[0, 1],
				[1, 1],
				[2, 1],
				[3, 1],
			]
			this.#pincodeCodePosition = [4, 2]
		}

		if (this.#surfaceConfig.config.never_lock) {
			// if device can't be locked, then make sure it isnt already locked
			this.#isSurfaceLocked = false
		}

		this.#graphics.on('button_drawn', this.#onButtonDrawn)

		this.panel.on('click', this.#onDeviceClick.bind(this))
		this.panel.on('rotate', this.#onDeviceRotate.bind(this))
		this.panel.on('changePage', this.#onDeviceChangePage.bind(this))
		this.panel.on('pincodeKey', this.#onDevicePincodeKey.bind(this))
		this.panel.on('remove', this.#onDeviceRemove.bind(this))
		this.panel.on('resized', this.#onDeviceResized.bind(this))
		this.panel.on('setCustomVariable', this.#onSetCustomVariable.bind(this))

		setImmediate(() => {
			this.#saveConfig()

			if (this.panel.setConfig) {
				const config = this.#surfaceConfig.config
				this.panel.setConfig(config, true)
			}

			this.#drawPage()
		})
	}

	#recreateLogger() {
		const suffix = this.#surfaceConfig?.name ? ` (${this.#surfaceConfig.name})` : ''
		this.#logger = LogController.createLogger(`Surface/Handler/${this.panel.info.deviceId}${suffix}`)
	}

	/**
	 * Get the current groupId this surface belongs to
	 */
	getGroupId(): string | null {
		return this.#surfaceConfig.groupId
	}
	/**
	 * Set the current groupId of this surface
	 */
	setGroupId(groupId: string | null): void {
		this.#surfaceConfig.groupId = groupId
		this.#saveConfig()
	}

	#getCurrentOffset() {
		return {
			xOffset: this.#surfaceConfig.config.xOffset,
			yOffset: this.#surfaceConfig.config.yOffset,
		}
	}

	get surfaceId(): string {
		return this.panel.info.deviceId
	}

	get displayName(): string {
		return getSurfaceName(this.#surfaceConfig, this.surfaceId)
	}

	#drawPageDebounced = debounceFn(() => this.#drawPage(), {
		after: true,
		wait: 1,
		maxWait: 5,
	})

	#drawPage() {
		// Ensure the debounce is not queued
		this.#drawPageDebounced.cancel()

		if (this.panel) {
			if (this.#isSurfaceLocked) {
				if (this.panel.setLocked !== undefined) {
					this.panel.setLocked(this.#isSurfaceLocked, this.#currentPincodeEntry.length)
					return
				}

				const buffers = this.#graphics.getImagesForPincode(this.#currentPincodeEntry)
				this.panel.clearDeck()

				const rawEntries: DrawButtonItem[] = [
					{
						x: this.#pincodeCodePosition[0],
						y: this.#pincodeCodePosition[1],
						image: buffers.code,
					},
				]

				this.#pincodeNumberPositions.forEach(([x, y], i) => {
					if (buffers[i]) {
						rawEntries.push({ x, y, image: buffers[i] })
					}
				})

				this.#drawButtons(rawEntries)
			} else {
				const { xOffset, yOffset } = this.#getCurrentOffset()

				const gridSize = this.panelGridSize

				const pageNumber = this.#pageStore.getPageNumber(this.#currentPageId)

				const rawEntries: DrawButtonItem[] = []

				for (let y = 0; y < gridSize.rows; y++) {
					for (let x = 0; x < gridSize.columns; x++) {
						const image = this.#graphics.getCachedRenderOrGeneratePlaceholder({
							pageNumber: pageNumber ?? 0,
							column: x + xOffset,
							row: y + yOffset,
						})

						rawEntries.push({ x, y, image })
					}
				}

				const transformedEntries = this.#transformButtonRenders(rawEntries)
				this.#drawButtons(transformedEntries)
			}
		}
	}

	/**
	 * Transform the coordinates of multiple images for a surface
	 */
	#transformButtonRenders(entries: DrawButtonItem[]): DrawButtonItem[] {
		return entries.map((entry) => {
			const [transformedX, transformedY] = rotateXYForPanel(
				entry.x,
				entry.y,
				this.panelGridSize,
				this.#surfaceConfig.config.rotation
			)

			return {
				x: transformedX,
				y: transformedY,
				image: entry.image,
			}
		})
	}

	/**
	 * Draw multiple images to a surface
	 */
	#drawButtons(entries: DrawButtonItem[]) {
		if (this.panel.drawMany) {
			this.panel.drawMany(entries)
		} else {
			for (const entry of entries) {
				this.panel.draw(entry.x, entry.y, entry.image)
			}
		}
	}

	/**
	 * Get the panel configuration
	 */
	getPanelConfig(): SurfacePanelConfig {
		return this.#surfaceConfig.config
	}

	/**
	 * Set the surface as locked
	 */
	setLocked(locked: boolean, skipDraw = false): void {
		// skip if surface can't be locked
		if (this.#surfaceConfig.config.never_lock && locked) return

		// If it changed, redraw
		if (this.#isSurfaceLocked != locked) {
			this.#isSurfaceLocked = !!locked

			this.#surfaces.emit('surface_locked', this.surfaceId, this.#isSurfaceLocked)

			if (!this.#isSurfaceLocked) this.#currentPincodeEntry = ''

			if (!skipDraw) {
				if (!this.#isSurfaceLocked && !!this.panel.setLocked) {
					this.panel.setLocked(false, this.#currentPincodeEntry.length)
				}

				this.#drawPageDebounced()
			}
		}
	}

	#onButtonDrawn = (location: ControlLocation, render: ImageResult): void => {
		// If surface is locked ignore updates. pincode updates are handled separately
		if (this.#isSurfaceLocked) return

		const pageNumber = this.#pageStore.getPageNumber(this.#currentPageId)
		if (location.pageNumber == pageNumber) {
			// normal mode
			const { xOffset, yOffset } = this.#getCurrentOffset()

			const rawEntries: DrawButtonItem[] = [
				{
					x: location.column - xOffset,
					y: location.row - yOffset,
					image: render,
				},
			]
			const transformedEntries = this.#transformButtonRenders(rawEntries)
			this.#drawButtons(transformedEntries)
		}
	}

	/**
	 * Set the brightness of the panel
	 * @param brightness 0-100
	 */
	setBrightness(brightness: number): void {
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

	/**
	 * Set the position offset of the surface
	 * @param xOffset
	 * @param yOffset
	 */
	setPosition(xOffset: number, yOffset: number): void {
		this.#surfaceConfig.config.xOffset = Math.floor(xOffset)
		this.#surfaceConfig.config.yOffset = Math.floor(yOffset)

		this.#saveConfig()
		this.triggerRedraw()
	}

	/**
	 * Adjust the position offset of the surface by a relative amount
	 * @param xAdjustment
	 * @param yAdjustment
	 */
	adjustPosition(xAdjustment: number, yAdjustment: number): void {
		const currentOffset = this.#getCurrentOffset()
		const newXOffset = currentOffset.xOffset + Math.floor(xAdjustment)
		const newYOffset = currentOffset.yOffset + Math.floor(yAdjustment)

		this.setPosition(newXOffset, newYOffset)
	}

	#onDeviceRemove() {
		if (!this.panel) return

		try {
			this.#surfaces.removeDevice(this.panel.info.devicePath)
		} catch (e) {
			this.#logger.error(`Remove failed: ${e}`)
		}
	}

	#onDeviceResized() {
		if (!this.panel) return

		this.#surfaceConfig.gridSize = this.panel.gridSize
		this.#saveConfig()

		this.#drawPage()
	}

	#onDeviceClick(x: number, y: number, pressed: boolean, pageOffset: number = 0): void {
		if (!this.panel) return

		const pageNumber = this.#pageStore.getPageNumber(this.#currentPageId)
		if (!pageNumber) return

		try {
			if (!this.#isSurfaceLocked) {
				this.emit('interaction')
				let location: ControlLocation

				// the key for saving button-press location, which has to refer to the physical button since that doesn't move between press and release
				const panelCoordinate = `${y}/${x}/${pageOffset}`

				const [x2, y2] = unrotateXYForPanel(x, y, this.panelGridSize, this.#surfaceConfig.config.rotation)
				const { xOffset, yOffset } = this.#getCurrentOffset()
				let thisPage = pageNumber

				// allow the xkeys (legacy mode) to span pages
				thisPage += pageOffset

				// loop after last page
				const pageCount = this.#pageStore.getPageCount()
				if (thisPage > pageCount) thisPage = 1

				location = {
					pageNumber: thisPage,
					column: x2 + xOffset,
					row: y2 + yOffset,
				}

				if (pressed) {
					// Map the physical key to the internal location, so button-release acts on the correct internal representation
					this.#currentButtonPresses.set(panelCoordinate, location)
				} else {
					// If released, use the same page/offset that was previously pressed, if available
					location = this.#currentButtonPresses.get(panelCoordinate) ?? location
					this.#currentButtonPresses.delete(panelCoordinate)
				}

				const controlId = this.#pageStore.getControlIdAt(location)
				if (controlId) {
					this.#controls.pressControl(controlId, pressed, this.surfaceId)
				}
				this.#logger.debug(
					`Button ${location.pageNumber}/${location.row}/${location.column} ${pressed ? 'pressed' : 'released'}`
				)
			} else if (!this.panel.setLocked) {
				if (pressed) {
					const pressCode = this.#pincodeNumberPositions.findIndex((pos) => pos[0] == x && pos[1] == y)
					if (pressCode !== -1) {
						this.#onDevicePincodeKey(pressCode)
					}
				}
			}
		} catch (e) {
			this.#logger.error(`Click failed: ${e}`)
		}
	}

	#onDeviceChangePage(forward: boolean): void {
		if (this.#isSurfaceLocked || !this.panel) return

		const pageNumber = this.#pageStore.getPageNumber(this.#currentPageId)
		if (!pageNumber) return
		const name = this.displayName

		try {
			this.#surfaces.devicePageSet(this.surfaceId, forward ? '+1' : '-1', true)
			this.#logger.debug(`Change page ${pageNumber}: ${forward ? 'forward' : 'backward'} initiated by ${name}`)
		} catch (e) {
			this.#logger.error(`Change page failed for ${name}: ${e}`)
		}
	}

	#onDeviceRotate(x: number, y: number, rightward: boolean, pageOffset?: number): void {
		if (!this.panel) return

		const pageNumber = this.#pageStore.getPageNumber(this.#currentPageId)
		if (!pageNumber) return

		try {
			if (!this.#isSurfaceLocked) {
				this.emit('interaction')

				const [x2, y2] = unrotateXYForPanel(x, y, this.panelGridSize, this.#surfaceConfig.config.rotation)

				// Translate key for offset
				const { xOffset, yOffset } = this.#getCurrentOffset()

				let thisPage = pageNumber

				// allow the xkeys (legacy mode) to span pages
				thisPage += pageOffset ?? 0
				// loop after last page
				const pageCount = this.#pageStore.getPageCount()
				if (thisPage > pageCount) thisPage = 1

				const controlId = this.#pageStore.getControlIdAt({
					pageNumber: thisPage,
					column: x2 + xOffset,
					row: y2 + yOffset,
				})
				if (controlId) {
					this.#controls.rotateControl(controlId, rightward, this.surfaceId)
				}
				this.#logger.debug(`Rotary ${thisPage}/${y2 + yOffset}/${x2 + xOffset} rotated ${rightward ? 'right' : 'left'}`)
			} else {
				// Ignore when locked out
			}
		} catch (e) {
			this.#logger.error(`Click failed: ${e}`)
		}
	}

	#onDevicePincodeKey(pressCode: number): void {
		if (!this.panel) return

		pressCode = Number(pressCode)
		if (isNaN(pressCode) || pressCode < 0 || pressCode > 9) throw new Error(`Invalid key: ${pressCode}`)

		this.#currentPincodeEntry += pressCode.toString()

		if (this.#currentPincodeEntry == this.#userconfig.getKey('pin').toString()) {
			this.#currentPincodeEntry = ''

			this.emit('unlocked')
		} else if (this.#currentPincodeEntry.length >= this.#userconfig.getKey('pin').toString().length) {
			this.#currentPincodeEntry = ''
		}

		if (!this.#isSurfaceLocked) return

		if (this.panel.setLocked !== undefined) {
			this.panel.setLocked(true, this.#currentPincodeEntry.length)
		} else {
			const datap = this.#graphics.getImagesForPincode(this.#currentPincodeEntry)

			this.#drawButtons([
				{
					x: this.#pincodeCodePosition[0],
					y: this.#pincodeCodePosition[1],
					image: datap.code,
				},
			])
		}
	}

	/**
	 * Set the value of a custom variable
	 */
	#onSetCustomVariable(name: string, value: CompanionVariableValue): void {
		this.#variables.custom.setValue(name, value)
	}

	/**
	 * Reset the config of this surface to defaults
	 */
	resetConfig(): void {
		this.#surfaceConfig.groupConfig = {
			...cloneDeep(SurfaceGroup.DefaultOptions),
			last_page_id: this.#pageStore.getFirstPageId(),
			startup_page_id: this.#pageStore.getFirstPageId(),
		}
		this.#surfaceConfig.groupId = null
		this.setPanelConfig(cloneDeep(PanelDefaults))
	}

	/**
	 * Trigger a save of the config
	 */
	#saveConfig() {
		this.emit('configUpdated', this.#surfaceConfig)
	}

	/**
	 * Get the 'SurfaceGroup' config for this surface, when run as an auto group
	 */
	getGroupConfig(): SurfaceGroupConfig {
		if (this.getGroupId()) throw new Error('Cannot retrieve the config from a non-auto surface')

		return this.#surfaceConfig.groupConfig
	}

	/**
	 * Get the full config blob for this surface
	 */
	getFullConfig(): SurfaceConfig {
		return this.#surfaceConfig
	}

	/**
	 * Set and save the 'SurfaceGroup' config for this surface, when run as an auto group
	 */
	saveGroupConfig(groupConfig: SurfaceGroupConfig): void {
		if (this.getGroupId()) throw new Error('Cannot save the config for a non-auto surface')

		this.#surfaceConfig.groupConfig = groupConfig
		this.#saveConfig()

		this.#updateEvents.emit(`groupConfig:${this.surfaceId}`, this.#surfaceConfig.groupConfig)
	}

	/**
	 * Update the panel configuration
	 */
	setPanelConfig(newconfig: SurfacePanelConfig): void {
		let redraw = false
		if (
			newconfig.xOffset != this.#surfaceConfig.config.xOffset ||
			newconfig.yOffset != this.#surfaceConfig.config.yOffset
		)
			redraw = true
		if (newconfig.rotation != this.#surfaceConfig.config.rotation) redraw = true

		if (newconfig.never_lock && newconfig.never_lock != this.#surfaceConfig.config.never_lock) {
			this.setLocked(false, true)
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
	 */
	setPanelName(newname: string): void {
		if (typeof newname === 'string') {
			this.#surfaceConfig.name = newname

			// update the logger
			this.#recreateLogger()

			// save it
			this.#saveConfig()

			this.#surfaces.emit('surface_name', this.surfaceId, this.#surfaceConfig.name)
		}
	}

	/**
	 * Update to a new page number
	 */
	storeNewDevicePage(newPageId: string, defer = false): void {
		this.#currentPageId = newPageId

		this.#surfaces.emit('surface_page', this.surfaceId, newPageId)

		this.triggerRedraw(defer)
	}

	/**
	 * Trigger a redraw of this surface
	 */
	triggerRedraw(defer = false): void {
		if (defer) {
			this.#drawPageDebounced()
		} else {
			this.#drawPage()
		}
	}

	/**
	 * Unload this surface handler
	 * @param purge Purge the configuration
	 */
	unload(purge = false): void {
		this.#logger.error(this.panel.info.type + ' disconnected')
		this.#logger.silly('unloading for ' + this.panel.info.devicePath)
		this.#graphics.off('button_drawn', this.#onButtonDrawn)

		try {
			this.panel.quit()
		} catch (e) {
			this.#logger.silly('Error quitting panel', e)
		}

		// Fetch the surfaceId before destroying the panel
		const surfaceId = this.surfaceId

		// delete this.panel.device
		// delete this.panel

		if (purge && surfaceId) {
			this.emit('configUpdated', undefined)
		}
	}
}
