import { rgb } from '../Resources/Util.js'
import { CreateBankControlId } from '../Shared/ControlId.js'
import ServiceOscBase from './OscBase.js'
import RegexRouter from './RegexRouter.js'

/**
 * Class providing OSC receive services.
 *
 * @extends ServiceOscBase
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
class ServiceOscListener extends ServiceOscBase {
	/**
	 * The port to open the socket with.  Default: <code>12321</code>
	 * @type {number}
	 * @access protected
	 */
	port = 12321

	/**
	 * Message router
	 * @type {RegexRouter}
	 * @access private
	 */
	#router

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'osc-rx', 'Service/OscListener', 'osc_enabled', 'osc_listen_port')

		this.init()

		this.#router = new RegexRouter()

		this.#setupOscRoutes()
	}

	/**
	 * Process an incoming message from a client
	 * @param {string} message - the incoming message part
	 * @access protected
	 */
	processIncoming(message) {
		try {
			this.#router.processMessage(message.address, message)
		} catch (error) {
			this.logger.warn('OSC Error: ' + error)
		}
	}

	#setupOscRoutes() {
		this.#router.addPath('/press/bank/:page(\\d+)/:bank(\\d+)', (match, message) => {
			const controlId = CreateBankControlId(match.page, match.bank)
			if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == '1') {
				this.logger.info(`Got /press/bank/ (press) for ${controlId}`)
				this.controls.pressControl(controlId, true)
			} else if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == '0') {
				this.logger.info(`Got /press/bank/ (release) for ${controlId}`)
				this.controls.pressControl(controlId, false)
			} else {
				this.logger.info(`Got /press/bank/ (trigger)${controlId}`)
				this.controls.pressControl(controlId, true)

				setTimeout(() => {
					this.logger.info(`Auto releasing /press/bank/ (trigger)${controlId}`)
					this.controls.pressControl(controlId, false)
				}, 20)
			}
		})

		this.#router.addPath('/style/bgcolor/:page(\\d+)/:bank(\\d+)', (match, message) => {
			if (message.args.length > 2) {
				const r = message.args[0].value
				const g = message.args[1].value
				const b = message.args[2].value
				if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
					const controlId = CreateBankControlId(match.page, match.bank)
					const control = this.controls.getControl(controlId)
					if (control && typeof control.styleSetFields === 'function') {
						this.logger.info(`Got /style/bgcolor for ${controlId}`)
						control.styleSetFields({ bgcolor: rgb(r, g, b) })
					} else {
						this.logger.info(`Got /style/bgcolor for unknown control: ${controlId}`)
					}
				}
			}
		})

		this.#router.addPath('/style/color/:page(\\d+)/:bank(\\d+)', (match, message) => {
			if (message.args.length > 2) {
				const r = message.args[0].value
				const g = message.args[1].value
				const b = message.args[2].value
				if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
					const controlId = CreateBankControlId(match.page, match.bank)
					const control = this.controls.getControl(controlId)
					if (control && typeof control.styleSetFields === 'function') {
						this.logger.info(`Got /style/color for ${controlId}`)
						control.styleSetFields({ color: rgb(r, g, b) })
					} else {
						this.logger.info(`Got /style/color for unknown control: ${controlId}`)
					}
				}
			}
		})

		this.#router.addPath('/style/text/:page(\\d+)/:bank(\\d+)', (match, message) => {
			if (message.args.length > 0) {
				const text = message.args[0].value
				if (typeof text === 'string') {
					const controlId = CreateBankControlId(match.page, match.bank)
					const control = this.controls.getControl(controlId)

					if (control && typeof control.styleSetFields === 'function') {
						this.logger.info(`Got /style/text for ${controlId}`)
						control.styleSetFields({ text: text })
					} else {
						this.logger.info(`Got /style/color for unknown control: ${controlId}`)
					}
				}
			}
		})

		this.#router.addPath('/rescan', (match, message) => {
			if (message.args.length > 0 && message.args[0].value == '1') {
				this.logger.info('Got /rescan 1')
				this.surfaces.triggerRefreshDevices().catch((e) => {
					this.logger.debug('Scan failed')
				})
			}
		})

		this.#router.addPath('/custom-variable/:name/value', (match, message) => {
			if (match.name && message.args.length > 0) {
				this.logger.debug(`Setting custom-variable ${match.name} to value ${message.args[0].value}`)
				this.instance.variable.custom.setValue(match.name, message.args[0].value)
			}
		})
	}
}

export default ServiceOscListener
