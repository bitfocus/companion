import { CreateBankControlId, rgb } from '../Resources/Util.js'
import ServiceOscBase from './OscBase.js'

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
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'osc-rx', 'Service/OscListener', 'osc_enabled', 'osc_listen_port')

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 * @param {string} message - the incoming message part
	 * @access protected
	 */
	processIncoming(message) {
		try {
			let match
			if ((match = message.address.match(/^\/press\/bank\/(\d+)\/(\d+)$/))) {
				const controlId = CreateBankControlId(match[1], match[2])

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
			} else if ((match = message.address.match(/^\/style\/bgcolor\/(\d+)\/(\d+)$/))) {
				if (message.args.length > 2) {
					let r = message.args[0].value
					let g = message.args[1].value
					let b = message.args[2].value
					if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
						const controlId = CreateBankControlId(match[1], match[2])
						const control = this.controls.getControl(controlId)

						if (control && typeof control.styleSetFields === 'function') {
							this.logger.info(`Got /style/bgcolor for ${controlId}`)
							control.styleSetFields({ bgcolor: rgb(r, g, b) })
						} else {
							this.logger.info(`Got /style/bgcolor for unknown control: ${controlId}`)
						}
					}
				}
			} else if ((match = message.address.match(/^\/style\/color\/(\d+)\/(\d+)$/))) {
				if (message.args.length > 2) {
					let r = message.args[0].value
					let g = message.args[1].value
					let b = message.args[2].value
					if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
						const controlId = CreateBankControlId(match[1], match[2])
						const control = this.controls.getControl(controlId)

						if (control && typeof control.styleSetFields === 'function') {
							this.logger.info(`Got /style/color for ${controlId}`)
							control.styleSetFields({ color: rgb(r, g, b) })
						} else {
							this.logger.info(`Got /style/color for unknown control: ${controlId}`)
						}
					}
				}
			} else if ((match = message.address.match(/^\/style\/text\/(\d+)\/(\d+)$/))) {
				if (message.args.length > 0) {
					let text = message.args[0].value
					if (typeof text === 'string') {
						const controlId = CreateBankControlId(match[1], match[2])
						const control = this.controls.getControl(controlId)

						if (control && typeof control.styleSetFields === 'function') {
							this.logger.info(`Got /style/text for ${controlId}`)
							control.styleSetFields({ text: text })
						} else {
							this.logger.info(`Got /style/color for unknown control: ${controlId}`)
						}
					}
				}
			} else if (message.address.match(/^\/rescan$/)) {
				if (message.args.length > 0 && message.args[0].value == '1') {
					this.logger.info('Got /rescan 1')
					this.surfaces.triggerRefreshDevices().catch((e) => {
						this.logger.debug('Scan failed')
					})
				}
			} else if ((match = message.address.match(/^\/custom-variable\/(.+)\/value$/))) {
				var name = match[1]
				if (message.args.length > 0) {
					debug('Setting custom-variable', name, 'to value', message.args[0].value)
					this.instance.variable.custom.setValue(name, message.args[0].value)
				}
			}
		} catch (error) {
			this.logger.warn('OSC Error: ' + error)
		}
	}
}

export default ServiceOscListener
