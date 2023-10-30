import ServiceBase from './Base.js'
import { isFalsey, parseLineParameters } from '../Resources/Util.js'
import net, { Socket } from 'net'
import { LEGACY_BUTTONS_PER_ROW, LEGACY_MAX_BUTTONS } from '../Util/Constants.js'
import LogController from '../Log/Controller.js'

/**
 * Version of this API. This follows semver, to allow for clients to check their compatibility
 * 1.0.0 - Initial release
 * 1.1.0 - Add KEY-STATE TYPE and PRESSED properties
 * 1.2.0 - Add DEVICEID to any ERROR responses when known
 * 1.3.0 - Add KEY-ROTATE message
 * 1.4.0 - Add TEXT_STYLE as ADD-DEVICE flags with FONT_SIZE as KEY-STATE property
 * 1.5.0 - Specify desired bitmap size with BITMAPS parameter when adding device
 * 1.5.1 - Remove surface size limit
 */
const API_VERSION = '1.5.1'

/**
 * Class providing the Satellite/Remote Surface api.
 *
 * @extends ServiceBase
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
	 * @type {Map<string, SatelliteDevice>}
	 * @access protected
	 */
	#devices = new Map()

	/**
	 * The port to open the socket with.  Default: <code>16622</code>
	 * @type {number}
	 * @access protected
	 */
	port = 16622

	/**
	 * @type {net.Server | undefined}
	 * @access protected
	 */
	server = undefined

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'satellite', 'Service/Satellite', null, null)

		this.init()
	}

	/**
	 *
	 * @param {import('winston').Logger} socketLogger
	 * @param {Socket} socket - the client socket
	 * @param {import('../Resources/Util.js').ParsedParams} params  - the device parameters
	 */
	#addDevice(socketLogger, socket, params) {
		if (!params.DEVICEID) {
			socket.write(`ADD-DEVICE ERROR MESSAGE="Missing DEVICEID"\n`)
			return
		}
		if (!params.PRODUCT_NAME) {
			socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Missing PRODUCT_NAME"\n`)
			return
		}

		const id = `${params.DEVICEID}`

		if (id.startsWith('emulator')) {
			// Some deviceId values are 'special' and cannot be used by satellite
			socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Reserved DEVICEID"\n`)
			return
		}

		const existing = this.#findDeviceById(id)
		if (existing) {
			if (existing.socket === socket) {
				socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Device already added"\n`)
				return
			} else {
				socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Device exists elsewhere"\n`)
				return
			}
		}

		const keysTotal = params.KEYS_TOTAL ? Number(params.KEYS_TOTAL) : LEGACY_MAX_BUTTONS
		if (isNaN(keysTotal) || keysTotal <= 0) {
			socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Invalid KEYS_TOTAL"\n`)
			return
		}

		const keysPerRow = params.KEYS_PER_ROW ? Number(params.KEYS_PER_ROW) : LEGACY_BUTTONS_PER_ROW
		if (isNaN(keysPerRow) || keysPerRow <= 0) {
			socket.write(`ADD-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Invalid KEYS_PER_ROW"\n`)
			return
		}

		socketLogger.debug(`add surface "${id}"`)

		let streamBitmapSize = null
		if (params.BITMAPS !== undefined && !isFalsey(params.BITMAPS)) {
			streamBitmapSize = Number(params.BITMAPS)
			if (isNaN(streamBitmapSize) || streamBitmapSize < 5) {
				// If it looks like a boolean value, use the old hardcoded size
				streamBitmapSize = 72
			}
		}

		const streamColors = params.COLORS !== undefined && !isFalsey(params.COLORS)
		const streamText = params.TEXT !== undefined && !isFalsey(params.TEXT)
		const streamTextStyle = params.TEXT_STYLE !== undefined && !isFalsey(params.TEXT_STYLE)

		const device = this.surfaces.addSatelliteDevice({
			path: id,
			gridSize: {
				columns: keysPerRow,
				rows: keysTotal / keysPerRow,
			},
			socket: socket,
			deviceId: id,
			productName: `${params.PRODUCT_NAME}`,
			streamBitmapSize: streamBitmapSize,
			streamColors: streamColors,
			streamText: streamText,
			streamTextStyle: streamTextStyle,
		})

		this.#devices.set(id, {
			id: id,
			socket: socket,
			device: device,
		})

		socket.write(`ADD-DEVICE OK DEVICEID="${params.DEVICEID}"\n`)
	}

	/**
	 *
	 * @param {string} id
	 * @returns {SatelliteDevice | undefined}
	 */
	#findDeviceById(id) {
		for (const device of this.#devices.values()) {
			if (device.id === id) return device
		}
		return undefined
	}

	/**
	 * Process a command from a client
	 * @param {import('winston').Logger} socketLogger
	 * @param {Socket} socket - the client socket
	 * @param {string} line - the received command
	 */
	#handleCommand(socketLogger, socket, line) {
		if (!line.trim().toUpperCase().startsWith('PING')) {
			socketLogger.silly(`received "${line}"`)
		}

		const i = line.indexOf(' ')
		const cmd = i === -1 ? line : line.slice(0, i)
		const body = i === -1 ? '' : line.slice(i + 1)
		const params = parseLineParameters(body)

		switch (cmd.toUpperCase()) {
			case 'ADD-DEVICE':
				this.#addDevice(socketLogger, socket, params)
				break
			case 'REMOVE-DEVICE':
				this.#removeDevice(socketLogger, socket, params)
				break
			case 'KEY-PRESS':
				this.#keyPress(socket, params)
				break
			case 'KEY-ROTATE':
				this.#keyRotate(socket, params)
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
			const name = socket.remoteAddress + ':' + socket.remotePort
			const logger = LogController.createLogger(`Service/Satellite/${name}`)

			this.initSocket(logger, socket)
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
	 * @param {import('winston').Logger} socketLogger
	 * @param {Socket} socket - the client socket
	 */
	initSocket(socketLogger, socket) {
		socketLogger.info(`new connection`)

		let receivebuffer = ''
		socket.on('data', (data) => {
			receivebuffer += data.toString()

			let i = 0,
				line = '',
				offset = 0
			while ((i = receivebuffer.indexOf('\n', offset)) !== -1) {
				line = receivebuffer.substr(offset, i - offset)
				offset = i + 1
				this.#handleCommand(socketLogger, socket, line.toString().replace(/\r/, ''))
			}
			receivebuffer = receivebuffer.substr(offset)
		})

		socket.on('error', (e) => {
			socketLogger.silly('socket error:', e)
		})

		const doCleanup = () => {
			let count = 0
			for (let [key, device] of this.#devices.entries()) {
				if (device.socket === socket) {
					this.surfaces.removeDevice(device.id)
					this.#devices.delete(key)
					count++
				}
			}

			socketLogger.info(`connection closed with ${count} connected surfaces`)

			socket.removeAllListeners('data')
			socket.removeAllListeners('close')
		}

		socket.setTimeout(5000)
		socket.on('timeout', () => {
			socketLogger.debug('socket timeout')
			socket.end()
			doCleanup()
		})

		socket.on('close', doCleanup)

		socket.write(`BEGIN CompanionVersion=${this.registry.appInfo.appBuild} ApiVersion=${API_VERSION}\n`)
	}

	/**
	 * Process a key press command
	 * @param {Socket} socket - the client socket
	 * @param {import('../Resources/Util.js').ParsedParams} params - the key press parameters
	 */
	#keyPress(socket, params) {
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

		const key = Number(params.KEY)
		if (isNaN(key) || key > LEGACY_MAX_BUTTONS || key < 0) {
			socket.write(`KEY-PRESS ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Invalid KEY"\n`)
			return
		}

		const pressed = !isFalsey(params.PRESSED)

		const id = `${params.DEVICEID}`
		const device = this.#devices.get(id)

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
	 * @param {import('../Resources/Util.js').ParsedParams} params - the key rotate parameters
	 */
	#keyRotate(socket, params) {
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

		const key = Number(params.KEY)
		if (isNaN(key) || key > LEGACY_MAX_BUTTONS || key < 0) {
			socket.write(`KEY-ROTATE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Invalid KEY"\n`)
			return
		}

		const direction = params.DIRECTION >= '1'

		const id = `${params.DEVICEID}`
		const device = this.#devices.get(id)
		if (device && device.socket === socket) {
			device.device.doRotate(key, direction)
			socket.write(`KEY-ROTATE OK\n`)
		} else {
			socket.write(`KEY-ROTATE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Device not found"\n`)
		}
	}

	/**
	 *
	 * @param {import('winston').Logger} socketLogger
	 * @param {Socket} socket - the client socket
	 * @param {import('../Resources/Util.js').ParsedParams} params  - the device parameters
	 */
	#removeDevice(socketLogger, socket, params) {
		if (!params.DEVICEID) {
			socket.write(`REMOVE-DEVICE ERROR MESSAGE="Missing DEVICEID"\n`)
			return
		}

		const id = `${params.DEVICEID}`
		const device = this.#devices.get(id)

		if (device && device.socket === socket) {
			socketLogger.info(`remove surface "${id}"`)

			this.surfaces.removeDevice(id)
			this.#devices.delete(id)
			socket.write(`REMOVE-DEVICE OK DEVICEID="${params.DEVICEID}"\n`)
		} else {
			socket.write(`REMOVE-DEVICE ERROR DEVICEID="${params.DEVICEID}" MESSAGE="Device not found"\n`)
		}
	}
}

export default ServiceSatellite

/**
 * @typedef {{
 *   id: string
 *   socket: Socket
 *   device: import('../Surface/IP/Satellite.js').default
 * }} SatelliteDevice
 */
