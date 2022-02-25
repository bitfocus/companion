const UIExpress = require('./Express')
const UIHandler = require('./Handler')
const UILog = require('./Log')
const UIServer = require('./Server')
const UIUpdate = require('./Update')

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

module.exports = UIController
