import express from 'express'
import supertest from 'supertest'
import { describe, expect, test } from 'vitest'
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import type { ClientDevicesListItem, ClientSurfaceItem } from '../../../shared-lib/lib/Model/Surfaces.js'
import type { IPageStore } from '../../lib/Page/Store.js'
import { REST_API_BASE_PATH } from '../../lib/Service/RestApi/constants.js'
import { createRestApiRouter } from '../../lib/Service/RestApi/RestApiRouter.js'
import { RestApiTokenStoreMemory } from '../../lib/Service/RestApi/RestApiTokenStore.js'
import type { SurfaceController } from '../../lib/Surface/Controller.js'
import { createSurfacesRestApiRouter, SURFACES_API_BASE_PATH } from '../../lib/Surface/SurfacesRestApi.js'
import { createTestRestApiResources } from '../Service/RestApi/RestApiTestHelpers.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

const mockAppInfo = {
	appVersion: '5.0.0-test',
}

const tokens = {
	read: 'cpn_read',
	write: 'cpn_write',
}

const SURFACES_PATH = `${REST_API_BASE_PATH}${SURFACES_API_BASE_PATH}`

type TestService = {
	app: express.Express
	surfaceController: DeepMockProxy<SurfaceController>
	pageStore: DeepMockProxy<IPageStore>
}

function createService(): TestService {
	const surfaceController = mockDeep<SurfaceController>(mockOptions)
	const pageStore = mockDeep<IPageStore>(mockOptions)

	// Every surface response resolves the page of its group
	surfaceController.devicePageGet.mockReturnValue('page-id-1')
	pageStore.getPageNumber.mockReturnValue(1)
	pageStore.getPageName.mockReturnValue('Main')
	const restApiRouter = createRestApiRouter(
		createTestRestApiResources({
			surfaces: { createRestApiRouter: (logger) => createSurfacesRestApiRouter(logger, surfaceController, pageStore) },
		}),
		new RestApiTokenStoreMemory(),
		mockAppInfo
	)

	const app = express()
	app.use(express.json())
	app.use(REST_API_BASE_PATH, restApiRouter)

	return { app, surfaceController, pageStore }
}

function createSurface(id: string, props: Partial<ClientSurfaceItem>): ClientSurfaceItem {
	return {
		id,
		type: 'Streamdeck XL',
		integrationType: 'elgato-stream-deck',
		name: 'Front of house',
		configFields: [],
		isConnected: true,
		displayName: `Front of house (${id})`,
		location: null,
		locked: false,
		enabled: true,
		canChangeEnabled: true,
		hasFirmwareUpdates: null,
		size: { rows: 4, columns: 8 },
		rotation: null,
		brightness: 80,
		offset: { rows: 0, columns: 0 },
		...props,
	}
}

function createDevicesList(): ClientDevicesListItem[] {
	return [
		{
			id: 'group-1',
			index: 0,
			displayName: 'Group 1',
			isAutoGroup: false,
			surfaces: [createSurface('surface-1', {}), createSurface('surface-2', { brightness: null })],
		},
		{
			id: 'surface-3',
			index: 1,
			displayName: 'Offline surface',
			isAutoGroup: true,
			surfaces: [createSurface('surface-3', { isConnected: false, size: null })],
		},
	]
}

describe('Surfaces REST API', () => {
	describe('GET /surfaces', () => {
		test('returns a flat list of the surfaces of all groups', async () => {
			const service = createService()
			service.surfaceController.getDevicesList.mockReturnValue(createDevicesList())
			// Resolve a different page per group so the per-group resolution is actually verified
			service.surfaceController.devicePageGet.mockImplementation((id) => (id === 'group-1' ? 'page-id-1' : 'page-id-2'))

			const res = await supertest(service.app).get(SURFACES_PATH).set('Authorization', `Bearer ${tokens.read}`).send()

			expect(res.status).toBe(200)
			expect(res.body.meta).toEqual({ total: 3, limit: 3, offset: 0 })
			expect(res.body.data).toEqual([
				{
					id: 'surface-1',
					type: 'Streamdeck XL',
					integrationType: 'elgato-stream-deck',
					name: 'Front of house',
					displayName: 'Front of house (surface-1)',
					isConnected: true,
					size: { rows: 4, columns: 8 },
					brightness: 80,
					page: { id: 'page-id-1', number: 1, name: 'Main' },
					groupId: 'group-1',
				},
				expect.objectContaining({
					id: 'surface-2',
					brightness: null,
					page: { id: 'page-id-1', number: 1, name: 'Main' },
				}),
				expect.objectContaining({
					id: 'surface-3',
					isConnected: false,
					size: null,
					page: { id: 'page-id-2', number: 1, name: 'Main' },
				}),
			])
			expect(service.surfaceController.devicePageGet).toHaveBeenCalledWith('group-1')
		})

		test('returns a null page when the group is not on a page', async () => {
			const service = createService()
			service.surfaceController.getDevicesList.mockReturnValue(createDevicesList())
			service.surfaceController.devicePageGet.mockReturnValue(undefined)

			const res = await supertest(service.app).get(SURFACES_PATH).set('Authorization', `Bearer ${tokens.read}`).send()

			expect(res.status).toBe(200)
			expect(res.body.data[0].page).toBeNull()
		})

		test('returns a null page name when the page is no longer in the page list', async () => {
			const service = createService()
			service.surfaceController.getDevicesList.mockReturnValue(createDevicesList())
			service.pageStore.getPageNumber.mockReturnValue(null)

			const res = await supertest(service.app).get(SURFACES_PATH).set('Authorization', `Bearer ${tokens.read}`).send()

			expect(res.status).toBe(200)
			expect(res.body.data[0].page).toEqual({ id: 'page-id-1', number: null, name: null })
		})

		test('returns 401 without a token', async () => {
			const service = createService()

			const res = await supertest(service.app).get(SURFACES_PATH).send()

			expect(res.status).toBe(401)
			expect(res.body.error.code).toBe('UNAUTHORIZED')
		})
	})

	describe('PATCH /surfaces/:surfaceId', () => {
		test('sets the brightness and returns the updated surface', async () => {
			const service = createService()
			// The response is re-read from getDevicesList, so reflect the change there
			const devices = createDevicesList()
			service.surfaceController.getDevicesList.mockReturnValue(devices)
			service.surfaceController.setDeviceBrightness.mockImplementation((id, brightness) => {
				for (const group of devices) {
					for (const surface of group.surfaces) {
						if (surface.id === id) surface.brightness = brightness
					}
				}
			})

			const res = await supertest(service.app)
				.patch(`${SURFACES_PATH}/surface-1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ brightness: 50 })

			expect(res.status).toBe(200)
			expect(service.surfaceController.setDeviceBrightness).toHaveBeenCalledWith('surface-1', 50)
			expect(res.body.data).toEqual(expect.objectContaining({ id: 'surface-1', brightness: 50 }))
		})

		test('returns 404 for an unknown surface', async () => {
			const service = createService()
			service.surfaceController.getDevicesList.mockReturnValue(createDevicesList())

			const res = await supertest(service.app)
				.patch(`${SURFACES_PATH}/surface-9`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ brightness: 50 })

			expect(res.status).toBe(404)
			expect(res.body.error.code).toBe('NOT_FOUND')
		})

		test('returns 409 for a surface which is not connected', async () => {
			const service = createService()
			service.surfaceController.getDevicesList.mockReturnValue(createDevicesList())

			const res = await supertest(service.app)
				.patch(`${SURFACES_PATH}/surface-3`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ brightness: 50 })

			expect(res.status).toBe(409)
			expect(res.body.error.code).toBe('CONFLICT')
		})

		test.each([
			{ brightness: 101 },
			{ brightness: -1 },
			{ brightness: 50.5 },
			{ brightness: '50' },
			{ brightness: 50, unknown: true },
			{},
		])('returns 400 for the invalid body %j', async (body) => {
			const service = createService()

			const res = await supertest(service.app)
				.patch(`${SURFACES_PATH}/surface-1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send(body)

			expect(res.status).toBe(400)
			expect(res.body.error.code).toBe('BAD_REQUEST')
		})

		test('returns 403 for a read only token', async () => {
			const service = createService()

			const res = await supertest(service.app)
				.patch(`${SURFACES_PATH}/surface-1`)
				.set('Authorization', `Bearer ${tokens.read}`)
				.send({ brightness: 50 })

			expect(res.status).toBe(403)
			expect(res.body.error.code).toBe('FORBIDDEN')
		})
	})
})
