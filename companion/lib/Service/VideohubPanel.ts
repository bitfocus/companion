import { ServiceBase } from './Base.js'
// @ts-ignore
import VideohubServer from 'videohub-server'
import type { SurfaceIPVideohubPanel } from '../Surface/IP/VideohubPanel.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { SurfaceController } from '../Surface/Controller.js'

/**
 * Class providing the Videohub Server api.
 *
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
 */
export class ServiceVideohubPanel extends ServiceBase {
	readonly #surfaceController: SurfaceController

	#server: VideohubServer | undefined = undefined

	/**
	 * The remote devices
	 */
	readonly #devices = new Map<string, VideohubPanelWrapper>()

	constructor(surfaceController: SurfaceController, userconfig: DataUserConfig) {
		super(userconfig, 'Service/VideohubPanel', 'videohub_panel_enabled', null)

		this.#surfaceController = surfaceController

		this.init()
	}

	protected listen() {
		this.#server = new VideohubServer({
			manualConfigure: true,
		})

		this.#server.on('error', (e: any) => {
			this.logger.debug(`listen-socket error: ${e}`)
		})
		this.#server.on('connect', this.#connectPanel.bind(this))

		this.#server.on('disconnect', this.#disconnectPanel.bind(this))
		this.#server.on('press', this.#pressPanel.bind(this))

		try {
			this.#server.start()
			this.currentState = true
		} catch (e) {
			this.logger.debug(`ERROR opening videohub server port`)
		}
	}

	protected close() {
		if (this.#server) {
			this.#server.destroy()
			this.#server = undefined
		}
	}

	/**
	 * Panel connected
	 */
	#connectPanel(id: string, info: any, remoteAddress: string): void {
		const fullId = `videohub:${id}`
		this.logger.info(`Panel "${fullId}" connected from ${remoteAddress}`)

		const device = this.#surfaceController.addVideohubPanelDevice({
			path: fullId,
			remoteAddress: remoteAddress,
			productName: `Videohub ${info.model}`,

			panelInfo: info,

			server: this.#server,
			serverId: remoteAddress, // TODO
		})

		this.#devices.set(fullId, {
			id: fullId,
			device: device,
		})
	}

	/**
	 * Panel disconnected
	 */
	#disconnectPanel(id: string): void {
		const fullId = `videohub:${id}`
		this.logger.info(`Panel "${fullId}" disconnected from`)

		this.#devices.delete(fullId)
		this.#surfaceController.removeDevice(fullId)
	}

	/**
	 * Panel button pressed
	 */
	#pressPanel(id: string, destination: number, button: number): void {
		const fullId = `videohub:${id}`
		this.logger.debug(`Panel "${fullId}" pressed ${destination}-${button}`)

		const device = this.#devices.get(fullId)
		if (device) {
			device.device.doButton(destination, button)
		}
	}
}

interface VideohubPanelWrapper {
	id: string
	device: SurfaceIPVideohubPanel
}
