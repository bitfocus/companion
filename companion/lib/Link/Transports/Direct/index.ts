import type { LinkTransportDefinition } from '../Types.js'
import { DirectClientTransport, type DirectClientTransportConfig } from './ClientTransport.js'
import { DirectServerTransport, type DirectServerTransportConfig } from './ServerTransport.js'

export const DIRECT_DEFAULT_PORT = 16624

export const DirectServerTransportDefinition: LinkTransportDefinition<DirectServerTransportConfig> = {
	type: 'direct-server',
	name: 'Accept direct connections',
	description:
		'Listen on a port for other installations to connect to directly. Best on a local network, with no extra software needed.',
	configFields: [
		{
			id: 'port',
			type: 'number',
			label: 'Port',
			default: DIRECT_DEFAULT_PORT,
			min: 1024,
			max: 65535,
		},
		{
			id: 'security',
			type: 'static-text',
			label: 'Security',
			value:
				'Connections are encrypted with a self-signed certificate. Anyone who can reach this port can use the buttons of this installation, so only use this on a trusted network.',
		},
	],

	create: (context, config) => new DirectServerTransport(context, config),
}

export const DirectClientTransportDefinition: LinkTransportDefinition<DirectClientTransportConfig> = {
	type: 'direct-client',
	name: 'Connect directly',
	description: 'Connect directly to another installation that is accepting direct connections.',
	configFields: [
		{
			id: 'url',
			type: 'textinput',
			label: 'Address',
			placeholder: `wss://192.168.1.10:${DIRECT_DEFAULT_PORT}`,
			default: `wss://127.0.0.1:${DIRECT_DEFAULT_PORT}`,
			regex: '/^wss:\\/\\/.+/',
			description: 'The address of the other installation, starting with wss://',
		},
		{
			id: 'fingerprint',
			type: 'textinput',
			label: 'Certificate fingerprint',
			default: '',
			placeholder: 'AB:CD:EF:…',
			description:
				'Shown on the other installation. When set, the connection is refused unless the other end presents this certificate',
		},
	],

	create: (context, config) => new DirectClientTransport(context, config),
}
