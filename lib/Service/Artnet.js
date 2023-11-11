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
	 * @type {number}
	 * @access private
	 */
	#currentPage = 0
	/**
	 * @type {number}
	 * @access private
	 */
	#currentBank = 0
	/**
	 * @type {number}
	 * @access private
	 */
	#currentDir = 0

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'artnet', 'Service/Artnet', 'artnet_enabled', null)

		this.init()
	}

	/**
	 * Process an incoming message from a remote
	 * @param {Buffer} data - the incoming message
	 * @param {import('./UdpBase.js').ServiceUdpBase_DgramRemoteInfo} _remote - remote address information
	 */
	processIncoming(data, _remote) {
		try {
			if (data.length >= 18 + 255) {
				// const sequence = data.readUInt8(12)
				// const physical = data.readUInt8(13)
				const universe = data.readUInt8(14)
				// let offset = data.readUInt8(16)
				// const length = data.readUInt8(17)

				const packetData = data.subarray(18, 18 + 255)

				if (Number(universe) === Number(this.userconfig.getKey('artnet_universe'))) {
					let ch = this.userconfig.getKey('artnet_channel')
					if (ch >= 1) {
						ch -= 1
					}

					const dmxPage = packetData.readUInt8(ch)
					const dmxBank = packetData.readUInt8(ch + 1)
					const dmxDir = packetData.readUInt8(ch + 2)

					if (dmxPage !== this.#currentPage || dmxBank !== this.#currentBank || dmxDir !== this.#currentDir) {
						this.#currentPage = dmxPage
						this.currentBank = dmxBank
						this.currentDir = dmxDir

						if (dmxDir == 0 || dmxPage == 0 || dmxBank == 0) {
							return
						}

						const controlId = this.page.getControlIdAtOldBankIndex(dmxPage, dmxBank)
						if (controlId) {
							// down
							if (dmxDir > 128) {
								this.controls.pressControl(controlId, false, 'artnet')
							}
							// up
							else if (dmxDir >= 10) {
								this.controls.pressControl(controlId, true, 'artnet')
							}
							// nothing.
							else {
							}
						}
					}
				}
			}
		} catch (/** @type {any} */ err) {
			this.logger.silly(`message error: ${err.toString()}`, err.stack)
		}
	}
}

export default ServiceArtnet
