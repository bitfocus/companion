import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import Express from 'express'
import z from 'zod'
import { isLocationOnGrid } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { IPageStore } from '../Page/Store.js'
import { RestApiError } from '../Service/RestApi/errors.js'
import {
	collectionResponse,
	createCollectionSchema,
	createSuccessSchema,
	errorResponses,
	successResponse,
} from '../Service/RestApi/schemas/common.js'
import {
	createRestEndpointSpecFactory,
	mountRestEndpoint,
	registerRestEndpoint,
	type RestEndpointSpec,
} from '../Service/RestApi/typedRoute.js'
import { buildButtonResponse, ButtonResponseSchema, BUTTONS_API_BASE_PATH } from './ButtonsRestApi.js'
import type { ControlsController } from './Controller.js'
import type { SomeControl } from './IControlFragments.js'

export const PAGES_API_BASE_PATH = '/pages/v1'
const PAGES_API_TAGS = ['Pages']

const PageExample = { id: 'ggmHXCUQ0RRXUwEr8HHtQ', number: 1, name: 'Main' }

export const PageResponseSchema = z
	.object({
		id: z.string().describe('Unique page id. It does not change when pages are reordered.').meta({
			example: PageExample.id,
		}),
		number: z.number().describe('Position of the page in the page list.').meta({ example: PageExample.number }),
		name: z.string().describe('Display name of the page.').meta({ example: PageExample.name }),
	})
	.meta({ id: 'Page' })

const PageControlResponseSchema = z.object({
	row: z.number().describe('Row of the button.').meta({ example: 0 }),
	column: z.number().describe('Column of the button.').meta({ example: 1 }),
	controlId: z
		.string()
		.describe('Control id of the button, for the button endpoints.')
		.meta({ example: 'bank:4kZ3cS6pXyIb2xUuDqQvH' }),
	type: z.string().describe('Button type.').meta({ example: 'button-layered' }),
})

export const PageDetailResponseSchema = PageResponseSchema.extend({
	controls: z.array(PageControlResponseSchema).describe('Buttons on the page, by row then column.'),
}).meta({
	id: 'PageDetail',
	example: {
		...PageExample,
		controls: [{ row: 0, column: 1, controlId: 'bank:4kZ3cS6pXyIb2xUuDqQvH', type: 'button-layered' }],
	},
})

/** The button types that can be created at an empty location */
const CREATABLE_BUTTON_TYPES = ['button-layered', 'pageup', 'pagedown', 'pagenum'] as const

const ButtonCreateBodySchema = z
	.object({
		type: z
			.enum(CREATABLE_BUTTON_TYPES)
			.default('button-layered')
			.describe('Type of button to create.')
			.meta({ example: 'button-layered' }),
		allowStyleChanges: z
			.boolean()
			.default(false)
			.describe(
				'Turn on "Allow style changes" for the new button, so APIs may change its style. Only for "button-layered". An existing button keeps the choice made in the web UI.'
			)
			.meta({ example: true }),
	})
	.strict()
	.refine((body) => !body.allowStyleChanges || body.type === 'button-layered', {
		message: 'allowStyleChanges is only for "button-layered"',
		path: ['allowStyleChanges'],
	})

const pageIdParam = z.object({
	pageId: z.string().describe('Unique page id, as returned by the list pages endpoint.').meta({
		example: PageExample.id,
	}),
})

const locationParams = pageIdParam.extend({
	row: z.coerce.number().int().describe('Row of the button.').meta({ example: 0 }),
	column: z.coerce.number().int().describe('Column of the button.').meta({ example: 1 }),
})

export type PagesRestContext = {
	controls: Pick<Map<string, SomeControl>, 'get'>
	controlsController: Pick<ControlsController, 'resetControlAt'>
	pageStore: IPageStore
	userconfig: Pick<DataUserConfig, 'getKey'>
}

const definePagesEndpointSpec = createRestEndpointSpecFactory<PagesRestContext>()

function getPageNumber(pageStore: IPageStore, pageId: string): number {
	const pageNumber = pageStore.getPageNumber(pageId)
	if (pageNumber === null) throw RestApiError.notFound('Page not found')
	return pageNumber
}

const pageEndpointSpecs: RestEndpointSpec<PagesRestContext>[] = [
	definePagesEndpointSpec(
		{
			method: 'get',
			path: '/',
			scopes: ['read'],
			tags: PAGES_API_TAGS,
			summary: 'List pages',
			description: 'Returns all pages in page order.',
			response: {
				status: 200,
				description: 'List of pages',
				schema: createCollectionSchema(PageResponseSchema),
			},
			examples: { response: collectionResponse([PageExample], { total: 1, limit: 1, offset: 0 }) },
			errorResponses,
		},
		({ pageStore }) => {
			return () => {
				const pages = pageStore.getPageIds().map((id, index) => ({
					id,
					number: index + 1,
					name: pageStore.getPageName(index + 1) ?? '',
				}))
				return { body: collectionResponse(pages, { total: pages.length, limit: pages.length, offset: 0 }) }
			}
		}
	),

	definePagesEndpointSpec(
		{
			method: 'get',
			path: '/:pageId',
			scopes: ['read'],
			tags: PAGES_API_TAGS,
			summary: 'Get a page',
			description: 'Returns a page with the buttons placed on it.',
			request: { params: pageIdParam },
			response: {
				status: 200,
				description: 'Page details',
				schema: createSuccessSchema(PageDetailResponseSchema),
			},
			examples: {
				response: successResponse({
					...PageExample,
					controls: [{ row: 0, column: 1, controlId: 'bank:4kZ3cS6pXyIb2xUuDqQvH', type: 'button-layered' }],
				}),
			},
			errorResponses,
		},
		({ pageStore, controls }) => {
			return ({ params }) => {
				const pageNumber = getPageNumber(pageStore, params.pageId)
				const page = pageStore.getPageInfo(pageNumber)
				if (!page) throw RestApiError.notFound('Page not found')

				const pageControls: z.infer<typeof PageControlResponseSchema>[] = []
				for (const [row, rowControls] of Object.entries(page.controls)) {
					for (const [column, controlId] of Object.entries(rowControls)) {
						const control = controlId ? controls.get(controlId) : undefined
						if (!control) continue
						pageControls.push({ row: Number(row), column: Number(column), controlId, type: control.type })
					}
				}
				pageControls.sort((a, b) => a.row - b.row || a.column - b.column)

				return {
					body: successResponse(
						PageDetailResponseSchema.parse({
							id: params.pageId,
							number: pageNumber,
							name: page.name,
							controls: pageControls,
						})
					),
				}
			}
		}
	),

	definePagesEndpointSpec(
		{
			method: 'put',
			path: '/:pageId/controls/:row/:column',
			scopes: ['write'],
			tags: PAGES_API_TAGS,
			summary: 'Create a button',
			description:
				'Creates a new, empty button at a location. A button already at the location is deleted first, as when a button is reset in the web UI.',
			request: { params: locationParams, body: ButtonCreateBodySchema },
			response: {
				status: 201,
				description: 'Button created',
				schema: createSuccessSchema(ButtonResponseSchema),
			},
			examples: { body: { type: 'button-layered', allowStyleChanges: true } },
			errorResponses,
		},
		({ pageStore, controls, controlsController, userconfig }) => {
			return ({ params, body, basePath }) => {
				const location: ControlLocation = {
					pageNumber: getPageNumber(pageStore, params.pageId),
					row: params.row,
					column: params.column,
				}
				if (!isLocationOnGrid(userconfig.getKey('gridSize'), location)) {
					throw RestApiError.badRequest('Location is outside of the grid')
				}

				const controlId = controlsController.resetControlAt(location, body.type)
				const control = controlId ? controls.get(controlId) : undefined
				if (!controlId || !control) throw new Error('Button was not created')

				if (body.allowStyleChanges) {
					if (!control.supportsOptions) throw new Error('Button has no options')
					control.optionsSetField({ key: 'canModifyStyleInApis', value: true })
				}

				return {
					status: 201,
					location: `${basePath}${BUTTONS_API_BASE_PATH}/${controlId}`,
					body: successResponse(buildButtonResponse(control, pageStore)),
				}
			}
		}
	),

	definePagesEndpointSpec(
		{
			method: 'delete',
			path: '/:pageId/controls/:row/:column',
			scopes: ['write'],
			tags: PAGES_API_TAGS,
			summary: 'Delete a button',
			description: 'Deletes the button at a location, leaving it empty, as when a button is reset in the web UI.',
			request: { params: locationParams },
			response: { status: 204, description: 'Button deleted' },
			errorResponses,
		},
		({ pageStore, controlsController }) => {
			return ({ params }) => {
				const location: ControlLocation = {
					pageNumber: getPageNumber(pageStore, params.pageId),
					row: params.row,
					column: params.column,
				}
				if (!pageStore.getControlIdAt(location)) throw RestApiError.notFound('No button at location')

				controlsController.resetControlAt(location, null)
				return { status: 204 }
			}
		}
	),
]

/**
 * Create the pages router for /api/v2/pages/v1
 */
export function createPagesRouter(context: PagesRestContext): Express.Router {
	const router = Express.Router()

	for (const endpointSpec of pageEndpointSpecs) {
		mountRestEndpoint(router, endpointSpec.createEndpoint(context))
	}

	return router
}

/**
 * Register all /pages paths in the OpenAPI registry.
 */
export function registerPagePaths(registry: OpenAPIRegistry): void {
	for (const endpointSpec of pageEndpointSpecs) {
		registerRestEndpoint(registry, PAGES_API_BASE_PATH, endpointSpec.contract)
	}
}
