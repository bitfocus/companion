import express from 'express'
import supertest from 'supertest'
import { describe, expect, test } from 'vitest'
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import type { ImageLibraryInfo } from '../../../shared-lib/lib/Model/ImageLibraryModel.js'
import { MAX_IMAGE_DATA_SIZE, type ImageLibrary } from '../../lib/Graphics/ImageLibrary.js'
import { createImageLibraryRestApiRouter, IMAGE_LIBRARY_API_BASE_PATH } from '../../lib/Graphics/ImageLibraryRestApi.js'
import { REST_API_BASE_PATH } from '../../lib/Service/RestApi/constants.js'
import { createRestApiRouter } from '../../lib/Service/RestApi/RestApiRouter.js'
import {
	createTestEnabledUserConfig,
	createTestRestApiResources,
	createTestTokenStore,
} from '../Service/RestApi/RestApiTestHelpers.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

const mockAppInfo = {
	appVersion: '5.0.0-test',
}

const { store: tokenStore, mint } = createTestTokenStore()
const tokens = {
	none: mint([]),
	read: mint(['read']),
	write: mint(['read', 'write']),
}

const IMAGES_PATH = `${REST_API_BASE_PATH}${IMAGE_LIBRARY_API_BASE_PATH}`
const CHECKSUM = '3f786850e387550fdab836ed7e6dc881de23001b'
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

type TestService = {
	app: express.Express
	imageLibrary: DeepMockProxy<ImageLibrary>
}

function createService(): TestService {
	const imageLibrary = mockDeep<ImageLibrary>(mockOptions)

	const restApiRouter = createRestApiRouter(
		createTestRestApiResources({
			imageLibrary: { createRestApiRouter: (logger) => createImageLibraryRestApiRouter(logger, imageLibrary) },
		}),
		createTestEnabledUserConfig(),
		tokenStore,
		mockAppInfo
	)

	// Mirror the app-wide body parsers, to check they leave image bodies for the route to read
	const app = express()
	app.use(express.json({ strict: false }))
	app.use(express.urlencoded({ extended: false }))
	app.use(express.text())
	app.use(REST_API_BASE_PATH, restApiRouter)

	return { app, imageLibrary }
}

function createImageInfo(name: string, props: Partial<ImageLibraryInfo>): ImageLibraryInfo {
	return {
		name,
		description: `Image ${name}`,
		originalSize: 11,
		previewSize: 5,
		createdAt: 1000,
		modifiedAt: 2000,
		checksum: CHECKSUM,
		mimeType: 'image/png',
		sortOrder: 0,
		backgroundColor: 'rgba(0, 0, 0, 0)',
		...props,
	}
}

function createEmptyImageInfo(name: string): ImageLibraryInfo {
	return createImageInfo(name, { originalSize: 0, previewSize: 0, checksum: '', mimeType: '' })
}

/** Back the mocked library lookups with a simple map */
function mockImages(
	imageLibrary: DeepMockProxy<ImageLibrary>,
	images: ImageLibraryInfo[]
): Map<string, ImageLibraryInfo> {
	const store = new Map(images.map((image) => [image.name, image]))
	imageLibrary.listImages.mockImplementation(() => Array.from(store.values()))
	imageLibrary.getImageInfo.mockImplementation((name) => store.get(name) ?? null)
	return store
}

/** Buffer a response body as raw bytes */
function parseBinary(res: supertest.Response, callback: (err: Error | null, body: Buffer) => void): void {
	const chunks: Buffer[] = []
	res.on('data', (chunk: Buffer) => chunks.push(chunk))
	res.on('end', () => callback(null, Buffer.concat(chunks)))
}

describe('Image Library REST API', () => {
	describe('auth', () => {
		test('rejects requests without a token', async () => {
			const { app } = createService()

			const res = await supertest(app).get(IMAGES_PATH)

			expect(res.status).toBe(401)
		})

		test('rejects reads without the read scope', async () => {
			const { app } = createService()

			const res = await supertest(app).get(IMAGES_PATH).set('Authorization', `Bearer ${tokens.none}`)

			expect(res.status).toBe(403)
		})

		test('rejects writes without the write scope', async () => {
			const { app } = createService()

			const res = await supertest(app)
				.post(IMAGES_PATH)
				.set('Authorization', `Bearer ${tokens.read}`)
				.send({ name: 'logo' })

			expect(res.status).toBe(403)
		})

		test('rejects data uploads without the write scope, before reading the body', async () => {
			const { app } = createService()

			const res = await supertest(app)
				.put(`${IMAGES_PATH}/logo/data`)
				.set('Authorization', `Bearer ${tokens.read}`)
				.set('Content-Type', 'image/png')
				.send(PNG_BYTES)

			expect(res.status).toBe(403)
		})
	})

	describe('GET /image-library', () => {
		test('lists images sorted by name', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createImageInfo('zebra', {}), createEmptyImageInfo('apple')])

			const res = await supertest(app).get(IMAGES_PATH).set('Authorization', `Bearer ${tokens.read}`)

			expect(res.status).toBe(200)
			expect(res.body.meta).toEqual({ total: 2, limit: 2, offset: 0 })
			expect(res.body.data.map((image: { name: string }) => image.name)).toEqual(['apple', 'zebra'])
		})

		test('returns the response shape, with urls built from the checksum', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createImageInfo('logo', { collectionId: 'collection-1' })])

			const res = await supertest(app).get(IMAGES_PATH).set('Authorization', `Bearer ${tokens.read}`)

			expect(res.status).toBe(200)
			expect(res.body.data[0]).toEqual({
				name: 'logo',
				description: 'Image logo',
				variable: '$(image:logo)',
				mimeType: 'image/png',
				originalSize: 11,
				previewSize: 5,
				checksum: CHECKSUM,
				urls: {
					original: `${IMAGES_PATH}/logo/data/original/${CHECKSUM}`,
					preview: `${IMAGES_PATH}/logo/data/preview/${CHECKSUM}`,
				},
				backgroundColor: 'rgba(0, 0, 0, 0)',
				collectionId: 'collection-1',
				createdAt: 1000,
				modifiedAt: 2000,
			})
		})

		test('returns null data fields for an image with no data uploaded', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createEmptyImageInfo('logo')])

			const res = await supertest(app).get(`${IMAGES_PATH}/logo`).set('Authorization', `Bearer ${tokens.read}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ mimeType: null, checksum: null, urls: null, collectionId: null })
		})
	})

	describe('GET /image-library/:imageName', () => {
		test('returns the image', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createImageInfo('logo', {})])

			const res = await supertest(app).get(`${IMAGES_PATH}/logo`).set('Authorization', `Bearer ${tokens.read}`)

			expect(res.status).toBe(200)
			expect(res.body.data.name).toBe('logo')
		})

		test('returns 404 for an unknown image', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [])

			const res = await supertest(app).get(`${IMAGES_PATH}/missing`).set('Authorization', `Bearer ${tokens.read}`)

			expect(res.status).toBe(404)
		})
	})

	describe('POST /image-library', () => {
		test('creates an image with the sanitised name', async () => {
			const { app, imageLibrary } = createService()
			const store = mockImages(imageLibrary, [])
			imageLibrary.createEmptyImage.mockImplementation((name, description) => {
				store.set(name, { ...createEmptyImageInfo(name), description })
				return name
			})

			const res = await supertest(app)
				.post(IMAGES_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ name: 'my logo', description: 'Company logo' })

			expect(res.status).toBe(201)
			expect(res.headers.location).toBe(`${IMAGES_PATH}/my_logo`)
			expect(res.body.data).toMatchObject({ name: 'my_logo', description: 'Company logo', urls: null })
			expect(imageLibrary.createEmptyImage).toHaveBeenCalledWith('my_logo', 'Company logo')
		})

		test('defaults the description to empty', async () => {
			const { app, imageLibrary } = createService()
			const store = mockImages(imageLibrary, [])
			imageLibrary.createEmptyImage.mockImplementation((name, description) => {
				store.set(name, { ...createEmptyImageInfo(name), description })
				return name
			})

			const res = await supertest(app)
				.post(IMAGES_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ name: 'logo' })

			expect(res.status).toBe(201)
			expect(imageLibrary.createEmptyImage).toHaveBeenCalledWith('logo', '')
		})

		test('returns 409 when the name is taken', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createImageInfo('logo', {})])

			const res = await supertest(app)
				.post(IMAGES_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ name: 'logo' })

			expect(res.status).toBe(409)
			expect(imageLibrary.createEmptyImage).not.toHaveBeenCalled()
		})

		test('returns 400 for a name that sanitises to nothing', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [])

			const res = await supertest(app)
				.post(IMAGES_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ name: '   ' })

			expect(res.status).toBe(400)
		})

		test('rejects unknown properties', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [])

			const res = await supertest(app)
				.post(IMAGES_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ name: 'logo', png64: 'abc' })

			expect(res.status).toBe(400)
		})
	})

	describe('PATCH /image-library/:imageName', () => {
		function setupPatch(): TestService & { store: Map<string, ImageLibraryInfo> } {
			const service = createService()
			const { imageLibrary } = service
			const store = mockImages(imageLibrary, [createImageInfo('logo', {}), createImageInfo('other', {})])

			imageLibrary.setImageDescription.mockImplementation((name, description) => {
				store.set(name, { ...store.get(name)!, description })
				return true
			})
			imageLibrary.setImageBackgroundColor.mockImplementation((name, backgroundColor) => {
				store.set(name, { ...store.get(name)!, backgroundColor })
				return true
			})
			imageLibrary.setImageName.mockImplementation((name, newName) => {
				const info = store.get(name)!
				store.delete(name)
				store.set(newName, { ...info, name: newName })
				return newName
			})

			return { ...service, store }
		}

		test('updates the description and background color', async () => {
			const { app, imageLibrary } = setupPatch()

			const res = await supertest(app)
				.patch(`${IMAGES_PATH}/logo`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ description: 'New description', backgroundColor: '#ff0000' })

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ description: 'New description', backgroundColor: '#ff0000' })
			expect(imageLibrary.setImageName).not.toHaveBeenCalled()
		})

		test('renames the image after applying the other changes', async () => {
			const { app, imageLibrary } = setupPatch()

			const res = await supertest(app)
				.patch(`${IMAGES_PATH}/logo`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ name: 'new logo', description: 'Renamed' })

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ name: 'new_logo', description: 'Renamed', variable: '$(image:new_logo)' })
			expect(imageLibrary.setImageDescription).toHaveBeenCalledWith('logo', 'Renamed')
			expect(imageLibrary.setImageName).toHaveBeenCalledWith('logo', 'new_logo')
		})

		test('returns 409 and changes nothing when renaming to a taken name', async () => {
			const { app, imageLibrary } = setupPatch()

			const res = await supertest(app)
				.patch(`${IMAGES_PATH}/logo`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ name: 'other', description: 'Renamed' })

			expect(res.status).toBe(409)
			expect(imageLibrary.setImageDescription).not.toHaveBeenCalled()
			expect(imageLibrary.setImageName).not.toHaveBeenCalled()
		})

		test('returns 404 for an unknown image', async () => {
			const { app } = setupPatch()

			const res = await supertest(app)
				.patch(`${IMAGES_PATH}/missing`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ description: 'x' })

			expect(res.status).toBe(404)
		})

		test('rejects unknown properties', async () => {
			const { app } = setupPatch()

			const res = await supertest(app)
				.patch(`${IMAGES_PATH}/logo`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ checksum: 'abc' })

			expect(res.status).toBe(400)
		})
	})

	describe('DELETE /image-library/:imageName', () => {
		test('deletes the image', async () => {
			const { app, imageLibrary } = createService()
			imageLibrary.deleteImage.mockReturnValue(true)

			const res = await supertest(app).delete(`${IMAGES_PATH}/logo`).set('Authorization', `Bearer ${tokens.write}`)

			expect(res.status).toBe(204)
			expect(imageLibrary.deleteImage).toHaveBeenCalledWith('logo')
		})

		test('returns 404 for an unknown image', async () => {
			const { app, imageLibrary } = createService()
			imageLibrary.deleteImage.mockReturnValue(false)

			const res = await supertest(app).delete(`${IMAGES_PATH}/missing`).set('Authorization', `Bearer ${tokens.write}`)

			expect(res.status).toBe(404)
		})
	})

	describe('GET /image-library/:imageName/data/:variant/:checksum', () => {
		test('returns the raw image with an immutable cache header', async () => {
			const { app, imageLibrary } = createService()
			imageLibrary.getImageBinary.mockReturnValue({ mimeType: 'image/png', data: PNG_BYTES, checksum: CHECKSUM })

			const res = await supertest(app)
				.get(`${IMAGES_PATH}/logo/data/original/${CHECKSUM}`)
				.set('Authorization', `Bearer ${tokens.read}`)
				.buffer(true)
				.parse(parseBinary)

			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toBe('image/png')
			expect(res.headers['cache-control']).toBe('private, max-age=31536000, immutable')
			expect(Buffer.compare(res.body, PNG_BYTES)).toBe(0)
			expect(imageLibrary.getImageBinary).toHaveBeenCalledWith('logo', 'original')
		})

		test('returns the preview', async () => {
			const { app, imageLibrary } = createService()
			const previewBytes = Buffer.from('RIFF....WEBP')
			imageLibrary.getImageBinary.mockReturnValue({ mimeType: 'image/webp', data: previewBytes, checksum: CHECKSUM })

			const res = await supertest(app)
				.get(`${IMAGES_PATH}/logo/data/preview/${CHECKSUM}`)
				.set('Authorization', `Bearer ${tokens.read}`)
				.buffer(true)
				.parse(parseBinary)

			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toBe('image/webp')
			expect(Buffer.compare(res.body, previewBytes)).toBe(0)
			expect(imageLibrary.getImageBinary).toHaveBeenCalledWith('logo', 'preview')
		})

		test('returns 404 for a stale checksum', async () => {
			const { app, imageLibrary } = createService()
			imageLibrary.getImageBinary.mockReturnValue({ mimeType: 'image/png', data: PNG_BYTES, checksum: CHECKSUM })

			const res = await supertest(app)
				.get(`${IMAGES_PATH}/logo/data/original/oldchecksum`)
				.set('Authorization', `Bearer ${tokens.read}`)

			expect(res.status).toBe(404)
			expect(res.headers['cache-control']).toBeUndefined()
		})

		test('returns 404 for an unknown image, or one with no data', async () => {
			const { app, imageLibrary } = createService()
			imageLibrary.getImageBinary.mockReturnValue(null)

			const res = await supertest(app)
				.get(`${IMAGES_PATH}/missing/data/original/${CHECKSUM}`)
				.set('Authorization', `Bearer ${tokens.read}`)

			expect(res.status).toBe(404)
		})

		test('returns 400 for an unknown variant', async () => {
			const { app } = createService()

			const res = await supertest(app)
				.get(`${IMAGES_PATH}/logo/data/huge/${CHECKSUM}`)
				.set('Authorization', `Bearer ${tokens.read}`)

			expect(res.status).toBe(400)
		})
	})

	describe('PUT /image-library/:imageName/data', () => {
		test('sets the image data from the raw body', async () => {
			const { app, imageLibrary } = createService()
			const store = mockImages(imageLibrary, [createEmptyImageInfo('logo')])
			imageLibrary.setImageData.mockImplementation(async (name, mimeType, data) => {
				const info = createImageInfo(name, { mimeType, originalSize: data.length, checksum: 'newchecksum' })
				store.set(name, info)
				return info
			})

			const res = await supertest(app)
				.put(`${IMAGES_PATH}/logo/data`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.set('Content-Type', 'image/png')
				.send(PNG_BYTES)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({
				name: 'logo',
				mimeType: 'image/png',
				checksum: 'newchecksum',
				urls: { original: `${IMAGES_PATH}/logo/data/original/newchecksum` },
			})
			expect(imageLibrary.setImageData).toHaveBeenCalledTimes(1)
			const [name, mimeType, data] = imageLibrary.setImageData.mock.calls[0]
			expect(name).toBe('logo')
			expect(mimeType).toBe('image/png')
			expect(Buffer.compare(data, PNG_BYTES)).toBe(0)
		})

		test('accepts a content type with parameters', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createEmptyImageInfo('logo')])
			imageLibrary.setImageData.mockResolvedValue(createImageInfo('logo', { mimeType: 'image/svg+xml' }))

			const res = await supertest(app)
				.put(`${IMAGES_PATH}/logo/data`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.set('Content-Type', 'image/svg+xml; charset=utf-8')
				.send(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))

			expect(res.status).toBe(200)
			expect(imageLibrary.setImageData.mock.calls[0][1]).toBe('image/svg+xml')
		})

		test('returns 404 for an unknown image', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [])

			const res = await supertest(app)
				.put(`${IMAGES_PATH}/missing/data`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.set('Content-Type', 'image/png')
				.send(PNG_BYTES)

			expect(res.status).toBe(404)
		})

		test('returns 415 for an unsupported content type', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createEmptyImageInfo('logo')])

			const res = await supertest(app)
				.put(`${IMAGES_PATH}/logo/data`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.set('Content-Type', 'text/plain')
				.send('data:image/png;base64,AAAA')

			expect(res.status).toBe(415)
			expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
		})

		test('returns 415 for a json body', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createEmptyImageInfo('logo')])

			const res = await supertest(app)
				.put(`${IMAGES_PATH}/logo/data`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ png64: 'AAAA' })

			expect(res.status).toBe(415)
		})

		test('returns 400 for an empty body', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createEmptyImageInfo('logo')])

			const res = await supertest(app)
				.put(`${IMAGES_PATH}/logo/data`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.set('Content-Type', 'image/png')
				.send(Buffer.alloc(0))

			expect(res.status).toBe(400)
		})

		test('returns 400 for a missing body', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createEmptyImageInfo('logo')])

			const res = await supertest(app).put(`${IMAGES_PATH}/logo/data`).set('Authorization', `Bearer ${tokens.write}`)

			expect(res.status).toBe(400)
		})

		test('returns 413 for an image over the size limit', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createEmptyImageInfo('logo')])

			const res = await supertest(app)
				.put(`${IMAGES_PATH}/logo/data`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.set('Content-Type', 'image/png')
				.send(Buffer.alloc(MAX_IMAGE_DATA_SIZE + 1))

			expect(res.status).toBe(413)
			expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE')
		})

		test('returns 422 when the image cannot be decoded', async () => {
			const { app, imageLibrary } = createService()
			mockImages(imageLibrary, [createEmptyImageInfo('logo')])
			imageLibrary.setImageData.mockRejectedValue(new Error('Unsupported image type'))

			const res = await supertest(app)
				.put(`${IMAGES_PATH}/logo/data`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.set('Content-Type', 'image/png')
				.send(Buffer.from('not a png'))

			expect(res.status).toBe(422)
		})
	})

	describe('CORS', () => {
		test('allows PUT in preflight requests', async () => {
			const { app } = createService()

			const res = await supertest(app)
				.options(`${IMAGES_PATH}/logo/data`)
				.set('Origin', 'http://example.com')
				.set('Access-Control-Request-Method', 'PUT')

			expect(res.status).toBe(204)
			expect(res.headers['access-control-allow-methods']).toContain('PUT')
		})
	})
})
