import ServiceBase from './Base.js'
import { isFalsey, isTruthy, parseLineParameters, parseStringParamWithBooleanFallback } from '../Resources/Util.js'
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
 * 1.6.0 - Allow for row/column notation,
 * 		 - add streaming of text color when color is requested,
 * 		 - allow choice of returned color format
 * 		 - compatibility with internal CSS colors,
 * 		 - allow buttons > 32
 * 1.7.0 - Support for transferable values. This allows surfaces to emit and consume values that don't align with a control in the grid.
 *       - allow surface to opt out of brightness slider and messages
 */
const API_VERSION = '1.7.0'

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
		super(registry, 'Service/Satellite', null, null)

		this.init()
	}

	/**
	 *
	 * @param {import('winston').Logger} socketLogger
	 * @param {Socket} socket - the client socket
	 * @param {import('../Resources/Util.js').ParsedParams} params  - the device parameters
	 */
	#addDevice(socketLogger, socket, params) {
		const messageName = 'ADD-DEVICE'
		if (!params.DEVICEID || params.DEVICEID === true) {
			return this.#formatAndSendError(socket, messageName, undefined, 'Missing DEVICEID')
		}
		if (!params.PRODUCT_NAME) {
			return this.#formatAndSendError(socket, messageName, params.DEVICEID, 'Missing PRODUCT_NAME')
		}

		const id = `${params.DEVICEID}`

		if (id.startsWith('emulator')) {
			// Some deviceId values are 'special' and cannot be used by satellite
			return this.#formatAndSendError(socket, messageName, id, 'Reserved DEVICEID')
		}

		const existing = this.#findDeviceById(id)
		if (existing) {
			if (existing.socket === socket) {
				return this.#formatAndSendError(socket, messageName, id, 'Device already added')
			} else {
				return this.#formatAndSendError(existing.socket, messageName, id, 'Device exists elsewhere')
			}
		}

		const keysTotal = params.KEYS_TOTAL ? Number(params.KEYS_TOTAL) : LEGACY_MAX_BUTTONS
		if (isNaN(keysTotal) || keysTotal <= 0) {
			return this.#formatAndSendError(socket, messageName, id, 'Invalid KEYS_TOTAL')
		}

		const keysPerRow = params.KEYS_PER_ROW ? Number(params.KEYS_PER_ROW) : LEGACY_BUTTONS_PER_ROW
		if (isNaN(keysPerRow) || keysPerRow <= 0) {
			return this.#formatAndSendError(socket, messageName, id, 'Invalid KEYS_PER_ROW')
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

		const streamColors = parseStringParamWithBooleanFallback(['hex', 'rgb'], 'hex', params.COLORS) || false
		const streamText = params.TEXT !== undefined && isTruthy(params.TEXT)
		const streamTextStyle = params.TEXT_STYLE !== undefined && isTruthy(params.TEXT_STYLE)
		const supportsBrightness = params.BRIGHTNESS === undefined || isTruthy(params.BRIGHTNESS)

		/** @type {import('../Surface/IP/Satellite.js').SatelliteTransferableValue[]} */
		let transferVariables
		try {
			transferVariables = parseTransferableValues(params.VARIABLES)
		} catch (e) {
			return this.#formatAndSendError(socket, messageName, id, 'Invalid VARIABLES')
		}

		const device = this.surfaces.addSatelliteDevice({
			path: id,
			gridSize: {
				columns: keysPerRow,
				rows: keysTotal / keysPerRow,
			},
			socket,
			deviceId: id,
			productName: `${params.PRODUCT_NAME}`,
			supportsBrightness,
			streamBitmapSize,
			streamColors,
			streamText,
			streamTextStyle,
			transferVariables,
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
			case 'SET-VARIABLE-VALUE':
				this.#setVariableValue(socket, params)
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
	 * Format and send an error message
	 * @param {Socket} socket - the client socket
	 * @param {string} messageName - the message name
	 * @param {string | undefined} deviceId
	 * @param {string} message - the message. this must not contain any newlines, or `"` characters
	 * @returns {void}
	 */
	#formatAndSendError(socket, messageName, deviceId, message) {
		if (deviceId) {
			socket.write(`${messageName} ERROR DEVICEID="${deviceId}" MESSAGE="${message}"\n`)
		} else {
			socket.write(`${messageName} ERROR MESSAGE="${message}"\n`)
		}
	}

	/**
	 * Format and send an error message
	 * @param {Socket} socket - the client socket
	 * @param {string} messageName - the message name
	 * @returns {void}
	 */
	#formatAndSendOk(socket, messageName) {
		socket.write(`${messageName} OK\n`)
	}

	/**
	 * Process a key press command
	 * @param {Socket} socket - the client socket
	 * @param {string} messageName - the message name
	 * @param {import('../Resources/Util.js').ParsedParams} params - the message parameters
	 * @returns {SatelliteDevice | undefined}
	 */
	#parseDeviceFromMessageAndReportError(socket, messageName, params) {
		if (!params.DEVICEID) {
			this.#formatAndSendError(socket, messageName, undefined, 'Missing DEVICEID')
			return
		}
		const id = `${params.DEVICEID}`
		const device = this.#devices.get(id)
		if (device === undefined || device.socket !== socket) {
			this.#formatAndSendError(socket, messageName, id, 'Device not found')
			return
		}

		return device
	}

	/**
	 * Process a key press command
	 * @param {Socket} socket - the client socket
	 * @param {import('../Resources/Util.js').ParsedParams} params - the key press parameters
	 */
	#keyPress(socket, params) {
		const messageName = 'KEY-PRESS'
		const device = this.#parseDeviceFromMessageAndReportError(socket, messageName, params)
		if (!device) return
		const id = device.id

		if (!params.KEY) {
			return this.#formatAndSendError(socket, messageName, id, 'Missing KEY')
		}
		const xy = device.device.parseKeyParam(params.KEY.toString())
		if (!xy) {
			return this.#formatAndSendError(socket, messageName, id, 'Invalid KEY')
		}
		if (!params.PRESSED) {
			return this.#formatAndSendError(socket, messageName, id, 'Missing PRESSED')
		}
		const pressed = !isFalsey(params.PRESSED)

		device.device.doButton(...xy, pressed)
		this.#formatAndSendOk(socket, messageName)
	}

	/**
	 * Process a key rotate command
	 * @param {Socket} socket - the client socket
	 * @param {import('../Resources/Util.js').ParsedParams} params - the key rotate parameters
	 */
	#keyRotate(socket, params) {
		const messageName = 'KEY-ROTATE'
		const device = this.#parseDeviceFromMessageAndReportError(socket, messageName, params)
		if (!device) return
		const id = device.id

		if (!params.KEY) {
			return this.#formatAndSendError(socket, messageName, id, 'Missing KEY')
		}
		const xy = device.device.parseKeyParam(params.KEY.toString())
		if (!xy) {
			return this.#formatAndSendError(socket, messageName, id, 'Invalid KEY')
		}
		if (!params.DIRECTION) {
			return this.#formatAndSendError(socket, messageName, id, 'Missing DIRECTION')
		}

		const direction = params.DIRECTION >= '1'

		device.device.doRotate(...xy, direction)
		this.#formatAndSendOk(socket, messageName)
	}

	/**
	 * Process a set variable value command
	 * @param {Socket} socket - the client socket
	 * @param {import('../Resources/Util.js').ParsedParams} params - the variable value parameters
	 */
	#setVariableValue(socket, params) {
		const messageName = 'SET-VARIABLE-VALUE'
		const device = this.#parseDeviceFromMessageAndReportError(socket, messageName, params)
		if (!device) return
		const id = device.id

		const variableName = params.VARIABLE
		if (!variableName || variableName === true) {
			return this.#formatAndSendError(socket, messageName, id, 'Missing VARIABLE')
		}

		const encodedValue = params.VALUE
		if (encodedValue === undefined || encodedValue === true) {
			return this.#formatAndSendError(socket, messageName, id, 'Missing VALUE')
		}

		const variableValue = Buffer.from(encodedValue, 'base64').toString()

		device.device.setVariableValue(variableName, variableValue)
		this.#formatAndSendOk(socket, messageName)
	}

	/**
	 *
	 * @param {import('winston').Logger} socketLogger
	 * @param {Socket} socket - the client socket
	 * @param {import('../Resources/Util.js').ParsedParams} params  - the device parameters
	 */
	#removeDevice(socketLogger, socket, params) {
		const messageName = 'REMOVE-DEVICE'
		const device = this.#parseDeviceFromMessageAndReportError(socket, messageName, params)
		if (!device) return
		const id = device.id

		socketLogger.info(`remove surface "${id}"`)

		this.surfaces.removeDevice(id)
		this.#devices.delete(id)
		socket.write(`${messageName} OK DEVICEID="${params.DEVICEID}"\n`)
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

/**
 *
 * @param {string | true | undefined} input
 * @returns {import('../Surface/IP/Satellite.js').SatelliteTransferableValue[]}
 */
function parseTransferableValues(input) {
	if (typeof input !== 'string') return []

	const decodedInput = JSON.parse(Buffer.from(input, 'base64').toString())
	if (!decodedInput) return []

	/** @type {import('../Surface/IP/Satellite.js').SatelliteTransferableValue[]} */
	const definitions = []

	for (const field of decodedInput) {
		const type = field.type
		if (type !== 'input' && type !== 'output') {
			throw new Error('Invalid transferable value definition')
		}

		const id = field.id
		const name = field.name
		const description = field.description

		if (typeof id !== 'string' || typeof name !== 'string') {
			throw new Error('Invalid transferable value definition')
		}
		if (description && typeof description !== 'string') {
			throw new Error('Invalid transferable value definition')
		}

		definitions.push({
			id,
			type,
			name,
			description: description || undefined,
		})
	}

	return definitions
}
