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

import GraphicsRenderer from './Renderer.js'
import CoreBase from '../Core/Base.js'

class GraphicsController extends CoreBase {
	constructor(registry) {
		super(registry, 'graphics', 'lib/Graphics/Controller')

		this.draw_options = {
			page_direction_flipped: this.userconfig.getKey('page_direction_flipped'),
			page_plusminus: this.userconfig.getKey('page_plusminus'),
			remove_topbar: this.userconfig.getKey('remove_topbar'),
		}

		this.renders = {}
	}

	/**
	 * Redraw the page controls on every page
	 */
	invalidatePageControls() {
		for (let page = 1; page <= 99; page++) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
				const style = this.renders[page + '_' + bank]?.style
				if (style == 'pageup' || style == 'pagedown') {
					this.invalidateBank(page, bank)
				}
			}
		}
	}
	/**
	 * Redraw the page number control on the specified page
	 * @param {number} page
	 */
	invalidatePageNumberControls(page) {
		if (page) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
				const style = this.renders[page + '_' + bank]?.style
				if (style == 'pagenum') {
					this.invalidateBank(page, bank)
				}
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('graphics_preview_generate', (config, answer) => {
			const res = GraphicsRenderer.drawBankImage(this.draw_options, config)
			if (res) {
				answer(res.buffer)
			} else {
				answer(null)
			}
		})
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
			this.debug('Topbar removed')
			// Delay redrawing to give instances a chance to adjust
			setTimeout(() => {
				this.instance.moduleHost.resubscribeAllFeedbacks()
				this.regenerateAll(true)
			}, 1000)
		}
	}

	invalidateBank(page, bank) {
		this.#drawAndCacheBank(page, bank)

		this.emit('bank_invalidated', page, bank)
	}

	/**
	 * Regenerate every bank image
	 * @param {boolean} invalidate whether to report invalidations of each bank
	 * @access private
	 */
	regenerateAll(invalidate) {
		for (let page = 1; page <= 99; page++) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				this.#drawAndCacheBank(page, bank)

				if (invalidate) {
					this.emit('bank_invalidated', page, bank)
				}
			}
		}

		this.emit('all_invalidated')
	}

	#drawAndCacheBank(page, bank) {
		page = parseInt(page)
		bank = parseInt(bank)

		const imageId = page !== undefined && bank !== undefined ? `${page}_${bank}` : undefined

		const buttonStyle = this.bank.getBankCompleteStyle(page, bank)
		if (buttonStyle && buttonStyle.style) {
			const pagename = page !== undefined ? this.page.getPageName(page) : undefined

			if (buttonStyle.show_topbar === 'default' || buttonStyle.show_topbar === undefined) {
				buttonStyle.show_topbar = !this.draw_options.remove_topbar
			}

			const render = GraphicsRenderer.drawBankImage(this.draw_options, buttonStyle, page, bank, pagename)
			this.renders[imageId] = render

			this.system.emit('graphics_set_bank_bg', page, bank, render.style?.bgcolor ?? 0)

			return render
		} else {
			const render = GraphicsRenderer.drawBlank(this.draw_options, page, bank)

			this.renders[imageId] = render

			return render
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

	getBank(page, bank) {
		let render = this.renders[page + '_' + bank]
		if (render) return render

		render = this.#drawAndCacheBank(page, bank)
		if (render) return render

		this.debug('!!!! ERROR: UNEXPECTED ERROR while fetching image for unbuffered bank: ' + page + '.' + bank)

		// continue gracefully, even though something is terribly wrong
		return {
			buffer: Buffer.alloc(72 * 72 * 3),
			updated: Date.now(),
		}
	}
}

export default GraphicsController
