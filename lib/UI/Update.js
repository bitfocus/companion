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
	logger = LogController.createLogger('UI/Update')

	latestUpdateData = null

	/**
	 * @param {Registry} registry
	 */
	constructor(registry) {
		this.logger.silly('loading update')
		this.registry = registry

		// Make a request now
		this.requestUpdate()
		setInterval(
			() => {
				// Do a check every day, in case this installation is being left on constantly
				this.requestUpdate()
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
			client.emit('app-update-info', this.latestUpdateData)
		})
	}

	get io() {
		if (this.registry) {
			return this.registry.io
		} else {
			return null
		}
	}

	getPayload() {
		const x = new Date()
		const offset = -x.getTimezoneOffset()
		const off = (offset >= 0 ? '+' : '-') + parseInt(offset / 60)

		return {
			// Information about the computer asking for a update. This way
			// we can filter out certain kinds of OS/versions if there
			// is known bugs etc.
			app_name: 'companion',
			app_build: this.registry.appBuild,
			app_version: this.registry.appVersion,
			arch: os.arch(),
			tz: off,
			cpus: os.cpus(),
			platform: os.platform(),
			release: os.release(),
			type: os.type(),
			id: this.registry.machineId,
		}
	}

	requestUpdate() {
		got
			.post('https://updates.bitfocus.io/updates', {
				json: this.getPayload(),
				responseType: 'json',
			})
			.then(({ body }) => {
				this.logger.debug('fresh update data received', body)
				this.latestUpdateData = body

				if (this.io) {
					this.io.emit('app-update-info', body)
				}
			})
			.catch((e) => {
				this.logger.verbose('update server said something unexpected!', e)
			})
	}
}

export default UIUpdate
