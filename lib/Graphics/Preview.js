import { CreateBankControlId, sendResult } from '../Resources/Util.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import { ControlConfigRoom } from '../Controls/ControlBase.js'

const WebButtonsRoom = 'web-buttons'

function PagePreviewRoom(id) {
	return `page-preview:${id}`
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
		client.onPromise('page-preview:subscribe', this.handlePreviewPageSubscribe.bind(this, client))
		client.onPromise('page-preview:unsubscribe', this.handlePreviewPageUnsubscribe.bind(this, client))

		client.onPromise('web-buttons:subscribe', this.handleWebButtonsSubscribe.bind(this, client))
		client.onPromise('web-buttons:unsubscribe', this.handleWebButtonsUnsubscribe.bind(this, client))

		client.onPromise('web-buttons:load-page', this.handleWebButtonsLoadPage.bind(this, client))
	}

	/**
	 * Send updated previews to the client for page edit
	 * @param {Socket} client - the client connection
	 * @param {number} page - the page number
	 * @access protected
	 */
	handlePreviewPageSubscribe(client, page) {
		client.join(PagePreviewRoom(page))

		const result = {}
		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			result[i + 1] = this.graphics.getBank(page, i + 1)
		}

		return result
	}

	handlePreviewPageUnsubscribe(client, page) {
		client.leave(PagePreviewRoom(page))
	}

	/**
	 * Get all the pages for web buttons
	 * @param {Socket} client - the client connection
	 * @access protected
	 */
	handleWebButtonsSubscribe(client) {
		this.logger.silly('handleWebButtonsSubscribe()')

		client.join(WebButtonsRoom)

		return this.page.getAll(true)
	}

	/**
	 *
	 * @param {Socket} client - the client connection
	 * @access protected
	 */
	handleWebButtonsUnsubscribe(client) {
		this.logger.silly('handleWebButtonsUnsubscribe()')

		client.leave(WebButtonsRoom)
	}

	/**
	 * Get a page for web buttons
	 * @param {Socket} client - the client connection
	 * @param {number} page - the page number
	 * @access protected
	 */
	handleWebButtonsLoadPage(client, page) {
		this.logger.silly('handleWebButtonsLoadPage()', page)

		const result = {}
		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			result[i + 1] = this.graphics.getBank(page, i + 1)
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

		// Send to web-buttons clients
		this.io.emitToRoom(WebButtonsRoom, 'web-buttons:bank-data', page, bank, render)

		// Send to bank-grid preview clients
		this.io.emitToRoom(PagePreviewRoom(page), 'page-preview:bank-data', page, bank, render)
	}

	/**
	 * Send a page update to web buttons
	 * @param {number} id - the page number
	 * @access public
	 */
	updateWebButtonsPage(id) {
		const page = this.page.getPage(id)

		this.io.emitToRoom(WebButtonsRoom, 'web-buttons:page-info', id, page)
	}
}

export default GraphicsPreview
