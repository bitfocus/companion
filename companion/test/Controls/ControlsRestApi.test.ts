import express from 'express'
import supertest from 'supertest'
import { describe, expect, test } from 'vitest'
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import { CreateBankControlId } from '../../../shared-lib/lib/ControlId.js'
import { EntityModelType, type SomeEntityModel } from '../../../shared-lib/lib/Model/EntityModel.js'
import {
	SomeButtonGraphicsElementSchema,
	type SomeButtonGraphicsElement,
} from '../../../shared-lib/lib/Model/StyleLayersModel.js'
import { BUTTONS_API_BASE_PATH } from '../../lib/Controls/ButtonsRestApi.js'
import type { SomeControl } from '../../lib/Controls/IControlFragments.js'
import { PAGES_API_BASE_PATH } from '../../lib/Controls/PagesRestApi.js'
import { createControlsRestApiRouter } from '../../lib/Controls/RestApi.js'
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

const BUTTONS_PATH = `${REST_API_BASE_PATH}${BUTTONS_API_BASE_PATH}`
const PAGES_PATH = `${REST_API_BASE_PATH}${PAGES_API_BASE_PATH}`

const CONTROL_ID = CreateBankControlId('button1')
const PAGE_ID = 'page-id-1'
const CONNECTION_ID = 'conn1'

function makeAction(id: string, input: number): SomeEntityModel {
	return {
		type: EntityModelType.Action,
		id,
		connectionId: CONNECTION_ID,
		definitionId: 'program',
		options: { input: { isExpression: false, value: input } },
		upgradeIndex: undefined,
	}
}

/** A layered button kept in memory, as the REST API reads it */
function createFakeButton(editable = true, allowStyleChanges = true) {
	const elements: SomeButtonGraphicsElement[] = [
		SomeButtonGraphicsElementSchema.parse({ type: 'canvas', id: 'canvas' }),
		SomeButtonGraphicsElementSchema.parse({ type: 'text', id: 'text1', text: { isExpression: false, value: 'CAM 1' } }),
	]
	const down: SomeEntityModel[] = [makeAction('action1', 1)]
	const entities = { isEditable: editable }

	const control = {
		controlId: CONTROL_ID,
		type: 'button-layered',
		supportsLayeredStyle: true,
		supportsEntities: true,
		entities,
		supportsOptions: true,
		options: { canModifyStyleInApis: allowStyleChanges },
		toJSON: () => ({
			type: 'button-layered',
			steps: { '0': { action_sets: { down, up: [] }, options: { runWhileHeld: [] } } },
			style: { layers: elements },
		}),
		layeredStyleGetElements: () => elements,
		layeredStyleGetElementById: (id: string) => elements.find((e) => e.id === id),
	}

	return {
		control: control as unknown as SomeControl,
		down,
		elements,
	}
}

type TestService = {
	app: express.Express
	controls: Map<string, SomeControl>
	button: ReturnType<typeof createFakeButton>
	pageStore: DeepMockProxy<IPageStore>
}

function createService(editable = true, allowStyleChanges = true): TestService {
	const button = createFakeButton(editable, allowStyleChanges)
	const controls = new Map<string, SomeControl>([[CONTROL_ID, button.control]])
	const pageStore = mockDeep<IPageStore>(mockOptions)

	pageStore.getLocationOfControlId.mockReturnValue({ pageNumber: 1, row: 0, column: 1 })
	pageStore.getPageId.mockReturnValue(PAGE_ID)
	pageStore.getPageNumber.mockImplementation((id) => (id === PAGE_ID ? 1 : null))
	pageStore.getPageIds.mockReturnValue([PAGE_ID])
	pageStore.getPageName.mockReturnValue('Main')
	pageStore.getPageInfo.mockReturnValue({ id: PAGE_ID, name: 'Main', controls: { 0: { 1: CONTROL_ID } } })

	const restApiRouter = createRestApiRouter(
		createTestRestApiResources({
			controls: {
				createRestApiRouter: () => createControlsRestApiRouter(controls, pageStore),
			},
		}),
		createTestEnabledUserConfig(),
		tokenStore,
		{ appVersion: '5.0.0-test' }
	)

	const app = express()
	app.use(express.json())
	app.use(REST_API_BASE_PATH, restApiRouter)

	return { app, controls, button, pageStore }
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
})

describe('REST API buttons', () => {
	test('gets a button with its style and actions', async () => {
		const { app } = createService()
		const res = await supertest(app).get(`${BUTTONS_PATH}/${CONTROL_ID}`).set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(200)
		const button = res.body.data
		expect(button.id).toBe(CONTROL_ID)
		expect(button.type).toBe('button-layered')
		expect(button.editable).toBe(true)
		expect(button.allowStyleChanges).toBe(true)
		expect(button.location).toEqual({ pageId: PAGE_ID, pageNumber: 1, row: 0, column: 1 })
		expect(button.style.elements.map((e: any) => e.id)).toEqual(['canvas', 'text1'])
		expect(button.style.elements[1].options.text).toEqual({ isExpression: false, value: 'CAM 1' })
		expect(button.style.elements[1].options.pinnedProperties).toBeUndefined()
		expect(button.steps).toEqual([
			{
				id: '0',
				actionSets: [
					{
						id: 'down',
						actions: [
							{
								id: 'action1',
								connectionId: CONNECTION_ID,
								definitionId: 'program',
								enabled: true,
								headline: null,
								options: { input: { isExpression: false, value: 1 } },
								children: null,
							},
						],
					},
					{ id: 'up', actions: [] },
				],
			},
		])
	})

	test('reads an option stored without a value', async () => {
		const { app, button } = createService()
		// An option cleared in the web UI is stored as just { isExpression: false }
		button.down[0].options.input = { isExpression: false } as any
		const res = await supertest(app).get(`${BUTTONS_PATH}/${CONTROL_ID}`).set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(200)
		expect(res.body.data.steps[0].actionSets[0].actions[0].options.input).toEqual({ isExpression: false })
	})

	test('unknown button is 404', async () => {
		const { app } = createService()
		const res = await supertest(app).get(`${BUTTONS_PATH}/bank:nope`).set('Authorization', `Bearer ${tokens.read}`)
		expect(res.status).toBe(404)
	})

	test('reports when the button does not allow style changes', async () => {
		const { app } = createService(true, false)
		const res = await supertest(app).get(`${BUTTONS_PATH}/${CONTROL_ID}`).set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(200)
		expect(res.body.data.allowStyleChanges).toBe(false)
	})

	test('a linked preset is not editable', async () => {
		const { app } = createService(false)
		const res = await supertest(app).get(`${BUTTONS_PATH}/${CONTROL_ID}`).set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(200)
		expect(res.body.data.editable).toBe(false)
	})
})
