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
			id: 'topicPrefix',
			type: 'textinput',
			label: 'Topic prefix',
			tooltip:
				'All Link topics go under this, to keep them apart from anything else on the broker. Installations only see each other when they use the same prefix',
			default: 'companion-link',
			minLength: 1,
			regex: '/^[^#+]+$/',
		},
		{
			id: 'allowUntrustedCertificate',
			type: 'checkbox',
			label: 'Allow untrusted certificate',
			tooltip: 'Accept a TLS certificate that is self-signed or otherwise not trusted. This is insecure',
			default: false,
		},
		{
			id: 'security',
			type: 'static-text',
			label: 'Security',
			value:
				'Anyone who can connect to the broker can read what is sent over it, including the images of buttons shared with other installations. They cannot send anything as another installation, as every message is signed.',
		},
	],

	create: (context, config) => new MqttTransport(context, config),
}
