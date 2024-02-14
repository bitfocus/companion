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

import os from 'os'
import got from 'got'
import LogController from '../Log/Controller.js'

class UIUpdate {
	#logger = LogController.createLogger('UI/Update')

	/**
	 * @type {import('../Registry.js').AppInfo}
	 * @readonly
	 */
	#appInfo

	/**
	 * @type {import('./Handler.js').default}
	 * @readonly
	 */
	#ioController

	/**
	 * Latest update information
	 * @type {import('../Shared/Model/Common.js').AppUpdateInfo | null}
	 * @access private
	 */
	#latestUpdateData = null

	/**
	 * @param {import('../Registry.js').AppInfo} appInfo
	 * @param {import('./Handler.js').default} ioController
	 */
	constructor(appInfo, ioController) {
		this.#logger.silly('loading update')
		this.#appInfo = appInfo
		this.#ioController = ioController

		// Make a request now
		this.#requestUpdate()
		setInterval(
			() => {
				// Do a check every day, in case this installation is being left on constantly
				this.#requestUpdate()
			},
			24 * 60 * 60 * 1000
		)
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('app-update-info', () => {
			client.emit('app-update-info', this.#latestUpdateData)
		})
	}

	/**
	 * Compile update payload
	 */
	compilePayload() {
		const x = new Date()
		const offset = -x.getTimezoneOffset()
		const off = (offset >= 0 ? '+' : '-') + offset / 60

		return {
			// Information about the computer asking for a update. This way
			// we can filter out certain kinds of OS/versions if there
			// is known bugs etc.
			app_name: 'companion',
			app_build: this.#appInfo.appBuild,
			app_version: this.#appInfo.appVersion,
			arch: os.arch(),
			tz: off,
			cpus: os.cpus(),
			platform: os.platform(),
			release: os.release(),
			type: os.type(),
			id: this.#appInfo.machineId,
		}
	}

	/**
	 * Perform the update request
	 */
	#requestUpdate() {
		got
			.post('https://updates.bitfocus.io/updates', {
				json: this.compilePayload(),
				responseType: 'json',
			})
			.then(({ body }) => {
				this.#logger.debug('fresh update data received', body)
				this.#latestUpdateData = body

				this.#ioController.emit('app-update-info', body)
			})
			.catch((e) => {
				this.#logger.verbose('update server said something unexpected!', e)
			})
	}
}

export default UIUpdate
