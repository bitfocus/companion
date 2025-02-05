import type { AppInfo } from '../Registry.js'
import { UIExpress } from './Express.js'
import { ClientSocket, UIHandler } from './Handler.js'
import { UIServer } from './Server.js'
import { UIUpdate } from './Update.js'
import type express from 'express'

export class UIController {
	readonly express: UIExpress
	readonly server: UIServer
	readonly io: UIHandler
	readonly update: UIUpdate

	constructor(appInfo: AppInfo, internalApiRouter: express.Router) {
		this.express = new UIExpress(internalApiRouter)
		this.server = new UIServer(this.express.app)
		this.io = new UIHandler(appInfo, this.server)
		this.update = new UIUpdate(appInfo, this.io)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.update.clientConnect(client)
	}

	close() {
		this.io.close()
	}
}
