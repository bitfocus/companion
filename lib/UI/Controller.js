// @ts-check
import UIExpress from './Express.js'
import UIHandler from './Handler.js'
import UIServer from './Server.js'
import UIUpdate from './Update.js'

class UIController {
	/**
	 * @param {import("../Registry.js").default} registry
	 */
	constructor(registry) {
		this.express = new UIExpress(registry)
		this.server = new UIServer(registry, this.express.app)
		this.io = new UIHandler(registry, this.server)
		this.update = new UIUpdate(registry)
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.update.clientConnect(client)
	}
}

export default UIController
