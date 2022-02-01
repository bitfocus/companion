const UIExpress = require('./Express')
const UIHandler = require('./Handler')
const UIHelp = require('./Help')
const UILog = require('./Log')
const UIServer = require('./Server')
const UIUpdate = require('./Update')

class UIController {
	constructor(registry) {
		this.express = new UIExpress(registry.system)
		this.server = new UIServer(registry.system, this.express)
		this.io = new UIHandler(registry.system, this.server)
		this.log = new UILog(registry.system, this.io)
		this.update = new UIUpdate(registry.system)
		this.help = new UIHelp(registry.system)
	}
}

module.exports = UIController
