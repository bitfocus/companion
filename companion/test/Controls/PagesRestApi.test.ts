import express from 'express'
import supertest from 'supertest'
import { describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { CreateBankControlId, type BankControlId } from '../../../shared-lib/lib/ControlId.js'
import type { ControlLocation } from '../../../shared-lib/lib/Model/Common.js'
import type { SomeControl } from '../../lib/Controls/IControlFragments.js'
import { createPagesRouter, PAGES_API_BASE_PATH } from '../../lib/Controls/PagesRestApi.js'
import type { IPageStore } from '../../lib/Page/Store.js'
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

const { store: tokenStore, mint } = createTestTokenStore()
const tokens = {
	read: mint(['read']),
	write: mint(['read', 'write']),
}

const PAGES_PATH = `${REST_API_BASE_PATH}${PAGES_API_BASE_PATH}`

const CONTROL_ID = CreateBankControlId('button1')
const NEW_CONTROL_ID = CreateBankControlId('button2')
const PAGE_ID = 'page-id-1'

function fakeControl(controlId: string, type: string): SomeControl {
	return { controlId, type } as unknown as SomeControl
}

/** One page with a button at row 0, column 1. Resetting a location changes what the page store reports there */
function createService() {
	const controls = new Map<string, SomeControl>([[CONTROL_ID, fakeControl(CONTROL_ID, 'button-layered')]])
	const placed = new Map<string, BankControlId>([['0/1', CONTROL_ID]])
	const key = (location: ControlLocation) => `${location.row}/${location.column}`

	const pageStore = mockDeep<IPageStore>(mockOptions)
	pageStore.getPageNumber.mockImplementation((id) => (id === PAGE_ID ? 1 : null))
	pageStore.getPageIds.mockReturnValue([PAGE_ID])
	pageStore.getPageName.mockReturnValue('Main')
	pageStore.getPageInfo.mockReturnValue({ id: PAGE_ID, name: 'Main', controls: { 0: { 1: CONTROL_ID } } })
	pageStore.getControlIdAt.mockImplementation((location) => placed.get(key(location)) ?? null)

	const resetControlAt = vi.fn((location: ControlLocation, newType: string | null) => {
		placed.delete(key(location))
		if (!newType) return null
		controls.set(NEW_CONTROL_ID, fakeControl(NEW_CONTROL_ID, newType))
		placed.set(key(location), NEW_CONTROL_ID)
		return NEW_CONTROL_ID
	})
	const userconfig = {
		getKey: () => ({ minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }),
	}

	const restApiRouter = createRestApiRouter(
		createTestRestApiResources({
			controls: {
				createRestApiRouter: () => {
					const router = express.Router()
					router.use(
						PAGES_API_BASE_PATH,
						createPagesRouter({
							controls,
							controlsController: { resetControlAt },
							pageStore,
							userconfig: userconfig as any,
						})
					)
					return router
				},
			},
		}),
		createTestEnabledUserConfig(),
		tokenStore,
		{ appVersion: '5.0.0-test' }
	)

	const app = express()
	app.use(express.json())
	app.use(REST_API_BASE_PATH, restApiRouter)

	return { app, resetControlAt }
}

describe('REST API pages', () => {
	test('lists pages', async () => {
		const { app } = createService()
		const res = await supertest(app).get(PAGES_PATH).set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			data: [{ id: PAGE_ID, number: 1, name: 'Main' }],
			meta: { total: 1, limit: 1, offset: 0 },
		})
	})

	test('gets a page with its buttons', async () => {
		const { app } = createService()
		const res = await supertest(app).get(`${PAGES_PATH}/${PAGE_ID}`).set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toEqual({
			id: PAGE_ID,
			number: 1,
			name: 'Main',
			controls: [{ row: 0, column: 1, controlId: CONTROL_ID, type: 'button-layered' }],
		})
	})

	test('unknown page is 404', async () => {
		const { app } = createService()
		const res = await supertest(app).get(`${PAGES_PATH}/nope`).set('Authorization', `Bearer ${tokens.read}`)
		expect(res.status).toBe(404)
	})

	test('needs a token', async () => {
		const { app } = createService()
		const res = await supertest(app).get(PAGES_PATH)
		expect(res.status).toBe(401)
	})

	test('gets the button at a location', async () => {
		const { app } = createService()
		const res = await supertest(app)
			.get(`${PAGES_PATH}/${PAGE_ID}/controls/0/1`)
			.set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toEqual({ row: 0, column: 1, controlId: CONTROL_ID, type: 'button-layered' })
	})

	test('an empty location is 404', async () => {
		const { app } = createService()
		const res = await supertest(app)
			.get(`${PAGES_PATH}/${PAGE_ID}/controls/1/1`)
			.set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(404)
	})

	test('creates a button the way the web UI resets one', async () => {
		const { app, resetControlAt } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/2/3`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({ type: 'pagenum' })

		expect(res.status).toBe(201)
		expect(res.headers.location).toBe(`${PAGES_PATH}/${PAGE_ID}/controls/2/3`)
		expect(res.body.data).toEqual({ row: 2, column: 3, controlId: NEW_CONTROL_ID, type: 'pagenum' })
		expect(resetControlAt).toHaveBeenCalledWith({ pageNumber: 1, row: 2, column: 3 }, 'pagenum')

		const get = await supertest(app)
			.get(`${PAGES_PATH}/${PAGE_ID}/controls/2/3`)
			.set('Authorization', `Bearer ${tokens.read}`)
		expect(get.body.data.controlId).toBe(NEW_CONTROL_ID)
	})

	test('creates a layered button by default', async () => {
		const { app, resetControlAt } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/2/3`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({})

		expect(res.status).toBe(201)
		expect(resetControlAt).toHaveBeenCalledWith({ pageNumber: 1, row: 2, column: 3 }, 'button-layered')
	})

	test('refuses a location outside the grid', async () => {
		const { app, resetControlAt } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/9/9`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({})

		expect(res.status).toBe(400)
		expect(resetControlAt).not.toHaveBeenCalled()
	})

	test('refuses a button type that can not be created', async () => {
		const { app, resetControlAt } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/0/0`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({ type: 'preset-reference' })

		expect(res.status).toBe(400)
		expect(resetControlAt).not.toHaveBeenCalled()
	})

	test('refuses unknown fields', async () => {
		const { app, resetControlAt } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/0/0`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({ allowStyleChanges: true })

		expect(res.status).toBe(400)
		expect(resetControlAt).not.toHaveBeenCalled()
	})

	test('deletes a button', async () => {
		const { app, resetControlAt } = createService()
		const res = await supertest(app)
			.delete(`${PAGES_PATH}/${PAGE_ID}/controls/0/1`)
			.set('Authorization', `Bearer ${tokens.write}`)

		expect(res.status).toBe(204)
		expect(resetControlAt).toHaveBeenCalledWith({ pageNumber: 1, row: 0, column: 1 }, null)
	})

	test('deleting an empty location is 404', async () => {
		const { app, resetControlAt } = createService()
		const res = await supertest(app)
			.delete(`${PAGES_PATH}/${PAGE_ID}/controls/1/1`)
			.set('Authorization', `Bearer ${tokens.write}`)

		expect(res.status).toBe(404)
		expect(resetControlAt).not.toHaveBeenCalled()
	})

	test('writing needs the write scope', async () => {
		const { app } = createService()
		const res = await supertest(app)
			.delete(`${PAGES_PATH}/${PAGE_ID}/controls/0/1`)
			.set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(403)
	})
})
