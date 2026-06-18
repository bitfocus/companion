import Express from 'express'
import z from 'zod'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import type { InstanceController } from '../../../Instance/Controller.js'
import type { Logger } from '../../../Log/Controller.js'
import { RestApiError } from '../errors.js'
import { registry } from '../registry.js'
import { hasScope, requireScope, type ApiToken } from '../RestApiAuth.js'
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
	ConnectionPatchBodySchema,
	ConnectionPatchResponseExample,
	ConnectionResponseSchema,
} from '../schemas/connections.js'

/**
 * Create the connections router for /api/connections/v1
 */
export function createConnectionsRouter(logger: Logger, instanceController: InstanceController): Express.Router {
	const router = Express.Router()

	/**
	 * GET /connections — List all connections with config + status
	 */
	router.get('/', requireScope('read'), (req, res, next) => {
		const token = (req as any).apiToken as ApiToken
		const includeConfig = req.query.include_config === 'true'
		const includeSecrets = req.query.include_secrets === 'true'

		if (includeSecrets && !hasScope(token.scopes, 'secrets')) {
			next(RestApiError.forbidden("Insufficient scope: requires 'secrets'"))
			return
		}
		const clientConnections = instanceController.getConnectionClientJson(true)

		const connections = Object.entries(clientConnections).map(([id, config]) => {
			const status = instanceController.getInstanceStatus(id)
			const instanceConfig = includeConfig
				? instanceController.getInstanceConfigOfType(id, ModuleInstanceType.Connection)
				: undefined
			return buildConnectionResponse(id, config, status, instanceConfig, includeSecrets)
		})

		res.json(collectionResponse(connections, { total: connections.length, limit: connections.length, offset: 0 }))
	})

	/**
	 * POST /connections — Create a new connection
	 */
	router.post('/', requireScope('write'), async (req, res, next) => {
		const parsed = ConnectionCreateBodySchema.safeParse(req.body)
		if (!parsed.success) {
			next(RestApiError.badRequest('Invalid request body', parsed.error.format()))
			return
		}

		const { moduleId, label, versionId, updatePolicy, disabled } = parsed.data

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
			next(RestApiError.badRequest(`Unknown module id: "${moduleId}"`))
			return
		}

		// Validate the specific version exists if provided
		if (versionId) {
			const versionInfo =
				instanceController.modules.getModuleManifest(ModuleInstanceType.Connection, moduleId, versionId) ??
				storeVersionInfo
			if (!versionInfo) {
				next(RestApiError.badRequest(`Unknown version "${versionId}" for module "${moduleId}"`))
				return
			}
		}

		try {
			const [id] = instanceController.addConnectionWithLabel({ type: moduleId }, label, {
				versionId,
				updatePolicy,
				disabled,
			})

			// Re-fetch from client JSON so response goes through the same path as GET
			const clientConnections = instanceController.getConnectionClientJson(false)
			const config = clientConnections[id]
			const status = instanceController.getInstanceStatus(id)
			const instanceConfig = instanceController.getInstanceConfigOfType(id, ModuleInstanceType.Connection)
			const response = buildConnectionResponse(id, config, status, instanceConfig)

			logger.info(`REST API: Created connection "${label}" (${id})`)
			res.status(201).location(`/api/connections/v1/${id}`).json(successResponse(response))
		} catch (e: any) {
			next(RestApiError.badRequest(e.message || 'Failed to create connection'))
		}
	})

	/**
	 * GET /connections/:connectionId — Get one connection (config + status)
	 */
	router.get('/:connectionId', requireScope('read'), (req, res, next) => {
		const token = (req as any).apiToken as ApiToken
		const { connectionId } = req.params
		const includeSecrets = req.query.include_secrets === 'true'

		if (includeSecrets && !hasScope(token.scopes, 'secrets')) {
			next(RestApiError.forbidden("Insufficient scope: requires 'secrets'"))
			return
		}
		const clientConnections = instanceController.getConnectionClientJson(true)
		const config = clientConnections[connectionId]

		if (!config) {
			next(RestApiError.notFound('Connection not found'))
			return
		}

		const status = instanceController.getInstanceStatus(connectionId)
		const instanceConfig = instanceController.getInstanceConfigOfType(connectionId, ModuleInstanceType.Connection)
		res.json(successResponse(buildConnectionResponse(connectionId, config, status, instanceConfig, includeSecrets)))
	})

	/**
	 * PATCH /connections/:connectionId — Partial update (merge fields)
	 */
	router.patch('/:connectionId', requireScope('write'), async (req, res, next) => {
		const { connectionId } = req.params

		const clientConnections = instanceController.getConnectionClientJson(true)
		const currentConnection = clientConnections[connectionId]
		if (!currentConnection) {
			next(RestApiError.notFound('Connection not found'))
			return
		}

		const parsed = ConnectionPatchBodySchema.safeParse(req.body)
		if (!parsed.success) {
			next(RestApiError.badRequest('Invalid request body', parsed.error.format()))
			return
		}

		const { label, disabled, config, secrets, updatePolicy, versionId } = parsed.data

		// Require 'secrets' scope to update secrets
		if (secrets) {
			const token = (req as any).apiToken as ApiToken
			if (!hasScope(token.scopes, 'secrets')) {
				next(RestApiError.forbidden("Insufficient scope: requires 'secrets'"))
				return
			}
		}

		// Validate config/secrets values against module field definitions
		if (config || secrets) {
			const validationResult = await validateConfigAndSecrets(instanceController, connectionId, config, secrets)
			if (validationResult.status === 'unavailable') {
				next(RestApiError.conflict(validationResult.message))
				return
			}
			if (validationResult.status === 'invalid') {
				next(RestApiError.badRequest('Config validation failed', validationResult.errors))
				return
			}
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
				next(RestApiError.badRequest(`Unknown version "${versionId}" for module "${currentConnection.moduleId}"`))
				return
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
			next(RestApiError.badRequest(result.message))
			return
		}

		if (versionId !== undefined) {
			const versionResult = instanceController.setModuleVersionAndActivate(connectionId, versionId, null)
			if (!versionResult) {
				next(RestApiError.badRequest('Failed to update connection version'))
				return
			}
		}

		// Re-fetch updated data — only echo back secrets if they were part of the update
		const updatedConnections = instanceController.getConnectionClientJson(false)
		const updatedConfig = updatedConnections[connectionId]
		const status = instanceController.getInstanceStatus(connectionId)
		const instanceConfig = instanceController.getInstanceConfigOfType(connectionId, ModuleInstanceType.Connection)
		const response = buildConnectionResponse(connectionId, updatedConfig, status, instanceConfig, !!secrets)

		logger.info(`REST API: Updated connection "${response.label}" (${connectionId})`)
		res.json(successResponse(response))
	})

	/**
	 * GET /connections/:connectionId/config-fields — Get module config field definitions
	 */
	router.get('/:connectionId/config-fields', requireScope('read'), async (req, res, next) => {
		const { connectionId } = req.params

		const clientConnections = instanceController.getConnectionClientJson(true)
		if (!clientConnections[connectionId]) {
			next(RestApiError.notFound('Connection not found'))
			return
		}

		const instance = instanceController.processManager.getConnectionChild(connectionId)
		if (!instance) {
			next(RestApiError.conflict('Connection is not running'))
			return
		}

		let fields: SomeCompanionInputField[]
		try {
			fields = await instance.requestConfigFields()
		} catch {
			next(RestApiError.conflict('Failed to retrieve config fields from module'))
			return
		}

		const configFields = fields.filter((field) => field.type !== 'static-text')

		res.json(successResponse(configFields))
	})

	/**
	 * DELETE /connections/:connectionId — Delete a connection
	 */
	router.delete('/:connectionId', requireScope('write'), async (req, res, next) => {
		const { connectionId } = req.params

		const clientConnections = instanceController.getConnectionClientJson(true)
		if (!clientConnections[connectionId]) {
			next(RestApiError.notFound('Connection not found'))
			return
		}

		await instanceController.removeConnection(connectionId)

		logger.info(`REST API: Deleted connection ${connectionId}`)
		res.status(204).send()
	})

	/**
	 * POST /connections/:connectionId/restart — Restart connection process
	 */
	router.post('/:connectionId/restart', requireScope('execute'), (req, res, next) => {
		const { connectionId } = req.params

		const clientConnections = instanceController.getConnectionClientJson(true)
		if (!clientConnections[connectionId]) {
			next(RestApiError.notFound('Connection not found'))
			return
		}

		const result = instanceController.restartConnection(connectionId)
		if (!result) {
			next(RestApiError.conflict('Connection is inactive and cannot be restarted'))
			return
		}

		logger.info(`REST API: Restarted connection ${connectionId}`)
		res.json(successResponse({ id: connectionId, message: 'Restart triggered' }))
	})

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

/**
 * Register all /connections paths in the OpenAPI registry.
 * Called once at startup before the spec is generated.
 */
export function registerConnectionPaths(): void {
	registry.registerPath({
		method: 'get',
		path: '/connections/v1',
		tags: ['Connections'],
		summary: 'List all connections',
		description:
			'Returns all connections with their current status. Use query parameters to include config and secrets.',
		security: [{ bearerAuth: [] }],
		request: {
			query: z.object({
				include_config: z
					.enum(['true', 'false'])
					.optional()
					.describe('Include connection config in response')
					.meta({ example: 'true' }),
				include_secrets: z
					.enum(['true', 'false'])
					.optional()
					.describe('Include connection secrets in response (requires include_config=true)')
					.meta({ example: 'false' }),
			}),
		},
		responses: {
			200: {
				description: 'List of connections',
				content: { 'application/json': { schema: createCollectionSchema(ConnectionResponseSchema) } },
			},
			...errorResponses,
		},
	})

	registry.registerPath({
		method: 'post',
		path: '/connections/v1',
		tags: ['Connections'],
		summary: 'Create a connection',
		description:
			'Create a new connection instance for a given connection module id. If the module is not installed, Companion queues installation of the latest compatible stable version by default.',
		security: [{ bearerAuth: [] }],
		request: {
			body: { content: { 'application/json': { schema: ConnectionCreateBodySchema } }, required: true },
		},
		responses: {
			201: {
				description: 'Connection created',
				content: { 'application/json': { schema: createSuccessSchema(ConnectionResponseSchema) } },
			},
			...errorResponses,
		},
	})

	registry.registerPath({
		method: 'get',
		path: '/connections/v1/{connectionId}',
		tags: ['Connections'],
		summary: 'Get a connection',
		description: 'Returns a single connection by ID with its configuration and current status.',
		security: [{ bearerAuth: [] }],
		request: {
			params: connectionIdParam,
			query: z.object({
				include_secrets: z
					.enum(['true', 'false'])
					.optional()
					.describe('Include connection secrets in response')
					.meta({ example: 'false' }),
			}),
		},
		responses: {
			200: {
				description: 'Connection details',
				content: { 'application/json': { schema: createSuccessSchema(ConnectionResponseSchema) } },
			},
			...errorResponses,
		},
	})

	registry.registerPath({
		method: 'get',
		path: '/connections/v1/{connectionId}/config-fields',
		tags: ['Connections'],
		summary: 'Get connection config field definitions',
		description:
			'Returns the config field definitions for a connection module, including field types, constraints, and available options. The connection must be running.',
		security: [{ bearerAuth: [] }],
		request: { params: connectionIdParam },
		responses: {
			200: {
				description: 'Config field definitions',
				content: {
					'application/json': {
						schema: createSuccessSchema(
							z.array(ConfigFieldResponseSchema).meta({ example: ConfigFieldsResponseExample })
						),
					},
				},
			},
			409: {
				description: 'Connection is not running',
				content: { 'application/json': { schema: ErrorResponseSchema } },
			},
			...errorResponses,
		},
	})

	registry.registerPath({
		method: 'patch',
		path: '/connections/v1/{connectionId}',
		tags: ['Connections'],
		summary: 'Update a connection',
		description: 'Partially update a connection. Only send the fields you want to change.',
		security: [{ bearerAuth: [] }],
		request: {
			params: connectionIdParam,
			body: { content: { 'application/json': { schema: ConnectionPatchBodySchema } }, required: true },
		},
		responses: {
			200: {
				description: 'Updated connection',
				content: {
					'application/json': {
						schema: createSuccessSchema(ConnectionResponseSchema.meta({ example: ConnectionPatchResponseExample })),
					},
				},
			},
			...errorResponses,
		},
	})

	registry.registerPath({
		method: 'delete',
		path: '/connections/v1/{connectionId}',
		tags: ['Connections'],
		summary: 'Delete a connection',
		description: 'Delete a connection and all its associated configuration.',
		security: [{ bearerAuth: [] }],
		request: { params: connectionIdParam },
		responses: {
			204: { description: 'Connection deleted' },
			...errorResponses,
		},
	})

	registry.registerPath({
		method: 'post',
		path: '/connections/v1/{connectionId}/restart',
		tags: ['Connections'],
		summary: 'Restart a connection',
		description: 'Force-restart the connection process. Fails if the connection is disabled.',
		security: [{ bearerAuth: [] }],
		request: { params: connectionIdParam },
		responses: {
			200: {
				description: 'Restart triggered',
				content: {
					'application/json': {
						schema: createSuccessSchema(
							z
								.object({
									id: z
										.string()
										.describe('Connection instance id that was restarted.')
										.meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
									message: z
										.string()
										.describe('Confirmation message for the restart request.')
										.meta({ example: 'Restart triggered' }),
								})
								.meta({ example: { id: 'KJA1isEECHRDBTFjx-7tf', message: 'Restart triggered' } })
						),
					},
				},
			},
			409: {
				description: 'Connection is inactive',
				content: { 'application/json': { schema: ErrorResponseSchema } },
			},
			...errorResponses,
		},
	})
}
