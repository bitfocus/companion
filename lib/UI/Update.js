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

const os = require('os')
const App = require('../../app')
const got = require('got')

class UIUpdate {
	debug = require('debug')('lib/UI/Update')

	latestUpdateData = null

	/**
	 * @param {App} system
	 */
	constructor(system) {
		this.debug('loading update')
		this.system = system
		this.serverdata = {}

		this.system.emit('io_get', (io) => {
			this.io = io

			this.system.on('io_connect', (socket) => {
				this.debug('updating data')
				socket.on('app-update-info', () => {
					socket.emit('app-update-info', this.latestUpdateData)
				})
			})
		})

		// Make a request now
		this.requestUpdate()
		setInterval(() => {
			// Do a check every day, in case this installation is being left on constantly
			this.requestUpdate()
		}, 24 * 60 * 60 * 1000)
	}

	requestUpdate() {
		const x = new Date()
		const offset = -x.getTimezoneOffset()
		const off = (offset >= 0 ? '+' : '-') + parseInt(offset / 60)

		got
			.post('https://updates.bitfocus.io/updates', {
				json: {
					// Information about the computer asking for a update. This way
					// we can filter out certain kinds of OS/versions if there
					// is known bugs etc.
					app_name: 'companion',
					app_build: this.system.appBuild,
					app_version: this.system.appVersion,
					arch: os.arch(),
					tz: off,
					cpus: os.cpus(),
					platform: os.platform(),
					release: os.release(),
					type: os.type(),
					id: this.system.machineId,
				},
				responseType: 'json',
			})
			.then(({ body }) => {
				this.debug('fresh update data received', body)
				this.latestUpdateData = body

				if (this.io) {
					this.io.emit('app-update-info', body)
				}
			})
			.catch((e) => {
				this.debug('update server said something unexpected!', e)
			})
	}
}

module.exports = UIUpdate
