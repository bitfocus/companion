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
import { GlobalFonts } from '@napi-rs/canvas'
import GraphicsRenderer from './Renderer.js'
import CoreBase from '../Core/Base.js'
import { xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import { ImageResult } from './ImageResult.js'
import ImageWriteQueue from '../Resources/ImageWriteQueue.js'
import workerPool from 'workerpool'
import { isPackaged } from '../Resources/Util.js'
import { fileURLToPath } from 'url'
import path from 'path'

const CRASHED_WORKER_RETRY_COUNT = 10

/**
 * @typedef {{
 *   page_direction_flipped: boolean,
 *   page_plusminus: boolean,
 *   remove_topbar: boolean
 * }} GraphicsOptions
 */

/**
 *
 * @param {string} fontFilename
 * @returns {string}
 */
function generateFontUrl(fontFilename) {
	if (isPackaged()) {
		return path.join(__dirname, 'assets/Fonts', fontFilename)
	} else {
		return fileURLToPath(new URL(path.join('../../../assets/Fonts', fontFilename), import.meta.url))
	}
}

class GraphicsController extends CoreBase {
	/**
	 * Cached UserConfig values that affect button rendering
	 * @access private
	 * @type {GraphicsOptions}
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
	 * @type {LRUCache<string, ImageResult>}
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
				return undefined
			},
			onTerminateWorker: () => {
				this.logger.info('Render worker terminated')
			},
		}
	)

	/**
	 * Generated pincode bitmaps
	 * @type {Omit<PincodeBitmaps, 'code'> | null}
	 * @access private
	 */
	#pincodeBuffersCache

	/**
	 * @param {import('../Registry.js').default} registry
	 */
	constructor(registry) {
		super(registry, 'Graphics/Controller')

		this.setMaxListeners(0)

		this.#drawOptions = {
			page_direction_flipped: this.userconfig.getKey('page_direction_flipped'),
			page_plusminus: this.userconfig.getKey('page_plusminus'),
			remove_topbar: this.userconfig.getKey('remove_topbar'),
		}

		this.#renderQueue = new ImageWriteQueue(
			this.logger,
			/**
			 * @param {string} _id
			 * @param {import('../Resources/Util.js').ControlLocation} location
			 * @param {boolean} skipInvalidation
			 */
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
					const control = controlId ? this.controls.getControl(controlId) : undefined
					const buttonStyle = control?.getDrawStyle() ?? undefined

					if (location && locationIsInBounds) {
						// Update the internal b_text_1_4 variable
						setImmediate(() => {
							/** @type {import('@companion-module/base').CompanionVariableValues} */
							const values = {}

							// Update text, if it is present
							values[`b_text_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' ? buttonStyle.text : undefined
							const bankIndex = xyToOldBankIndex(location.column, location.row)
							if (bankIndex)
								values[`b_text_${location.pageNumber}_${bankIndex}`] =
									buttonStyle?.style === 'button' ? buttonStyle.text : undefined

							// Update step
							values[`b_step_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' ? (buttonStyle.step_cycle ?? 1) : undefined

							this.variablesController.values.setVariableValues('internal', values)
						})
					}

					let render
					if (location && locationIsInBounds && buttonStyle && buttonStyle.style) {
						const pagename = this.page.getPageName(location.pageNumber)

						// Check if the image is already present in the render cache and if so, return it
						/** @type {import('../Resources/Util.js').ControlLocation | undefined} */
						let keyLocation
						if (buttonStyle.style === 'button') {
							const globalShowTopBar = !this.#drawOptions.remove_topbar && buttonStyle.show_topbar === 'default'
							keyLocation = globalShowTopBar || buttonStyle.show_topbar === true ? location : undefined
						}
						const key = JSON.stringify({ options: this.#drawOptions, buttonStyle, keyLocation, pagename })
						render = this.#renderLRUCache.get(key)

						if (!render) {
							const { buffer, width, height, dataUrl, draw_style } = await this.#executePoolDrawButtonImage(
								buttonStyle,
								location,
								pagename,
								CRASHED_WORKER_RETRY_COUNT
							)
							render = GraphicsRenderer.wrapDrawButtonImage(buffer, width, height, dataUrl, draw_style, buttonStyle)
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
					this.logger.warn(`drawButtonImage failed: ${e}`)
				}
			},
			5
		) // TODO - dynamic limit

		this.logger.info('Loading fonts')

		GlobalFonts.registerFromPath(generateFontUrl('Arimo-Regular.ttf'), 'Companion-sans')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansMono-wdth-wght.ttf'), 'Companion-mono')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansSymbols-wght.ttf'), 'Companion-symbols1')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansSymbols2-Regular.ttf'), 'Companion-symbols2')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansMath-Regular.ttf'), 'Companion-symbols3')
		GlobalFonts.registerFromPath(generateFontUrl('NotoMusic-Regular.ttf'), 'Companion-symbols4')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansLinearA-Regular.ttf'), 'Companion-symbols5')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansLinearB-Regular.ttf'), 'Companion-symbols6')
		GlobalFonts.registerFromPath(generateFontUrl('NotoColorEmoji-compat.ttf'), 'Companion-emoji')
		GlobalFonts.registerFromPath(generateFontUrl('pf_tempesta_seven.ttf'), '5x7')

		this.logger.info('Fonts loaded')
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
	 * @param {import('@companion-module/base').CompanionButtonStyleProps & {style: 'button'}} buttonStyle
	 * @returns {Promise<ImageResult>}
	 */
	async drawPreview(buttonStyle) {
		/** @type {import('@companion-app/shared/Model/StyleModel.js').DrawStyleModel} */
		const drawStyle = {
			...buttonStyle,

			textExpression: false,

			imageBuffers: [],
			pushed: false,
			cloud: false,
			cloud_error: false,
			button_status: undefined,
			step_cycle: undefined,
			action_running: false,

			show_topbar: buttonStyle.show_topbar,
			alignment: buttonStyle.alignment ?? 'center:center',
			pngalignment: buttonStyle.pngalignment ?? 'center:center',
			png64: buttonStyle.png64 ?? null,
			size: buttonStyle.size === 'auto' ? 'auto' : Number(buttonStyle.size),
		}

		const { buffer, width, height, dataUrl, draw_style } = await this.#executePoolDrawButtonImage(
			drawStyle,
			undefined,
			undefined,
			CRASHED_WORKER_RETRY_COUNT
		)
		return GraphicsRenderer.wrapDrawButtonImage(buffer, width, height, dataUrl, draw_style, drawStyle)
	}

	/**
	 * Process an updated userconfig value and update as necessary.
	 * @param {string} key - the saved key
	 * @param {(boolean|number|string)} value - the saved value
	 * @access public
	 */
	updateUserConfig(key, value) {
		if (key == 'page_direction_flipped') {
			this.#drawOptions.page_direction_flipped = !!value
			this.invalidatePageControls()
		} else if (key == 'page_plusminus') {
			this.#drawOptions.page_plusminus = !!value
			this.invalidatePageControls()
		} else if (key == 'remove_topbar') {
			this.#drawOptions.remove_topbar = !!value
			this.logger.silly('Topbar removed')
			// Delay redrawing to give connections a chance to adjust
			setTimeout(() => {
				this.instance.moduleHost.resubscribeAllFeedbacks()
				this.regenerateAll(false)
			}, 1000)
		}
	}

	/**
	 * Regenerate the render of a control
	 * @param {string} controlId
	 * @returns {void}
	 */
	invalidateControl(controlId) {
		const location = this.page.getLocationOfControlId(controlId)
		if (location) {
			this.invalidateButton(location)
		}
	}

	/**
	 * Regenerate the render of a button at a location
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @returns {void}
	 */
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

	/**
	 * Generate and cache
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @param {boolean} skipInvalidation
	 * @returns {void}
	 */
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

	/**
	 * Generate pincode images
	 * @param {string} pincode
	 * @returns {PincodeBitmaps}
	 */
	getImagesForPincode(pincode) {
		if (!this.#pincodeBuffersCache) {
			this.#pincodeBuffersCache = {}

			for (let i = 0; i < 10; i++) {
				this.#pincodeBuffersCache[i] = GraphicsRenderer.drawPincodeNumber(i)
			}
		}

		return {
			...this.#pincodeBuffersCache,
			code: GraphicsRenderer.drawPincodeEntry(pincode),
		}
	}

	/**
	 * Get the cached render of a button
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @returns {ImageResult | undefined}
	 */
	getCachedRender(location) {
		return this.#renderCache.get(location.pageNumber)?.get(location.row)?.get(location.column)
	}

	/**
	 * Get the cached render of a button, or generate a placeholder it if is missing
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @returns {ImageResult}
	 */
	getCachedRenderOrGeneratePlaceholder(location) {
		const render = this.#renderCache.get(location.pageNumber)?.get(location.row)?.get(location.column)
		if (render) return render

		return GraphicsRenderer.drawBlank(this.#drawOptions, location)
	}

	/**
	 * Draw a button image in the worker pool
	 * @param {import('@companion-app/shared/Model/StyleModel.js').DrawStyleModel} drawStyle The style to draw
	 * @param {import('../Resources/Util.js').ControlLocation | undefined} location
	 * @param {string | undefined} pagename
	 * @param {number} remainingAttempts
	 * @returns {Promise<{ buffer: Buffer, width: number, height: number, dataUrl: string, draw_style: import('@companion-app/shared/Model/StyleModel.js').DrawStyleModel['style'] | undefined}>} Image render object
	 */
	async #executePoolDrawButtonImage(drawStyle, location, pagename, remainingAttempts) {
		try {
			return this.#pool.exec('drawButtonImage', [this.#drawOptions, drawStyle, location, pagename])
		} catch (/** @type {any} */ e) {
			// if a worker crashes, the first attempt will fail, retry when that happens, but not infinitely
			if (remainingAttempts > 1 && e?.message?.includes('Worker is terminated')) {
				return this.#executePoolDrawButtonImage(drawStyle, location, pagename, remainingAttempts - 1)
			} else {
				throw e
			}
		}
	}
}

export default GraphicsController

/**
 * @typedef {{
 *   code: ImageResult
 *   [index: number]: ImageResult
 * }} PincodeBitmaps
 */
