import type { LinkTransportDefinition } from '../Types.js'
import { DirectClientTransport, type DirectClientTransportConfig } from './ClientTransport.js'
import { DIRECT_DEFAULT_PORT } from './Constants.js'
import { DirectServerTransport, type DirectServerTransportConfig } from './ServerTransport.js'

export const DirectServerTransportDefinition: LinkTransportDefinition<DirectServerTransportConfig> = {
	type: 'direct-server',
	name: 'Accept direct connections',
	description:
		'Listen on a port for other installations to connect to directly. For installations on different networks, connect them over a VPN rather than exposing this port to the internet.',
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
				'Connections are encrypted. An installation can only connect once it has been paired, by entering the code it shows into the pairing request that appears here. Even so, do not expose this port to the internet: to link installations on different networks, use a VPN between them.',
		},
	],

	create: (context, config) => new DirectServerTransport(context, config),
}

export const DirectClientTransportDefinition: LinkTransportDefinition<DirectClientTransportConfig> = {
	type: 'direct-client',
	name: 'Connect directly',
	description:
		'Connect directly to another installation that is accepting direct connections, on the same network or over a VPN. The first time, you pair them by entering a code shown here on the other installation.',
	configFields: [
		{
			id: 'address',
			type: 'textinput',
			label: 'Address',
			placeholder: '192.168.1.10',
			default: '',
			minLength: 1,
			description: `The IP address or hostname of the other installation (port ${DIRECT_DEFAULT_PORT} unless given, eg 192.168.1.10:1234), or its full address if it is behind a reverse proxy (eg wss://proxy.example.com/companion-link)`,
		},
	],

	create: (context, config) => new DirectClientTransport(context, config),
}
