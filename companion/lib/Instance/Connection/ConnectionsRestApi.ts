import Express from 'express'
import z from 'zod'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import {
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
	type InstanceConfig,
} from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import type { Logger } from '../../Log/Controller.js'
import { RestApiError } from '../../Service/RestApi/errors.js'
import { registry } from '../../Service/RestApi/registry.js'
import { hasScope } from '../../Service/RestApi/RestApiAuth.js'
import {
	collectionResponse,
	createCollectionSchema,
	createSuccessSchema,
	ErrorResponseSchema,
	successResponse,
} from '../../Service/RestApi/schemas/common.js'
import {
	defineRestEndpoint,
	defineRestEndpointContract,
	mountRestEndpoint,
	registerRestEndpoint,
	type RestEndpointContract,
	type RestEndpointDefinition,
} from '../../Service/RestApi/typedRoute.js'
import type { InstanceController } from '../Controller.js'
import {
	ConfigFieldsResponseExample,
	ConnectionCreateBodyExample,
	ConnectionCreateResponseExample,
	ConnectionPatchBodyExample,
	ConnectionPatchResponseExample,
	ConnectionResponseExample,
	RestartConnectionResponseExample,
} from './ConnectionsRestApiExamples.js'

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

const VersionIdSchema = z.string().min(1, 'versionId cannot be empty')

/** Schema for a connection in API responses — used for both validation and stripping */
export const ConnectionResponseSchema = z.object({
	id: z.string().describe('Unique connection instance id.').meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
	label: z.string().describe('Display name shown for the connection in Companion.').meta({ example: 'ATEM' }),
	moduleId: z
		.string()
		.describe('Connection module id, such as "bmd-atem" or "obs-websocket".')
		.meta({ example: 'bmd-atem' }),
	moduleVersionId: z
		.string()
		.nullable()
		.describe(
			'Module version id used by this connection, such as "1.2.0". Null means the newest compatible stable version is selected automatically, and may be returned while that version is being installed.'
		)
		.meta({ example: '1.2.0' }),
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

/** Minimal response returned after creating a connection */
export const ConnectionCreateResponseSchema = z.object({
	id: z.string().describe('Unique connection instance id.').meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
})

/** Schema for creating a new connection */
export const ConnectionCreateBodySchema = z
	.object({
		moduleId: z
			.string()
			.describe('Connection module id to create, such as "bmd-atem" or "obs-websocket".')
			.meta({ example: 'bmd-atem' }),
		label: z.string().describe('Display name for the new connection.').meta({ example: 'ATEM' }),
		versionId: VersionIdSchema.nullable()
			.default(null)
			.describe(
				'Specific module version to use. Omit or use null to use the newest compatible stable version. If the module is not installed, Companion queues installation of that version.'
			)
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
		versionId: VersionIdSchema.nullable()
			.optional()
			.describe(
				'Specific module version to use, such as "1.2.0". Omit to leave the current version unchanged. Use null to switch to the newest compatible stable version.'
			)
			.meta({ example: '1.2.0' }),
		collectionId: z
			.string()
			.nullable()
			.optional()
			.describe('Collection id to move the connection into, or null to remove it.')
			.meta({ example: null }),
	})
	.strict()

/** Schema for a dropdown choice */
const DropdownChoiceSchema = z.object({
	id: z.union([z.string(), z.number()]).describe('Choice value sent in connection config.').meta({ example: 'auto' }),
	label: z.string().describe('Display label for the choice.').meta({ example: 'Auto' }),
})

/** Schema for a raw config field definition in API responses */
export const ConfigFieldResponseSchema = z
	.object({
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
	.catchall(z.unknown())

export type ConnectionResponse = z.infer<typeof ConnectionResponseSchema>
export type ConnectionCreateBody = z.infer<typeof ConnectionCreateBodySchema>
export type ConnectionCreateResponse = z.infer<typeof ConnectionCreateResponseSchema>
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
		response.config = instanceConfig.config ?? {}
		if (includeSecrets) {
			response.secrets = instanceConfig.secrets ?? {}
		}
	}

	return ConnectionResponseSchema.parse(response)
}

const CONNECTIONS_API_BASE_PATH = '/connections/v1'
const CONNECTIONS_API_TAGS = ['Connections']

type ConnectionsRestContext = {
	logger: Logger
	instanceController: InstanceController
}

type AnyRestEndpointContract = RestEndpointContract<
	z.ZodType | undefined,
	z.ZodType | undefined,
	z.ZodType | undefined,
	z.ZodType | undefined
>

type AnyRestEndpointDefinition = RestEndpointDefinition<
	z.ZodType | undefined,
	z.ZodType | undefined,
	z.ZodType | undefined,
	z.ZodType | undefined
>

type ConnectionEndpointSpec = {
	contract: AnyRestEndpointContract
	createEndpoint: (context: ConnectionsRestContext) => AnyRestEndpointDefinition
}

function defineConnectionEndpointSpec<
	ParamsSchema extends z.ZodType | undefined = undefined,
	QuerySchema extends z.ZodType | undefined = undefined,
	BodySchema extends z.ZodType | undefined = undefined,
	ResponseSchema extends z.ZodType | undefined = undefined,
>(
	contract: RestEndpointContract<ParamsSchema, QuerySchema, BodySchema, ResponseSchema>,
	createHandler: (
		context: ConnectionsRestContext
	) => RestEndpointDefinition<ParamsSchema, QuerySchema, BodySchema, ResponseSchema>['handler']
): ConnectionEndpointSpec {
	return {
		contract,
		createEndpoint: (context) =>
			defineRestEndpoint({
				...contract,
				handler: createHandler(context),
			}),
	}
}

/**
 * Create the connections router for /api/connections/v1
 */
export function createConnectionsRouter(logger: Logger, instanceController: InstanceController): Express.Router {
	const router = Express.Router()

	for (const endpointSpec of connectionEndpointSpecs) {
		mountRestEndpoint(router, endpointSpec.createEndpoint({ logger, instanceController }))
	}

	return router
}

type ValidationResult =
	| { status: 'ok' }
	| { status: 'unavailable'; message: string }
	| { status: 'invalid'; errors: Record<string, string> }

/**
 * Validate config and secrets values against the module's field definitions.
 * Returns validation result: ok, unavailable (connection not running), or invalid (field errors).
 */
async function validateConfigAndSecrets(
	instanceController: InstanceController,
	connectionId: string,
	config: Record<string, unknown> | undefined,
	secrets: Record<string, unknown> | undefined
): Promise<ValidationResult> {
	const instance = instanceController.processManager.getConnectionChild(connectionId)
	if (!instance) {
		return { status: 'unavailable', message: 'Connection is not running, cannot validate config' }
	}

	let fields: SomeCompanionInputField[]
	try {
		fields = await instance.requestConfigFields()
	} catch {
		return { status: 'unavailable', message: 'Failed to retrieve config fields from module' }
	}

	const errors: Record<string, string> = {}

	// Build a lookup of field definitions by id
	const fieldMap = new Map<string, SomeCompanionInputField>()
	for (const field of fields) {
		fieldMap.set(field.id, field)
	}

	// Validate config keys against non-secret fields
	if (config) {
		for (const [key, value] of Object.entries(config)) {
			const field = fieldMap.get(key)
			if (!field) {
				errors[`config.${key}`] = `Unknown config field: "${key}"`
				continue
			}
			if (field.type === 'secret-text') {
				errors[`config.${key}`] = `Field "${key}" is a secret and must be sent in "secrets", not "config"`
				continue
			}
			const result = validateInputValue(field, value as any)
			if (result.validationError) {
				errors[`config.${key}`] = result.validationError
			}
		}
	}

	// Validate secrets keys against secret-text fields
	if (secrets) {
		for (const [key, value] of Object.entries(secrets)) {
			const field = fieldMap.get(key)
			if (!field) {
				errors[`secrets.${key}`] = `Unknown secret field: "${key}"`
				continue
			}
			if (field.type !== 'secret-text') {
				errors[`secrets.${key}`] = `Field "${key}" is not a secret and must be sent in "config", not "secrets"`
				continue
			}
			const result = validateInputValue(field, value as any)
			if (result.validationError) {
				errors[`secrets.${key}`] = result.validationError
			}
		}
	}

	return Object.keys(errors).length > 0 ? { status: 'invalid', errors } : { status: 'ok' }
}

const connectionIdParam = z.object({
	connectionId: z
		.string()
		.describe('Connection instance id, as returned by the list or create connection endpoints.')
		.meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
})

const errorResponses = {
	400: { description: 'Bad request', content: { 'application/json': { schema: ErrorResponseSchema } } },
	401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
	403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
	404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
}

const connectionListQuery = z.object({
	include_config: z.enum(['true', 'false']).optional().describe('Include connection config in response').meta({
		example: 'true',
	}),
	include_secrets: z
		.enum(['true', 'false'])
		.optional()
		.describe('Include connection secrets in response (requires include_config=true)')
		.meta({ example: 'false' }),
})

const connectionGetQuery = z.object({
	include_secrets: z.enum(['true', 'false']).optional().describe('Include connection secrets in response').meta({
		example: 'false',
	}),
})

const connectionConfigFieldsResponseSchema = createSuccessSchema(z.array(ConfigFieldResponseSchema))

const restartConnectionResponseSchema = createSuccessSchema(
	z.object({
		id: z.string().describe('Connection instance id that was restarted.').meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
		message: z
			.string()
			.describe('Confirmation message for the restart request.')
			.meta({ example: 'Restart triggered' }),
	})
)

const listConnectionsEndpoint = defineRestEndpointContract({
	method: 'get',
	path: '/',
	scope: 'read',
	tags: CONNECTIONS_API_TAGS,
	summary: 'List all connections',
	description: 'Returns all connections with their current status. Use query parameters to include config and secrets.',
	request: {
		query: connectionListQuery,
	},
	response: {
		status: 200,
		description: 'List of connections',
		schema: createCollectionSchema(ConnectionResponseSchema),
	},
	examples: {
		response: collectionResponse([ConnectionResponseExample], { total: 1, limit: 1, offset: 0 }),
	},
	errorResponses,
})

const createConnectionEndpoint = defineRestEndpointContract({
	method: 'post',
	path: '/',
	scope: 'write',
	tags: CONNECTIONS_API_TAGS,
	summary: 'Create a connection',
	description:
		'Create a new connection instance for a given connection module id. If the module is not installed, Companion queues installation of the latest compatible stable version by default.',
	request: {
		body: ConnectionCreateBodySchema,
	},
	response: {
		status: 201,
		description: 'Connection created',
		schema: createSuccessSchema(ConnectionCreateResponseSchema),
	},
	examples: {
		body: ConnectionCreateBodyExample,
		response: successResponse(ConnectionCreateResponseExample),
	},
	errorResponses,
})

const getConnectionEndpoint = defineRestEndpointContract({
	method: 'get',
	path: '/:connectionId',
	scope: 'read',
	tags: CONNECTIONS_API_TAGS,
	summary: 'Get a connection',
	description: 'Returns a single connection by ID with its configuration and current status.',
	request: {
		params: connectionIdParam,
		query: connectionGetQuery,
	},
	response: {
		status: 200,
		description: 'Connection details',
		schema: createSuccessSchema(ConnectionResponseSchema),
	},
	examples: {
		response: successResponse(ConnectionResponseExample),
	},
	errorResponses,
})

const getConnectionConfigFieldsEndpoint = defineRestEndpointContract({
	method: 'get',
	path: '/:connectionId/config-fields',
	scope: 'read',
	tags: CONNECTIONS_API_TAGS,
	summary: 'Get connection config field definitions',
	description:
		'Returns the config field definitions for a connection module, including field types, constraints, and available options. The connection must be running.',
	request: {
		params: connectionIdParam,
	},
	response: {
		status: 200,
		description: 'Config field definitions',
		schema: connectionConfigFieldsResponseSchema,
	},
	examples: {
		response: successResponse(ConfigFieldsResponseExample),
	},
	extraResponses: {
		409: {
			description: 'Connection is not running',
			content: { 'application/json': { schema: ErrorResponseSchema } },
		},
	},
	errorResponses,
})

const patchConnectionEndpoint = defineRestEndpointContract({
	method: 'patch',
	path: '/:connectionId',
	scope: 'write',
	tags: CONNECTIONS_API_TAGS,
	summary: 'Update a connection',
	description: 'Partially update a connection. Only send the fields you want to change.',
	request: {
		params: connectionIdParam,
		body: ConnectionPatchBodySchema,
	},
	response: {
		status: 200,
		description: 'Updated connection',
		schema: createSuccessSchema(ConnectionResponseSchema),
	},
	examples: {
		body: ConnectionPatchBodyExample,
		response: successResponse(ConnectionPatchResponseExample),
	},
	errorResponses,
})

const deleteConnectionEndpoint = defineRestEndpointContract({
	method: 'delete',
	path: '/:connectionId',
	scope: 'write',
	tags: CONNECTIONS_API_TAGS,
	summary: 'Delete a connection',
	description: 'Delete a connection and all its associated configuration.',
	request: {
		params: connectionIdParam,
	},
	response: {
		status: 204,
		description: 'Connection deleted',
	},
	errorResponses,
})

const restartConnectionEndpoint = defineRestEndpointContract({
	method: 'post',
	path: '/:connectionId/restart',
	scope: 'execute',
	tags: CONNECTIONS_API_TAGS,
	summary: 'Restart a connection',
	description: 'Force-restart the connection process. Fails if the connection is disabled.',
	request: {
		params: connectionIdParam,
	},
	response: {
		status: 200,
		description: 'Restart triggered',
		schema: restartConnectionResponseSchema,
	},
	examples: {
		response: successResponse(RestartConnectionResponseExample),
	},
	extraResponses: {
		409: {
			description: 'Connection is inactive',
			content: { 'application/json': { schema: ErrorResponseSchema } },
		},
	},
	errorResponses,
})

const connectionEndpointSpecs = [
	defineConnectionEndpointSpec(listConnectionsEndpoint, ({ instanceController }) => {
		return ({ query, token }) => {
			const includeConfig = query.include_config === 'true'
			const includeSecrets = query.include_secrets === 'true'

			if (includeSecrets && !includeConfig) {
				throw RestApiError.badRequest("Query parameter 'include_secrets' requires 'include_config=true'")
			}

			if (includeSecrets && !hasScope(token.scopes, 'secrets')) {
				throw RestApiError.forbidden("Insufficient scope: requires 'secrets'")
			}
			const clientConnections = instanceController.getConnectionClientJson(true)

			const connections = Object.entries(clientConnections).map(([id, config]) => {
				const status = instanceController.getInstanceStatus(id)
				const instanceConfig = includeConfig
					? instanceController.getInstanceConfigOfType(id, ModuleInstanceType.Connection)
					: undefined
				return buildConnectionResponse(id, config, status, instanceConfig, includeSecrets)
			})

			return {
				body: collectionResponse(connections, { total: connections.length, limit: connections.length, offset: 0 }),
			}
		}
	}),

	defineConnectionEndpointSpec(createConnectionEndpoint, ({ logger, instanceController }) => {
		return async ({ body }) => {
			const { moduleId, label, versionId, updatePolicy, disabled } = body

			// Validate the module exists before attempting to create
			const isInstalledModule = instanceController.modules.hasModule(ModuleInstanceType.Connection, moduleId)
			const storeVersionInfo = !isInstalledModule
				? await instanceController.modulesStore.fetchModuleVersionInfo(
						ModuleInstanceType.Connection,
						moduleId,
						versionId,
						true
					)
				: null
			if (!isInstalledModule && !storeVersionInfo) {
				throw RestApiError.badRequest(`Unknown module id: "${moduleId}"`)
			}

			// Validate the specific version exists if provided
			if (versionId) {
				const versionInfo =
					instanceController.modules.getModuleManifest(ModuleInstanceType.Connection, moduleId, versionId) ??
					storeVersionInfo
				if (!versionInfo) {
					throw RestApiError.badRequest(`Unknown version "${versionId}" for module "${moduleId}"`)
				}
			}

			try {
				const [id] = instanceController.addConnectionWithLabel({ type: moduleId }, label, {
					versionId,
					updatePolicy,
					disabled,
				})

				logger.info(`REST API: Created connection "${label}" (${id})`)
				return { status: 201, location: `/api/connections/v1/${id}`, body: successResponse({ id }) }
			} catch (e) {
				throw RestApiError.badRequest(e instanceof Error ? e.message : 'Failed to create connection')
			}
		}
	}),

	defineConnectionEndpointSpec(getConnectionEndpoint, ({ instanceController }) => {
		return ({ params, query, token }) => {
			const { connectionId } = params
			const includeSecrets = query.include_secrets === 'true'

			if (includeSecrets && !hasScope(token.scopes, 'secrets')) {
				throw RestApiError.forbidden("Insufficient scope: requires 'secrets'")
			}
			const clientConnections = instanceController.getConnectionClientJson(true)
			const config = clientConnections[connectionId]

			if (!config) {
				throw RestApiError.notFound('Connection not found')
			}

			const status = instanceController.getInstanceStatus(connectionId)
			const instanceConfig = instanceController.getInstanceConfigOfType(connectionId, ModuleInstanceType.Connection)
			return {
				body: successResponse(buildConnectionResponse(connectionId, config, status, instanceConfig, includeSecrets)),
			}
		}
	}),

	defineConnectionEndpointSpec(patchConnectionEndpoint, ({ logger, instanceController }) => {
		return async ({ params, body, token }) => {
			const { connectionId } = params

			const clientConnections = instanceController.getConnectionClientJson(true)
			const currentConnection = clientConnections[connectionId]
			if (!currentConnection) {
				throw RestApiError.notFound('Connection not found')
			}

			const { label, disabled, config, secrets, updatePolicy, versionId } = body

			// Require 'secrets' scope to update secrets
			if (secrets && !hasScope(token.scopes, 'secrets')) {
				throw RestApiError.forbidden("Insufficient scope: requires 'secrets'")
			}

			if (versionId) {
				const versionInfo =
					instanceController.modules.getModuleManifest(
						ModuleInstanceType.Connection,
						currentConnection.moduleId,
						versionId
					) ??
					(await instanceController.modulesStore.fetchModuleVersionInfo(
						ModuleInstanceType.Connection,
						currentConnection.moduleId,
						versionId,
						true
					))
				if (!versionInfo) {
					throw RestApiError.badRequest(`Unknown version "${versionId}" for module "${currentConnection.moduleId}"`)
				}
			}

			if (versionId !== undefined) {
				const versionResult = instanceController.setModuleVersionAndActivate(connectionId, versionId, null)
				if (!versionResult) {
					throw RestApiError.badRequest('Failed to update connection version')
				}
			}

			// Validate config/secrets values against module field definitions
			if (config || secrets) {
				const validationResult = await validateConfigAndSecrets(instanceController, connectionId, config, secrets)
				if (validationResult.status === 'unavailable') {
					throw RestApiError.conflict(validationResult.message)
				}
				if (validationResult.status === 'invalid') {
					throw RestApiError.badRequest('Config validation failed', validationResult.errors)
				}
			}

			const result = instanceController.setConnectionLabelAndConfig(
				connectionId,
				{
					label: label ?? null,
					enabled: disabled === undefined ? null : !disabled,
					config: config ?? null,
					secrets: secrets ?? null,
					updatePolicy: updatePolicy ?? null,
					upgradeIndex: null,
				},
				{ patchConfig: true, patchSecrets: true }
			)

			if (!result.ok) {
				throw RestApiError.badRequest(result.message)
			}

			// Re-fetch updated data — only echo back secrets if they were part of the update
			const updatedConnections = instanceController.getConnectionClientJson(false)
			const updatedConfig = updatedConnections[connectionId]
			const status = instanceController.getInstanceStatus(connectionId)
			const instanceConfig = instanceController.getInstanceConfigOfType(connectionId, ModuleInstanceType.Connection)
			const response = buildConnectionResponse(connectionId, updatedConfig, status, instanceConfig, !!secrets)

			logger.info(`REST API: Updated connection "${response.label}" (${connectionId})`)
			return { body: successResponse(response) }
		}
	}),

	defineConnectionEndpointSpec(getConnectionConfigFieldsEndpoint, ({ instanceController }) => {
		return async ({ params }) => {
			const { connectionId } = params

			const clientConnections = instanceController.getConnectionClientJson(true)
			if (!clientConnections[connectionId]) {
				throw RestApiError.notFound('Connection not found')
			}

			const instance = instanceController.processManager.getConnectionChild(connectionId)
			if (!instance) {
				throw RestApiError.conflict('Connection is not running')
			}

			let fields: SomeCompanionInputField[]
			try {
				fields = await instance.requestConfigFields()
			} catch {
				throw RestApiError.conflict('Failed to retrieve config fields from module')
			}

			const response = connectionConfigFieldsResponseSchema.parse(successResponse(fields))

			return { body: response }
		}
	}),

	defineConnectionEndpointSpec(deleteConnectionEndpoint, ({ logger, instanceController }) => {
		return async ({ params }) => {
			const { connectionId } = params

			const clientConnections = instanceController.getConnectionClientJson(true)
			if (!clientConnections[connectionId]) {
				throw RestApiError.notFound('Connection not found')
			}

			await instanceController.removeConnection(connectionId)

			logger.info(`REST API: Deleted connection ${connectionId}`)
			return { status: 204 }
		}
	}),

	defineConnectionEndpointSpec(restartConnectionEndpoint, ({ logger, instanceController }) => {
		return ({ params }) => {
			const { connectionId } = params

			const clientConnections = instanceController.getConnectionClientJson(true)
			if (!clientConnections[connectionId]) {
				throw RestApiError.notFound('Connection not found')
			}

			const result = instanceController.restartConnection(connectionId)
			if (!result) {
				throw RestApiError.conflict('Connection is inactive and cannot be restarted')
			}

			logger.info(`REST API: Restarted connection ${connectionId}`)
			return { body: successResponse({ id: connectionId, message: 'Restart triggered' }) }
		}
	}),
]

/**
 * Register all /connections paths in the OpenAPI registry.
 * Called once at startup before the spec is generated.
 */
export function registerConnectionPaths(): void {
	for (const endpointSpec of connectionEndpointSpecs) {
		registerRestEndpoint(registry, CONNECTIONS_API_BASE_PATH, endpointSpec.contract)
	}
}
