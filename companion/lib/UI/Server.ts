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

import { Server as HttpServer } from 'node:http'
import type express from 'express'
import type { LauncherHttpStatusMessage } from '@companion-app/shared/Model/LauncherAppInfo.js'
import LogController from '../Log/Controller.js'
import { sendOverIpc } from '../Resources/Util.js'

export class UIServer extends HttpServer {
	readonly #logger = LogController.createLogger('UI/Server')

	/** The 'error' listener of the current bind, replaced on each rebind as it reports that bind's address */
	#errorListener: ((e: any) => void) | null = null

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
			if (this.#errorListener) this.off('error', this.#errorListener)
			this.#errorListener = (e: any) => {
				this.#logger.error(`Failed to bind to ${bindIp}:${bindPort}: ${e?.message ?? e}`)
				sendOverIpc({
					messageType: 'http-bind-status',
					appStatus: 'error',
					appMessage: getBindErrorMessage(e, bindIp, bindPort),
					appLaunch: null,
				} satisfies LauncherHttpStatusMessage)
			}
			this.on('error', this.#errorListener)

			this.listen(bindPort, bindIp, () => {
				const address0 = this.address()
				const address = typeof address0 === 'object' ? address0 : undefined

				const isBindGlobal = bindIp == '0.0.0.0' || bindIp == '::'

				const ip = isBindGlobal ? '127.0.0.1' : bindIp
				const url = `http://${ip}:${address?.port}/`
				setTimeout(() => this.#logger.info(`new url: ${url}`), 2000)

				sendOverIpc({
					messageType: 'http-bind-status',
					appStatus: 'running',
					appMessage: isBindGlobal ? 'Listening on all network interfaces' : null,
					appLaunch: url,
				} satisfies LauncherHttpStatusMessage)
			})
		} catch (e) {
			setTimeout(() => this.#logger.error(`http bind error: ${e}`), 2000)
		}
	}
}

function getBindErrorMessage(e: any, bindIp: string, bindPort: number): string {
	switch (e?.code) {
		case 'EADDRNOTAVAIL':
			return `${bindIp} is unavailable. Select another interface.`
		case 'EADDRINUSE':
			return `Port ${bindPort} is already in use. Choose another port.`
		case 'EACCES':
			return `Not permitted to use port ${bindPort}. Choose another port.`
		default:
			return `Could not start the web server: ${e?.message ?? e}`
	}
}
