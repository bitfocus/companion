import { sendResult } from '../Resources/Util.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'

/**
 * The class that manages bank preview generation/relay for interfaces
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.9
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class GraphicsPreview extends CoreBase {
	/**
	 * This stored client sockets
	 * @type {Array<string, Socket>}
	 * @access protected
	 */
	clients = {}

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'preview', 'lib/Graphics/Preview')

		this.graphics.on('bank_invalidated', this.updateBank.bind(this))
	}

	/**
	 * Setup a client's calls
	 * @param {Socket} client - the client connection
	 * @access public
	 */
	clientConnect(client) {
		this.clients[client.id] = client

		client._previewHandler = this.handlePreview.bind(this, client)
		client.on('bank_preview', client._previewHandler)

		client._previewPageHandler = this.handlePreviewPage.bind(this, client)
		client.on('bank_preview_page', client._previewPageHandler)

		client._webButtonsHandler = this.handleWebButtons.bind(this, client)
		client.on('web_buttons', client._webButtonsHandler)

		client._webButtonsPageHandler = this.handleWebButtonsPage.bind(this, client)
		client.on('web_buttons_page', client._webButtonsPageHandler)

		client.on('disconnect', () => {
			delete this.clients[client.id]
		})
	}

	/**
	 * Locate on a given page an page control bank types
	 * @param {number} index - the page ID
	 * @param {Object} page - the page object
	 * @returns {Object} extended page information for any page control bank types
	 * @access protected
	 */
	getExtendedPageInfo(index, page) {
		const newPage = {
			...page,
			pagenum: [],
			pageup: [],
			pagedown: [],
		}

		let pageBanks = this.bank.getPageBanks(page)

		for (const bank in pageBanks) {
			const info = pageBanks[bank]
			if (info) {
				switch (info.style) {
					case 'pageup':
						newPage.pageup.push(bank)
						break
					case 'pagenum':
						newPage.pagenum.push(bank)
						break
					case 'pagedown':
						newPage.pagedown.push(bank)
						break
				}
			}
		}

		return newPage
	}

	/**
	 * Generate an edit bank preview
	 * @param {Socket} client - the client connection
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @access protected
	 */
	handlePreview(client, page, bank) {
		this.logger.silly('handlePreview()', page, bank)

		if (page === false) {
			this.logger.silly('client ' + client.id + ' removed preview listener')
			client._preview = undefined
			return
		}
		this.logger.silly('socket ' + client.id + ' added preview listener for ' + page + ', ' + bank)

		client._preview = { page: page, bank: bank }

		let img = this.graphics.getBank(page, bank)
		client.emit('preview_bank_data', page, bank, img.buffer, img.updated)
	}

	/**
	 * Send updated previews to the client for page edit
	 * @param {Socket} client - the client connection
	 * @param {number} page - the page number
	 * @param {Object} cache - last update information from the UI
	 * @access protected
	 */
	handlePreviewPage(client, page, cache) {
		let result = {}

		client._previewPage = page

		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			const image = this.graphics.getBank(page, i + 1)
			if (cache === undefined || cache[i + 1] === undefined || cache[i + 1] != image.updated) {
				result[i + 1] = image
			}
		}

		client.emit('preview_page_data', result)
	}

	/**
	 * Get all the pages for web buttons
	 * @param {Socket} client - the client connection
	 * @param {?function} answer - the response function to the UI
	 * @access protected
	 */
	handleWebButtons(client, answer) {
		this.logger.silly('handleWebButtons()')

		const pages = this.page.getAll(true)
		for (const id in pages) {
			pages[id] = this.getExtendedPageInfo(id, pages[id])
		}

		client.web_buttons = 1
		sendResult(client, answer, 'pages', pages)
	}

	/**
	 * Get a page for web buttons
	 * @param {Socket} client - the client connection
	 * @param {number} page - the page number
	 * @param {Object} cache - last update information from the UI
	 * @param {?function} answer - the response function to the UI
	 * @access protected
	 */
	handleWebButtonsPage(client, page, cache, answer) {
		this.logger.silly('handleWebButtonsPage()', page)

		let result = {}

		if (cache === null) {
			return
		}

		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			const image = this.graphics.getBank(page, i + 1)
			if (cache === undefined || cache[i + 1] === undefined || cache[i + 1] != image.updated) {
				result[i + 1] = image
			}
		}

		sendResult(client, answer, 'buttons_page_data', page, result)
	}

	/**
	 * Send a bank update to the UIs
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @access public
	 */
	updateBank(page, bank, render) {
		for (const key in this.clients) {
			let client = this.clients[key]

			if (client._preview !== undefined) {
				if (client._preview.page == page && client._preview.bank == bank) {
					client.emit('preview_bank_data', page, bank, render.buffer, render.updated)
				}
			}

			if (client.web_buttons) {
				let result = {}
				result[bank] = render

				client.emit('buttons_bank_data', page, result)
			} else if (client._previewPage !== undefined) {
				if (client._previewPage == page) {
					let result = {}
					result[bank] = render

					client.emit('preview_page_data', result)
				}
			}
		}
	}

	/**
	 * Send a page update to web buttons
	 * @param {number} id - the page number
	 * @access public
	 */
	updateWebButtonsPage(id) {
		let page = this.page.getPage(id)
		const newInfo = this.getExtendedPageInfo(id, page)

		for (const key in this.clients) {
			let client = this.clients[key]
			if (client.web_buttons) {
				client.emit('page_update_ext', page, newInfo)
			}
		}
	}
}

export default GraphicsPreview
