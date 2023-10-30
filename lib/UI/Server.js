/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import { Server as _http } from 'http'
import LogController from '../Log/Controller.js'
import { sendOverIpc } from '../Resources/Util.js'

class UIServer extends _http {
	#logger = LogController.createLogger('UI/Server')

	/**
	 * @param {import('express').Express} express
	 */
	constructor(express) {
		super(express)
	}

	/**
	 *
	 * @param {string} bind_ip
	 * @param {number} http_port
	 */
	rebindHttp(bind_ip, http_port) {
		this.bind_ip = bind_ip
		this.http_port = http_port

		if (this !== undefined && this.close !== undefined) {
			this.close()
		}
		try {
			this.on('error', (/** @type {any} */ e) => {
				if (e.code == 'EADDRNOTAVAIL') {
					this.#logger.error(`Failed to bind to: ${this.bind_ip}`)
					sendOverIpc({
						messageType: 'http-bind-status',
						appStatus: 'Error',
						appURL: `${this.bind_ip} unavailable. Select another IP`,
						appLaunch: null,
					})
				} else {
					this.#logger.error(e)
				}
			}).listen(this.http_port, this.bind_ip, () => {
				const address0 = this.address()
				const address = typeof address0 === 'object' ? address0 : undefined

				this.#logger.info(`new url: http://${address?.address}:${address?.port}/`)

				let ip = this.bind_ip == '0.0.0.0' ? '127.0.0.1' : this.bind_ip
				let url = `http://${ip}:${address?.port}/`
				let info = this.bind_ip == '0.0.0.0' ? `All Interfaces: e.g. ${url}` : url
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

export default UIServer
