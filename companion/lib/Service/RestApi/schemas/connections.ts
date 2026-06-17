import z from 'zod'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy, type InstanceConfig } from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'

/** Schema for connection status info */
export const ConnectionStatusSchema = z.object({
	category: z.string().nullable().describe('Status category reported by the connection module.'),
	level: z.string().nullable().describe('Severity level of the current connection status.'),
	message: z.string().nullable().describe('Human-readable status message from the connection module.'),
})

/** Schema for a connection in API responses — used for both validation and stripping */
export const ConnectionResponseSchema = z.object({
	id: z.string().describe('Unique connection instance id.'),
	label: z.string().describe('Display name shown for the connection in Companion.'),
	moduleId: z.string().describe('Connection module id, such as "bmd-atem" or "obs-websocket".'),
	moduleVersionId: z.string().nullable().describe('Installed module version id used by this connection.'),
	updatePolicy: z.enum(InstanceVersionUpdatePolicy).describe('Module version update policy for this connection.'),
	enabled: z.boolean().describe('Whether the connection is enabled and allowed to run.'),
	sortOrder: z.number().describe('Sort position of the connection in the Companion UI.'),
	collectionId: z.string().nullable().describe('Connection collection id, or null when not in a collection.'),
	status: ConnectionStatusSchema.nullable().describe('Latest runtime status reported by the connection.'),
	config: z.record(z.string(), z.unknown()).optional().describe('Non-secret connection configuration values.'),
	secrets: z.record(z.string(), z.unknown()).optional().describe('Secret connection configuration values.'),
})

/** Schema for creating a new connection */
export const ConnectionCreateBodySchema = z
	.object({
		moduleId: z.string().describe('Connection module id to create, such as "bmd-atem" or "obs-websocket".'),
		label: z.string().describe('Display name for the new connection.'),
		versionId: z
			.string()
			.nullable()
			.default(null)
			.describe('Specific module version to use. Use null or omit to use the latest compatible stable version.'),
		updatePolicy: z
			.enum(InstanceVersionUpdatePolicy)
			.default(InstanceVersionUpdatePolicy.Stable)
			.describe('Module version update policy for the new connection.'),
		disabled: z.boolean().default(false).describe('Whether the new connection should be created disabled.'),
	})
	.strict()

/**
 * Schema for partially updating a connection.
 * Both `config` and `secrets` use merge semantics — only the keys you send are updated,
 * existing keys are preserved.
 */
export const ConnectionPatchBodySchema = z
	.object({
		label: z.string().optional().describe('New display name for the connection.'),
		disabled: z.boolean().optional().describe('Set true to disable the connection, or false to enable it.'),
		config: z
			.record(z.string(), z.unknown())
			.optional()
			.describe('Non-secret config values to merge into the connection config.'),
		secrets: z
			.record(z.string(), z.unknown())
			.optional()
			.describe('Secret config values to merge into the connection secrets.'),
		updatePolicy: z.enum(InstanceVersionUpdatePolicy).optional().describe('Module version update policy to apply.'),
		versionId: z
			.string()
			.nullable()
			.optional()
			.describe('Specific module version to use. Use null to use the latest compatible stable version.'),
		collectionId: z
			.string()
			.nullable()
			.optional()
			.describe('Collection id to move the connection into, or null to remove it.'),
	})
	.strict()

/** Schema for a dropdown choice */
const DropdownChoiceSchema = z.object({
	id: z.union([z.string(), z.number()]).describe('Choice value sent in connection config.'),
	label: z.string().describe('Display label for the choice.'),
})

/** Schema for a config field definition in API responses */
export const ConfigFieldResponseSchema = z.object({
	id: z.string().describe('Config field id used as the key in config or secrets objects.'),
	type: z.string().describe('Companion config field type.'),
	label: z.string().describe('Display label for the config field.'),
	tooltip: z.string().optional().describe('Short help text shown for the config field.'),
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
