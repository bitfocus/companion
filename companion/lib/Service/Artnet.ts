import type { ServiceApi } from './ServiceApi.js'
import { ServiceUdpBase, DgramRemoteInfo } from './UdpBase.js'
import type { DataUserConfig } from '../Data/UserConfig.js'

/**
 * Class providing the Artnet api.
 *
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
 */
export class ServiceArtnet extends ServiceUdpBase {
	readonly #serviceApi: ServiceApi

	#currentPage: number = 0
	#currentBank: number = 0
	#currentDir: number = 0

	constructor(serviceApi: ServiceApi, userconfig: DataUserConfig) {
		super(userconfig, 'Service/Artnet', 'artnet_enabled', null)

		this.#serviceApi = serviceApi

		this.port = 6454

		this.init()
	}

	/**
	 * Process an incoming message from a remote
	 * @param data - the incoming message
	 * @param _remote - remote address information
	 */
	processIncoming(data: Buffer, _remote: DgramRemoteInfo): void {
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
						this.#currentBank = dmxBank
						this.#currentDir = dmxDir

						if (dmxDir == 0 || dmxPage == 0 || dmxBank == 0) {
							return
						}

						const controlId = this.#serviceApi.getControlIdAtOldBankIndex(dmxPage, dmxBank)
						if (controlId) {
							// down
							if (dmxDir > 128) {
								this.#serviceApi.pressControl(controlId, false, 'artnet')
							}
							// up
							else if (dmxDir >= 10) {
								this.#serviceApi.pressControl(controlId, true, 'artnet')
							} else {
								// nothing.
							}
						}
					}
				}
			}
		} catch (err: any) {
			this.logger.silly(`message error: ${err.toString()}`, err.stack)
		}
	}
}
