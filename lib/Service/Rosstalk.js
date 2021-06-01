const ServiceTcpBase = require('./TcpBase')

/**
 * Class providing the Rosstalk api.
 *
 * @extends ServiceTcpBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Justin Osborne <justin@eblah.com>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.1.1
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
class ServiceRosstalk extends ServiceTcpBase {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Service/Rosstalk')

	/**
	 * The port to open the socket with.  Default: <code>7788</code>
	 * @type {number}
	 * @access protected
	 */
	port = 7788

	/**
	 * The release time when simulating a button press.  Default: <code>20ms</code>
	 * @type {number}
	 * @access protected
	 */
	releaseTime = 20

	/**
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'rosstalk', { rosstalk_enabled: false }, 'rosstalk_enabled')

		this.init()
	}

	/**
	 * Execute a button press and release
	 * @param {number} page - the bank's page number
	 * @param {number} bank - the bank to press
	 */
	pressButton(page, bank) {
		this.log('debug', `Push button ${page}.${bank}`)
		this.system.emit('bank_pressed', page, bank, true)

		setTimeout(() => {
			this.log('debug', `Release button ${page}.${bank}`)
			this.system.emit('bank_pressed', page, bank, false)
		}, this.releaseTime)
	}

	/**
	 * Process an incoming message from a client
	 * @param {net.Socket} client - the client's tcp socket
	 * @param {string} data - the incoming message part
	 * @access protected
	 */
	processIncomming(client, data) {
		data = data.toString('utf8')
		// Type, bank/page, CC/bnt number
		const match = data.match(/(CC) ([0-9]*)\:([0-9]*)/)

		if (match === null) {
			this.log('warn', `Invalid incomming command: ${data}`)
			return
		}

		if (match[1] === 'CC') {
			this.pressButton(parseInt(match[2]), parseInt(match[3]))
		}
	}
}

exports = module.exports = ServiceRosstalk
