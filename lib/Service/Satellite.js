import ServiceBase from './Base.js'
import { isFalsey, parseLineParameters } from '../Resources/Util.js'
import net from 'net'

/**
 * Version of this API. This follows semver, to allow for clients to check their compatibility
 * 1.0.0 - Initial release
 * 1.1.0 - Add KEY-STATE TYPE and PRESSED properties
 * 1.2.0 - Add DEVICEID to any ERROR responses when known
 * 1.3.0 - Add KEY-ROTATE message
 * 1.4.0 - Add TEXT_STYLE as ADD-DEVICE flags with FONT_SIZE as KEY-STATE property
 */
const API_VERSION = '1.4.0'

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
		super(registry, 'satellite', 'Service/Satellite')

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
			socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Missing PRODUCT_NAME"\n`)
			return
		}

		if (params.DEVICEID.startsWith('emulator')) {
			// Some deviceId values are 'special' and cannot be used by satellite
			socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Reserved DEVICEID"\n`)
			return
		}

		const id = `${params.DEVICEID}`

		const existing = Object.entries(this.devices).find(([internalId, dev]) => dev.id === id)
		if (existing) {
			if (existing[1].socket === socket) {
				socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Device already added"\n`)
				return
			} else {
				socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Device exists elsewhere"\n`)
				return
			}
		}

		const keysTotal = params.KEYS_TOTAL ? parseInt(params.KEYS_TOTAL) : global.MAX_BUTTONS
		if (isNaN(keysTotal) || keysTotal > global.MAX_BUTTONS || keysTotal <= 0) {
			socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Invalid KEYS_TOTAL"\n`)
			return
		}

		const keysPerRow = params.KEYS_PER_ROW ? parseInt(params.KEYS_PER_ROW) : global.MAX_BUTTONS_PER_ROW
		if (isNaN(keysPerRow) || keysPerRow > global.MAX_BUTTONS || keysPerRow <= 0) {
			socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Invalid KEYS_PER_ROW"\n`)
			return
		}

		socket.logger.debug(`add surface "${id}"`)

		const streamBitmaps = params.BITMAPS === undefined || !isFalsey(params.BITMAPS)
		const streamColors = params.COLORS !== undefined && !isFalsey(params.COLORS)
		const streamText = params.TEXT !== undefined && !isFalsey(params.TEXT)
		const streamTextStyle = params.TEXT_STYLE !== undefined && !isFalsey(params.TEXT_STYLE)

		const device = this.surfaces.addSatelliteDevice({
			path: id,
			keysTotal: keysTotal,
			keysPerRow: keysPerRow,
			socket: socket,
			deviceId: params.DEVICEID,
			productName: params.PRODUCT_NAME,
			streamBitmaps: streamBitmaps,
			streamColors: streamColors,
			streamText: streamText,
			streamTextStyle: streamTextStyle,
		})

		this.devices[id] = {
			id: id,
			socket: socket,
			device: device,
		}

		socket.write(`ADD-DEVICE OK DEVICEID="${params.DEVICEID}"\n`)
	}

	/**
	 * Process a command from a client
	 * @param {Socket} socket - the client socket
	 * @param {string} line - the received command
	 */
	handleCommand(socket, line) {
		if (!line.trim().toUpperCase().startsWith('PING')) {
			socket.logger.silly(`received "${line}"`)
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
			case 'KEY-ROTATE':
				this.keyRotate(socket, params)
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

	listen() {
		this.server = net.createServer((socket) => {
			socket.name = socket.remoteAddress + ':' + socket.remotePort
			socket.logger = this.registry.log.createLogger(`Service/Satellite/${socket.name}`)

			this.initSocket(socket)
		})
		this.server.on('error', (e) => {
			this.logger.debug(`listen-socket error: ${e}`)
		})

		try {
			this.server.listen(this.port)
		} catch (e) {
			this.logger.debug(`ERROR opening port this.port for companion satellite devices`)
		}
	}

	/**
	 * Set up a client socket
	 * @param {Socket} socket - the client socket
	 */
	initSocket(socket) {
		socket.logger.info(`new connection`)

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
			socket.logger.silly('socket error:', e)
		})

		const doCleanup = () => {
			let count = 0
			for (let key in this.devices) {
				if (this.devices[key].socket === socket) {
					this.surfaces.removeDevice(this.devices[key].id)
					delete this.devices[key]
					count++
				}
			}

			socket.logger.info(`connection closed with ${count} connected surfaces`)

			socket.removeAllListeners('data')
			socket.removeAllListeners('close')
		}

		socket.setTimeout(5000)
		socket.on('timeout', () => {
			socket.logger.debug('socket timeout')
			socket.end()
			doCleanup()
		})

		socket.on('close', doCleanup)

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
			socket.write(`KEY-PRESS ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Missing KEY"\n`)
			return
		}
		if (!params.PRESSED) {
			socket.write(`KEY-PRESS ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Missing PRESSED"\n`)
			return
		}

		const key = parseInt(params.KEY)
		if (isNaN(key) || key > global.MAX_BUTTONS || key < 0) {
			socket.write(`KEY-PRESS ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Invalid KEY"\n`)
			return
		}

		const pressed = !isFalsey(params.PRESSED)

		const id = `${params.DEVICEID}`
		const device = this.devices[id]

		if (device && device.socket === socket) {
			device.device.doButton(key, pressed)
			socket.write(`KEY-PRESS OK\n`)
		} else {
			socket.write(`KEY-PRESS ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Device not found"\n`)
		}
	}

	/**
	 * Process a key rotate command
	 * @param {Socket} socket - the client socket
	 * @param {Object} params - the key rotate parameters
	 */
	keyRotate(socket, params) {
		if (!params.DEVICEID) {
			socket.write(`KEY-ROTATE ERROR MESSAGE="Missing DEVICEID"\n`)
			return
		}
		if (!params.KEY) {
			socket.write(`KEY-ROTATE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Missing KEY"\n`)
			return
		}
		if (!params.DIRECTION) {
			socket.write(`KEY-ROTATE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Missing DIRECTION"\n`)
			return
		}

		const key = parseInt(params.KEY)
		if (isNaN(key) || key > global.MAX_BUTTONS || key < 0) {
			socket.write(`KEY-ROTATE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Invalid KEY"\n`)
			return
		}

		const direction = params.DIRECTION >= '1'

		const id = `${params.DEVICEID}`
		const device = this.devices[id]
		if (device && device.socket === socket) {
			device.device.doRotate(key, direction)
			socket.write(`KEY-ROTATE OK\n`)
		} else {
			socket.write(`KEY-ROTATE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Device not found"\n`)
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

		const id = `${params.DEVICEID}`
		const device = this.devices[id]

		if (device && device.socket === socket) {
			socket.logger.info(`remove surface "${id}"`)

			this.surfaces.removeDevice(id)
			delete this.devices[id]
			socket.write(`REMOVE-DEVICE OK DEVICEID="${params.DEVICEID}"\n`)
		} else {
			socket.write(`REMOVE-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Device not found"\n`)
		}
	}
}

export default ServiceSatellite
