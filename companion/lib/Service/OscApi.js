import CoreBase from '../Core/Base.js'
import { parseColorToNumber, rgb } from '../Resources/Util.js'
import { formatLocation } from '../Shared/ControlId.js'
import RegexRouter from './RegexRouter.js'

/**
 * Class providing the OSC API.
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.2.0
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
export class ServiceOscApi extends CoreBase {
	/**
	 * Message router
	 * @type {RegexRouter}
	 * @access private
	 */
	#router

	get router() {
		return this.#router
	}

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'osc-api', 'Service/OscApi')

		this.#router = new RegexRouter()

		this.#setupLegacyOscRoutes()
		this.#setupNewOscRoutes()
	}

	#isLegacyRouteAllowed() {
		return !!this.userconfig.getKey('osc_legacy_api_enabled')
	}

	#setupLegacyOscRoutes() {
		this.#router.addPath('/press/bank/:page(\\d+)/:bank(\\d+)', (match, message) => {
			if (!this.#isLegacyRouteAllowed()) return

			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) return

			if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == '1') {
				this.logger.info(`Got /press/bank/ (press) for ${controlId}`)
				this.controls.pressControl(controlId, true, undefined)
			} else if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == '0') {
				this.logger.info(`Got /press/bank/ (release) for ${controlId}`)
				this.controls.pressControl(controlId, false, undefined)
			} else {
				this.logger.info(`Got /press/bank/ (trigger)${controlId}`)
				this.controls.pressControl(controlId, true, undefined)

				setTimeout(() => {
					this.logger.info(`Auto releasing /press/bank/ (trigger)${controlId}`)
					this.controls.pressControl(controlId, false, undefined)
				}, 20)
			}
		})

		this.#router.addPath('/style/bgcolor/:page(\\d+)/:bank(\\d+)', (match, message) => {
			if (!this.#isLegacyRouteAllowed()) return

			if (message.args.length > 2) {
				const r = message.args[0].value
				const g = message.args[1].value
				const b = message.args[2].value
				if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
					const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
					if (!controlId) return

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						this.logger.info(`Got /style/bgcolor for ${controlId}`)
						control.styleSetFields({ bgcolor: rgb(r, g, b) })
					} else {
						this.logger.info(`Got /style/bgcolor for unknown control: ${controlId}`)
					}
				}
			}
		})

		this.#router.addPath('/style/color/:page(\\d+)/:bank(\\d+)', (match, message) => {
			if (!this.#isLegacyRouteAllowed()) return

			if (message.args.length > 2) {
				const r = message.args[0].value
				const g = message.args[1].value
				const b = message.args[2].value
				if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
					const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
					if (!controlId) return

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						this.logger.info(`Got /style/color for ${controlId}`)
						control.styleSetFields({ color: rgb(r, g, b) })
					} else {
						this.logger.info(`Got /style/color for unknown control: ${controlId}`)
					}
				}
			}
		})

		this.#router.addPath('/style/text/:page(\\d+)/:bank(\\d+)', (match, message) => {
			if (!this.#isLegacyRouteAllowed()) return

			if (message.args.length > 0) {
				const text = message.args[0].value
				if (typeof text === 'string') {
					const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
					if (!controlId) return

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						this.logger.info(`Got /style/text for ${controlId}`)
						control.styleSetFields({ text: text })
					} else {
						this.logger.info(`Got /style/color for unknown control: ${controlId}`)
					}
				}
			}
		})

		this.#router.addPath('/rescan', (_match, _message) => {
			if (!this.#isLegacyRouteAllowed()) return

			this.logger.info('Got /rescan 1')
			this.surfaces.triggerRefreshDevices().catch(() => {
				this.logger.debug('Scan failed')
			})
		})
	}

	#setupNewOscRoutes() {
		// controls by location
		this.#router.addPath('/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/press', this.#locationPress)
		this.#router.addPath('/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/down', this.#locationDown)
		this.#router.addPath('/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/up', this.#locationUp)
		this.#router.addPath(
			'/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/rotate-left',
			this.#locationRotateLeft
		)
		this.#router.addPath(
			'/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/rotate-right',
			this.#locationRotateRight
		)
		this.#router.addPath('/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/step', this.#locationStep)

		this.#router.addPath(
			'/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/style/text',
			this.#locationSetStyleText
		)
		this.#router.addPath(
			'/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/style/color',
			this.#locationSetStyleColor
		)
		this.#router.addPath(
			'/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/style/bgcolor',
			this.#locationSetStyleBgcolor
		)

		// custom variables
		this.#router.addPath('/custom-variable/:name/value', this.#customVariableSetValue)

		// surfaces
		this.#router.addPath('/surfaces/rescan', this.#surfacesRescan)
	}

	/**
	 * Perform surfaces rescan
	 * @returns {void}
	 */
	#surfacesRescan = () => {
		this.logger.info('Got OSC surface rescan')
		this.registry.surfaces.triggerRefreshDevices().catch(() => {
			this.logger.debug('Scan failed')
		})
	}

	/**
	 * Parse the location and controlId from a request
	 * @param {Record<string, string>} match
	 * @returns {{ location: import('../Resources/Util.js').ControlLocation, controlId: string | null }}
	 */
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
	 * Perform control press
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} _message
	 * @returns {void}
	 */
	#locationPress = (match, _message) => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control press ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.registry.controls.pressControl(controlId, true, 'osc')

		setTimeout(() => {
			this.logger.info(`Auto releasing OSC control press ${formatLocation(location)} - ${controlId}`)

			this.registry.controls.pressControl(controlId, false, 'osc')
		}, 20)
	}

	/**
	 * Perform control down
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} _message
	 * @returns {void}
	 */
	#locationDown = (match, _message) => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control down ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.registry.controls.pressControl(controlId, true, 'osc')
	}

	/**
	 * Perform control up
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} _message
	 * @returns {void}
	 */
	#locationUp = (match, _message) => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control up ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.registry.controls.pressControl(controlId, false, 'osc')
	}

	/**
	 * Perform control rotate left
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} _message
	 * @returns {void}
	 */
	#locationRotateLeft = (match, _message) => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control rotate left ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.registry.controls.rotateControl(controlId, false, 'osc')
	}

	/**
	 * Perform control rotate right
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} _message
	 * @returns {void}
	 */
	#locationRotateRight = (match, _message) => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control rotate right ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.registry.controls.rotateControl(controlId, true, 'osc')
	}

	/**
	 * Set control step
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} message
	 * @returns {void}
	 */
	#locationStep = (match, message) => {
		if (message.args.length === 0) return

		const { location, controlId } = this.#locationParse(match)
		const step = Number(message.args[0]?.value)

		this.logger.info(`Got OSC control step ${formatLocation(location)} - ${controlId} to ${step}`)
		if (!controlId) return

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsSteps) {
			return
		}

		control.stepMakeCurrent(step)
	}

	/**
	 * Perform control style text change
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} message
	 * @returns {void}
	 */
	#locationSetStyleText = (match, message) => {
		if (message.args.length === 0) return

		const text = message.args[0]?.value
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control set text ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsStyle) return

		control.styleSetFields({ text: text })
	}

	/**
	 * Perform control style color change
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} message
	 * @returns {void}
	 */
	#locationSetStyleColor = (match, message) => {
		if (message.args.length === 0) return

		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control set color ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsStyle) return

		/** @type {number | false} */
		let color = false
		if (message.args.length === 3) {
			const r = message.args[0].value
			const g = message.args[1].value
			const b = message.args[2].value
			if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
				color = rgb(r, g, b)
			}
		} else {
			color = parseColorToNumber(message.args[0].value)
		}

		if (color !== false) {
			control.styleSetFields({ color })
		}
	}
	/**
	 * Perform control style bgcolor change
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} message
	 * @returns {void}
	 */
	#locationSetStyleBgcolor = (match, message) => {
		if (message.args.length === 0) return

		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control set bgcolor ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsStyle) return

		/** @type {number | false} */
		let color = false
		if (message.args.length === 3) {
			const r = message.args[0].value
			const g = message.args[1].value
			const b = message.args[2].value
			if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
				color = rgb(r, g, b)
			}
		} else {
			color = parseColorToNumber(message.args[0].value)
		}

		if (color !== false) {
			control.styleSetFields({ bgcolor: color })
		}
	}

	/**
	 * Perform custom variable set value
	 * @param {Record<string, string>} match
	 * @param {import('osc').OscReceivedMessage} message
	 * @returns {void}
	 */
	#customVariableSetValue = (match, message) => {
		const variableName = match.name
		const variableValue = message.args?.[0]?.value

		this.logger.debug(`Got HTTP custom variable set value name "${variableName}" to value "${variableValue}"`)
		if (variableValue === undefined) return

		this.registry.instance.variable.custom.setValue(variableName, variableValue.toString())
	}
}
