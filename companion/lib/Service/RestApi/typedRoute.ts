import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import type Express from 'express'
import type z from 'zod'
import { RestApiError } from './errors.js'
import { requireScopes, type ApiToken, type RequiredScope, type RestApiResponse } from './RestApiAuth.js'

type RegisterPathConfig = Parameters<OpenAPIRegistry['registerPath']>[0]
type HttpMethod = 'get' | 'post' | 'patch' | 'delete'
type ResponseConfig = NonNullable<RegisterPathConfig['responses']>[number]
type RouteParameter = NonNullable<NonNullable<RegisterPathConfig['request']>['params']>

type InferSchema<T> = T extends z.ZodType ? z.infer<T> : undefined
type RequestBodyExample<T> = T extends z.ZodType ? z.input<T> : never
type ResponseExample<T> = T extends z.ZodType ? z.output<T> : never

export type RestRouteResult<T> =
	| {
			status?: 200 | 201
			body: T
			location?: string
	  }
	| {
			status: 204
	  }

export interface RestRouteContext<
	ParamsSchema extends z.ZodType | undefined,
	QuerySchema extends z.ZodType | undefined,
	BodySchema extends z.ZodType | undefined,
> {
	params: InferSchema<ParamsSchema>
	query: InferSchema<QuerySchema>
	body: InferSchema<BodySchema>
	token: ApiToken
}

export interface RestEndpointContract<
	ParamsSchema extends z.ZodType | undefined,
	QuerySchema extends z.ZodType | undefined,
	BodySchema extends z.ZodType | undefined,
	ResponseSchema extends z.ZodType | undefined,
> {
	method: HttpMethod
	path: string
	scopes: readonly RequiredScope[]
	tags: string[]
	summary: string
	description?: string
	request?: {
		params?: ParamsSchema
		query?: QuerySchema
		body?: BodySchema
	}
	response:
		| {
				status: 200 | 201
				description: string
				schema: ResponseSchema
		  }
		| {
				status: 204
				description: string
				schema?: undefined
		  }
	examples?: {
		body?: RequestBodyExample<BodySchema>
		response?: ResponseExample<ResponseSchema>
	}
	errorResponses: RegisterPathConfig['responses']
	extraResponses?: RegisterPathConfig['responses']
}

export interface RestEndpointDefinition<
	ParamsSchema extends z.ZodType | undefined,
	QuerySchema extends z.ZodType | undefined,
	BodySchema extends z.ZodType | undefined,
	ResponseSchema extends z.ZodType | undefined,
> extends RestEndpointContract<ParamsSchema, QuerySchema, BodySchema, ResponseSchema> {
	handler: (
		context: RestRouteContext<ParamsSchema, QuerySchema, BodySchema>
	) => RestRouteResult<InferSchema<ResponseSchema>> | Promise<RestRouteResult<InferSchema<ResponseSchema>>>
}

export function defineRestEndpointContract<
	ParamsSchema extends z.ZodType | undefined = undefined,
	QuerySchema extends z.ZodType | undefined = undefined,
	BodySchema extends z.ZodType | undefined = undefined,
	ResponseSchema extends z.ZodType | undefined = undefined,
>(
	definition: RestEndpointContract<ParamsSchema, QuerySchema, BodySchema, ResponseSchema>
): RestEndpointContract<ParamsSchema, QuerySchema, BodySchema, ResponseSchema> {
	return definition
}

export function defineRestEndpoint<
	ParamsSchema extends z.ZodType | undefined = undefined,
	QuerySchema extends z.ZodType | undefined = undefined,
	BodySchema extends z.ZodType | undefined = undefined,
	ResponseSchema extends z.ZodType | undefined = undefined,
>(
	definition: RestEndpointDefinition<ParamsSchema, QuerySchema, BodySchema, ResponseSchema>
): RestEndpointDefinition<ParamsSchema, QuerySchema, BodySchema, ResponseSchema> {
	return definition
}

export function mountRestEndpoint(
	router: Express.Router,
	endpoint: RestEndpointDefinition<
		z.ZodType | undefined,
		z.ZodType | undefined,
		z.ZodType | undefined,
		z.ZodType | undefined
	>
): void {
	router[endpoint.method](endpoint.path, requireScopes(endpoint.scopes), async (req, res: RestApiResponse, next) => {
		try {
			const token = res.locals.apiToken
			if (!token) throw RestApiError.unauthorized()

			const params = parseRequestPart(endpoint.request?.params, req.params, 'Invalid path parameters')
			const query = parseRequestPart(endpoint.request?.query, req.query, 'Invalid query parameters')
			const body = parseRequestPart(endpoint.request?.body, req.body, 'Invalid request body')

			const result = await endpoint.handler({ params, query, body, token })

			if (result.status === 204) {
				res.status(204).send()
				return
			}
			if (endpoint.response.status === 204) throw new Error('Route returned a body for a 204 response')
			if (!endpoint.response.schema) throw new Error('Route response schema is missing')

			if (result.location) res.location(result.location)
			const parsedBody = endpoint.response.schema.parse(result.body)
			res.status(result.status ?? 200).json(parsedBody)
		} catch (e) {
			next(e)
		}
	})
}

export function registerRestEndpoint(
	registry: OpenAPIRegistry,
	basePath: string,
	endpoint: RestEndpointContract<
		z.ZodType | undefined,
		z.ZodType | undefined,
		z.ZodType | undefined,
		z.ZodType | undefined
	>
): void {
	const request: RegisterPathConfig['request'] = {}
	if (endpoint.request?.params) request.params = endpoint.request.params as RouteParameter
	if (endpoint.request?.query) request.query = endpoint.request.query as RouteParameter
	if (endpoint.request?.body) {
		request.body = {
			content: {
				'application/json': {
					schema: endpoint.request.body,
					...(endpoint.examples?.body !== undefined ? { example: endpoint.examples.body } : {}),
				},
			},
			required: true,
		}
	}

	registry.registerPath({
		method: endpoint.method,
		path: toOpenApiPath(basePath, endpoint.path),
		tags: endpoint.tags,
		summary: endpoint.summary,
		description: endpoint.description,
		security: [{ bearerAuth: [...endpoint.scopes] }],
		request,
		responses: {
			[endpoint.response.status]: createOpenApiResponse(endpoint.response, endpoint.examples?.response),
			...endpoint.extraResponses,
			...endpoint.errorResponses,
		},
	})
}

function parseRequestPart<T extends z.ZodType | undefined>(
	schema: T,
	value: unknown,
	errorMessage: string
): InferSchema<T> {
	if (!schema) return undefined as InferSchema<T>

	const parsed = schema.safeParse(value)
	if (!parsed.success) {
		throw RestApiError.badRequest(errorMessage, parsed.error.format())
	}

	return parsed.data as InferSchema<T>
}

function createOpenApiResponse(
	response: RestEndpointDefinition<undefined, undefined, undefined, z.ZodType | undefined>['response'],
	example?: unknown
): ResponseConfig {
	if (!response.schema) return { description: response.description }

	return {
		description: response.description,
		content: {
			'application/json': {
				schema: response.schema,
				...(example !== undefined ? { example } : {}),
			},
		},
	}
}

function toOpenApiPath(basePath: string, localPath: string): string {
	const fullPath = `${basePath.replace(/\/$/, '')}/${localPath.replace(/^\//, '')}`.replace(/\/$/, '')
	const normalizedPath = fullPath === '' ? '/' : fullPath

	return normalizedPath.replace(/:([^/]+)/g, '{$1}')
}
