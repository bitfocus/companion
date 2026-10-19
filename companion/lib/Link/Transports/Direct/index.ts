import type { LinkBuiltinTransport, LinkTransportDefinition } from '../Types.js'
import { DirectClientTransport, type DirectClientTransportConfig } from './ClientTransport.js'
import { DIRECT_DEFAULT_PORT } from './Constants.js'
import { DirectServerTransport, type DirectServerTransportConfig } from './ServerTransport.js'

const DirectServerTransportDefinition: LinkTransportDefinition<DirectServerTransportConfig> = {
	type: 'direct-server',
	name: 'Incoming direct connections',
	description:
		'Other installations connect to this one directly, by adding a "Direct connection" transport pointing at it. Switched on and configured in Settings, under Protocols.',
	configFields: [
		{
			id: 'port',
			type: 'number',
			label: 'Port',
			default: DIRECT_DEFAULT_PORT,
			min: 1024,
			max: 65535,
		},
	],

	create: (context, config) => new DirectServerTransport(context, config),
}

/**
 * Accepting direct connections is part of Link, not something to add: anything that connects can do nothing until
 * the user pairs it
 */
export const DirectServerBuiltinTransport: LinkBuiltinTransport<DirectServerTransportConfig> = {
	id: 'direct-server',
	definition: DirectServerTransportDefinition,
	userConfigKeys: ['link_direct_enabled', 'link_direct_port'],
	getConfig: (userconfig) =>
		userconfig.getKey('link_direct_enabled') ? { port: Number(userconfig.getKey('link_direct_port')) } : null,
}

export const DirectClientTransportDefinition: LinkTransportDefinition<DirectClientTransportConfig> = {
	type: 'direct-client',
	name: 'Direct connection',
	description:
		'Connect directly to another installation, on the same network or over a VPN. The first time, you pair them by entering a code shown here on the other installation.',
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
