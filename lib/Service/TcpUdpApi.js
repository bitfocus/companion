import CoreBase from '../Core/Base.js'
import { parseColorToNumber } from '../Resources/Util.js'
import { formatLocation } from '../Shared/ControlId.js'
import RegexRouter from './RegexRouter.js'

/**
 * Common API command processing for {@link ServiceTcp} and {@link ServiceUdp}.
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.3.0
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
export class ServiceTcpUdpApi extends CoreBase {
	/**
	 * Message router
	 * @type {RegexRouter}
	 * @access private
	 * @readonly
	 */
	#router

	/**
	 * Protocol name
	 * @type {string}
	 * @access private
	 * @readonly
	 */
	#protocolName

	/**
	 * Userconfig key to enable/disable legacy routes
	 * @type {string | null}
	 * @access private
	 * @readonly
	 */
	#legacyRoutesEnableKey

	get router() {
		return this.#router
	}

	/**
	 * @param {import('../Registry.js').default} registry - the core registry
	 * @param {string} protocolName - the protocol name
	 * @param {string | null} legacyRoutesEnableKey - Userconfig key to enable/disable legacy routes
	 */
	constructor(registry, protocolName, legacyRoutesEnableKey) {
		super(registry, 'api', 'Service/Api')

		this.#router = new RegexRouter(() => {
			throw new ApiMessageError('Syntax error')
		})
		this.#protocolName = protocolName
		this.#legacyRoutesEnableKey = legacyRoutesEnableKey

		this.#setupLegacyRoutes()
		this.#setupNewRoutes()
	}

	#checkLegacyRouteAllowed() {
		if (this.#legacyRoutesEnableKey && !this.userconfig.getKey(this.#legacyRoutesEnableKey)) {
			throw new ApiMessageError('Deprecated commands are disabled')
		}
	}

	#setupLegacyRoutes() {
		this.#router.addPath('page-set :page(\\d+) :deviceId', (match) => {
			this.#checkLegacyRouteAllowed()

			const page = parseInt(match.page)
			const deviceId = match.deviceId

			this.surfaces.devicePageSet(deviceId, page)

			return `If ${deviceId} is connected`
		})

		this.#router.addPath('page-up :deviceId', (match) => {
			this.#checkLegacyRouteAllowed()

			const deviceId = match.deviceId

			this.surfaces.devicePageUp(deviceId)

			return `If ${deviceId} is connected`
		})

		this.#router.addPath('page-down :deviceId', (match) => {
			this.#checkLegacyRouteAllowed()

			const deviceId = match.deviceId

			this.surfaces.devicePageDown(deviceId)

			return `If ${deviceId} is connected`
		})

		this.#router.addPath('bank-press :page(\\d+) :bank(\\d+)', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(match.page, match.bank)

			this.logger.info(`Got bank-press (trigger) ${controlId}`)

			if (!this.controls.pressControl(controlId, true, this.#protocolName)) {
				throw new ApiMessageError('Page/bank out of range')
			}

			setTimeout(() => {
				this.logger.info(`Auto releasing bank-press ${controlId}`)
				this.controls.pressControl(controlId, false, this.#protocolName)
			}, 20)
		})

		this.#router.addPath('bank-down :page(\\d+) :bank(\\d+)', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(match.page, match.bank)

			this.logger.info(`Got bank-down (trigger) ${controlId}`)

			if (!this.controls.pressControl(controlId, true, this.#protocolName)) {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('bank-up :page(\\d+) :bank(\\d+)', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(match.page, match.bank)

			this.logger.info(`Got bank-up (trigger) ${controlId}`)

			if (!this.controls.pressControl(controlId, false, this.#protocolName)) {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('bank-step :page(\\d+) :bank(\\d+) :step(\\d+)', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = CreateBankControlId(parseInt(match.page), parseInt(match.bank))
			const step = parseInt(match.step)

			this.logger.info(`Got bank-step (trigger) ${controlId} ${step}`)

			if (isNaN(step) || step <= 0) throw new ApiMessageError('Step out of range')

			const control = this.controls.getControl(controlId)
			if (!control || typeof control.stepMakeCurrent !== 'function') throw new ApiMessageError('Invalid control')

			if (!control.stepMakeCurrent(step)) throw new ApiMessageError('Step out of range')
		})

		this.#router.addPath('style bank :page(\\d+) :bank(\\d+) text{ :text}?', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(match.page, match.bank)

			const control = this.controls.getControl(controlId)

			if (control && typeof control.styleSetFields === 'function') {
				const text = match.text || ''

				control.styleSetFields({ text: text })
			} else {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('style bank :page(\\d+) :bank(\\d+) bgcolor #:color([a-f\\d]+)', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(match.page, match.bank)

			const color = parseInt(match.color, 16)
			if (isNaN(color)) throw new ApiMessageError('Invalid color')

			const control = this.controls.getControl(controlId)

			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ bgcolor: color })
			} else {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('style bank :page(\\d+) :bank(\\d+) color #:color([a-f\\d]+)', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(match.page, match.bank)

			const color = parseInt(match.color, 16)
			if (isNaN(color)) throw new ApiMessageError('Invalid color')

			const control = this.controls.getControl(controlId)

			if (control && typeof control.styleSetFields === 'function') {
				control.styleSetFields({ color: color })
			} else {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('rescan', async () => {
			this.#checkLegacyRouteAllowed()

			this.logger.debug('Rescanning USB')

			try {
				await this.surfaces.triggerRefreshDevices()
			} catch (e) {
				throw new ApiMessageError('Scan failed')
			}
		})
	}

	#surfaceSetPage = (match) => {
		const page = parseInt(match.page)
		const surfaceId = match.surfaceId

		this.surfaces.devicePageSet(surfaceId, page)

		return `If ${surfaceId} is connected`
	}
	#surfacePageUp = (match) => {
		const surfaceId = match.surfaceId

		this.surfaces.devicePageUp(surfaceId)

		return `If ${surfaceId} is connected`
	}
	#surfacePageDown = (match) => {
		const surfaceId = match.surfaceId

		this.surfaces.devicePageDown(surfaceId)

		return `If ${surfaceId} is connected`
	}

	#locationPress = (match) => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location press at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.pressControl(controlId, true, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}

		setTimeout(() => {
			this.logger.info(`Auto releasing ${formatLocation(location)} (${controlId})`)
			this.controls.pressControl(controlId, false, this.#protocolName)
		}, 20)
	}
	#locationDown = (match) => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location down at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.pressControl(controlId, true, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}
	}
	#locationUp = (match) => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location up at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.pressControl(controlId, false, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}
	}
	#locationRotateLeft = (match) => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location rotate-left at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.rotateControl(controlId, false, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}
	}
	#locationRotateRight = (match) => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location rotate-right at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.rotateControl(controlId, true, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}
	}
	#locationSetStep = (match) => {
		const step = parseInt(match.step)
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location set-step at ${formatLocation(location)} (${controlId}) to ${step}`)
		if (!controlId) {
			throw new ApiMessageError('No control at location')
		}

		const control = this.controls.getControl(controlId)
		if (!control || typeof control.stepMakeCurrent !== 'function') {
			throw new ApiMessageError('No control at location')
		}

		if (!control.stepMakeCurrent(step)) throw new ApiMessageError('Step out of range')
	}

	#locationStyleText = (match) => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location style text at ${formatLocation(location)} (${controlId}) `)
		if (!controlId) {
			throw new ApiMessageError('No control at location')
		}

		const control = this.controls.getControl(controlId)
		if (control && typeof control.styleSetFields === 'function') {
			const text = match.text || ''

			control.styleSetFields({ text: text })
		} else {
			throw new ApiMessageError('No control at location')
		}
	}

	#locationStyleColor = (match) => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location style color at ${formatLocation(location)} (${controlId}) `)
		if (!controlId) {
			throw new ApiMessageError('No control at location')
		}

		const control = this.controls.getControl(controlId)
		if (control && typeof control.styleSetFields === 'function') {
			const color = parseColorToNumber(match.color)

			control.styleSetFields({ color: color })
		} else {
			throw new ApiMessageError('No control at location')
		}
	}

	#locationStyleBgcolor = (match) => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location style bgcolor at ${formatLocation(location)} (${controlId}) `)
		if (!controlId) {
			throw new ApiMessageError('No control at location')
		}

		const control = this.controls.getControl(controlId)
		if (control && typeof control.styleSetFields === 'function') {
			const color = parseColorToNumber(match.bgcolor)

			control.styleSetFields({ bgcolor: color })
		} else {
			throw new ApiMessageError('No control at location')
		}
	}

	#setupNewRoutes() {
		// surface pages
		this.#router.addPath('surface :surfaceId page-set :page(\\d+)', this.#surfaceSetPage)
		this.#router.addPath('surface :surfaceId page-up', this.#surfacePageUp)
		this.#router.addPath('surface :surfaceId page-down', this.#surfacePageDown)

		// control by location
		this.#router.addPath('location :page(\\d+)/:row(\\d+)/:column(\\d+) press', this.#locationPress)
		this.#router.addPath('location :page(\\d+)/:row(\\d+)/:column(\\d+) down', this.#locationDown)
		this.#router.addPath('location :page(\\d+)/:row(\\d+)/:column(\\d+) up', this.#locationUp)
		this.#router.addPath('location :page(\\d+)/:row(\\d+)/:column(\\d+) rotate-left', this.#locationRotateLeft)
		this.#router.addPath('location :page(\\d+)/:row(\\d+)/:column(\\d+) rotate-right', this.#locationRotateRight)
		this.#router.addPath('location :page(\\d+)/:row(\\d+)/:column(\\d+) set-step :step(\\d+)', this.#locationSetStep)

		this.#router.addPath('location :page(\\d+)/:row(\\d+)/:column(\\d+) style text{ :text}?', this.#locationStyleText)
		this.#router.addPath(
			'location :page(\\d+)/:row(\\d+)/:column(\\d+) style color :color(.+)',
			this.#locationStyleColor
		)
		this.#router.addPath(
			'location :page(\\d+)/:row(\\d+)/:column(\\d+) style bgcolor :bgcolor(.+)',
			this.#locationStyleBgcolor
		)

		// surfaces
		this.#router.addPath('surfaces rescan', async () => {
			this.logger.debug('Rescanning USB')

			try {
				await this.surfaces.triggerRefreshDevices()
			} catch (e) {
				throw new ApiMessageError('Scan failed')
			}
		})

		// custom variables
		this.#router.addPath('custom-variable :name set-value :value(.*)', this.#customVariableSetValue)
	}

	#customVariableSetValue = (match) => {
		const result = this.instance.variable.custom.setValue(match.name, match.value)
		if (result) {
			throw new ApiMessageError(result)
		}
	}

	#locationParse = (match) => {
		const location = {
			pageNumber: Number(match.page),
			row: Number(match.row),
			column: Number(match.column),
		}

		const controlId = this.registry.page.getControlIdAt(location)

		return {
			location,
			controlId,
		}
	}

	/**
	 * Fire an API command from a raw TCP/UDP command
	 * @param {string} data - the raw command
	 */
	async parseApiCommand(data) {
		data = data.trim()
		this.logger.silly(`API parsing command: ${data}`)

		return this.#router.processMessage(data)
	}
}

export class ApiMessageError extends Error {
	constructor(message) {
		super(message)
	}
}
