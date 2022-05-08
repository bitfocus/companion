import ServiceUdpBase from './UdpBase.js'

/**
 * Class providing the Artnet api.
 *
 * @extends ServiceUdpBase
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
class ServiceArtnet extends ServiceUdpBase {
	/**
	 * The port to open the socket with.  Default: <code>6454</code>
	 * @type {number}
	 * @access protected
	 */
	port = 6454

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'artnet', 'Service/Artnet', 'artnet_enabled')

		this.currentPage = 0
		this.currentBank = 0
		this.currentDir = 0

		this.init()
	}

	/**
	 * Process an incoming message from a remote
	 * @param {Buffer} data - the incoming message
	 * @param {ServiceUdpBase~DgramRemoteInfo} remote - remote address information
	 */
	processIncoming(data, remote) {
		try {
			if (data.length >= 18 + 255) {
				let sequence = data.readUInt8(12, true)
				let physical = data.readUInt8(13, true)
				let universe = data.readUInt8(14, true)
				let offset = data.readUInt8(16, true)
				let length = data.readUInt8(17, true)

				let rawData = []

				for (i = 18; i < 18 + 255; i++) {
					rawData.push(data.readUInt8(i, true))
				}

				let packet = {
					sequence: sequence,
					physical: physical,
					universe: universe,
					length: length,
					data: rawData,
				}

				if (parseInt(packet.universe) === this.userconfig.getKey('artnet_universe')) {
					let ch = this.userconfig.getKey('artnet_channel')
					if (ch >= 1) {
						ch -= 1
					}

					let dmxPage = parseInt(packet.data[ch])
					let dmxBank = parseInt(packet.data[ch + 1])
					let dmxDir = parseInt(packet.data[ch + 2])

					if (dmxPage !== this.currentPage || dmxBank !== this.currentBank || dmxDir !== this.currentDir) {
						this.currentPage = dmxPage
						this.currentBank = dmxBank
						this.currentDir = dmxDir

						if (dmxDir == 0 || dmxPage == 0 || dmxBank == 0) {
							return
						}

						// down
						if (dmxDir > 128) {
							this.bank.action.pressBank(dmxPage, dmxBank, false)
						}
						// up
						else if (dmxDir >= 10) {
							this.bank.action.pressBank(dmxPage, dmxBank, true)
						}
						// nothing.
						else {
						}
					}
				}
			}
		} catch (e) {
			this.logger.silly(`message error: ${err.toString()}`, err.stack)
		}
	}
}

export default ServiceArtnet
