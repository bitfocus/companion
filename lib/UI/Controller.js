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
}

module.exports = UIController
