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

class GraphicsController extends CoreBase {
	constructor(registry) {
		super(registry, 'graphics', 'Graphics/Controller')

		this.draw_options = {
			page_direction_flipped: this.userconfig.getKey('page_direction_flipped'),
			page_plusminus: this.userconfig.getKey('page_plusminus'),
			remove_topbar: this.userconfig.getKey('remove_topbar'),
		}

		this.renders = {}
		this.renderCache = new LRUCache({ max: 100 })

		FontLibrary.reset()
		let companionFonts = FontLibrary.use({
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
	 * Draw a preview of a bank
	 * @param {object} bankConfig
	 */
	drawPreview(bankConfig) {
		return GraphicsRenderer.drawBankImage(this.draw_options, bankConfig)
	}

	/**
	 * Process an updated userconfig value and update as necessary.
	 * @param {string} key - the saved key
	 * @param {(boolean|number|string)} value - the saved value
	 * @access public
	 */
	updateUserConfig(key, value) {
		if (key == 'page_direction_flipped') {
			this.draw_options.page_direction_flipped = value
			this.invalidatePageControls()
		} else if (key == 'page_plusminus') {
			this.draw_options.page_plusminus = value
			this.invalidatePageControls()
		} else if (key == 'remove_topbar') {
			this.draw_options.remove_topbar = value
			this.logger.silly('Topbar removed')
			// Delay redrawing to give instances a chance to adjust
			setTimeout(() => {
				this.instance.moduleHost.resubscribeAllFeedbacks()
				this.regenerateAll(true)
			}, 1000)
		}
	}

	invalidateControl(controlId) {
		const location = this.page.getLocationOfControlId(controlId)
		if (location) {
			this.invalidateBank(location)
		}
	}

	invalidateBank(location) {
		const render = this.#drawAndCacheBank(location)

		this.emit('button_drawn', location, render)
	}

	/**
	 * Regenerate every bank image
	 * @param {boolean} invalidate whether to report invalidations of each bank
	 * @access private
	 */
	regenerateAll(invalidate) {
		for (let pageNumber = 1; pageNumber <= 99; pageNumber++) {
			const populatedLocations = this.page.getAllPopulatedLocationsOnPage(pageNumber)
			for (const location of populatedLocations) {
				const render = this.#drawAndCacheBank(location)

				if (invalidate) {
					this.emit('button_drawn', location, render)
				}
			}
		}
	}

	#drawAndCacheBank(location) {
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

					const bank = xyToOldBankIndex(location.column, location.row)
					if (bank) values[`b_text_${location.pageNumber}_${bank}`] = variableValue

					this.instance.variable.setVariableValues('internal', values)
				})
			}

			const pagename = this.page.getPageName(location.pageNumber)

			// Check if the image is already present in the render cache and if so, return it
			const globalShowTopBar = !this.draw_options.remove_topbar && buttonStyle.show_topbar === 'default'
			const keyLocation = globalShowTopBar || buttonStyle.show_topbar === true ? location : undefined
			const key = JSON.stringify({ options: this.draw_options, buttonStyle, keyLocation, pagename })
			render = this.renderCache.get(key)

			if (!render) {
				render = GraphicsRenderer.drawBankImage(this.draw_options, buttonStyle, location, pagename)
			}
		} else {
			render = GraphicsRenderer.drawBlank(this.draw_options, location)
		}

		// Only cache the render, if it is within the valid bounds
		if (locationIsInBounds && location) {
			if (!this.renders[location.pageNumber]) this.renders[location.pageNumber] = {}
			if (!this.renders[location.pageNumber][location.row]) this.renders[location.pageNumber][location.row] = {}
			this.renders[location.pageNumber][location.row][location.column] = render
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

		for (const page of Object.values(this.renders)) {
			for (const row of Object.keys(page)) {
				const rowObj = page[row]
				if (!rowObj) continue

				if (row < minRow || row > maxRow) {
					// Row is out of bounds, delete it all
					delete page[row]
				} else {
					for (const column of Object.keys(rowObj)) {
						if (column < minColumn || column > maxColumn) {
							// Column is out of bounds
							delete rowObj[column]
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

	getBank(location) {
		let render = this.renders[location.pageNumber]?.[location.row]?.[location.column]
		if (render) return render

		render = this.#drawAndCacheBank(location)
		if (render) {
			this.emit('button_drawn', location, render)
			return render
		}

		this.logger.silly(
			`!!!! ERROR: UNEXPECTED ERROR while fetching image for unbuffered bank: ${formatLocation(location)}`
		)

		// continue gracefully, even though something is terribly wrong
		return new ImageResult(Buffer.alloc(72 * 72 * 3))
	}
}

export default GraphicsController
