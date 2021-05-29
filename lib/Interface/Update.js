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

const debug = require('debug')('Data/Update')
const fs = require('fs')
const os = require('os')
const http = require('https') // https
const shortid = require('shortid')

class InterfaceUpdate {
	constructor(registry, io) {
		this.registry = registry
		this.system = this.registry.system
		this.io = io

		this.cfgdir = this.registry.cfgDir

		this.package = {}
		this.serverdata = {}

		const x = new Date()
		const offset = -x.getTimezoneOffset()
		const off = (offset >= 0 ? '+' : '-') + parseInt(offset / 60)
		const build = fs.readFileSync(this.registry.appRoot + '/BUILD').toString()

		// Information about the computer asking for a update. This way
		// we can filter out certain kinds of OS/versions if there
		// is known bugs etc.
		this.payload = {
			app_name: 'companion',
			app_build: build,
			arch: os.arch(),
			tz: off,
			cpus: os.cpus(),
			platform: os.platform(),
			release: os.release(),
			type: os.type(),
			id: this.uuid(),
		}

		fs.readFile(this.registry.appRoot + '/package.json', 'utf8', (err, data) => {
			if (err) {
				throw err
			}

			this.package = JSON.parse(data)
			this.payload.app_version = this.package.version
			this.requestUpdate(this.payload)
			this.system.emit('version-local', this.package.version)
		})
	}

	clientConnect(client) {
		client.on('update_data', () => {
			client.emit('update_data:result', this.serverdata)
		})
	}

	requestUpdate(payload) {
		const options = {
			hostname: 'updates.bitfocus.io',
			path: '/updates',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		}

		const req = http.request(options, (res) => {
			if (res.statusCode == 200) {
				res.setEncoding('utf8')

				res.on('data', (body) => {
					try {
						var rp = JSON.parse(body)
						debug('update server says', rp)
						this.serverdata = rp
						this.io.emit('update_data:result', this.serverdata)
					} catch (e) {
						debug('update server said something unexpected!', body, e)
					}
				})
			} else {
				debug('update server said status', res.statusCode)
			}
		})
		req.on('error', (e) => {
			console.log('problem with request: ' + e.message)
		})

		// write data to request body
		req.write(JSON.stringify(payload))
		req.end()
	}

	// Unique identifier for this user
	uuid() {
		let uuid = shortid.generate()

		if (fs.existsSync(this.cfgdir + 'machid')) {
			let text = ''
			try {
				text = fs.readFileSync(this.cfgdir + 'machid')

				if (text) {
					uuid = text.toString()
					debug('read uuid', uuid)
				}
			} catch (e) {
				debug('error reading uuid-file', e)
			}
		} else {
			debug('creating uuid file')
			fs.writeFileSync(this.cfgdir + 'machid', uuid)
		}

		return uuid
	}
}

exports = module.exports = InterfaceUpdate
