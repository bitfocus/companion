import {
	isFalsey,
	isTruthy,
	ParsedParams,
	parseLineParameters,
	parseStringParamWithBooleanFallback,
} from '../Resources/Util.js'
import { LEGACY_BUTTONS_PER_ROW, LEGACY_MAX_BUTTONS } from '../Resources/Constants.js'
import { Logger } from '../Log/Controller.js'
import type { SatelliteTransferableValue, SurfaceIPSatellite } from '../Surface/IP/Satellite.js'
import type { AppInfo } from '../Registry.js'
import type { SurfaceController } from '../Surface/Controller.js'

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
 * 1.7.1 - Respond with variable name in SET-VARIABLE-VALUE success message
 * 1.8.0 - Add support for remote surface to handle display of locked state
 */
const API_VERSION = '1.8.0'

export type SatelliteMessageArgs = Record<string, string | number | boolean>

export abstract class SatelliteSocketWrapper {
	abstract readonly remoteAddress?: string

	protected abstract write(data: string): void

	sendMessage(
		messageName: string,
		status: 'OK' | 'ERROR' | null,
		deviceId: string | null,
		args: SatelliteMessageArgs
	): void {
		const chunks: string[] = [messageName]
		if (status) chunks.push(status)
		if (deviceId) chunks.push(`DEVICEID="${deviceId}"`)

		for (const [key, value] of Object.entries(args)) {
			let valueStr: string
			if (typeof value === 'boolean') {
				valueStr = value ? '1' : '0'
			} else if (typeof value === 'number') {
				valueStr = value.toString()
			} else {
				valueStr = `"${value}"`
			}
			chunks.push(`${key}=${valueStr}`)
		}

		chunks.push('\n')
		this.write(chunks.join(' '))
	}

	abstract destroy(): void
}

export interface SatelliteInitSocketResult {
	processMessage: (data: string) => void
	cleanupDevices: () => number
}

/**
 * Class providing the Satellite/Remote Surface api.
 *
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
 */
export class ServiceSatelliteApi {
	// readonly #logger = LogController.createLogger('Service/SatelliteApi')

	readonly #appInfo: AppInfo
	readonly #surfaceController: SurfaceController

	/**
	 * The remote devices
	 */
	#devices = new Map<string, SatelliteDevice>()

	constructor(appInfo: AppInfo, surfaceController: SurfaceController) {
		this.#appInfo = appInfo
		this.#surfaceController = surfaceController
	}

	/**
	 *
	 */
	#addDevice(socketLogger: Logger, socket: SatelliteSocketWrapper, params: ParsedParams): void {
		const messageName = 'ADD-DEVICE'
		if (!params.DEVICEID || params.DEVICEID === true) {
			return this.#formatAndSendError(socket, messageName, undefined, 'Missing DEVICEID')
		}
		if (!params.PRODUCT_NAME) {
			return this.#formatAndSendError(socket, messageName, params.DEVICEID, 'Missing PRODUCT_NAME')
		}

		const id = `${params.DEVICEID}`

		if (id.startsWith('emulator:') || id.startsWith('group:')) {
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
		const supportsLockedState =
			params.PINCODE_LOCK !== undefined && (params.PINCODE_LOCK === 'FULL' || params.PINCODE_LOCK === 'PARTIAL')

		let transferVariables: SatelliteTransferableValue[]
		try {
			transferVariables = parseTransferableValues(params.VARIABLES)
		} catch (_e) {
			return this.#formatAndSendError(socket, messageName, id, 'Invalid VARIABLES')
		}

		const device = this.#surfaceController.addSatelliteDevice({
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
			supportsLockedState,
		})

		this.#devices.set(id, {
			id: id,
			socket: socket,
			device: device,
		})

		socket.sendMessage(messageName, 'OK', id, {})
	}

	/**
	 *
	 */
	#findDeviceById(id: string): SatelliteDevice | undefined {
		for (const device of this.#devices.values()) {
			if (device.id === id) return device
		}
		return undefined
	}

	/**
	 * Process a command from a client
	 */
	#handleCommand(socketLogger: Logger, socket: SatelliteSocketWrapper, line: string): void {
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
			case 'PINCODE-KEY':
				this.#pincodeKey(socket, params)
				break
			case 'PING':
				socket.sendMessage(`PONG ${body}`, null, null, {})
				break
			case 'PONG':
				// Nothing to do
				// TODO - track timeouts?
				break
			case 'QUIT':
				socket.destroy()
				break
			default:
				socket.sendMessage('ERROR', null, null, {
					MESSAGE: 'Unknown command: ${cmd.toUpperCase()}',
				})
		}
	}

	/**
	 * Set up a client socket
	 */
	initSocket(socketLogger: Logger, socket: SatelliteSocketWrapper): SatelliteInitSocketResult {
		socketLogger.info(`new connection`)

		socket.sendMessage('BEGIN', null, null, {
			CompanionVersion: this.#appInfo.appBuild,
			ApiVersion: API_VERSION,
		})

		let receivebuffer = ''
		return {
			processMessage: (data) => {
				receivebuffer += data

				let i = 0,
					line = '',
					offset = 0
				while ((i = receivebuffer.indexOf('\n', offset)) !== -1) {
					line = receivebuffer.substr(offset, i - offset)
					offset = i + 1
					try {
						this.#handleCommand(socketLogger, socket, line.toString().replace(/\r/, ''))
					} catch (e: any) {
						socketLogger.error(`Error processing command: ${e?.message ?? e}`)
					}
				}
				receivebuffer = receivebuffer.substr(offset)
			},
			cleanupDevices: () => {
				let count = 0
				for (const [key, device] of this.#devices.entries()) {
					if (device.socket === socket) {
						this.#surfaceController.removeDevice(device.id)
						this.#devices.delete(key)
						count++
					}
				}
				return count
			},
		}
	}

	/**
	 * Format and send an error message
	 * @param socket - the client socket
	 * @param messageName - the message name
	 * @param deviceId
	 * @param message - the message. this must not contain any newlines, or `"` characters
	 */
	#formatAndSendError(
		socket: SatelliteSocketWrapper,
		messageName: string,
		deviceId: string | undefined,
		message: string
	): void {
		socket.sendMessage(messageName, 'ERROR', deviceId ?? null, { MESSAGE: message })
	}

	/**
	 * Process a key press command
	 * @param socket - the client socket
	 * @param messageName - the message name
	 * @param params - the message parameters
	 */
	#parseDeviceFromMessageAndReportError(
		socket: SatelliteSocketWrapper,
		messageName: string,
		params: ParsedParams
	): SatelliteDevice | undefined {
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
	 */
	#keyPress(socket: SatelliteSocketWrapper, params: ParsedParams): void {
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
		socket.sendMessage(messageName, 'OK', id, {})
	}

	/**
	 * Process a pincode key command
	 */
	#pincodeKey(socket: SatelliteSocketWrapper, params: ParsedParams): void {
		const messageName = 'PINCODE-KEY'
		const device = this.#parseDeviceFromMessageAndReportError(socket, messageName, params)
		if (!device) return
		const id = device.id

		const key = params.KEY
		if (!key) {
			return this.#formatAndSendError(socket, messageName, id, 'Missing KEY')
		}

		const keyNumber = Number(key)
		if (isNaN(keyNumber) || keyNumber < 0 || keyNumber > 9) {
			return this.#formatAndSendError(socket, messageName, id, 'Invalid KEY')
		}

		device.device.doPincodeKey(keyNumber)

		socket.sendMessage(messageName, 'OK', id, {})
	}

	/**
	 * Process a key rotate command
	 */
	#keyRotate(socket: SatelliteSocketWrapper, params: ParsedParams): void {
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
		socket.sendMessage(messageName, 'OK', id, {})
	}

	/**
	 * Process a set variable value command
	 */
	#setVariableValue(socket: SatelliteSocketWrapper, params: ParsedParams): void {
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
		socket.sendMessage(messageName, 'OK', id, { VARIABLE: variableName })
	}

	#removeDevice(socketLogger: Logger, socket: SatelliteSocketWrapper, params: ParsedParams): void {
		const messageName = 'REMOVE-DEVICE'
		const device = this.#parseDeviceFromMessageAndReportError(socket, messageName, params)
		if (!device) return
		const id = device.id

		socketLogger.info(`remove surface "${id}"`)

		this.#surfaceController.removeDevice(id)
		this.#devices.delete(id)
		socket.sendMessage(messageName, 'OK', id, {})
	}
}

interface SatelliteDevice {
	id: string
	socket: SatelliteSocketWrapper
	device: SurfaceIPSatellite
}

function parseTransferableValues(input: string | true | undefined): SatelliteTransferableValue[] {
	if (typeof input !== 'string') return []

	const decodedInput = JSON.parse(Buffer.from(input, 'base64').toString())
	if (!decodedInput) return []

	const definitions: SatelliteTransferableValue[] = []

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
