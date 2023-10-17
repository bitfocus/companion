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

import { LRUCache } from 'lru-cache'
import { FontLibrary } from '@julusian/skia-canvas'
import GraphicsRenderer from './Renderer.js'
import CoreBase from '../Core/Base.js'
import { formatLocation, xyToOldBankIndex } from '../Shared/ControlId.js'
import { ImageResult } from './ImageWrapper.js'
import ImageWriteQueue from '../Resources/ImageWriteQueue.js'
import workerPool from 'workerpool'
import { isPackaged } from '../Resources/Util.js'
import { fileURLToPath } from 'url'
import path from 'path'

class GraphicsController extends CoreBase {
	/**
	 * Cached UserConfig values that affect button rendering
	 * @access private
	 * @type {{ page_direction_flipped: boolean, page_plusminus: boolean, remove_topbar: boolean}}
	 */
	#drawOptions

	/**
	 * Current button renders cache
	 * @access private
	 * @type {Map<number, Map<number, Map<number, ImageResult>>>}
	 */
	#renderCache = new Map()

	/**
	 * Last recently used cache for button renders
	 * @access private
	 */
	#renderLRUCache = new LRUCache({ max: 100 })

	#renderQueue

	#pool = workerPool.pool(
		isPackaged() ? path.join(__dirname, './RenderThread.js') : fileURLToPath(new URL('./Thread.js', import.meta.url)),
		{
			minWorkers: 2,
			maxWorkers: 6,
			workerType: 'thread',
			onCreateWorker: () => {
				this.logger.info('Render worker created')
			},
			onTerminateWorker: () => {
				this.logger.info('Render worker terminated')
			},
		}
	)

	constructor(registry) {
		super(registry, 'graphics', 'Graphics/Controller')

		this.#drawOptions = {
			page_direction_flipped: this.userconfig.getKey('page_direction_flipped'),
			page_plusminus: this.userconfig.getKey('page_plusminus'),
			remove_topbar: this.userconfig.getKey('remove_topbar'),
		}

		this.#renderQueue = new ImageWriteQueue(
			this.logger,
			async (_id, location, skipInvalidation) => {
				try {
					const gridSize = this.userconfig.getKey('gridSize')
					const locationIsInBounds =
						location &&
						gridSize &&
						location.column <= gridSize.maxColumn &&
						location.column >= gridSize.minColumn &&
						location.row <= gridSize.maxRow &&
						location.row >= gridSize.minRow

					const controlId = this.page.getControlIdAt(location)
					const control = this.controls.getControl(controlId)
					const buttonStyle = control?.getDrawStyle?.()

					let render
					if (location && locationIsInBounds && buttonStyle && buttonStyle.style) {
						// Update the internal b_text_1_4 variable
						const variableValue = buttonStyle?.text
						if (location) {
							setImmediate(() => {
								const values = {
									[`b_text_${location.pageNumber}_${location.row}_${location.column}`]: variableValue,
								}

								const bankIndex = xyToOldBankIndex(location.column, location.row)
								if (bankIndex) values[`b_text_${location.pageNumber}_${bankIndex}`] = variableValue

								this.instance.variable.setVariableValues('internal', values)
							})
						}

						const pagename = this.page.getPageName(location.pageNumber)

						// Check if the image is already present in the render cache and if so, return it
						const globalShowTopBar = !this.#drawOptions.remove_topbar && buttonStyle.show_topbar === 'default'
						const keyLocation = globalShowTopBar || buttonStyle.show_topbar === true ? location : undefined
						const key = JSON.stringify({ options: this.#drawOptions, buttonStyle, keyLocation, pagename })
						render = this.#renderLRUCache.get(key)

						if (!render) {
							const { buffer, draw_style } = await this.#pool.exec('drawBankImage', [
								this.#drawOptions,
								buttonStyle,
								location,
								pagename,
							])
							render = GraphicsRenderer.wrapDrawBankImage(buffer, draw_style, buttonStyle)
						}
					} else {
						render = GraphicsRenderer.drawBlank(this.#drawOptions, location)
					}

					// Only cache the render, if it is within the valid bounds
					if (locationIsInBounds && location) {
						let pageCache = this.#renderCache.get(location.pageNumber)
						if (!pageCache) {
							pageCache = new Map()
							this.#renderCache.set(location.pageNumber, pageCache)
						}

						let rowCache = pageCache.get(location.row)
						if (!rowCache) {
							rowCache = new Map()
							pageCache.set(location.row, rowCache)
						}

						rowCache.set(location.column, render)
					}

					if (!skipInvalidation) {
						this.emit('button_drawn', location, render)
					}
				} catch (e) {
					this.logger.warn(`drawBankImage failed: ${e}`)
				}
			},
			5
		) // TODO - dynamic limit

		FontLibrary.reset()
		FontLibrary.use({
			'Companion-sans': ['assets/Fonts/Arimo-Regular.ttf'],
			'Companion-mono': ['assets/Fonts/NotoSansMono-wdth-wght.ttf'],
			'Companion-symbols': [
				'assets/Fonts/NotoSansSymbols-wght.ttf',
				'assets/Fonts/NotoSansSymbols2-Regular.ttf',
				'assets/Fonts/NotoSansMath-Regular.ttf',
				'assets/Fonts/NotoMusic-Regular.ttf',
				'assets/Fonts/NotoSansLinearA-Regular.ttf',
				'assets/Fonts/NotoSansLinearB-Regular.ttf',
			],
			'Companion-emoji': ['assets/Fonts/NotoColorEmoji-compat.ttf'],
			'5x7': ['assets/Fonts/pf_tempesta_seven.ttf'],
		})
		this.fonts = FontLibrary.families
	}

	/**
	 * Redraw the page controls on every page
	 */
	invalidatePageControls() {
		const allControls = this.controls.getAllControls()
		for (const control of Object.values(allControls)) {
			if (control.type === 'pageup' || control.type === 'pagedown') {
				this.invalidateControl(control.controlId)
			}
		}
	}

	/**
	 * Draw a preview of a button
	 * @param {object} buttonStyle
	 */
	async drawPreview(buttonStyle) {
		const { buffer, draw_style } = await this.#pool.exec('drawBankImage', [this.#drawOptions, buttonStyle])
		return GraphicsRenderer.wrapDrawBankImage(buffer, draw_style, buttonStyle)
	}

	/**
	 * Process an updated userconfig value and update as necessary.
	 * @param {string} key - the saved key
	 * @param {(boolean|number|string)} value - the saved value
	 * @access public
	 */
	updateUserConfig(key, value) {
		if (key == 'page_direction_flipped') {
			this.#drawOptions.page_direction_flipped = value
			this.invalidatePageControls()
		} else if (key == 'page_plusminus') {
			this.#drawOptions.page_plusminus = value
			this.invalidatePageControls()
		} else if (key == 'remove_topbar') {
			this.#drawOptions.remove_topbar = value
			this.logger.silly('Topbar removed')
			// Delay redrawing to give instances a chance to adjust
			setTimeout(() => {
				this.instance.moduleHost.resubscribeAllFeedbacks()
				this.regenerateAll(false)
			}, 1000)
		}
	}

	invalidateControl(controlId) {
		const location = this.page.getLocationOfControlId(controlId)
		if (location) {
			this.invalidateButton(location)
		}
	}

	invalidateButton(location) {
		this.#drawAndCacheButton(location)
	}

	/**
	 * Regenerate every button image
	 * @param {boolean=} skipInvalidation whether to skip reporting invalidations of each button
	 * @access private
	 */
	regenerateAll(skipInvalidation = false) {
		for (let pageNumber = 1; pageNumber <= 99; pageNumber++) {
			const populatedLocations = this.page.getAllPopulatedLocationsOnPage(pageNumber)
			for (const location of populatedLocations) {
				this.#drawAndCacheButton(location, skipInvalidation)
			}
		}
	}

	#drawAndCacheButton(location, skipInvalidation = false) {
		const id = `${location.pageNumber}_${location.row}_${location.column}`
		this.#renderQueue.queue(id, location, skipInvalidation)
	}

	/**
	 * Discard any renders for controls that are outside of the valid grid bounds
	 * @returns
	 * @access public
	 */
	discardAllOutOfBoundsControls() {
		const { minColumn, maxColumn, minRow, maxRow } = this.userconfig.getKey('gridSize')

		for (const page of this.#renderCache.values()) {
			for (const row of page.keys()) {
				const rowObj = page.get(row)
				if (!rowObj) continue

				if (row < minRow || row > maxRow) {
					// Row is out of bounds, delete it all
					page.delete(row)
				} else {
					for (const column of rowObj.keys()) {
						if (column < minColumn || column > maxColumn) {
							// Column is out of bounds
							rowObj.delete(column)
						}
					}
				}
			}
		}
	}

	getImagesForPincode(pincode) {
		if (!this.pincodebuffers) {
			this.pincodebuffers = {}

			for (let i = 0; i < 10; i++) {
				this.pincodebuffers[i] = GraphicsRenderer.drawPincodeNumber(i)
			}
		}

		return {
			...this.pincodebuffers,
			code: GraphicsRenderer.drawPincodeEntry(pincode),
		}
	}

	/**
	 * Get the cached render of a button
	 * @param {object} location
	 * @returns
	 */
	getCachedRender(location) {
		return this.#renderCache.get(location.pageNumber)?.get(location.row)?.get(location.column)
	}

	/**
	 * Get the cached render of a button, or generate a placeholder it if is missing
	 * @param {object} location
	 * @returns
	 */
	getCachedRenderOrGeneratePlaceholder(location) {
		const render = this.#renderCache.get(location.pageNumber)?.get(location.row)?.get(location.column)
		if (render) return render

		return GraphicsRenderer.drawBlank(this.#drawOptions, location)
	}
}

export default GraphicsController
