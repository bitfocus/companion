import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import { ControlConfigRoom } from '../Controls/ControlBase.js'

function PreviewPageRoom(page) {
	return `preview:page:${page}`
}
function PreviewBankRoom(location) {
	return `preview:bank:${location.pageNumber}-${location.column}-${location.row}`
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

		this.graphics.on('button_drawn', this.updateButton.bind(this))
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
			for (let y = 0; y < global.MAX_BUTTONS_PER_COL; ++y) {
				const rowRenders = (renders[y] = {})
				for (let x = 0; x < global.MAX_BUTTONS_PER_ROW; ++x) {
					rowRenders[x]
					rowRenders[x] = this.graphics.getBank({
						pageNumber: page,
						column: x,
						row: y,
					}).buffer
				}
			}

			return renders
		})
		client.onPromise('preview:page:unsubscribe', (pageNumber) => {
			client.leave(PreviewPageRoom(pageNumber))
		})

		client.onPromise('preview:bank:subscribe', (location) => {
			client.join(PreviewBankRoom(location))

			return this.graphics.getBank(location).buffer
		})
		client.onPromise('preview:bank:unsubscribe', (location) => {
			client.leave(PreviewBankRoom(location))
		})
	}

	/**
	 * Send a bank update to the UIs
	 * @param {*} location
	 * @param {*} render
	 * @access public
	 */
	updateButton(location, render) {
		// Push the updated render to any clients viewing a preview of a control
		const controlId = this.page.getControlIdAt(location)
		if (controlId) {
			const controlRoom = ControlConfigRoom(controlId)
			if (this.io.countRoomMembers(controlRoom) > 0) {
				this.io.emitToRoom(controlRoom, `controls:preview-${controlId}`, render.buffer)
			}
		}

		const previewRoom = PreviewPageRoom(location.pageNumber)
		if (this.io.countRoomMembers(previewRoom) > 0) {
			this.io.emitToRoom(previewRoom, `preview:page-bank`, location, render.buffer)
		}

		const previewRoom2 = PreviewBankRoom(location)
		if (this.io.countRoomMembers(previewRoom2) > 0) {
			this.io.emitToRoom(previewRoom2, `preview:page-bank`, location, render.buffer)
		}
	}
}

export default GraphicsPreview
