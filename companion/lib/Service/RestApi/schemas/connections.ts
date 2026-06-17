import z from 'zod'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy, type InstanceConfig } from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'

/** Schema for connection status info */
export const ConnectionStatusSchema = z.object({
	category: z.string().nullable(),
	level: z.string().nullable(),
	message: z.string().nullable(),
})

/** Schema for a connection in API responses — used for both validation and stripping */
export const ConnectionResponseSchema = z.object({
	id: z.string(),
	label: z.string(),
	moduleId: z.string(),
	moduleVersionId: z.string().nullable(),
	updatePolicy: z.enum(InstanceVersionUpdatePolicy),
	enabled: z.boolean(),
	sortOrder: z.number(),
	collectionId: z.string().nullable(),
	status: ConnectionStatusSchema.nullable(),
	config: z.record(z.string(), z.unknown()).optional(),
	secrets: z.record(z.string(), z.unknown()).optional(),
})

/** Schema for creating a new connection */
export const ConnectionCreateBodySchema = z
	.object({
		module: z.object({
			type: z.string(),
			product: z.string().optional(),
		}),
		label: z.string(),
		versionId: z.string().nullable().optional(),
		disabled: z.boolean().optional(),
	})
	.strict()

/**
 * Schema for partially updating a connection.
 * Both `config` and `secrets` use merge semantics — only the keys you send are updated,
 * existing keys are preserved.
 */
export const ConnectionPatchBodySchema = z
	.object({
		label: z.string().optional(),
		disabled: z.boolean().optional(),
		config: z.record(z.string(), z.unknown()).optional(),
		secrets: z.record(z.string(), z.unknown()).optional(),
		updatePolicy: z.enum(InstanceVersionUpdatePolicy).optional(),
		collectionId: z.string().nullable().optional(),
	})
	.strict()

/** Schema for a dropdown choice */
const DropdownChoiceSchema = z.object({
	id: z.union([z.string(), z.number()]),
	label: z.string(),
})

/** Schema for a config field definition in API responses */
export const ConfigFieldResponseSchema = z.object({
	id: z.string(),
	type: z.string(),
	label: z.string(),
	tooltip: z.string().optional(),
	description: z.string().optional(),
	default: z.unknown().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
	range: z.boolean().optional(),
	minLength: z.number().optional(),
	regex: z.string().optional(),
	placeholder: z.string().optional(),
	multiline: z.boolean().optional(),
	choices: z.array(DropdownChoiceSchema).optional(),
	allowCustom: z.boolean().optional(),
	minSelection: z.number().optional(),
	maxSelection: z.number().optional(),
	enableAlpha: z.boolean().optional(),
	returnType: z.string().optional(),
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
