import { CreateBankControlId } from '../Shared/ControlId.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import { ControlConfigRoom } from '../Controls/ControlBase.js'

function PreviewPageRoom(page) {
	return `preview:page:${page}`
}
function PreviewBankRoom(page, bank) {
	return `preview:bank:${page}.${bank}`
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

		client.onPromise('preview:bank:subscribe', (page, bank) => {
			client.join(PreviewBankRoom(page, bank))

			return this.graphics.getBank(page, bank).buffer
		})
		client.onPromise('preview:bank:unsubscribe', (page, bank) => {
			client.leave(PreviewBankRoom(page, bank))
		})
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

		const previewRoom2 = PreviewBankRoom(page, bank)
		if (this.io.countRoomMembers(previewRoom2) > 0) {
			this.io.emitToRoom(previewRoom2, `preview:page-bank`, page, bank, render.buffer)
		}
	}
}

export default GraphicsPreview
