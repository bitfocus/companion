import UIExpress from './Express.js'
import UIHandler from './Handler.js'
import UILog from './Log.js'
import UIServer from './Server.js'
import UIUpdate from './Update.js'

class UIController {
	constructor(registry) {
		this.express = new UIExpress(registry)
		this.server = new UIServer(registry, this.express)
		this.io = new UIHandler(registry, this.server)
		this.log = new UILog(registry, this.io)
		this.update = new UIUpdate(registry)
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.log.clientConnect(client)
		this.update.clientConnect(client)
	}
}

export default UIController
