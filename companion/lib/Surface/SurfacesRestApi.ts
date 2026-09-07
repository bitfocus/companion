import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import Express from 'express'
import z from 'zod'
import type { Logger } from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import { RestApiError } from '../Service/RestApi/errors.js'
import {
	collectionResponse,
	createCollectionSchema,
	createSuccessSchema,
	errorResponses,
	ErrorResponseSchema,
	successResponse,
} from '../Service/RestApi/schemas/common.js'
import {
	createRestEndpointSpecFactory,
	mountRestEndpoint,
	registerRestEndpoint,
	type RestEndpointSpec,
} from '../Service/RestApi/typedRoute.js'
import type { SurfaceController } from './Controller.js'

/** Schema for the page a surface is currently showing */
const SurfacePageSchema = z.object({
	id: z.string().describe('Unique page id.').meta({ example: 'ggmHXCUQ0RRXUwEr8HHtQ' }),
	number: z
		.number()
		.nullable()
		.describe('Position of the page in the page list, or null if the page is no longer in the list.')
		.meta({ example: 1 }),
	name: z.string().nullable().describe('Display name of the page.').meta({ example: 'Main' }),
})

/** Schema for the grid size of a surface */
const SurfaceSizeSchema = z.object({
	rows: z.number().describe('Number of button rows on the surface.').meta({ example: 4 }),
	columns: z.number().describe('Number of button columns on the surface.').meta({ example: 8 }),
})

const SurfaceResponseExample = {
	id: 'streamdeck:1A2B3C4D',
	type: 'Elgato Stream Deck XL',
	integrationType: 'elgato-stream-deck',
	name: 'Front of house',
	displayName: 'Front of house (streamdeck:1A2B3C4D)',
	isConnected: true,
	size: { rows: 4, columns: 8 },
	brightness: 80,
	page: { id: 'ggmHXCUQ0RRXUwEr8HHtQ', number: 1, name: 'Main' },
	groupId: 'streamdeck:1A2B3C4D',
}

/** Schema for a surface in API responses — used for both validation and stripping */
const SurfaceResponseSchema = z
	.object({
		id: z.string().describe('Unique surface id.').meta({ example: SurfaceResponseExample.id }),
		type: z
			.string()
			.describe('Model of the surface, as reported by the integration.')
			.meta({ example: SurfaceResponseExample.type }),
		integrationType: z
			.string()
			.describe('Integration the surface is connected through.')
			.meta({ example: SurfaceResponseExample.integrationType }),
		name: z.string().describe('Name given to the surface in Companion.').meta({ example: SurfaceResponseExample.name }),
		displayName: z
			.string()
			.describe('Name shown for the surface in the Companion UI.')
			.meta({ example: SurfaceResponseExample.displayName }),
		isConnected: z.boolean().describe('Whether the surface is currently connected.').meta({ example: true }),
		size: SurfaceSizeSchema.nullable().describe('Button grid size of the surface, if known.'),
		brightness: z
			.number()
			.nullable()
			.describe('Brightness of the surface in percent, or null if it is not set in the surface config.')
			.meta({ example: 80 }),
		page: SurfacePageSchema.nullable().describe(
			'Page the surface is currently showing, or null if it is not showing one.'
		),
		groupId: z
			.string()
			.describe(
				'Id of the surface group the surface belongs to. Note: if not part of a group, this will typically be the same as the id.'
			),
	})
	.meta({ example: SurfaceResponseExample })

/** Schema for partially updating a surface */
const SurfacePatchBodySchema = z
	.object({
		brightness: z
			.number()
			.int()
			.min(0)
			.max(100)
			.describe('Brightness to apply to the surface, in percent.')
			.meta({ example: 50 }),
	})
	.strict()

type SurfaceResponse = z.infer<typeof SurfaceResponseSchema>

export const SURFACES_API_BASE_PATH = '/surfaces/v1'
const SURFACES_API_TAGS = ['Surfaces']

type SurfacesRestContext = {
	logger: Logger
	surfaceController: SurfaceController
	pageStore: IPageStore
}

const defineSurfaceEndpointSpec = createRestEndpointSpecFactory<SurfacesRestContext>()

/**
 * Create the surfaces router for /api/v2/surfaces/v1
 */
export function createSurfacesRestApiRouter(
	logger: Logger,
	surfaceController: SurfaceController,
	pageStore: IPageStore
): Express.Router {
	const surfacesRouter = Express.Router()
	const surfacesLogger = logger.child({ source: 'surfaces/v1' })

	for (const endpointSpec of surfaceEndpointSpecs) {
		mountRestEndpoint(
			surfacesRouter,
			endpointSpec.createEndpoint({ logger: surfacesLogger, surfaceController, pageStore })
		)
	}

	const router = Express.Router()
	router.use(SURFACES_API_BASE_PATH, surfacesRouter)

	return router
}

const surfaceIdParam = z.object({
	surfaceId: z
		.string()
		.describe('Surface id, as returned by the list surfaces endpoint.')
		.meta({ example: SurfaceResponseExample.id }),
})

const surfaceEndpointSpecs: RestEndpointSpec<SurfacesRestContext>[] = [
	defineSurfaceEndpointSpec(
		{
			method: 'get',
			path: '/',
			scopes: ['read'],
			tags: SURFACES_API_TAGS,
			summary: 'List all surfaces',
			description: 'Returns all known surfaces, connected or not, with their current state.',
			response: {
				status: 200,
				description: 'List of surfaces',
				schema: createCollectionSchema(SurfaceResponseSchema),
			},
			examples: {
				response: collectionResponse([SurfaceResponseExample], { total: 1, limit: 1, offset: 0 }),
			},
			errorResponses,
		},
		({ surfaceController, pageStore }) => {
			return () => {
				const surfaces = listSurfaces(surfaceController, pageStore)

				return {
					body: collectionResponse(surfaces, { total: surfaces.length, limit: surfaces.length, offset: 0 }),
				}
			}
		}
	),

	defineSurfaceEndpointSpec(
		{
			method: 'get',
			path: '/:surfaceId',
			scopes: ['read'],
			tags: SURFACES_API_TAGS,
			summary: 'Get a surface',
			description: 'Returns a single surface by id, connected or not, with its current state.',
			request: {
				params: surfaceIdParam,
			},
			response: {
				status: 200,
				description: 'The requested surface',
				schema: createSuccessSchema(SurfaceResponseSchema),
			},
			examples: {
				response: successResponse(SurfaceResponseExample),
			},
			errorResponses,
		},
		({ surfaceController, pageStore }) => {
			return ({ params }) => {
				const { surfaceId } = params

				const surface = listSurfaces(surfaceController, pageStore).find((surface) => surface.id === surfaceId)
				if (!surface) throw RestApiError.notFound('Surface not found')

				return { body: successResponse(surface) }
			}
		}
	),

	defineSurfaceEndpointSpec(
		{
			method: 'patch',
			path: '/:surfaceId',
			scopes: ['write'],
			tags: SURFACES_API_TAGS,
			summary: 'Update a surface',
			description: 'Update a connected surface. Currently only the brightness can be changed.',
			request: {
				params: surfaceIdParam,
				body: SurfacePatchBodySchema,
			},
			response: {
				status: 200,
				description: 'Updated surface',
				schema: createSuccessSchema(SurfaceResponseSchema),
			},
			examples: {
				body: { brightness: 50 },
				response: successResponse({ ...SurfaceResponseExample, brightness: 50 }),
			},
			extraResponses: {
				409: {
					description: 'Surface is not connected',
					content: { 'application/json': { schema: ErrorResponseSchema } },
				},
			},
			errorResponses,
		},
		({ logger, surfaceController, pageStore }) => {
			return ({ params, body }) => {
				const { surfaceId } = params
				const { brightness } = body

				const surface = listSurfaces(surfaceController, pageStore).find((surface) => surface.id === surfaceId)
				if (!surface) throw RestApiError.notFound('Surface not found')
				if (!surface.isConnected) throw RestApiError.conflict('Surface is not connected')

				surfaceController.setDeviceBrightness(surfaceId, brightness)

				logger.info(`Set brightness of surface "${surface.displayName}" (${surfaceId}) to ${brightness}`)

				// Re-read so the response reflects the surface's actual state after the change
				const updatedSurface = listSurfaces(surfaceController, pageStore).find((surface) => surface.id === surfaceId)
				if (!updatedSurface) throw RestApiError.notFound('Surface not found')

				return { body: successResponse(updatedSurface) }
			}
		}
	),
]

/**
 * Build the validated SurfaceResponse for every known surface.
 */
function listSurfaces(surfaceController: SurfaceController, pageStore: IPageStore): SurfaceResponse[] {
	return surfaceController.getDevicesList().flatMap((group) => {
		// All surfaces in a group share the same page
		const page = buildSurfacePage(surfaceController, pageStore, group.id)

		return group.surfaces.map((surface) => SurfaceResponseSchema.parse({ ...surface, page, groupId: group.id }))
	})
}

/**
 * Resolve the page a surface group is currently showing
 */
function buildSurfacePage(
	surfaceController: SurfaceController,
	pageStore: IPageStore,
	groupId: string
): SurfaceResponse['page'] {
	const pageId = surfaceController.devicePageGet(groupId)
	if (!pageId) return null

	const number = pageStore.getPageNumber(pageId)
	return {
		id: pageId,
		number,
		name: (number !== null ? pageStore.getPageName(number) : undefined) ?? null,
	}
}

export function registerSurfacePaths(registry: OpenAPIRegistry): void {
	for (const endpointSpec of surfaceEndpointSpecs) {
		registerRestEndpoint(registry, SURFACES_API_BASE_PATH, endpointSpec.contract)
	}
}
