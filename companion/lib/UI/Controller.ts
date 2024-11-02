import { UIExpress } from './Express.js'
import { ClientSocket, UIHandler } from './Handler.js'
import { UIServer } from './Server.js'
import { UIUpdate } from './Update.js'
import type { Registry } from '../Registry.js'

export class UIController {
	readonly express: UIExpress
	readonly server: UIServer
	readonly io: UIHandler
	readonly update: UIUpdate

	constructor(registry: Registry) {
		this.express = new UIExpress(registry)
		this.server = new UIServer(this.express.app)
		registry.on('http_rebind', this.server.rebindHttp.bind(this.server))

		this.io = new UIHandler(registry.appInfo, this.server)
		this.update = new UIUpdate(registry.appInfo, this.io)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.update.clientConnect(client)
	}
}
