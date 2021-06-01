const ServiceBase = require('./Base')
const OSC = require('osc')
const rgb = require('../Graphics/Image').rgb

/**
 * Class providing OSC send and receive services.
 *
 * @extends ServiceBase
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @since 1.0.8
 * @copyright 2021 Bitfocus AS
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
class ServiceOsc extends ServiceBase {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Service/Osc')

	/**
	 * The port to open the socket with.  Default: <code>12321</code>
	 * @type {number}
	 * @access protected
	 */
	port = 12321

	/**
	 * Flag indicating if the socket is ready
	 * @type {boolean}
	 * @access protected
	 */
	ready = false

	/**
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'osc')

		/**
		 * Send an OSC command to a host.  See {@link ServiceOsc#send|ServiceOsc}
		 * @event System~osc_send
		 * @param {string} host - the receiving host
		 * @param {number} port - the receiving port
		 * @param {string} path - the OSC path
		 * @param {?ServiceOsc~CompanionOSCArgument[]} args - arguments to include
		 */
		this.system.on('osc_send', this.send.bind(this))
		/**
		 * Send multiple OSC commands to a host.  See {@link ServiceOsc#sendBundle|ServiceOsc}
		 * @event System~osc_send_bundle
		 * @param {string} host - the receiving host
		 * @param {number} port - the receiving port
		 * @param {number} time - OSC 64-bit time tag (see OSC specification); <code>0</code> to send immediately
		 * @param {ServiceOsc~CompanionOSCBundle[]} bundle - the packages to send
		 */
		this.system.on('osc_send_bundle', this.sendBundle.bind(this))

		this.init()
	}

	/**
	 * Start the service if it is not already running
	 * @access protected
	 */
	listen() {
		if (this.socket === undefined) {
			this.socket = new OSC.UDPPort({
				localAddress: '0.0.0.0',
				localPort: this.port,
				broadcast: true,
				metadata: true,
			})

			this.socket.open()

			this.socket.on('ready', () => {
				this.ready = true
			})

			this.socket.on('message', this.processIncoming.bind(this))
		}
	}

	/**
	 * Parse an incoming OSC message to see if there's a command to execute
	 * @param {string} message - the incoming string to parse
	 * @protected
	 */
	processIncoming(message) {
		try {
			let a = message.address.split('/')

			if (message.address.match(/^\/press\/bank\/\d+\/\d+$/)) {
				if (message.address.match(/^\/press\/bank\/\d+\/\d+$/)) {
					this.debug('Got /press/bank/ (trigger)', parseInt(a[3]), 'button', parseInt(a[4]))
					this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), true)

					setTimeout(() => {
						this.debug('Auto releasing /press/bank/ (trigger)', parseInt(a[3]), 'button', parseInt(a[4]))
						this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), false)
					}, 20)
				} else {
					if (message.args[0].type == 'i' && message.args[0].value == '1') {
						this.debug('Got /press/bank/ (press) for bank', parseInt(a[3]), 'button', parseInt(a[4]))
						this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), true)

						setTimeout(() => {
							debug('Auto releasing /press/bank/ (trigger)', parseInt(a[3]), 'button', parseInt(a[4]))
							this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), false)
						}, 20)
					} else if (message.args[0].type == 'i' && message.args[0].value == '0') {
						this.debug('Got /press/bank/ (release) for bank', parseInt(a[3]), 'button', parseInt(a[4]))
						this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), false)
					}
				}
			} else if (message.address.match(/^\/style\/bgcolor\/\d+\/\d+$/)) {
				if (message.args.length > 2) {
					let r = message.args[0].value
					let g = message.args[1].value
					let b = message.args[2].value
					if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
						let col = rgb(r, g, b)
						this.debug('Got /style/bgcolor', parseInt(a[3]), 'button', parseInt(a[4]))
						this.system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'bgcolor', col)
						this.graphics.invalidateBank(parseInt(a[3]), parseInt(a[4]))
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
						this.system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'color', col)
						this.graphics.invalidateBank(parseInt(a[3]), parseInt(a[4]))
					}
				}
			} else if (message.address.match(/^\/style\/text\/\d+\/\d+$/)) {
				if (message.args.length > 0) {
					let text = message.args[0].value
					if (typeof text === 'string') {
						this.debug('Got /style/text', parseInt(a[3]), 'button', parseInt(a[4]))
						this.system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'text', text)
						this.graphics.invalidateBank(parseInt(a[3]), parseInt(a[4]))
					}
				}
			}
		} catch (error) {
			this.log('warn', `OSC Error: ${error}`)
		}
	}

	/**
	 * Send an OSC command to a host
	 * @param {string} host - the receiving host
	 * @param {number} port - the receiving port
	 * @param {string} path - the OSC path
	 * @param {?ServiceOsc~CompanionOSCArgument[]} args - arguments to include
	 * @access public
	 */
	send(host, port, path, args) {
		if (this.socket !== undefined) {
			this.socket.send(
				{
					address: path,
					args: args,
				},
				host,
				port
			)
		}
	}

	/**
	 * Send multiple OSC commands to a host
	 * @param {string} host - the receiving host
	 * @param {number} port - the receiving port
	 * @param {number} time - OSC 64-bit time tag (see OSC specification); <code>0</code> to send immediately
	 * @param {ServiceOsc~CompanionOSCBundle[]} bundle - the packages to send
	 * @access public
	 */
	sendBundle(host, port, time, bundle) {
		if (this.socket !== undefined) {
			this.socket.send(
				{
					timeTag: OSC.timeTag(time),
					packets: bundle,
				},
				host,
				port
			)
		}
	}
}

/**
 * An argument to include with an OSC package
 * @typedef ServiceOsc~CompanionOSCArgument
 * @property {string} type - 'f' = float | 'i' = int | 's' = string
 * @property {number|string} value - the agrument's value
 */

/**
 * A full OSC package when sending a bundle
 * @typedef ServiceOsc~CompanionOSCBundle
 * @property {string} address - the OSC path
 * @property {ServiceOsc~CompanionOSCArgument[]} args - arguments to include
 */

exports = module.exports = ServiceOsc
