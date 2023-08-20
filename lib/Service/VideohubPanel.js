import ServiceBase from './Base.js'
import VideohubServer from 'videohub-server'

/**
 * Class providing the Videohub Server api.
 *
 * @extends ServiceBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.2.0
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
class ServiceVideohubPanel extends ServiceBase {
	/**
	 * @type {VideohubServer | undefined}
	 */
	server

	/**
	 * The remote devices
	 * @type {Object}
	 * @access protected
	 */
	devices = {}

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'videohub-panel', 'Service/VideohubPanel', 'videohub_panel_enabled')

		this.init()
	}

	listen() {
		this.server = new VideohubServer({
			manualConfigure: true,
		})

		this.server.on('error', (e) => {
			this.logger.debug(`listen-socket error: ${e}`)
		})
		this.server.on('connect', this.#connectPanel.bind(this))

		this.server.on('disconnect', this.#disconnectPanel.bind(this))
		this.server.on('press', this.#pressPanel.bind(this))

		try {
			this.server.start()
			this.currentState = true
		} catch (e) {
			this.logger.debug(`ERROR opening videohub server port`)
		}
	}

	close() {
		this.server.destroy()
	}

	#connectPanel(id, info, remoteAddress) {
		const fullId = `videohub:${id}`
		this.logger.info(`Panel "${fullId}" connected from ${remoteAddress}`)

		const device = this.surfaces.addVideohubPanelDevice({
			path: fullId,
			remoteAddress: remoteAddress,
			productName: `Videohub ${info.model}`,

			panelInfo: info,

			server: this.server,
			serverId: remoteAddress, // TODO
		})

		this.devices[fullId] = {
			id: fullId,
			device: device,
		}
	}

	#disconnectPanel(id) {
		const fullId = `videohub:${id}`
		this.logger.info(`Panel "${fullId}" disconnected from`)

		delete this.devices[fullId]
		this.surfaces.removeDevice(fullId)
	}

	#pressPanel(id, destination, button) {
		const fullId = `videohub:${id}`
		this.logger.debug(`Panel "${fullId}" pressed ${destination}-${button}`)

		const device = this.devices[fullId]
		if (device) {
			device.device.doButton(destination, button)
		}
	}
}

export default ServiceVideohubPanel
