import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import Express from 'express'
import z from 'zod'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { collectionResponse, createCollectionSchema, errorResponses } from '../Service/RestApi/schemas/common.js'
import {
	createRestEndpointSpecFactory,
	mountRestEndpoint,
	registerRestEndpoint,
	type RestEndpointSpec,
} from '../Service/RestApi/typedRoute.js'
import type { InstanceDefinitions } from './Definitions.js'

export const DEFINITIONS_API_BASE_PATH = '/definitions/v1'
const DEFINITIONS_API_TAGS = ['Definitions']

/**
 * An input field of an action. These are the same fields the web UI renders, so only the common properties are
 * described here; the rest depend on the `type`.
 */
export const ActionOptionFieldSchema = z
	.object({
		id: z.string().describe('Option id, used as the key in the options of an action.').meta({ example: 'input' }),
		type: z
			.string()
			.describe('Field type, such as "textinput", "number", "dropdown" or "checkbox".')
			.meta({ example: 'dropdown' }),
		label: z.string().describe('Display label of the field.').meta({ example: 'Input' }),
	})
	.catchall(z.unknown())
	.meta({ id: 'ActionOptionField' })

const ActionDefinitionExample = {
	connectionId: 'KJA1isEECHRDBTFjx-7tf',
	id: 'program',
	label: 'Set input on Program',
	description: null,
	options: [
		{
			id: 'input',
			type: 'dropdown',
			label: 'Input',
			default: 1,
			choices: [
				{ id: 1, label: 'Camera 1' },
				{ id: 2, label: 'Camera 2' },
			],
		},
	],
	hasLearn: false,
	hasResult: false,
}

export const ActionDefinitionResponseSchema = z
	.object({
		connectionId: z
			.string()
			.describe('Id of the connection that provides the action, or "internal" for the built-in actions.')
			.meta({ example: ActionDefinitionExample.connectionId }),
		id: z
			.string()
			.describe('Action definition id, used as `definitionId` when adding an action to a button.')
			.meta({ example: ActionDefinitionExample.id }),
		label: z.string().describe('Display name of the action.').meta({ example: ActionDefinitionExample.label }),
		description: z.string().nullable().describe('Longer description of the action.'),
		options: z.array(ActionOptionFieldSchema).describe('Input fields of the action, in display order.'),
		hasLearn: z.boolean().describe('Whether the module can fill in the options from the current device state.'),
		hasResult: z.boolean().describe('Whether the action returns a value that can be stored in a variable.'),
	})
	.meta({ id: 'ActionDefinition' })

export type ActionDefinitionResponse = z.infer<typeof ActionDefinitionResponseSchema>

const actionDefinitionsQuery = z.object({
	connectionId: z
		.string()
		.optional()
		.describe('Only return the actions of this connection. Use "internal" for the built-in actions.')
		.meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
})

function buildActionDefinitionResponse(
	connectionId: string,
	id: string,
	definition: ClientEntityDefinition
): ActionDefinitionResponse {
	return ActionDefinitionResponseSchema.parse({
		connectionId,
		id,
		label: definition.label,
		description: definition.description ?? null,
		options: definition.options,
		hasLearn: definition.hasLearn,
		hasResult: !!definition.actionHasResult,
	})
}

type DefinitionsRestContext = {
	definitions: InstanceDefinitions
}

const defineDefinitionsEndpointSpec = createRestEndpointSpecFactory<DefinitionsRestContext>()

const definitionsEndpointSpecs: RestEndpointSpec<DefinitionsRestContext>[] = [
	defineDefinitionsEndpointSpec(
		{
			method: 'get',
			path: '/actions',
			scopes: ['read'],
			tags: DEFINITIONS_API_TAGS,
			summary: 'List action definitions',
			description:
				'Returns the actions that can be added to a button, with their option fields. A connection only reports its actions while it is running.',
			request: {
				query: actionDefinitionsQuery,
			},
			response: {
				status: 200,
				description: 'List of action definitions',
				schema: createCollectionSchema(ActionDefinitionResponseSchema),
			},
			examples: {
				response: collectionResponse([ActionDefinitionExample], { total: 1, limit: 1, offset: 0 }),
			},
			errorResponses,
		},
		({ definitions }) => {
			return ({ query }) => {
				const result: ActionDefinitionResponse[] = []
				for (const [connectionId, connectionDefinitions] of Object.entries(definitions.getAllActionDefinitions())) {
					if (!connectionDefinitions) continue
					if (query.connectionId !== undefined && query.connectionId !== connectionId) continue

					for (const [id, definition] of Object.entries(connectionDefinitions)) {
						// Placeholders for actions that failed to load can not be added
						if (definition.hiddenFromPicker) continue
						result.push(buildActionDefinitionResponse(connectionId, id, definition))
					}
				}
				result.sort((a, b) => a.connectionId.localeCompare(b.connectionId) || a.id.localeCompare(b.id))

				return { body: collectionResponse(result, { total: result.length, limit: result.length, offset: 0 }) }
			}
		}
	),
]

/**
 * Create the definitions router for /api/v2/definitions/v1
 */
export function createDefinitionsRouter(definitions: InstanceDefinitions): Express.Router {
	const router = Express.Router()

	for (const endpointSpec of definitionsEndpointSpecs) {
		mountRestEndpoint(router, endpointSpec.createEndpoint({ definitions }))
	}

	return router
}

/**
 * Register all /definitions paths in the OpenAPI registry.
 */
export function registerDefinitionsPaths(registry: OpenAPIRegistry): void {
	for (const endpointSpec of definitionsEndpointSpecs) {
		registerRestEndpoint(registry, DEFINITIONS_API_BASE_PATH, endpointSpec.contract)
	}
}
