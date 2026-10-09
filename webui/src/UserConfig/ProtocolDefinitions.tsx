import { windowLinkOpen } from '~/Helpers/Window.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { ArtnetConfig } from './Sections/ArtnetConfig.js'
import { EmberPlusConfig } from './Sections/EmberPlusConfig.js'
import { HttpConfig } from './Sections/HttpConfig.js'
import { MetricsConfig } from './Sections/MetricsConfig.js'
import { OscConfig } from './Sections/OscConfig.js'
import { RestApiKeysSection } from './Sections/RestApiConfig.js'
import { RosstalkConfig } from './Sections/RosstalkConfig.js'
import { SatelliteConfig } from './Sections/SatelliteConfig.js'
import { TcpConfig } from './Sections/TcpConfig.js'
import { UdpConfig } from './Sections/UdpConfig.js'
import type { SettingsItemDefinition } from './SettingsItems.js'

/**
 * The port this web interface was opened on, which also serves the HTTP based APIs. The server doesn't report its
 * listen port, and this is the address a client should use anyway, even behind a proxy.
 */
function webInterfacePort(): string {
	return window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
}

export const PROTOCOLS: SettingsItemDefinition[] = [
	{
		id: 'satellite',
		name: 'Satellite',
		description:
			'Lets remote surfaces such as Stream Decks connect to Companion over the network, most often through the Companion Satellite app. Its ports are fixed.',
		enabledField: 'always-on',
		summary: () => 'TCP port 16622 · WebSocket port 16623',
		docs: '/user-guide/remote-control/satellite',
		docsLabel: 'Setup guide',
		Settings: SatelliteConfig,
		Section: null,
	},
	{
		id: 'tcp',
		name: 'TCP',
		description:
			'Listens for plain-text commands over TCP, so other devices and software can press buttons, change pages and set variables.',
		enabledField: 'tcp_enabled',
		summary: (config) => `Port ${config.tcp_listen_port}`,
		docs: '/user-guide/remote-control/tcp-udp',
		docsLabel: 'Command reference',
		Settings: TcpConfig,
		Section: null,
	},
	{
		id: 'udp',
		name: 'UDP',
		description:
			'Listens for plain-text commands over UDP, so other devices and software can press buttons, change pages and set variables.',
		enabledField: 'udp_enabled',
		summary: (config) => `Port ${config.udp_listen_port}`,
		docs: '/user-guide/remote-control/tcp-udp',
		docsLabel: 'Command reference',
		Settings: UdpConfig,
		Section: null,
	},
	{
		id: 'http',
		name: 'HTTP API',
		description:
			'Accepts HTTP requests on the same address as this web interface, so other devices and software can press buttons, change styles and set variables.',
		enabledField: 'http_api_enabled',
		summary: () => `Port ${webInterfacePort()}`,
		docs: '/user-guide/remote-control/http-remote-control',
		docsLabel: 'Command reference',
		Settings: HttpConfig,
		Section: null,
	},
	{
		id: 'rest',
		name: 'REST API',
		description:
			'A versioned REST API at /api/v2 for configuring Companion from scripts and other software. Requests are authenticated with a bearer token, using the API keys below.',
		enabledField: 'rest_api_enabled',
		summary: () => `Port ${webInterfacePort()}, at /api/v2`,
		// The REST API documents itself, rather than in the user guide
		docs: () => windowLinkOpen({ href: makeAbsolutePath('/api/v2/docs') }),
		docsLabel: 'Interactive API docs',
		Settings: null,
		Section: RestApiKeysSection,
	},
	{
		id: 'metrics',
		name: 'Prometheus Metrics',
		description:
			'A Prometheus-compatible endpoint at /api/metrics reporting memory usage, the drawing pipeline and high-level counts. Scrape it with the bearer token below.',
		enabledField: 'prometheus_enabled',
		summary: () => `Port ${webInterfacePort()}, at /api/metrics`,
		docs: '/user-guide/config/settings#protocols',
		docsLabel: 'Settings guide',
		Settings: MetricsConfig,
		Section: null,
	},
	{
		id: 'osc',
		name: 'OSC',
		description:
			'Listens for OSC messages, so other devices and software can press buttons, change styles and set variables.',
		enabledField: 'osc_enabled',
		summary: (config) => `Port ${config.osc_listen_port}`,
		docs: '/user-guide/remote-control/osc-control',
		docsLabel: 'Command reference',
		Settings: OscConfig,
		Section: null,
	},
	{
		id: 'rosstalk',
		name: 'RossTalk',
		description:
			"Listens for RossTalk, Ross Video's text-based control protocol, so Ross switchers and other devices can press buttons. Its port is fixed.",
		enabledField: 'rosstalk_enabled',
		summary: () => 'Port 7788',
		docs: '/user-guide/remote-control/rosstalk-control',
		docsLabel: 'Command reference',
		Settings: RosstalkConfig,
		Section: null,
	},
	{
		id: 'emberplus',
		name: 'Ember+',
		description:
			"Runs an Ember+ provider that exposes Companion's buttons and variables to Ember+ consumers. Its port is fixed.",
		enabledField: 'emberplus_enabled',
		summary: () => 'Port 9092',
		docs: '/user-guide/remote-control/emberplus-control',
		docsLabel: 'Parameter reference',
		Settings: EmberPlusConfig,
		Section: null,
	},
	{
		id: 'artnet',
		name: 'Artnet',
		description:
			'Listens for Artnet, so lighting consoles can press buttons. Each button maps to a DMX channel, counting up from the channel below.',
		enabledField: 'artnet_enabled',
		summary: (config) => `Universe ${config.artnet_universe} · Channel ${config.artnet_channel}`,
		docs: '/user-guide/remote-control/artnet-dmx-control',
		docsLabel: 'Artnet guide',
		Settings: ArtnetConfig,
		Section: null,
	},
]
