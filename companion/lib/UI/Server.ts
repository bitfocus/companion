/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { Server as HttpServer } from 'http'
import LogController from '../Log/Controller.js'
import { sendOverIpc } from '../Resources/Util.js'
import type express from 'express'

export class UIServer extends HttpServer {
	readonly #logger = LogController.createLogger('UI/Server')

	constructor(express: express.Express) {
		super(express)
	}

	/**
	 *
	 */
	rebindHttp(bindIp: string, bindPort: number): void {
		if (this !== undefined && this.close !== undefined) {
			this.close()
		}
		try {
			this.on('error', (e: any) => {
				if (e.code == 'EADDRNOTAVAIL') {
					this.#logger.error(`Failed to bind to: ${bindIp}`)
					sendOverIpc({
						messageType: 'http-bind-status',
						appStatus: 'Error',
						appURL: `${bindIp} unavailable. Select another IP`,
						appLaunch: null,
					})
				} else {
					this.#logger.error(e)
				}
			})
			this.listen(bindPort, bindIp, () => {
				const address0 = this.address()
				const address = typeof address0 === 'object' ? address0 : undefined

				this.#logger.info(`new url: http://${address?.address}:${address?.port}/`)

				const ip = bindIp == '0.0.0.0' ? '127.0.0.1' : bindIp
				const url = `http://${ip}:${address?.port}/`
				const info = bindIp == '0.0.0.0' ? `All Interfaces: e.g. ${url}` : url
				sendOverIpc({
					messageType: 'http-bind-status',
					appStatus: 'Running',
					appURL: info,
					appLaunch: url,
				})
			})
		} catch (e) {
			this.#logger.error(`http bind error: ${e}`)
		}
	}
}
