import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import Express from 'express'
import z from 'zod'
import { makeLabelSafe } from '@companion-app/shared/Label.js'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import type { Logger } from '../Log/Controller.js'
import { REST_API_BASE_PATH } from '../Service/RestApi/constants.js'
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
	binaryRequestBodySchema,
	binaryResponseBodySchema,
	createRestEndpointSpecFactory,
	mountRestEndpoint,
	registerRestEndpoint,
	type RestEndpointSpec,
} from '../Service/RestApi/typedRoute.js'
import { MAX_IMAGE_DATA_SIZE, type ImageLibrary } from './ImageLibrary.js'

export const IMAGE_LIBRARY_API_BASE_PATH = '/image-library/v1'
const IMAGE_LIBRARY_API_TAGS = ['Image Library']

/** Image types that can be uploaded. These are the formats the renderer is able to decode */
const UPLOAD_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'] as const

/** Image data URLs contain the checksum, so the bytes behind one never change */
const IMMUTABLE_CACHE_CONTROL = 'private, max-age=31536000, immutable'

const ImageVariantSchema = z
	.enum(['original', 'preview'])
	.describe('Which version of the image to fetch. The preview is a small WebP thumbnail.')
	.meta({ example: 'original' })

const ImageUrlsSchema = z.object({
	original: z
		.string()
		.describe('URL of the image as uploaded. Changes whenever the image data changes.')
		.meta({ example: '/api/v2/image-library/v1/logo/data/original/3f786850e387550fdab836ed7e6dc881de23001b' }),
	preview: z
		.string()
		.describe('URL of a small WebP preview of the image. Changes whenever the image data changes.')
		.meta({ example: '/api/v2/image-library/v1/logo/data/preview/3f786850e387550fdab836ed7e6dc881de23001b' }),
})

const ImageResponseExample = {
	name: 'logo',
	description: 'Company logo',
	variable: '$(image:logo)',
	mimeType: 'image/png',
	originalSize: 24512,
	previewSize: 3120,
	checksum: '3f786850e387550fdab836ed7e6dc881de23001b',
	urls: {
		original: '/api/v2/image-library/v1/logo/data/original/3f786850e387550fdab836ed7e6dc881de23001b',
		preview: '/api/v2/image-library/v1/logo/data/preview/3f786850e387550fdab836ed7e6dc881de23001b',
	},
	backgroundColor: 'rgba(0, 0, 0, 0)',
	collectionId: null,
	createdAt: 1767225600000,
	modifiedAt: 1767225600000,
}

/** Schema for an image in API responses — used for both validation and stripping */
const ImageResponseSchema = z
	.object({
		name: z
			.string()
			.describe('Unique name of the image. Only letters, numbers, underscores and dashes.')
			.meta({ example: ImageResponseExample.name }),
		description: z.string().describe('Description of the image.').meta({ example: ImageResponseExample.description }),
		variable: z
			.string()
			.describe('Variable to use in a button to reference this image.')
			.meta({ example: ImageResponseExample.variable }),
		mimeType: z
			.string()
			.nullable()
			.describe('Content type of the uploaded image, or null if no image data has been uploaded yet.')
			.meta({ example: ImageResponseExample.mimeType }),
		originalSize: z
			.number()
			.describe('Size of the uploaded image in bytes.')
			.meta({ example: ImageResponseExample.originalSize }),
		previewSize: z
			.number()
			.describe('Size of the preview image in bytes.')
			.meta({ example: ImageResponseExample.previewSize }),
		checksum: z
			.string()
			.nullable()
			.describe('Checksum of the image data, or null if no image data has been uploaded yet.')
			.meta({ example: ImageResponseExample.checksum }),
		urls: ImageUrlsSchema.nullable().describe(
			'URLs to fetch the image data from, or null if no image data has been uploaded yet. These include the checksum, so can be cached indefinitely.'
		),
		backgroundColor: z
			.string()
			.describe('CSS color shown behind the image when previewing it in the UI.')
			.meta({ example: ImageResponseExample.backgroundColor }),
		collectionId: z.string().nullable().describe('Id of the collection the image is in, or null if in none.'),
		createdAt: z
			.number()
			.describe('Time the image was created, in milliseconds since the epoch.')
			.meta({ example: ImageResponseExample.createdAt }),
		modifiedAt: z
			.number()
			.describe('Time the image was last modified, in milliseconds since the epoch.')
			.meta({ example: ImageResponseExample.modifiedAt }),
	})
	.meta({ example: ImageResponseExample })

type ImageResponse = z.infer<typeof ImageResponseSchema>

const ImageNameSchema = z
	.string()
	.min(1)
	.describe(
		'Name for the image. Characters other than letters, numbers, underscores and dashes are replaced with underscores.'
	)

/** Schema for creating an image */
const ImageCreateBodySchema = z
	.object({
		name: ImageNameSchema.meta({ example: 'logo' }),
		description: z.string().optional().describe('Description of the image.').meta({ example: 'Company logo' }),
	})
	.strict()

/** Schema for partially updating an image */
const ImagePatchBodySchema = z
	.object({
		name: ImageNameSchema.optional().meta({ example: 'new_logo' }),
		description: z.string().optional().describe('Description of the image.').meta({ example: 'Company logo' }),
		backgroundColor: z
			.string()
			.optional()
			.describe('CSS color shown behind the image when previewing it in the UI.')
			.meta({ example: '#000000' }),
	})
	.strict()

const ImageDataBodySchema = binaryRequestBodySchema({
	contentTypes: UPLOAD_CONTENT_TYPES,
	maxBytes: MAX_IMAGE_DATA_SIZE,
	description: `The raw image file, with a Content-Type matching its format. At most ${MAX_IMAGE_DATA_SIZE} bytes.`,
})

const ImageDataResponseSchema = binaryResponseBodySchema({
	contentTypes: UPLOAD_CONTENT_TYPES,
})

const imageNameParam = z.object({
	imageName: z
		.string()
		.describe('Image name, as returned by the list images endpoint.')
		.meta({ example: ImageResponseExample.name }),
})

const imageDataParams = imageNameParam.extend({
	variant: ImageVariantSchema,
	checksum: z
		.string()
		.describe('Checksum of the image data, as included in the image urls.')
		.meta({ example: ImageResponseExample.checksum }),
})

const conflictResponse = {
	409: {
		description: 'An image with that name already exists',
		content: { 'application/json': { schema: ErrorResponseSchema } },
	},
}

type ImageLibraryRestContext = {
	logger: Logger
	imageLibrary: ImageLibrary
}

const defineImageLibraryEndpointSpec = createRestEndpointSpecFactory<ImageLibraryRestContext>()

/**
 * Create the image library router for /api/v2/image-library/v1
 */
export function createImageLibraryRestApiRouter(logger: Logger, imageLibrary: ImageLibrary): Express.Router {
	const imagesRouter = Express.Router()
	const imagesLogger = logger.child({ source: 'image-library/v1' })

	for (const endpointSpec of imageLibraryEndpointSpecs) {
		mountRestEndpoint(imagesRouter, endpointSpec.createEndpoint({ logger: imagesLogger, imageLibrary }))
	}

	const router = Express.Router()
	router.use(IMAGE_LIBRARY_API_BASE_PATH, imagesRouter)

	return router
}

/**
 * Register the image library paths into the OpenAPI registry
 */
export function registerImageLibraryPaths(registry: OpenAPIRegistry): void {
	for (const endpointSpec of imageLibraryEndpointSpecs) {
		registerRestEndpoint(registry, IMAGE_LIBRARY_API_BASE_PATH, endpointSpec.contract)
	}
}

const imageLibraryEndpointSpecs: RestEndpointSpec<ImageLibraryRestContext>[] = [
	defineImageLibraryEndpointSpec(
		{
			method: 'get',
			path: '/',
			scopes: ['read'],
			tags: IMAGE_LIBRARY_API_TAGS,
			summary: 'List all images',
			description: 'Returns every image in the image library, sorted by name.',
			response: {
				status: 200,
				description: 'List of images',
				schema: createCollectionSchema(ImageResponseSchema),
			},
			examples: {
				response: collectionResponse([ImageResponseExample], { total: 1, limit: 1, offset: 0 }),
			},
			errorResponses,
		},
		({ imageLibrary }) => {
			return () => {
				const images = imageLibrary
					.listImages()
					.map(toImageResponse)
					.sort((a, b) => a.name.localeCompare(b.name))

				return {
					body: collectionResponse(images, { total: images.length, limit: images.length, offset: 0 }),
				}
			}
		}
	),

	defineImageLibraryEndpointSpec(
		{
			method: 'post',
			path: '/',
			scopes: ['write'],
			tags: IMAGE_LIBRARY_API_TAGS,
			summary: 'Create an image',
			description:
				'Create a new, empty image. Upload its data with the set image data endpoint. The name is sanitised, so check the name in the response.',
			request: {
				body: ImageCreateBodySchema,
			},
			response: {
				status: 201,
				description: 'Image created',
				schema: createSuccessSchema(ImageResponseSchema),
			},
			examples: {
				body: { name: 'logo', description: 'Company logo' },
				response: successResponse({
					...ImageResponseExample,
					mimeType: null,
					originalSize: 0,
					previewSize: 0,
					checksum: null,
					urls: null,
				}),
			},
			extraResponses: conflictResponse,
			errorResponses,
		},
		({ logger, imageLibrary }) => {
			return ({ body }) => {
				const safeName = makeLabelSafe(body.name)
				if (!safeName) throw RestApiError.badRequest('Invalid image name')
				if (imageLibrary.getImageInfo(safeName)) {
					throw RestApiError.conflict(`Image with name "${safeName}" already exists`)
				}

				const name = imageLibrary.createEmptyImage(safeName, body.description ?? '')

				logger.info(`Created image "${name}"`)

				return {
					status: 201,
					location: imageUrl(name),
					body: successResponse(getImageOrThrow(imageLibrary, name)),
				}
			}
		}
	),

	defineImageLibraryEndpointSpec(
		{
			method: 'get',
			path: '/:imageName',
			scopes: ['read'],
			tags: IMAGE_LIBRARY_API_TAGS,
			summary: 'Get an image',
			description: 'Returns the details of a single image. Fetch the image itself from one of its urls.',
			request: {
				params: imageNameParam,
			},
			response: {
				status: 200,
				description: 'The requested image',
				schema: createSuccessSchema(ImageResponseSchema),
			},
			examples: {
				response: successResponse(ImageResponseExample),
			},
			errorResponses,
		},
		({ imageLibrary }) => {
			return ({ params }) => {
				return { body: successResponse(getImageOrThrow(imageLibrary, params.imageName)) }
			}
		}
	),

	defineImageLibraryEndpointSpec(
		{
			method: 'patch',
			path: '/:imageName',
			scopes: ['write'],
			tags: IMAGE_LIBRARY_API_TAGS,
			summary: 'Update an image',
			description:
				'Update the details of an image. Renaming an image changes its variable, so buttons using the old name will no longer show it.',
			request: {
				params: imageNameParam,
				body: ImagePatchBodySchema,
			},
			response: {
				status: 200,
				description: 'Updated image',
				schema: createSuccessSchema(ImageResponseSchema),
			},
			examples: {
				body: { description: 'Company logo' },
				response: successResponse(ImageResponseExample),
			},
			extraResponses: conflictResponse,
			errorResponses,
		},
		({ logger, imageLibrary }) => {
			return ({ params, body }) => {
				const { imageName } = params

				if (!imageLibrary.getImageInfo(imageName)) throw RestApiError.notFound('Image not found')

				// Validate the rename before changing anything, so a failed request leaves the image untouched
				let newName: string | null = null
				if (body.name !== undefined) {
					newName = makeLabelSafe(body.name)
					if (!newName) throw RestApiError.badRequest('Invalid image name')
					if (newName !== imageName && imageLibrary.getImageInfo(newName)) {
						throw RestApiError.conflict(`Image with name "${newName}" already exists`)
					}
				}

				if (body.description !== undefined) imageLibrary.setImageDescription(imageName, body.description)
				if (body.backgroundColor !== undefined) imageLibrary.setImageBackgroundColor(imageName, body.backgroundColor)

				// Rename last, as the other updates are made against the current name
				const finalName = newName !== null ? imageLibrary.setImageName(imageName, newName) : imageName

				logger.info(`Updated image "${finalName}"`)

				return { body: successResponse(getImageOrThrow(imageLibrary, finalName)) }
			}
		}
	),

	defineImageLibraryEndpointSpec(
		{
			method: 'delete',
			path: '/:imageName',
			scopes: ['write'],
			tags: IMAGE_LIBRARY_API_TAGS,
			summary: 'Delete an image',
			description: 'Delete an image. Buttons using it will no longer show it.',
			request: {
				params: imageNameParam,
			},
			response: {
				status: 204,
				description: 'Image deleted',
			},
			errorResponses,
		},
		({ logger, imageLibrary }) => {
			return ({ params }) => {
				if (!imageLibrary.deleteImage(params.imageName)) throw RestApiError.notFound('Image not found')

				logger.info(`Deleted image "${params.imageName}"`)

				return { status: 204 }
			}
		}
	),

	defineImageLibraryEndpointSpec(
		{
			method: 'get',
			path: '/:imageName/data/:variant/:checksum',
			scopes: ['read'],
			tags: IMAGE_LIBRARY_API_TAGS,
			summary: 'Get image data',
			description:
				'Returns the raw image. Use the urls from the image rather than building this path: they contain the checksum of the current data, so can be cached indefinitely. Once the image data changes, the old urls return 404.',
			request: {
				params: imageDataParams,
			},
			response: {
				status: 200,
				description: 'The image',
				schema: ImageDataResponseSchema,
			},
			errorResponses,
		},
		({ imageLibrary }) => {
			return ({ params }) => {
				const image = imageLibrary.getImageBinary(params.imageName, params.variant)
				if (!image || image.checksum !== params.checksum) throw RestApiError.notFound('Image data not found')

				return {
					body: { contentType: image.mimeType, data: image.data, cacheControl: IMMUTABLE_CACHE_CONTROL },
				}
			}
		}
	),

	defineImageLibraryEndpointSpec(
		{
			method: 'put',
			path: '/:imageName/data',
			scopes: ['write'],
			tags: IMAGE_LIBRARY_API_TAGS,
			summary: 'Set image data',
			description:
				'Replace the image data with the raw image file in the request body. Buttons using the image update to show the new image.',
			request: {
				params: imageNameParam,
				body: ImageDataBodySchema,
			},
			response: {
				status: 200,
				description: 'Updated image',
				schema: createSuccessSchema(ImageResponseSchema),
			},
			examples: {
				response: successResponse(ImageResponseExample),
			},
			extraResponses: {
				413: { description: 'Image is too large', content: { 'application/json': { schema: ErrorResponseSchema } } },
				415: {
					description: 'Unsupported image type',
					content: { 'application/json': { schema: ErrorResponseSchema } },
				},
				422: {
					description: 'Image could not be decoded',
					content: { 'application/json': { schema: ErrorResponseSchema } },
				},
			},
			errorResponses,
		},
		({ logger, imageLibrary }) => {
			return async ({ params, body }) => {
				const { imageName } = params

				if (!imageLibrary.getImageInfo(imageName)) throw RestApiError.notFound('Image not found')

				try {
					await imageLibrary.setImageData(imageName, body.contentType, body.data)
				} catch (e) {
					logger.warn(`Failed to set data of image "${imageName}": ${e}`)
					throw RestApiError.unprocessable('Image data could not be decoded')
				}

				logger.info(`Set data of image "${imageName}" (${body.contentType}, ${body.data.length} bytes)`)

				return { body: successResponse(getImageOrThrow(imageLibrary, imageName)) }
			}
		}
	),
]

function imageUrl(imageName: string): string {
	return `${REST_API_BASE_PATH}${IMAGE_LIBRARY_API_BASE_PATH}/${encodeURIComponent(imageName)}`
}

/**
 * Convert the stored image info to the API representation
 */
function toImageResponse(info: ImageLibraryInfo): ImageResponse {
	const hasData = !!info.checksum

	return ImageResponseSchema.parse({
		name: info.name,
		description: info.description,
		variable: `$(image:${info.name})`,
		mimeType: info.mimeType || null,
		originalSize: info.originalSize,
		previewSize: info.previewSize,
		checksum: hasData ? info.checksum : null,
		urls: hasData
			? {
					original: `${imageUrl(info.name)}/data/original/${info.checksum}`,
					preview: `${imageUrl(info.name)}/data/preview/${info.checksum}`,
				}
			: null,
		backgroundColor: info.backgroundColor ?? 'rgba(0, 0, 0, 0)',
		collectionId: info.collectionId ?? null,
		createdAt: info.createdAt,
		modifiedAt: info.modifiedAt,
	} satisfies ImageResponse)
}

function getImageOrThrow(imageLibrary: ImageLibrary, imageName: string): ImageResponse {
	const info = imageLibrary.getImageInfo(imageName)
	if (!info) throw RestApiError.notFound('Image not found')

	return toImageResponse(info)
}
