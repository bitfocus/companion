import type { LinkTransportDefinition } from '../Types.js'
import { MockTransport, type MockTransportConfig } from './MockTransport.js'

export const MockTransportDefinition: LinkTransportDefinition<MockTransportConfig> = {
	type: 'mock',
	name: 'Mock (local network, for development)',
	description:
		'Finds the other installations using this on the local network with UDP multicast. Unencrypted and unauthenticated: only for developing Link, until a real transport is available.',
	configFields: [
		{
			id: 'port',
			type: 'number',
			label: 'Port',
			tooltip: 'Every installation that should see each other must use the same port',
			default: 16625,
			min: 1024,
			max: 65535,
		},
	],

	create: (context, config) => new MockTransport(context, config),
}
