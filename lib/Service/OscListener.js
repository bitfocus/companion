const { rgb } = require('../Resources/Util')
const ServiceOscBase = require('./OscBase')

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
		super(registry, 'osc-rx', 'lib/Service/OscListener', 'osc_enabled', 'osc_listen_port')

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 * @param {string} message - the incoming message part
	 * @access protected
	 */
	processIncoming(message) {
		try {
			let a = message.address.split('/')
			if (message.address.match(/^\/press\/bank\/\d+\/\d+$/)) {
				if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == '1') {
					this.debug('Got /press/bank/ (press) for bank', parseInt(a[3]), 'button', parseInt(a[4]))
					this.bank.action.pressBank(parseInt(a[3]), parseInt(a[4]), true)
				} else if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == '0') {
					this.debug('Got /press/bank/ (release) for bank', parseInt(a[3]), 'button', parseInt(a[4]))
					this.bank.action.pressBank(parseInt(a[3]), parseInt(a[4]), false)
				} else {
					this.debug('Got /press/bank/ (trigger)', parseInt(a[3]), 'button', parseInt(a[4]))
					this.bank.action.pressBank(parseInt(a[3]), parseInt(a[4]), true)

					setTimeout(() => {
						this.debug('Auto releasing /press/bank/ (trigger)', parseInt(a[3]), 'button', parseInt(a[4]))
						this.bank.action.pressBank(parseInt(a[3]), parseInt(a[4]), false)
					}, 20)
				}
			} else if (message.address.match(/^\/style\/bgcolor\/\d+\/\d+$/)) {
				if (message.args.length > 2) {
					let r = message.args[0].value
					let g = message.args[1].value
					let b = message.args[2].value
					if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
						let col = rgb(r, g, b)
						this.debug('Got /style/bgcolor', parseInt(a[3]), 'button', parseInt(a[4]))
						this.bank.changeField(parseInt(a[3]), parseInt(a[4]), 'bgcolor', col)
					}
				}
			} else if (message.address.match(/^\/style\/color\/\d+\/\d+$/)) {
				if (message.args.length > 2) {
					let r = message.args[0].value
					let g = message.args[1].value
					let b = message.args[2].value
					if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
						let col = rgb(r, g, b)
						this.debug('Got /style/color', parseInt(a[3]), 'button', parseInt(a[4]))
						this.bank.changeField(parseInt(a[3]), parseInt(a[4]), 'color', col)
					}
				}
			} else if (message.address.match(/^\/style\/text\/\d+\/\d+$/)) {
				if (message.args.length > 0) {
					let text = message.args[0].value
					if (typeof text === 'string') {
						this.debug('Got /style/text', parseInt(a[3]), 'button', parseInt(a[4]))
						this.bank.changeField(parseInt(a[3]), parseInt(a[4]), 'text', text)
					}
				}
			} else if (message.address.match(/^\/rescan$/)) {
				if (message.args.length > 0 && message.args[0].value == '1') {
					this.debug('Got /rescan 1')
					this.log('debug', 'Rescanning USB')
					this.surfaces.refreshDevices()
				}
			}
		} catch (error) {
			this.log('warn', 'OSC Error: ' + error)
		}
	}
}

module.exports = ServiceOscListener
