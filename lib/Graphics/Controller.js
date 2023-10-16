// @ts-check
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
import { ImageResult } from './ImageResult.js'

/**
 * @typedef {{
 *   page_direction_flipped: boolean,
 *   page_plusminus: boolean, 
 *   remove_topbar: boolean
 * }} GraphicsOptions
 */

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
		super(registry, 'graphics', 'Graphics/Controller')

		this.#drawOptions = {
			page_direction_flipped: this.userconfig.getKey('page_direction_flipped'),
			page_plusminus: this.userconfig.getKey('page_plusminus'),
			remove_topbar: this.userconfig.getKey('remove_topbar'),
		}

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
	 * @param {object} buttonConfig
	 */
	drawPreview(buttonConfig) {
		return GraphicsRenderer.drawBankImage(this.#drawOptions, buttonConfig, undefined, undefined)
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
			// Delay redrawing to give instances a chance to adjust
			setTimeout(() => {
				this.instance.moduleHost.resubscribeAllFeedbacks()
				this.regenerateAll(true)
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
		this.#drawAndCacheButton(location, true)
	}

	/**
	 * Regenerate every button image
	 * @param {boolean} emitInvalidation whether to report invalidations of each button
	 * @access private
	 */
	regenerateAll(emitInvalidation) {
		for (let pageNumber = 1; pageNumber <= 99; pageNumber++) {
			const populatedLocations = this.page.getAllPopulatedLocationsOnPage(pageNumber)
			for (const location of populatedLocations) {
				this.#drawAndCacheButton(location, emitInvalidation)
			}
		}
	}

	/**
	 * Generate and cache
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @param {boolean} emitInvalidation
	 * @returns
	 */
	#drawAndCacheButton(location, emitInvalidation) {
		const gridSize = this.userconfig.getKey('gridSize')
		const locationIsInBounds =
			location &&
			gridSize &&
			location.column <= gridSize.maxColumn &&
			location.column >= gridSize.minColumn &&
			location.row <= gridSize.maxRow &&
			location.row >= gridSize.minRow

		const controlId = this.page.getControlIdAt(location)
		const control = controlId && this.controls.getControl(controlId)
		const buttonStyle = control?.getDrawStyle?.()

		/** @type {ImageResult | undefined} */
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
				render = GraphicsRenderer.drawBankImage(this.#drawOptions, buttonStyle, location, pagename)
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

		if (emitInvalidation) {
			this.emit('button_drawn', location, render)
		}

		return render
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
	 * Get Button render at location
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @returns {ImageResult}
	 */
	getBank(location) {
		let render = this.#renderCache.get(location.pageNumber)?.get(location.row)?.get(location.column)
		if (render) return render

		render = this.#drawAndCacheButton(location, true)
		if (render) {
			this.emit('button_drawn', location, render)
			return render
		}

		this.logger.silly(
			`!!!! ERROR: UNEXPECTED ERROR while fetching image for unbuffered button: ${formatLocation(location)}`
		)

		// continue gracefully, even though something is terribly wrong
		return new ImageResult(Buffer.alloc(72 * 72 * 3), undefined)
	}
}

export default GraphicsController

/**
 * @typedef {{
 *   code: ImageResult
 *   [index: number]: ImageResult
 * }} PincodeBitmaps
 */
