import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import Express from 'express'
import z from 'zod'
import { RestApiError } from './errors.js'
import { requireScopes, type ApiToken, type RequiredScope, type RestApiResponse } from './RestApiAuth.js'

type RegisterPathConfig = Parameters<OpenAPIRegistry['registerPath']>[0]
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
type ResponseConfig = NonNullable<RegisterPathConfig['responses']>[number]
type RouteParameter = NonNullable<NonNullable<RegisterPathConfig['request']>['params']>

/** A request body sent as raw bytes rather than JSON, eg an image upload */
export interface BinaryRequestBody {
	/** The content type of the body, as matched against the accepted content types */
	contentType: string
	data: Buffer
}

/** A response sent as raw bytes rather than JSON, eg an image download */
export interface BinaryResponseBody {
	contentType: string
	data: Buffer
	/** Value for the Cache-Control header, or null to not send one */
	cacheControl: string | null
}

interface BinaryRequestBodyConfig {
	contentTypes: readonly string[]
	maxBytes: number
	description: string
}

interface BinaryResponseBodyConfig {
	contentTypes: readonly string[]
}

const binaryRequestBodyConfigs = new WeakMap<z.ZodType, BinaryRequestBodyConfig>()
const binaryResponseBodyConfigs = new WeakMap<z.ZodType, BinaryResponseBodyConfig>()

/**
 * Create a schema for a request body that is sent as raw bytes with one of the given content types.
 * Use it as `request.body`; the handler then receives a {@link BinaryRequestBody}.
 */
export function binaryRequestBodySchema(config: BinaryRequestBodyConfig): z.ZodType<BinaryRequestBody> {
	const schema = z.custom<BinaryRequestBody>(
		(value) =>
			typeof value === 'object' &&
			value !== null &&
			typeof (value as BinaryRequestBody).contentType === 'string' &&
			Buffer.isBuffer((value as BinaryRequestBody).data)
	)
	binaryRequestBodyConfigs.set(schema, config)
	return schema
}

/**
 * Create a schema for a response that is sent as raw bytes with one of the given content types.
 * Use it as `response.schema`; the handler then returns a {@link BinaryResponseBody}.
 */
export function binaryResponseBodySchema(config: BinaryResponseBodyConfig): z.ZodType<BinaryResponseBody> {
	const schema = z.custom<BinaryResponseBody>(
		(value) =>
			typeof value === 'object' &&
			value !== null &&
			typeof (value as BinaryResponseBody).contentType === 'string' &&
			Buffer.isBuffer((value as BinaryResponseBody).data)
	)
	binaryResponseBodyConfigs.set(schema, config)
	return schema
}

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

export type AnyRestEndpointContract = RestEndpointContract<
	z.ZodType | undefined,
	z.ZodType | undefined,
	z.ZodType | undefined,
	z.ZodType | undefined
>

export type AnyRestEndpointDefinition = RestEndpointDefinition<
	z.ZodType | undefined,
	z.ZodType | undefined,
	z.ZodType | undefined,
	z.ZodType | undefined
>

export interface RestEndpointSpec<Context> {
	contract: AnyRestEndpointContract
	createEndpoint: (context: Context) => AnyRestEndpointDefinition
}

export function createRestEndpointSpecFactory<Context>() {
	return function defineRestEndpointSpec<
		ParamsSchema extends z.ZodType | undefined = undefined,
		QuerySchema extends z.ZodType | undefined = undefined,
		BodySchema extends z.ZodType | undefined = undefined,
		ResponseSchema extends z.ZodType | undefined = undefined,
	>(
		contract: RestEndpointContract<ParamsSchema, QuerySchema, BodySchema, ResponseSchema>,
		createHandler: (
			context: Context
		) => RestEndpointDefinition<ParamsSchema, QuerySchema, BodySchema, ResponseSchema>['handler']
	): RestEndpointSpec<Context> {
		return {
			contract,
			createEndpoint: (context) =>
				defineRestEndpoint({
					...contract,
					handler: createHandler(context),
				}),
		}
	}
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
	const binaryRequestConfig = endpoint.request?.body ? binaryRequestBodyConfigs.get(endpoint.request.body) : undefined
	const binaryResponseConfig = endpoint.response.schema
		? binaryResponseBodyConfigs.get(endpoint.response.schema)
		: undefined

	// Binary bodies are only read once the scopes have been checked, so an unauthorised client can't make us buffer them
	const bodyParsers: Express.RequestHandler[] = binaryRequestConfig
		? [
				Express.raw({ type: [...binaryRequestConfig.contentTypes], limit: binaryRequestConfig.maxBytes }),
				createBinaryBodyMiddleware(binaryRequestConfig),
			]
		: []

	router[endpoint.method](
		endpoint.path,
		requireScopes(endpoint.scopes),
		...bodyParsers,
		async (req, res: RestApiResponse, next) => {
			try {
				const token = res.locals.apiToken
				if (!token) throw RestApiError.unauthorized()

				const params = parseRequestPart(endpoint.request?.params, req.params, 'Invalid path parameters')
				const query = parseRequestPart(endpoint.request?.query, req.query, 'Invalid query parameters')
				const body = parseRequestPart(
					endpoint.request?.body,
					binaryRequestConfig ? res.locals.binaryBody : req.body,
					'Invalid request body'
				)

				const result = await endpoint.handler({ params, query, body, token })

				if (result.status === 204) {
					res.status(204).send()
					return
				}
				if (endpoint.response.status === 204) throw new Error('Route returned a body for a 204 response')
				if (!endpoint.response.schema) throw new Error('Route response schema is missing')

				if (result.location) res.location(result.location)
				const parsedBody = endpoint.response.schema.parse(result.body)

				if (binaryResponseConfig) {
					const binaryBody = parsedBody as BinaryResponseBody
					res.type(binaryBody.contentType)
					if (binaryBody.cacheControl !== null) res.set('Cache-Control', binaryBody.cacheControl)
					res.status(result.status ?? 200).send(binaryBody.data)
				} else {
					res.status(result.status ?? 200).json(parsedBody)
				}
			} catch (e) {
				next(e)
			}
		}
	)
}

/**
 * Validate the raw body read by `Express.raw` and stash it for the handler. `Express.raw` silently skips
 * bodies of other content types, so those are rejected here.
 */
function createBinaryBodyMiddleware(config: BinaryRequestBodyConfig): Express.RequestHandler {
	return (req, res: RestApiResponse, next) => {
		const contentType = req.is([...config.contentTypes])
		const isEmpty =
			contentType === null ||
			req.headers['content-length'] === '0' ||
			(Buffer.isBuffer(req.body) && req.body.length === 0)
		if (isEmpty) {
			next(RestApiError.badRequest('Request body is required'))
			return
		}
		if (contentType === false || !Buffer.isBuffer(req.body)) {
			next(
				RestApiError.unsupportedMediaType(
					`Unsupported content type, expected one of: ${config.contentTypes.join(', ')}`
				)
			)
			return
		}

		res.locals.binaryBody = { contentType, data: req.body } satisfies BinaryRequestBody
		next()
	}
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
	const binaryRequestConfig = endpoint.request?.body ? binaryRequestBodyConfigs.get(endpoint.request.body) : undefined
	if (binaryRequestConfig) {
		request.body = {
			description: binaryRequestConfig.description,
			content: Object.fromEntries(
				binaryRequestConfig.contentTypes.map((contentType) => [
					contentType,
					{ schema: { type: 'string', format: 'binary' } },
				])
			),
			required: true,
		}
	} else if (endpoint.request?.body) {
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

	const binaryResponseConfig = binaryResponseBodyConfigs.get(response.schema)
	if (binaryResponseConfig) {
		return {
			description: response.description,
			content: Object.fromEntries(
				binaryResponseConfig.contentTypes.map((contentType) => [
					contentType,
					{ schema: { type: 'string', format: 'binary' } },
				])
			),
		}
	}

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
