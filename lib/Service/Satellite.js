import ServiceBase from './Base.js'
import { isFalsey, parseLineParameters } from '../Resources/Util.js'

/**
 * Version of this API. This follows semver, to allow for clients to check their compatability
 * 1.0.0 - Initial release
 * 1.1.0 - Add KEY-STATE TYPE and PRESSED properties
 */
const API_VERSION = '1.1.0'

/**
 * Class providing the Satellite/Remote Surface api.
 *
 * @extends ServiceTcpBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.2.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class ServiceSatellite extends ServiceBase {
	/**
	 * The remote devices
	 * @type {Object}
	 * @access protected
	 */
	devices = {}
	/**
	 * The port to open the socket with.  Default: <code>16622</code>
	 * @type {number}
	 * @access protected
	 */
	port = 16622

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'satellite', 'lib/Service/Satellite')

		this.init()
	}

	/**
	 *
	 * @param {Socket} socket - the client socket
	 * @param {Object} params - the device parameters
	 */
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
		this.debug(`add device "${id}" for ${socket.remoteAddress}`)

		const existing = Object.entries(this.devices).find(([internalId, dev]) => dev.id === id)
		if (existing) {
			if (existing[1].socket === socket) {
				socket.write(`ADD-DEVICE ERROR MESSAGE="Device already added"\n`)
				return
			} else {
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

		this.surfaces.addDevice(
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

	/**
	 * Process a command from a client
	 * @param {Socket} socket - the client socket
	 * @param {string} line - the received command
	 */
	handleCommand(socket, line) {
		if (!line.trim().toUpperCase().startsWith('PING')) {
			this.debug(`received "${line}" from ${socket.name}`)
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

	/**
	 * Set up a client socket
	 * @param {Socket} socket - the client socket
	 */
	initSocket(socket) {
		this.debug(`new connection from ${socket.name}`)

		let receivebuffer = ''
		socket.on('data', (data) => {
			receivebuffer += data.toString()

			let i = 0,
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
			this.debug('socket error:', e)
		})

		socket.on('close', () => {
			for (let key in this.devices) {
				if (this.devices[key].socket === socket) {
					this.surfaces.removeDevice(this.devices[key].id)
					this.system.removeAllListeners(this.devices[key].id + '_button')
					delete this.devices[key]
				}
			}

			socket.removeAllListeners('data')
			socket.removeAllListeners('close')
		})

		socket.write(`BEGIN CompanionVersion=${this.registry.appBuild} ApiVersion=${API_VERSION}\n`)
	}

	/**
	 * Process a key press command
	 * @param {Socket} socket - the client socket
	 * @param {Object} params - the key press parameters
	 */
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

	/**
	 *
	 * @param {Socket} socket - the client socket
	 * @param {Object} params - the device parameters
	 */
	removeDevice(socket, params) {
		if (!params.DEVICEID) {
			socket.write(`REMOVE-DEVICE ERROR MESSAGE="Missing DEVICEID"\n`)
			return
		}

		const id = `satellite-${params.DEVICEID}`
		const device = this.devices[id]

		if (device && device.socket === socket) {
			this.system.removeAllListeners(id + '_button')
			this.surfaces.removeDevice(id)
			delete this.devices[id]
			socket.write(`REMOVE-DEVICE OK DEVICEID=${params.DEVICEID}\n`)
		} else {
			socket.write(`REMOVE-DEVICE ERROR MESSAGE="Device not found"\n`)
		}
	}
}

export default ServiceSatellite
