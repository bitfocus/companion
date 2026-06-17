import z from 'zod'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy, type InstanceConfig } from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'

/** Schema for connection status info */
export const ConnectionStatusSchema = z
	.object({
		category: z
			.string()
			.nullable()
			.describe('Status category reported by the connection module.')
			.meta({ example: 'ok' }),
		level: z.string().nullable().describe('Severity level of the current connection status.').meta({ example: 'info' }),
		message: z
			.string()
			.nullable()
			.describe('Human-readable status message from the connection module.')
			.meta({ example: 'Connected' }),
	})
	.meta({ example: { category: 'ok', level: 'info', message: 'Connected' } })

const AtemConfigExample = {
	host: '10.50.0.20',
	modelID: 0,
	presets: 0,
	fadeFps: 10,
	enableCameraControl: true,
	pollTimecode: false,
	bonjourHost: null,
}

const ConnectionResponseExample = {
	id: 'KJA1isEECHRDBTFjx-7tf',
	label: 'ATEM',
	moduleId: 'bmd-atem',
	moduleVersionId: null,
	updatePolicy: InstanceVersionUpdatePolicy.Stable,
	enabled: true,
	sortOrder: 1,
	collectionId: null,
	status: { category: 'ok', level: 'info', message: 'Connected' },
	config: AtemConfigExample,
	secrets: {},
}

export const ConnectionPatchResponseExample = {
	...ConnectionResponseExample,
	label: 'ATEM Program',
	updatePolicy: InstanceVersionUpdatePolicy.Manual,
}

/** Schema for a connection in API responses — used for both validation and stripping */
export const ConnectionResponseSchema = z
	.object({
		id: z.string().describe('Unique connection instance id.').meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
		label: z.string().describe('Display name shown for the connection in Companion.').meta({ example: 'ATEM' }),
		moduleId: z
			.string()
			.describe('Connection module id, such as "bmd-atem" or "obs-websocket".')
			.meta({ example: 'bmd-atem' }),
		moduleVersionId: z.string().nullable().describe('Installed module version id used by this connection.'),
		updatePolicy: z
			.enum(InstanceVersionUpdatePolicy)
			.describe('Module version update policy for this connection.')
			.meta({ example: InstanceVersionUpdatePolicy.Stable }),
		enabled: z.boolean().describe('Whether the connection is enabled and allowed to run.').meta({ example: true }),
		sortOrder: z.number().describe('Sort position of the connection in the Companion UI.').meta({ example: 1 }),
		collectionId: z.string().nullable().describe('Connection collection id, or null when not in a collection.'),
		status: ConnectionStatusSchema.nullable().describe('Latest runtime status reported by the connection.'),
		config: z.record(z.string(), z.unknown()).optional().describe('Non-secret connection configuration values.'),
		secrets: z.record(z.string(), z.unknown()).optional().describe('Secret connection configuration values.'),
	})
	.meta({ example: ConnectionResponseExample })

/** Schema for creating a new connection */
export const ConnectionCreateBodySchema = z
	.object({
		moduleId: z
			.string()
			.describe('Connection module id to create, such as "bmd-atem" or "obs-websocket".')
			.meta({ example: 'bmd-atem' }),
		label: z.string().describe('Display name for the new connection.').meta({ example: 'ATEM' }),
		versionId: z
			.string()
			.nullable()
			.default(null)
			.describe('Specific module version to use. Use null or omit to use the latest compatible stable version.')
			.meta({ example: null }),
		updatePolicy: z
			.enum(InstanceVersionUpdatePolicy)
			.default(InstanceVersionUpdatePolicy.Stable)
			.describe('Module version update policy for the new connection.')
			.meta({ example: InstanceVersionUpdatePolicy.Stable }),
		disabled: z
			.boolean()
			.default(false)
			.describe('Whether the new connection should be created disabled.')
			.meta({ example: false }),
	})
	.strict()
	.meta({
		example: {
			moduleId: 'bmd-atem',
			label: 'ATEM',
			versionId: null,
			updatePolicy: InstanceVersionUpdatePolicy.Stable,
			disabled: false,
		},
	})

/**
 * Schema for partially updating a connection.
 * Both `config` and `secrets` use merge semantics — only the keys you send are updated,
 * existing keys are preserved.
 */
export const ConnectionPatchBodySchema = z
	.object({
		label: z.string().optional().describe('New display name for the connection.').meta({ example: 'ATEM Program' }),
		disabled: z
			.boolean()
			.optional()
			.describe('Set true to disable the connection, or false to enable it.')
			.meta({ example: false }),
		config: z
			.record(z.string(), z.unknown())
			.optional()
			.describe('Non-secret config values to merge into the connection config.')
			.meta({ example: { host: '10.50.0.20', fadeFps: 10 } }),
		secrets: z
			.record(z.string(), z.unknown())
			.optional()
			.describe('Secret config values to merge into the connection secrets.')
			.meta({ example: {} }),
		updatePolicy: z
			.enum(InstanceVersionUpdatePolicy)
			.optional()
			.describe('Module version update policy to apply.')
			.meta({ example: InstanceVersionUpdatePolicy.Manual }),
		versionId: z
			.string()
			.nullable()
			.optional()
			.describe('Specific module version to use. Use null to use the latest compatible stable version.')
			.meta({ example: null }),
		collectionId: z
			.string()
			.nullable()
			.optional()
			.describe('Collection id to move the connection into, or null to remove it.')
			.meta({ example: null }),
	})
	.strict()
	.meta({
		example: {
			label: 'ATEM Program',
			disabled: false,
			config: { host: '10.50.0.20', fadeFps: 10 },
			secrets: {},
			updatePolicy: InstanceVersionUpdatePolicy.Manual,
			versionId: null,
			collectionId: null,
		},
	})

/** Schema for a dropdown choice */
const DropdownChoiceSchema = z.object({
	id: z.union([z.string(), z.number()]).describe('Choice value sent in connection config.').meta({ example: 'auto' }),
	label: z.string().describe('Display label for the choice.').meta({ example: 'Auto' }),
})

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

/** Schema for a config field definition in API responses */
export const ConfigFieldResponseSchema = z.object({
	id: z.string().describe('Config field id used as the key in config or secrets objects.').meta({ example: 'host' }),
	type: z.string().describe('Companion config field type.').meta({ example: 'textinput' }),
	label: z.string().describe('Display label for the config field.').meta({ example: 'Host' }),
	tooltip: z
		.string()
		.optional()
		.describe('Short help text shown for the config field.')
		.meta({ example: 'Target switcher IP' }),
	description: z.string().optional().describe('Longer help text for the config field.'),
	default: z.unknown().optional().describe('Default value for the config field.'),
	min: z.number().optional().describe('Minimum numeric value allowed.'),
	max: z.number().optional().describe('Maximum numeric value allowed.'),
	step: z.number().optional().describe('Numeric step size.'),
	range: z.boolean().optional().describe('Whether the field accepts a numeric range.'),
	minLength: z.number().optional().describe('Minimum string length allowed.'),
	regex: z.string().optional().describe('Regular expression that string values must match.'),
	placeholder: z.string().optional().describe('Placeholder text shown for empty text fields.'),
	multiline: z.boolean().optional().describe('Whether the text field supports multiple lines.'),
	choices: z.array(DropdownChoiceSchema).optional().describe('Allowed choices for dropdown-style fields.'),
	allowCustom: z.boolean().optional().describe('Whether custom values outside the choices list are allowed.'),
	minSelection: z.number().optional().describe('Minimum number of choices that must be selected.'),
	maxSelection: z.number().optional().describe('Maximum number of choices that can be selected.'),
	enableAlpha: z.boolean().optional().describe('Whether color values include an alpha channel.'),
	returnType: z.string().optional().describe('Value type returned by the field.'),
})

export type ConnectionResponse = z.infer<typeof ConnectionResponseSchema>
export type ConnectionCreateBody = z.infer<typeof ConnectionCreateBodySchema>
export type ConnectionPatchBody = z.infer<typeof ConnectionPatchBodySchema>

/**
 * Build a validated ConnectionResponse from internal data.
 * Parses through Zod to strip unknown fields and validate types.
 */
export function buildConnectionResponse(
	id: string,
	clientConfig: ClientConnectionConfig,
	status: InstanceStatusEntry | undefined,
	instanceConfig?: InstanceConfig,
	includeSecrets?: boolean
): ConnectionResponse {
	const response: Record<string, unknown> = {
		id,
		label: clientConfig.label,
		moduleId: clientConfig.moduleId,
		moduleVersionId: clientConfig.moduleVersionId,
		updatePolicy: clientConfig.updatePolicy,
		enabled: clientConfig.enabled,
		sortOrder: clientConfig.sortOrder,
		collectionId: clientConfig.collectionId,
		status: status ?? null,
	}

	if (instanceConfig) {
		response.config = (instanceConfig.config as Record<string, unknown>) ?? {}
		if (includeSecrets) {
			response.secrets = (instanceConfig.secrets as Record<string, unknown>) ?? {}
		}
	}

	return ConnectionResponseSchema.parse(response)
}
