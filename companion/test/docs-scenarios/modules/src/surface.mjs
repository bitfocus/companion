/*
 * The surface module the screenshots of the docs use, standing in for the integration of a real surface: a control
 * panel with eight buttons, which Companion connects to over the network. It doesn't connect to anything: each remote
 * connection is a panel as soon as it is started, and a panel is always found by the discovery, so that the
 * screenshots are the same each time.
 */
import EventEmitter from 'node:events'

const LAYOUT = {
	stylePresets: { default: { bitmap: { w: 72, h: 72 } } },
	controls: Object.fromEntries(
		Array.from({ length: 8 }, (_, index) => {
			const row = Math.floor(index / 4)
			const column = index % 4
			return [`${row}/${column}`, { row, column }]
		})
	),
}

class DemoPanelRemote extends EventEmitter {
	configFields = [
		{ type: 'textinput', id: 'address', label: 'Address', default: '' },
		{ type: 'number', id: 'port', label: 'Port', default: 5343, min: 1, max: 65535 },
	]
	checkConfigMatchesExpression = '$(options:address) == $(config:address)'

	async startConnections(connectionInfos) {
		this.emit(
			'surfacesConnected',
			connectionInfos.map((info) => ({
				// A real panel would report its serial number
				surfaceId: `demo-panel:${String(info.config.address ?? '').replaceAll('.', '-')}`,
				description: 'Demo Control Panel',
				pluginInfo: { address: String(info.config.address ?? '') },
				deviceHandle: info.connectionId,
			}))
		)
	}

	async stopConnections() {}

	rejectSurface() {}
}

class DemoPanel {
	constructor(surfaceId) {
		this.surfaceId = surfaceId
		this.productName = 'Demo Control Panel'
	}

	async init() {}
	async updateConfig() {}
	async close() {}
	async ready() {}
	async setBrightness() {}
	async blank() {}
	async draw() {}
	async showStatus() {}
}

const remote = new DemoPanelRemote()

export default {
	remote,

	async init() {
		// The panels on the network
		setTimeout(() => {
			remote.emit(
				'connectionsFound',
				[
					['demo-panel-presenter', 'Presenter panel', '192.168.0.50'],
					['demo-panel-backstage', 'Backstage panel', '192.168.0.51'],
				].map(([id, displayName, address]) => ({
					id,
					displayName,
					description: 'Demo Control Panel',
					addresses: address,
					config: { address, port: 5343 },
				}))
			)
		}, 100)
	},

	async destroy() {},

	async getSurfaceModels() {
		return [{ id: 'demo-panel', name: 'Demo Control Panel', layout: LAYOUT }]
	},

	async openSurface(surfaceId, pluginInfo) {
		return {
			surface: new DemoPanel(surfaceId),
			registerProps: {
				brightness: true,
				surfaceLayout: LAYOUT,
				surfaceAppearance: null,
				modelId: 'demo-panel',
				pincodeMap: null,
				location: pluginInfo.address || null,
				configFields: null,
			},
		}
	},
}
