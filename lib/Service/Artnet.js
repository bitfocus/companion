const ServiceUdpBase = require('./UdpBase')

/**
 * Class providing the Artnet api.
 *
 * @extends ServiceUdpBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 1.2.0
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
class ServiceArtnet extends ServiceUdpBase {
	/**
	 * Default user config settings for the service
	 * @access public
	 * @static
	 */
	static Defaults = { artnet_enabled: false, artnet_universe: '1', artnet_channel: '1' }

	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Service/Artnet')

	/**
	 * The port to open the socket with.  Default: <code>6454</code>
	 * @type {number}
	 * @access protected
	 */
	port = 6454

	/**
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'artnet', ServiceArtnet.Defaults, 'artnet_enabled')

		this.currentPage = 0
		this.currentBank = 0
		this.currentDir = 0

		this.init()
	}

	/**
	 * Process an incoming message from a remote
	 * @param {Buffer} msg - the incoming message
	 * @param {ServiceUdpBase~DgramRemoteInfo} remote - remote address information
	 */
	processIncoming(msg, remote) {
		const sequence = msg.readUInt8(12, true)
		const physical = msg.readUInt8(13, true)
		const universe = msg.readUInt8(14, true)
		const offset = msg.readUInt8(16, true)
		const length = msg.readUInt8(17, true)

		let rawData = []

		for (let i = 18; i < 18 + 255; i++) {
			rawData.push(msg.readUInt8(i, true))
		}

		const packet = {
			sequence: sequence,
			physical: physical,
			universe: universe,
			length: length,
			data: rawData,
		}

		if (parseInt(packet.universe) === parseInt(this.userconfig.getKey('artnet_universe'))) {
			const ch = parseInt(this.userconfig.getKey('artnet_channel'))

			if (ch >= 1) {
				ch -= 1
			}

			const dmxPage = parseInt(packet.data[ch])
			const dmxBank = parseInt(packet.data[ch + 1])
			const dmxDir = parseInt(packet.data[ch + 2])

			if (dmxPage !== this.currentPage || dmxBank !== this.currentBank || dmxDir !== this.currentDir) {
				this.currentPage = dmxPage
				this.currentBank = dmxBank
				this.currentDir = dmxDir

				if (dmxDir == 0 || dmxPage == 0 || dmxBank == 0) {
					return
				}

				// down
				if (dmxDir > 128) {
					this.system.emit('bank_pressed', dmxPage, dmxBank, false)
				}
				// up
				else if (dmxDir >= 10) {
					this.system.emit('bank_pressed', dmxPage, dmxBank, true)
				}
			}
		}
	}
}

exports = module.exports = ServiceArtnet
