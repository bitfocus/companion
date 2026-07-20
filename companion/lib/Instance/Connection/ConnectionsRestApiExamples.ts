import { InstanceVersionUpdatePolicy } from '@companion-app/shared/Model/Instance.js'

const AtemConfigExample = {
	host: '10.50.0.20',
	modelID: 0,
	presets: 0,
	fadeFps: 10,
	enableCameraControl: true,
	pollTimecode: false,
	bonjourHost: null,
}

export const ConnectionResponseExample = {
	id: 'KJA1isEECHRDBTFjx-7tf',
	label: 'ATEM',
	moduleId: 'bmd-atem',
	moduleVersionId: '1.2.0',
	updatePolicy: InstanceVersionUpdatePolicy.Stable,
	enabled: true,
	status: { category: 'ok', level: 'info', message: 'Connected' },
	config: AtemConfigExample,
	secrets: {},
}

export const ConnectionCreateResponseExample = {
	id: 'KJA1isEECHRDBTFjx-7tf',
}

export const ConnectionCreateBodyExample = {
	moduleId: 'bmd-atem',
	label: 'ATEM',
	versionId: null,
	updatePolicy: InstanceVersionUpdatePolicy.Stable,
	disabled: false,
}

export const ConnectionPatchBodyExample = {
	label: 'ATEM Program',
	disabled: false,
	config: { host: '10.50.0.20', fadeFps: 10 },
	secrets: {},
	updatePolicy: InstanceVersionUpdatePolicy.Manual,
	versionId: '1.2.0',
}

export const ConnectionPatchResponseExample = {
	...ConnectionResponseExample,
	label: 'ATEM Program',
	updatePolicy: InstanceVersionUpdatePolicy.Manual,
}

export const ConnectionTreeResponseExample = {
	connections: [],
	collections: [
		{
			id: 'production',
			label: 'Production',
			enabled: true,
			connections: [ConnectionResponseExample],
			children: [],
		},
	],
}

export const ConnectionMoveBodyExample = {
	moves: [
		{ connectionId: 'KJA1isEECHRDBTFjx-7tf', collectionId: 'production', position: 0 },
		{ connectionId: 'XhA2fsEECHRDQPKjx-8ug', collectionId: null, position: 1 },
	],
}

export const ConfigFieldsResponseExample = [
	{
		id: 'bonjourHost',
		type: 'bonjour-device',
		label: 'Device',
	},
	{
		id: 'host',
		type: 'textinput',
		label: 'Target IP',
		default: '',
		regex: '/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/',
	},
	{
		id: 'modelID',
		type: 'dropdown',
		label: 'Model',
		default: 0,
		choices: [
			{ id: 0, label: 'Auto Detect' },
			{ id: 33, label: 'Mini Extreme ISO G2' },
		],
	},
	{
		id: 'fadeFps',
		type: 'number',
		label: 'Framerate for fades',
		tooltip: 'Higher is smoother, but has higher impact on system performance',
		default: 10,
		min: 5,
		max: 60,
		step: 1,
	},
	{
		id: 'enableCameraControl',
		type: 'checkbox',
		label: 'Enable Camera Control',
		default: false,
	},
]

export const RestartConnectionResponseExample = {
	id: 'KJA1isEECHRDBTFjx-7tf',
	message: 'Restart triggered',
}
