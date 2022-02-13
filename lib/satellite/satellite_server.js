/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: Håkon Nessjøen <haakon@bitfocus.io>, William Viker <william@bitfocus.io>
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
const debug = require('debug')('lib/satellite_server')
const net = require('net')

/**
 * Version of this API. This follows semver, to allow for clients to check their compatability
 * 1.0.0 - Initial release
 * 1.1.0 - Add KEY-STATE TYPE and PRESSED properties
 */
const API_VERSION = '1.1.0'

function isFalsey(val) {
	return (typeof val === 'string' && val.toLowerCase() == 'false') || val == '0'
}

function parseLineParameters(line) {
	// https://newbedev.com/javascript-split-string-by-space-but-ignore-space-in-quotes-notice-not-to-split-by-the-colon-too
	const fragments = line.match(/\\?.|^$/g).reduce(
		(p, c) => {
			if (c === '"') {
				p.quote ^= 1
			} else if (!p.quote && c === ' ') {
				p.a.push('')
			} else {
				p.a[p.a.length - 1] += c.replace(/\\(.)/, '$1')
			}
			return p
		},
		{ a: [''] }
	).a

	const res = {}

	for (const fragment of fragments) {
		const [key, value] = fragment.split('=')
		res[key] = value === undefined ? true : value
	}

	return res
}

class satelliteServer {
	constructor(system) {
		this.system = system
		this.clients = []
		this.devices = {}

		this.buildNumber = 'Unknown'
		this.system.emit('skeleton-info-info', (info) => {
			// Assume this happens synchronously
			this.buildNumber = info.appBuild
		})

		this.elgatoDM = require('../elgato_dm')(system)

		this.server = net.createServer((socket) => {
			socket.name = socket.remoteAddress + ':' + socket.remotePort

			this.initSocket(socket)
		})
		this.server.on('error', function (e) {
			debug('listen-socket error: ', e)
		})

		try {
			this.server.listen(16622)
		} catch (e) {
			debug('ERROR opening port 16622 for companion satellite devices')
		}
	}

	initSocket(socket) {
		debug(`new connection from ${socket.name}`)

		let receivebuffer = ''
		socket.on('data', (data) => {
			receivebuffer += data.toString()

			var i = 0,
				line = '',
				offset = 0
			while ((i = receivebuffer.indexOf('\n', offset)) !== -1) {
				line = receivebuffer.substr(offset, i - offset)
				offset = i + 1
				this.handleCommand(socket, line.toString().replace(/\r/, ''))
			}
			receivebuffer = receivebuffer.substr(offset)
		})

		socket.on('error', (e) => {
			debug('socket error:', e)
		})

		socket.on('close', () => {
			for (let key in this.devices) {
				if (this.devices[key].socket === socket) {
					this.elgatoDM.removeDevice(this.devices[key].id)
					system.removeAllListeners(this.devices[key].id + '_button')
					delete this.devices[key]
				}
			}

			socket.removeAllListeners('data')
			socket.removeAllListeners('close')
		})

		socket.write(`BEGIN CompanionVersion=${this.buildNumber} ApiVersion=${API_VERSION}\n`)
	}

	handleCommand(socket, line) {
		if (!line.trim().toUpperCase().startsWith('PING')) {
			debug(`received "${line}" from ${socket.name}`)
		}

		const i = line.indexOf(' ')
		const cmd = i === -1 ? line : line.slice(0, i)
		const body = i === -1 ? '' : line.slice(i + 1)
		const params = parseLineParameters(body)
		switch (cmd.toUpperCase()) {
			case 'ADD-DEVICE':
				this.addDevice(socket, params)
				break
			case 'REMOVE-DEVICE':
				this.removeDevice(socket, params)
				break
			case 'KEY-PRESS':
				this.keyPress(socket, params)
				break
			case 'PING':
				socket.write(`PONG ${body}\n`)
				break
			case 'PONG':
				// Nothing to do
				// TODO - track timeouts?
				break
			case 'QUIT':
				socket.destroy()
				break
			default:
				socket.write(`ERROR MESSAGE="Unknown command: ${cmd.toUpperCase()}"\n`)
		}
	}

	addDevice(socket, params) {
		if (!params.DEVICEID) {
			socket.write(`ADD-DEVICE ERROR MESSAGE="Missing DEVICEID"\n`)
			return
		}
		if (!params.PRODUCT_NAME) {
			socket.write(`ADD-DEVICE ERROR MESSAGE="Missing PRODUCT_NAME"\n`)
			return
		}

		const id = `satellite-${params.DEVICEID}`
		debug(`add device "${id}" for ${socket.remoteAddress}`)

		const existing = Object.entries(this.devices).find(([internalId, dev]) => dev.id === id)
		if (existing) {
			if (existing[1].socket === socket) {
				socket.write(`ADD-DEVICE ERROR MESSAGE="Device already added"\n`)
				return
			} else {
				// // Reuse the existing, to avoid duplicates issues
				// setImmediate(() => {
				// 	system.emit('elgato_ready', id)
				// })
				// return existing[0]
				socket.write(`ADD-DEVICE ERROR MESSAGE="Device exists elsewhere"\n`)
				return
			}
		}

		this.devices[id] = {
			id: id,
			socket: socket,
		}

		const keysTotal = params.KEYS_TOTAL ? parseInt(params.KEYS_TOTAL) : global.MAX_BUTTONS
		if (isNaN(keysTotal) || keysTotal > global.MAX_BUTTONS || keysTotal <= 0) {
			socket.write(`ADD-DEVICE ERROR MESSAGE="Invalid KEYS_TOTAL"\n`)
			return
		}

		const keysPerRow = params.KEYS_PER_ROW ? parseInt(params.KEYS_PER_ROW) : global.MAX_BUTTONS_PER_ROW
		if (isNaN(keysPerRow) || keysPerRow > global.MAX_BUTTONS || keysPerRow <= 0) {
			socket.write(`ADD-DEVICE ERROR MESSAGE="Invalid KEYS_PER_ROW"\n`)
			return
		}

		const streamBitmaps = params.BITMAPS === undefined || !isFalsey(params.BITMAPS)
		const streamColors = params.COLORS !== undefined && !isFalsey(params.COLORS)
		const streamText = params.TEXT !== undefined && !isFalsey(params.TEXT)

		this.elgatoDM.addDevice(
			{
				path: id,
				keysTotal: keysTotal,
				keysPerRow: keysPerRow,
				socket: socket,
				deviceId: params.DEVICEID,
				productName: params.PRODUCT_NAME,
				streamBitmaps: streamBitmaps,
				streamColors: streamColors,
				streamText: streamText,
			},
			'satellite_device2'
		)

		socket.write(`ADD-DEVICE OK DEVICEID=${params.DEVICEID}\n`)
	}

	removeDevice(socket, params) {
		if (!params.DEVICEID) {
			socket.write(`REMOVE-DEVICE ERROR MESSAGE="Missing DEVICEID"\n`)
			return
		}

		const id = `satellite-${params.DEVICEID}`
		const device = this.devices[id]
		if (device && device.socket === socket) {
			this.system.removeAllListeners(id + '_button')
			this.elgatoDM.removeDevice(id)
			delete this.devices[id]
			socket.write(`REMOVE-DEVICE OK DEVICEID=${params.DEVICEID}\n`)
		} else {
			socket.write(`REMOVE-DEVICE ERROR MESSAGE="Device not found"\n`)
		}
	}

	keyPress(socket, params) {
		if (!params.DEVICEID) {
			socket.write(`KEY-PRESS ERROR MESSAGE="Missing DEVICEID"\n`)
			return
		}
		if (!params.KEY) {
			socket.write(`KEY-PRESS ERROR MESSAGE="Missing KEY"\n`)
			return
		}
		if (!params.PRESSED) {
			socket.write(`KEY-PRESS ERROR MESSAGE="Missing PRESSED"\n`)
			return
		}

		const key = parseInt(params.KEY)
		if (isNaN(key) || key > global.MAX_BUTTONS || key < 0) {
			socket.write(`KEY-PRESS ERROR MESSAGE="Invalid KEY"\n`)
			return
		}

		const pressed = !isFalsey(params.PRESSED)

		const id = `satellite-${params.DEVICEID}`
		const device = this.devices[id]
		if (device && device.socket === socket) {
			this.system.emit(id + '_button', key, pressed)
			socket.write(`KEY-PRESS OK\n`)
		} else {
			socket.write(`KEY-PRESS ERROR MESSAGE="Device not found KEY"\n`)
		}
	}
}

exports = module.exports = function (_system) {
	return new satelliteServer(_system)
}
