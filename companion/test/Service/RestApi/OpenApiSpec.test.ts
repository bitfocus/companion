import express from 'express'
import Express from 'express'
import supertest from 'supertest'
import { beforeAll, describe, expect, test } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { InstanceController } from '../../../lib/Instance/Controller.js'
import { generateOpenApiDocument } from '../../../lib/Service/RestApi/openapi.js'
import { createRestApiRouter } from '../../../lib/Service/RestApi/RestApiRouter.js'
import { RestApiTokenStoreMemory } from '../../../lib/Service/RestApi/RestApiTokenStore.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('OpenAPI Spec Generation', () => {
	let doc: ReturnType<typeof generateOpenApiDocument>

	beforeAll(() => {
		doc = generateOpenApiDocument()
	})

	test('generates a valid OpenAPI 3.0.3 document', () => {
		expect(doc.openapi).toBe('3.0.3')
		expect(doc.info.title).toBe('Bitfocus Companion REST API')
		expect(doc.info.version).toBe('4.3.0')
	})

	test('includes server definition', () => {
		expect(doc.servers).toBeDefined()
		expect(doc.servers).toEqual(expect.arrayContaining([expect.objectContaining({ url: '/api' })]))
	})

	test('defines bearerAuth security scheme', () => {
		const schemes = doc.components?.securitySchemes
		expect(schemes).toBeDefined()
		expect(schemes!['bearerAuth']).toEqual(
			expect.objectContaining({
				type: 'http',
				scheme: 'bearer',
			})
		)
	})

	test('has global security requirement', () => {
		expect(doc.security).toEqual(expect.arrayContaining([{ bearerAuth: [] }]))
	})

	describe('connection paths', () => {
		const expectedPaths = [
			'/connections/v1',
			'/connections/v1/{connectionId}',
			'/connections/v1/{connectionId}/restart',
		]

		test('registers all expected paths', () => {
			for (const path of expectedPaths) {
				expect(doc.paths?.[path]).toBeDefined()
			}
		})

		test('GET /connections is defined with correct response schema', () => {
			const op = doc.paths?.['/connections/v1']?.get
			expect(op).toBeDefined()
			expect(op!.tags).toContain('Connections')
			expect(op!.responses['200']).toBeDefined()
			// Response should have content with application/json
			const content200 = (op!.responses['200'] as any).content?.['application/json']
			expect(content200).toBeDefined()
			expect(content200.schema).toBeDefined()
		})

		test('POST /connections is defined with request body', () => {
			const op = doc.paths?.['/connections/v1']?.post
			expect(op).toBeDefined()
			expect(op!.tags).toContain('Connections')
			expect(op!.requestBody).toBeDefined()
			expect(op!.responses['201']).toBeDefined()
		})

		test('GET /connections/{connectionId} is defined', () => {
			const op = doc.paths?.['/connections/v1/{connectionId}']?.get
			expect(op).toBeDefined()
			expect(op!.responses['200']).toBeDefined()
		})

		test('PATCH /connections/{connectionId} is defined with request body', () => {
			const op = doc.paths?.['/connections/v1/{connectionId}']?.patch
			expect(op).toBeDefined()
			expect(op!.requestBody).toBeDefined()
			expect(op!.responses['200']).toBeDefined()
		})

		test('DELETE /connections/{connectionId} is defined', () => {
			const op = doc.paths?.['/connections/v1/{connectionId}']?.delete
			expect(op).toBeDefined()
			expect(op!.responses['204']).toBeDefined()
		})

		test('POST /connections/{connectionId}/restart is defined', () => {
			const op = doc.paths?.['/connections/v1/{connectionId}/restart']?.post
			expect(op).toBeDefined()
			expect(op!.responses['200']).toBeDefined()
			expect(op!.responses['409']).toBeDefined()
		})

		test('all paths include standard error responses', () => {
			const errorCodes = ['401', '403']
			for (const path of expectedPaths) {
				const pathItem = doc.paths?.[path]
				for (const method of Object.keys(pathItem ?? {})) {
					const op = (pathItem as any)[method]
					if (op?.responses) {
						for (const code of errorCodes) {
							expect(op.responses[code]).toBeDefined()
						}
					}
				}
			}
		})
	})

	describe('schema definitions', () => {
		test('ConnectionResponse schema has expected properties', () => {
			const listOp = doc.paths?.['/connections/v1']?.get
			const schema200 = (listOp?.responses['200'] as any)?.content?.['application/json']?.schema
			expect(schema200).toBeDefined()

			// The collection envelope should have data (array) and meta
			expect(schema200.properties?.data).toBeDefined()
			expect(schema200.properties?.meta).toBeDefined()

			// data should be an array
			expect(schema200.properties.data.type).toBe('array')

			// Each item should have connection fields
			const itemSchema = schema200.properties.data.items
			expect(itemSchema).toBeDefined()
			const expectedFields = [
				'id',
				'label',
				'moduleId',
				'moduleVersionId',
				'updatePolicy',
				'enabled',
				'sortOrder',
				'collectionId',
				'status',
			]
			for (const field of expectedFields) {
				expect(itemSchema.properties?.[field]).toBeDefined()
			}
		})

		test('ConnectionCreateBody schema has expected properties', () => {
			const postOp = doc.paths?.['/connections/v1']?.post
			const bodySchema = (postOp?.requestBody as any)?.content?.['application/json']?.schema
			expect(bodySchema).toBeDefined()

			const expectedFields = ['moduleId', 'label', 'versionId', 'updatePolicy', 'disabled']
			for (const field of expectedFields) {
				expect(bodySchema.properties?.[field]).toBeDefined()
			}
			expect(bodySchema.properties?.module).toBeUndefined()
			expect(bodySchema.properties?.enabled).toBeUndefined()
			expect(bodySchema.required).toContain('moduleId')
			expect(bodySchema.required).toContain('label')
		})

		test('ConnectionCreateBody schema includes examples', () => {
			const postOp = doc.paths?.['/connections/v1']?.post
			const bodySchema = (postOp?.requestBody as any)?.content?.['application/json']?.schema
			expect(bodySchema.example).toEqual(
				expect.objectContaining({
					moduleId: 'obs-websocket',
					label: 'OBS',
				})
			)
			expect(bodySchema.properties?.moduleId.example).toBe('obs-websocket')
		})

		test('Connection response schema includes examples', () => {
			const postOp = doc.paths?.['/connections/v1']?.post
			const responseSchema = (postOp?.responses['201'] as any)?.content?.['application/json']?.schema
			expect(responseSchema.example?.data).toEqual(
				expect.objectContaining({
					id: 'obs',
					moduleId: 'obs-websocket',
				})
			)
		})

		test('ConnectionPatchBody schema has expected optional properties', () => {
			const patchOp = doc.paths?.['/connections/v1/{connectionId}']?.patch
			const bodySchema = (patchOp?.requestBody as any)?.content?.['application/json']?.schema
			expect(bodySchema).toBeDefined()

			const expectedFields = ['label', 'disabled', 'config', 'updatePolicy', 'versionId']
			for (const field of expectedFields) {
				expect(bodySchema.properties?.[field]).toBeDefined()
			}
			expect(bodySchema.properties?.enabled).toBeUndefined()
			// All fields should be optional (no required array, or empty)
			expect(bodySchema.required ?? []).toEqual([])
		})

		test('PaginationMeta schema has total, limit, offset', () => {
			const listOp = doc.paths?.['/connections/v1']?.get
			const schema200 = (listOp?.responses['200'] as any)?.content?.['application/json']?.schema
			const metaSchema = schema200?.properties?.meta
			expect(metaSchema).toBeDefined()
			expect(metaSchema.properties?.total).toBeDefined()
			expect(metaSchema.properties?.limit).toBeDefined()
			expect(metaSchema.properties?.offset).toBeDefined()
		})

		test('ErrorResponse schema has error.code and error.message', () => {
			const getOp = doc.paths?.['/connections/v1']?.get
			const schema401 = (getOp?.responses['401'] as any)?.content?.['application/json']?.schema
			expect(schema401).toBeDefined()
			expect(schema401.properties?.error).toBeDefined()
			expect(schema401.properties.error.properties?.code).toBeDefined()
			expect(schema401.properties.error.properties?.message).toBeDefined()
		})
	})
})

describe('OpenAPI HTTP endpoints', () => {
	function createService() {
		const instanceController = mockDeep<InstanceController>(mockOptions)
		const tokenStore = new RestApiTokenStoreMemory()
		const restApiRouter = createRestApiRouter(instanceController, tokenStore)

		const app = express()
		app.use(Express.json())
		app.use('/api', restApiRouter)

		return { app }
	}

	test('GET /openapi.json returns the OpenAPI document without auth', async () => {
		const { app } = createService()

		const res = await supertest(app).get('/api/openapi.json').send()

		expect(res.status).toBe(200)
		expect(res.body.openapi).toBe('3.0.3')
		expect(res.body.info.title).toBe('Bitfocus Companion REST API')
		expect(res.body.paths).toBeDefined()
		expect(res.body.paths['/connections/v1']).toBeDefined()
	})

	test('GET /docs returns Swagger UI HTML without auth', async () => {
		const { app } = createService()

		const res = await supertest(app).get('/api/docs/').send()

		expect(res.status).toBe(200)
		expect(res.headers['content-type']).toMatch(/text\/html/)
		expect(res.text).toContain('swagger')
	})
})
