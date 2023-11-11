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
		this.server = new UIServer(this.express.app)
		registry.on('http_rebind', this.server.rebindHttp.bind(this.server))

		this.io = new UIHandler(registry, this.server)
		this.update = new UIUpdate(registry.appInfo, this.io)
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
