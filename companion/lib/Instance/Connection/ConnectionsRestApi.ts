import Express from 'express'
import z from 'zod'
import type { ClientConnectionConfig, ConnectionCollection } from '@companion-app/shared/Model/Connections.js'
import {
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
	type InstanceConfig,
} from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import type { Logger } from '../../Log/Controller.js'
import { REST_API_BASE_PATH } from '../../Service/RestApi/constants.js'
import { RestApiError } from '../../Service/RestApi/errors.js'
import { registry } from '../../Service/RestApi/registry.js'
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
import type { InstanceConfigStore } from '../ConfigStore.js'
import type { InstanceController } from '../Controller.js'
import { ConnectionOperationError, ConnectionOperations } from './ConnectionOperations.js'
import {
	ConfigFieldsResponseExample,
	ConnectionCreateBodyExample,
	ConnectionCreateResponseExample,
	ConnectionMoveBodyExample,
	ConnectionPatchBodyExample,
	ConnectionPatchResponseExample,
	ConnectionResponseExample,
	ConnectionTreeResponseExample,
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
	})
	.strict()

export interface ConnectionTreeCollection {
	id: string
	label: string
	enabled: boolean
	connections: ConnectionResponse[]
	children: ConnectionTreeCollection[]
}

export const ConnectionTreeCollectionSchema: z.ZodType<ConnectionTreeCollection> = z
	.object({
		id: z.string().describe('Unique connection collection id.'),
		label: z.string().describe('Display name of the collection.'),
		enabled: z.boolean().describe('Whether connections in this collection are enabled.'),
		connections: z
			.array(ConnectionResponseSchema)
			.describe('Connections in this collection, in their current display order.'),
		children: z
			.array(z.lazy(() => ConnectionTreeCollectionSchema))
			.describe('Nested collections, in their current display order.'),
	})
	.meta({ id: 'ConnectionTreeCollection' })

export const ConnectionTreeResponseSchema = z.object({
	connections: z
		.array(ConnectionResponseSchema)
		.describe('Ungrouped connections at the root, in their current display order.'),
	collections: z.array(ConnectionTreeCollectionSchema).describe('Root collections, in their current display order.'),
})

const ConnectionMoveOperationSchema = z
	.object({
		connectionId: z.string().describe('Connection instance id to move.'),
		collectionId: z.string().nullable().describe('Destination collection id, or null for the ungrouped root.'),
		position: z
			.number()
			.int()
			.nonnegative()
			.describe('Zero-based insertion index in the destination after removing the moved connection.'),
	})
	.strict()

export const ConnectionMoveBodySchema = z
	.object({
		moves: z
			.array(ConnectionMoveOperationSchema)
			.min(1)
			.describe('Moves to evaluate sequentially and persist atomically.'),
	})
	.strict()

/** Schema for a dropdown choice */
const DropdownChoiceSchema = z.object({
	id: z.union([z.string(), z.number()]).describe('Choice value sent in connection config.').meta({ example: 'auto' }),
	label: z.string().describe('Display label for the choice.').meta({ example: 'Auto' }),
})

const ConfigFieldBaseResponseSchema = z
	.object({
		id: z.string().describe('Config field id used as the key in config or secrets objects.').meta({ example: 'host' }),
		label: z.string().describe('Display label for the config field.').meta({ example: 'Host' }),
		tooltip: z
			.string()
			.optional()
			.describe('Short help text shown for the config field.')
			.meta({ example: 'Target switcher IP' }),
		description: z.string().optional().describe('Longer help text for the config field.'),
	})
	.catchall(z.unknown())

/** Schema for a raw config field definition in API responses */
export const ConfigFieldResponseSchema = z.discriminatedUnion('type', [
	ConfigFieldBaseResponseSchema.extend({
		type: z.literal('bonjour-device').describe('Bonjour device selector field.'),
	}),
	ConfigFieldBaseResponseSchema.extend({
		type: z.literal('secret-text').describe('Secret text field. Values for this field belong in secrets.'),
		default: z.string().optional().describe('Default secret text value.'),
		minLength: z.number().optional().describe('Minimum string length allowed.'),
		regex: z.string().optional().describe('Regular expression that string values must match.'),
	}),
	ConfigFieldBaseResponseSchema.extend({
		type: z.literal('static-text').describe('Read-only text shown alongside other config fields.'),
		value: z.string().describe('Static text content to display.').meta({ example: 'Network settings' }),
	}),
	ConfigFieldBaseResponseSchema.extend({
		type: z.literal('textinput').describe('Plain text input field.'),
		default: z.string().optional().describe('Default text value.').meta({ example: '' }),
		minLength: z.number().optional().describe('Minimum string length allowed.'),
		regex: z.string().optional().describe('Regular expression that string values must match.'),
		placeholder: z.string().optional().describe('Placeholder text shown for empty text fields.'),
		multiline: z.boolean().optional().describe('Whether the text field supports multiple lines.'),
	}),
	ConfigFieldBaseResponseSchema.extend({
		type: z.literal('checkbox').describe('Boolean checkbox field.'),
		default: z.boolean().optional().describe('Default checked state.').meta({ example: false }),
	}),
	ConfigFieldBaseResponseSchema.extend({
		type: z.literal('colorpicker').describe('Color picker field.'),
		default: z.union([z.string(), z.number()]).optional().describe('Default color value.'),
		enableAlpha: z.boolean().optional().describe('Whether color values include an alpha channel.'),
		returnType: z.enum(['string', 'number']).optional().describe('Value type returned by the field.'),
	}),
	ConfigFieldBaseResponseSchema.extend({
		type: z.literal('number').describe('Numeric input field.'),
		default: z.number().optional().describe('Default numeric value.').meta({ example: 10 }),
		min: z.number().optional().describe('Minimum numeric value allowed.'),
		max: z.number().optional().describe('Maximum numeric value allowed.'),
		step: z.number().optional().describe('Numeric step size.'),
		range: z.boolean().optional().describe('Whether the field is shown as a range slider.'),
	}),
	ConfigFieldBaseResponseSchema.extend({
		type: z.literal('dropdown').describe('Single-select dropdown field.'),
		default: z
			.union([z.string(), z.number()])
			.optional()
			.describe('Default selected choice id.')
			.meta({ example: 'auto' }),
		choices: z.array(DropdownChoiceSchema).describe('Allowed choices for the dropdown.'),
		allowCustom: z.boolean().optional().describe('Whether custom values outside the choices list are allowed.'),
		regex: z.string().optional().describe('Regular expression that custom string values must match.'),
	}),
	ConfigFieldBaseResponseSchema.extend({
		type: z.literal('multidropdown').describe('Multi-select dropdown field.'),
		default: z
			.array(z.union([z.string(), z.number()]))
			.optional()
			.describe('Default selected choice ids.'),
		choices: z.array(DropdownChoiceSchema).describe('Allowed choices for the dropdown.'),
		minSelection: z.number().optional().describe('Minimum number of choices that must be selected.'),
		maxSelection: z.number().optional().describe('Maximum number of choices that can be selected.'),
		allowCustom: z.boolean().optional().describe('Whether custom values outside the choices list are allowed.'),
		regex: z.string().optional().describe('Regular expression that custom string values must match.'),
	}),
])

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

export const CONNECTIONS_API_BASE_PATH = '/connections/v1'
const CONNECTIONS_API_TAGS = ['Connections']

type ConnectionsRestContext = {
	logger: Logger
	instanceController: InstanceController
	connectionOperations: ConnectionOperations
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
 * Create the connections router for /api/v2/connections/v1
 */
export function createConnectionsRouter(
	logger: Logger,
	instanceController: InstanceController,
	configStore: InstanceConfigStore
): Express.Router {
	const router = Express.Router()
	const connectionOperations = new ConnectionOperations({ logger, instanceController, configStore })

	for (const endpointSpec of connectionEndpointSpecs) {
		mountRestEndpoint(
			router,
			endpointSpec.createEndpoint({
				logger,
				instanceController,
				connectionOperations,
			})
		)
	}

	return router
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
	scopes: ['connections', 'read'],
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

const getConnectionsTreeEndpoint = defineRestEndpointContract({
	method: 'get',
	path: '/tree',
	scopes: ['connections', 'read'],
	tags: CONNECTIONS_API_TAGS,
	summary: 'Get the connection arrangement',
	description:
		'Returns all connections grouped into the complete collection hierarchy. Array order represents the current display order.',
	request: {
		query: connectionListQuery,
	},
	response: {
		status: 200,
		description: 'Connection arrangement',
		schema: createSuccessSchema(ConnectionTreeResponseSchema),
	},
	examples: {
		response: successResponse(ConnectionTreeResponseExample),
	},
	errorResponses,
})

const moveConnectionsEndpoint = defineRestEndpointContract({
	method: 'patch',
	path: '/move',
	scopes: ['connections', 'write'],
	tags: CONNECTIONS_API_TAGS,
	summary: 'Move connections',
	description:
		'Moves connections atomically. Operations are evaluated in request order against the result of preceding operations.',
	request: {
		body: ConnectionMoveBodySchema,
	},
	response: {
		status: 204,
		description: 'Connections moved',
	},
	examples: {
		body: ConnectionMoveBodyExample,
	},
	errorResponses,
})

const createConnectionEndpoint = defineRestEndpointContract({
	method: 'post',
	path: '/',
	scopes: ['connections', 'write'],
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
	scopes: ['connections', 'read'],
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
	scopes: ['connections', 'read'],
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
		response: successResponse(ConfigFieldsResponseExample as z.infer<typeof ConfigFieldResponseSchema>[]),
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
	scopes: ['connections', 'write'],
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
	scopes: ['connections', 'write'],
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
	scopes: ['connections', 'write'],
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
		return ({ query }) => {
			const includeConfig = query.include_config === 'true'
			const includeSecrets = query.include_secrets === 'true'

			if (includeSecrets && !includeConfig) {
				throw RestApiError.badRequest("Query parameter 'include_secrets' requires 'include_config=true'")
			}

			const clientConnections = instanceController.getConnectionClientJson(true)

			const connections = Object.entries(clientConnections).map(([id, config]) => {
				const status = instanceController.getInstanceStatus(id)
				const instanceConfig = includeConfig
					? instanceController.getInstanceConfigOfType(id, ModuleInstanceType.Connection)
					: undefined
				return buildConnectionResponse(id, config, status, instanceConfig, includeSecrets)
			})
			connections.sort((a, b) => a.id.localeCompare(b.id))

			return {
				body: collectionResponse(connections, { total: connections.length, limit: connections.length, offset: 0 }),
			}
		}
	}),

	defineConnectionEndpointSpec(getConnectionsTreeEndpoint, ({ instanceController }) => {
		return ({ query }) => {
			const includeConfig = query.include_config === 'true'
			const includeSecrets = query.include_secrets === 'true'

			if (includeSecrets && !includeConfig) {
				throw RestApiError.badRequest("Query parameter 'include_secrets' requires 'include_config=true'")
			}
			const clientConnections = instanceController.getConnectionClientJson(true)
			const responses = new Map<string, ConnectionResponse>()
			for (const [id, config] of Object.entries(clientConnections)) {
				const status = instanceController.getInstanceStatus(id)
				const instanceConfig = includeConfig
					? instanceController.getInstanceConfigOfType(id, ModuleInstanceType.Connection)
					: undefined
				responses.set(id, buildConnectionResponse(id, config, status, instanceConfig, includeSecrets))
			}

			const connectionsByCollection = new Map<
				string | null,
				Array<{ response: ConnectionResponse; sortOrder: number }>
			>()
			const knownCollectionIds = instanceController.connectionCollections.collectAllCollectionIds()
			for (const [id, config] of Object.entries(clientConnections)) {
				const collectionId =
					config.collectionId && knownCollectionIds.has(config.collectionId) ? config.collectionId : null
				let entries = connectionsByCollection.get(collectionId)
				if (!entries) {
					entries = []
					connectionsByCollection.set(collectionId, entries)
				}
				entries.push({ response: responses.get(id)!, sortOrder: config.sortOrder })
			}

			const takeConnections = (collectionId: string | null): ConnectionResponse[] =>
				(connectionsByCollection.get(collectionId) ?? [])
					.sort((a, b) => a.sortOrder - b.sortOrder || a.response.id.localeCompare(b.response.id))
					.map((entry) => entry.response)

			const buildCollection = (collection: ConnectionCollection): ConnectionTreeCollection => ({
				id: collection.id,
				label: collection.label,
				enabled: collection.metaData.enabled,
				connections: takeConnections(collection.id),
				children: [...collection.children]
					.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
					.map(buildCollection),
			})

			const tree = {
				connections: takeConnections(null),
				collections: instanceController.connectionCollections.collectionData
					.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
					.map(buildCollection),
			}

			return { body: successResponse(ConnectionTreeResponseSchema.parse(tree)) }
		}
	}),

	defineConnectionEndpointSpec(moveConnectionsEndpoint, ({ connectionOperations }) => {
		return ({ body }) => {
			try {
				connectionOperations.moveConnections(body.moves)
				return { status: 204 }
			} catch (e) {
				throw mapConnectionOperationError(e)
			}
		}
	}),

	defineConnectionEndpointSpec(createConnectionEndpoint, ({ connectionOperations }) => {
		return async ({ body }) => {
			const { moduleId, label, versionId, updatePolicy, disabled } = body

			try {
				const id = await connectionOperations.createConnection({
					moduleId,
					label,
					versionId,
					updatePolicy,
					disabled,
				})

				return {
					status: 201,
					location: `${REST_API_BASE_PATH}${CONNECTIONS_API_BASE_PATH}/${id}`,
					body: successResponse({ id }),
				}
			} catch (e) {
				throw mapConnectionOperationError(e)
			}
		}
	}),

	defineConnectionEndpointSpec(getConnectionEndpoint, ({ instanceController }) => {
		return ({ params, query }) => {
			const { connectionId } = params
			const includeSecrets = query.include_secrets === 'true'

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

	defineConnectionEndpointSpec(patchConnectionEndpoint, ({ logger, instanceController, connectionOperations }) => {
		return async ({ params, body }) => {
			const { connectionId } = params

			const { label, disabled, config, secrets, updatePolicy, versionId } = body

			try {
				await connectionOperations.patchConnection({
					connectionId,
					label,
					enabled: disabled === undefined ? null : !disabled,
					config,
					secrets,
					updatePolicy,
					versionId,
					patchConfig: true,
					patchSecrets: true,
					validateConfigValues: true,
				})
			} catch (e) {
				throw mapConnectionOperationError(e)
			}

			// Re-fetch updated data — only echo back secrets if they were part of the update
			const updatedConnections = instanceController.getConnectionClientJson(false)
			const updatedConfig = updatedConnections[connectionId]
			const status = instanceController.getInstanceStatus(connectionId)
			const instanceConfig = instanceController.getInstanceConfigOfType(connectionId, ModuleInstanceType.Connection)
			const response = buildConnectionResponse(connectionId, updatedConfig, status, instanceConfig, !!secrets)

			logger.info(`Updated connection "${response.label}" (${connectionId})`)
			return { body: successResponse(response) }
		}
	}),

	defineConnectionEndpointSpec(getConnectionConfigFieldsEndpoint, ({ connectionOperations }) => {
		return async ({ params }) => {
			const { connectionId } = params

			try {
				const fields = await connectionOperations.getConnectionConfigFields(connectionId)
				const response = connectionConfigFieldsResponseSchema.parse(successResponse(fields))

				return { body: response }
			} catch (e) {
				throw mapConnectionOperationError(e)
			}
		}
	}),

	defineConnectionEndpointSpec(deleteConnectionEndpoint, ({ connectionOperations }) => {
		return async ({ params }) => {
			const { connectionId } = params

			try {
				await connectionOperations.deleteConnection(connectionId)
				return { status: 204 }
			} catch (e) {
				throw mapConnectionOperationError(e)
			}
		}
	}),

	defineConnectionEndpointSpec(restartConnectionEndpoint, ({ connectionOperations }) => {
		return ({ params }) => {
			const { connectionId } = params

			try {
				connectionOperations.restartConnection(connectionId)
				return { body: successResponse({ id: connectionId, message: 'Restart triggered' }) }
			} catch (e) {
				throw mapConnectionOperationError(e)
			}
		}
	}),
]

function mapConnectionOperationError(e: unknown): RestApiError {
	if (!(e instanceof ConnectionOperationError)) {
		throw e
	}

	switch (e.code) {
		case 'not_found':
			return RestApiError.notFound(e.message)
		case 'conflict':
			return RestApiError.conflict(e.message)
		case 'forbidden':
			return RestApiError.forbidden(e.message)
		case 'invalid_input':
			return RestApiError.badRequest(e.message, e.details)
	}
}

/**
 * Register all /connections paths in the OpenAPI registry.
 * Called once at startup before the spec is generated.
 */
export function registerConnectionPaths(): void {
	for (const endpointSpec of connectionEndpointSpecs) {
		registerRestEndpoint(registry, CONNECTIONS_API_BASE_PATH, endpointSpec.contract)
	}
}
