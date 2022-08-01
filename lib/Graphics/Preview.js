import { CreateBankControlId, sendResult } from '../Resources/Util.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import { ControlConfigRoom } from '../Controls/ControlBase.js'

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
		super(registry, 'preview', 'Graphics/Preview')

		this.graphics.on('bank_invalidated', this.updateBank.bind(this))
	}

	/**
	 * Setup a client's calls
	 * @param {Socket} client - the client connection
	 * @access public
	 */
	clientConnect(client) {
		this.clients[client.id] = client

		client.on('bank_preview_page', this.handlePreviewPage.bind(this, client))
		client.onPromise('web_buttons', this.handleWebButtons.bind(this, client))

		client.onPromise('web_buttons_page', this.handleWebButtonsPage.bind(this, client))

		client.on('disconnect', () => {
			delete this.clients[client.id]
		})
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
	handleWebButtons(client) {
		this.logger.silly('handleWebButtons()')

		const pages = this.page.getAll(true)

		client.web_buttons = 1
		return pages
	}

	/**
	 * Get a page for web buttons
	 * @param {Socket} client - the client connection
	 * @param {number} page - the page number
	 * @param {Object} cache - last update information from the UI
	 * @param {?function} answer - the response function to the UI
	 * @access protected
	 */
	handleWebButtonsPage(client, page, cache) {
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

		return result
	}

	/**
	 * Send a bank update to the UIs
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @access public
	 */
	updateBank(page, bank, render) {
		// Push the updated render to any clients viewing a preview of a control
		const controlId = CreateBankControlId(page, bank)
		const controlRoom = ControlConfigRoom(controlId)
		if (this.io.countRoomMembers(controlRoom) > 0) {
			this.io.emitToRoom(controlRoom, `controls:preview-${controlId}`, render.buffer)
		}

		for (const key in this.clients) {
			let client = this.clients[key]

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
		const page = this.getExtendedPageInfo(id, page)

		for (const key in this.clients) {
			let client = this.clients[key]
			if (client.web_buttons) {
				client.emit('page_update_ext', id, page)
			}
		}
	}
}

export default GraphicsPreview
