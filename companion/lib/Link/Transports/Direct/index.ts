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
				'Connections are encrypted. An installation can only connect once it has been paired, by entering the code it shows into the pairing request that appears here.',
		},
	],

	create: (context, config) => new DirectServerTransport(context, config),
}

export const DirectClientTransportDefinition: LinkTransportDefinition<DirectClientTransportConfig> = {
	type: 'direct-client',
	name: 'Connect directly',
	description:
		'Connect directly to another installation that is accepting direct connections. The first time, you pair them by entering a code shown here on the other installation.',
	configFields: [
		{
			id: 'host',
			type: 'textinput',
			label: 'Address',
			placeholder: '192.168.1.10',
			default: '',
			minLength: 1,
			description: 'The IP address or hostname of the other installation',
		},
		{
			id: 'port',
			type: 'number',
			label: 'Port',
			default: DIRECT_DEFAULT_PORT,
			min: 1,
			max: 65535,
		},
	],

	create: (context, config) => new DirectClientTransport(context, config),
}
