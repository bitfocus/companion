import { CreateBankControlId, sendResult } from '../Resources/Util.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import { ControlConfigRoom } from '../Controls/ControlBase.js'

function PreviewPageRoom(page) {
	return `preview:page:${page}`
}

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

		client.onPromise('preview:page:subscribe', (page) => {
			client.join(PreviewPageRoom(page))

			const renders = {}
			for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
				renders[i] = this.graphics.getBank(page, i).buffer
			}

			return renders
		})
		client.onPromise('preview:page:unsubscribe', (page) => {
			client.leave(PreviewPageRoom(page))
		})

		client.onPromise('web_buttons', this.handleWebButtons.bind(this, client))

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
		const controlInfo = this.controls.getExtendedPageInfo(index)

		const newPage = {
			...page,
			...controlInfo,
		}

		return newPage
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
		for (const id in pages) {
			pages[id] = this.getExtendedPageInfo(id, pages[id])
		}

		client.web_buttons = 1
		return pages
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

		const previewRoom = PreviewPageRoom(page)
		if (this.io.countRoomMembers(previewRoom) > 0) {
			this.io.emitToRoom(previewRoom, `preview:page-bank`, page, bank, render.buffer)
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
