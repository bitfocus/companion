import type { LinkTransportDefinition } from '../Types.js'
import { MqttTransport, type MqttTransportConfig } from './MqttTransport.js'

export const MqttTransportDefinition: LinkTransportDefinition<MqttTransportConfig> = {
	type: 'mqtt',
	name: 'MQTT broker',
	experimental: true,
	description:
		'Connect to an MQTT broker (such as Mosquitto) that the other installations also connect to. Works across networks and through firewalls, as only the broker needs to be reachable.',
	configFields: [
		{
			id: 'url',
			type: 'textinput',
			label: 'Broker URL',
			description: 'mqtt://, mqtts:// (TLS), ws:// or wss://, with the port if it is not the default',
			placeholder: 'mqtts://broker.example.com:8883',
			default: 'mqtt://localhost:1883',
			regex: '/^(mqtts?|wss?):\\/\\/.+/',
		},
		{
			id: 'username',
			type: 'textinput',
			label: 'Username',
			default: '',
		},
		{
			id: 'password',
			type: 'secret-text',
			label: 'Password',
			default: '',
		},
		{
			id: 'allowUntrustedCertificate',
			type: 'checkbox',
			label: 'Allow untrusted certificate',
			tooltip: 'Accept a TLS certificate that is self-signed or otherwise not trusted. This is insecure',
			default: false,
		},
		{
			id: 'shareButtons',
			type: 'checkbox',
			label: 'Share buttons',
			tooltip:
				"Let the other installations on this broker see and press the buttons of this one. A broker can't tell its clients apart, so this applies to everyone who can connect to it",
			default: false,
		},
	],

	create: (context, config) => new MqttTransport(context, config),
}
