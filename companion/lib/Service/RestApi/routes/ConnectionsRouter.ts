import Express from 'express'
import z from 'zod'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import type { InstanceController } from '../../../Instance/Controller.js'
import type { Logger } from '../../../Log/Controller.js'
import { RestApiError } from '../errors.js'
import { registry } from '../registry.js'
import { hasScope } from '../RestApiAuth.js'
import {
	collectionResponse,
	createCollectionSchema,
	createSuccessSchema,
	ErrorResponseSchema,
	successResponse,
} from '../schemas/common.js'
import {
	buildConnectionResponse,
	ConfigFieldResponseSchema,
	ConfigFieldsResponseExample,
	ConnectionCreateBodySchema,
	ConnectionCreateResponseSchema,
	ConnectionPatchBodySchema,
	ConnectionPatchResponseExample,
	ConnectionResponseSchema,
} from '../schemas/connections.js'
import {
	defineRestEndpoint,
	defineRestEndpointContract,
	mountRestEndpoint,
	registerRestEndpoint,
} from '../typedRoute.js'

const CONNECTIONS_API_BASE_PATH = '/connections/v1'
const CONNECTIONS_API_TAGS = ['Connections']

/**
 * Create the connections router for /api/connections/v1
 */
export function createConnectionsRouter(logger: Logger, instanceController: InstanceController): Express.Router {
	const router = Express.Router()

	mountRestEndpoint(
		router,
		defineRestEndpoint({
			...listConnectionsEndpoint,
			handler: ({ query, token }) => {
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
			},
		})
	)

	mountRestEndpoint(
		router,
		defineRestEndpoint({
			...createConnectionEndpoint,
			handler: async ({ body }) => {
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
			},
		})
	)

	mountRestEndpoint(
		router,
		defineRestEndpoint({
			...getConnectionEndpoint,
			handler: ({ params, query, token }) => {
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
			},
		})
	)

	mountRestEndpoint(
		router,
		defineRestEndpoint({
			...patchConnectionEndpoint,
			handler: async ({ params, body, token }) => {
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
			},
		})
	)

	mountRestEndpoint(
		router,
		defineRestEndpoint({
			...getConnectionConfigFieldsEndpoint,
			handler: async ({ params }) => {
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
			},
		})
	)

	mountRestEndpoint(
		router,
		defineRestEndpoint({
			...deleteConnectionEndpoint,
			handler: async ({ params }) => {
				const { connectionId } = params

				const clientConnections = instanceController.getConnectionClientJson(true)
				if (!clientConnections[connectionId]) {
					throw RestApiError.notFound('Connection not found')
				}

				await instanceController.removeConnection(connectionId)

				logger.info(`REST API: Deleted connection ${connectionId}`)
				return { status: 204 }
			},
		})
	)

	mountRestEndpoint(
		router,
		defineRestEndpoint({
			...restartConnectionEndpoint,
			handler: ({ params }) => {
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
			},
		})
	)

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

const connectionConfigFieldsResponseSchema = createSuccessSchema(
	z.array(ConfigFieldResponseSchema).meta({ example: ConfigFieldsResponseExample })
)

const restartConnectionResponseSchema = createSuccessSchema(
	z
		.object({
			id: z.string().describe('Connection instance id that was restarted.').meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
			message: z
				.string()
				.describe('Confirmation message for the restart request.')
				.meta({ example: 'Restart triggered' }),
		})
		.meta({ example: { id: 'KJA1isEECHRDBTFjx-7tf', message: 'Restart triggered' } })
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
		schema: createSuccessSchema(ConnectionResponseSchema.meta({ example: ConnectionPatchResponseExample })),
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
	extraResponses: {
		409: {
			description: 'Connection is inactive',
			content: { 'application/json': { schema: ErrorResponseSchema } },
		},
	},
	errorResponses,
})

const connectionEndpoints = [
	listConnectionsEndpoint,
	createConnectionEndpoint,
	getConnectionEndpoint,
	getConnectionConfigFieldsEndpoint,
	patchConnectionEndpoint,
	deleteConnectionEndpoint,
	restartConnectionEndpoint,
]

/**
 * Register all /connections paths in the OpenAPI registry.
 * Called once at startup before the spec is generated.
 */
export function registerConnectionPaths(): void {
	for (const endpoint of connectionEndpoints) {
		registerRestEndpoint(registry, CONNECTIONS_API_BASE_PATH, endpoint)
	}
}
