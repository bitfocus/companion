import express from 'express'
import supertest from 'supertest'
import { describe, expect, test, vi } from 'vitest'
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import { CreateBankControlId } from '../../../shared-lib/lib/ControlId.js'
import type { ClientEntityDefinition } from '../../../shared-lib/lib/Model/EntityDefinitionModel.js'
import { EntityModelType, type SomeEntityModel } from '../../../shared-lib/lib/Model/EntityModel.js'
import {
	SomeButtonGraphicsElementSchema,
	type SomeButtonGraphicsElement,
} from '../../../shared-lib/lib/Model/StyleLayersModel.js'
import { BUTTONS_API_BASE_PATH } from '../../lib/Controls/ButtonsRestApi.js'
import type { SomeControl } from '../../lib/Controls/IControlFragments.js'
import { PAGES_API_BASE_PATH } from '../../lib/Controls/PagesRestApi.js'
import { createControlsRestApiRouter } from '../../lib/Controls/RestApi.js'
import type { CompositeElementDefinition, InstanceDefinitions } from '../../lib/Instance/Definitions.js'
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
const DOWN_PATH = `${BUTTONS_PATH}/${CONTROL_ID}/steps/0/action-sets/down/actions`

const programDefinition = {
	entityType: EntityModelType.Action,
	label: 'Set input on Program',
	description: undefined,
	options: [
		{
			id: 'input',
			type: 'dropdown',
			label: 'Input',
			default: 1,
			choices: [
				{ id: 1, label: 'Camera 1' },
				{ id: 2, label: 'Camera 2' },
			],
		},
		{ id: 'note', type: 'static-text', label: 'Note', value: 'Info' },
		{ id: 'wide', type: 'checkbox', label: 'Wide', default: false },
	],
	hasLearn: false,
	actionHasResult: false,
} as unknown as ClientEntityDefinition

/** Like the built-in "wait": an expression field that allows invalid values */
const waitDefinition = {
	entityType: EntityModelType.Action,
	label: 'Wait',
	description: undefined,
	options: [
		{
			id: 'time',
			type: 'expression',
			label: 'Time expression (ms)',
			default: '1000',
			disableAutoExpression: true,
			allowInvalidValues: true,
		},
	],
	hasLearn: false,
	actionHasResult: false,
} as unknown as ClientEntityDefinition

const conditionDefinition = {
	entityType: EntityModelType.Feedback,
	label: 'Input is on program',
	description: undefined,
	options: [{ id: 'input', type: 'number', label: 'Input', default: 1, min: 1, max: 8 }],
	hasLearn: false,
} as unknown as ClientEntityDefinition

const meterDefinition = {
	id: 'meter',
	name: 'Meter',
	sortKey: null,
	description: undefined,
	options: [{ id: 'level', type: 'number', label: 'Level', default: 0, min: 0, max: 100 }],
	elements: [],
} as unknown as CompositeElementDefinition

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

/** Make an action hold a condition, as the "When True" group of "Logic: If statement" does */
function addCondition(action: SomeEntityModel): void {
	action.children = {
		condition: [
			{
				type: EntityModelType.Feedback,
				id: 'cond1',
				connectionId: CONNECTION_ID,
				definitionId: 'on_program',
				options: { input: { isExpression: false, value: 1 } },
				upgradeIndex: undefined,
			},
		],
	}
}

/**
 * A layered button kept in memory. The mutators change the same model the REST API reads back, so a test can see
 * the effect of a request the way the web UI would.
 */
function createFakeButton(editable = true, allowStyleChanges = true) {
	const elements: SomeButtonGraphicsElement[] = [
		SomeButtonGraphicsElementSchema.parse({ type: 'canvas', id: 'canvas' }),
		SomeButtonGraphicsElementSchema.parse({ type: 'text', id: 'text1', text: { isExpression: false, value: 'CAM 1' } }),
		SomeButtonGraphicsElementSchema.parse({
			type: 'composite',
			id: 'meter1',
			connectionId: CONNECTION_ID,
			elementId: 'meter',
			'opt:level': { isExpression: false, value: 10 },
		}),
	]
	const down: SomeEntityModel[] = [makeAction('action1', 1)]
	const findIn = (list: SomeEntityModel[], id: string): SomeEntityModel | undefined => {
		for (const entity of list) {
			if (entity.id === id) return entity
			for (const children of Object.values(entity.children ?? {})) {
				const found = findIn(children ?? [], id)
				if (found) return found
			}
		}
		return undefined
	}
	const findAction = (id: string) => findIn(down, id)

	const entities = {
		isEditable: editable,
		entityAdd: vi.fn((_listId: unknown, _owner: unknown, ...models: SomeEntityModel[]) => {
			down.push(...models)
			return true
		}),
		entitySetOption: vi.fn((_listId: unknown, id: string, key: string, value: any) => {
			const action = findAction(id)
			if (!action) return false
			action.options[key] = value
			return true
		}),
		entityEnabled: vi.fn((_listId: unknown, id: string, enabled: boolean) => {
			const action = findAction(id)
			if (!action) return false
			action.disabled = !enabled
			return true
		}),
		entityHeadline: vi.fn((_listId: unknown, id: string, headline: string) => {
			const action = findAction(id)
			if (!action) return false
			action.headline = headline
			return true
		}),
		entityReplaceAll: vi.fn((_listId: unknown, models: SomeEntityModel[]) => {
			down.splice(0, down.length, ...models)
			return true
		}),
		entityRemove: vi.fn((_listId: unknown, id: string) => {
			const index = down.findIndex((a) => a.id === id)
			if (index === -1) return false
			down.splice(index, 1)
			return true
		}),
	}

	const control = {
		controlId: CONTROL_ID,
		type: 'button-layered',
		supportsLayeredStyle: true,
		supportsEntities: true,
		entities,
		supportsOptions: true,
		options: { canModifyStyleInApis: allowStyleChanges },
		optionsSetField: vi.fn(),
		toJSON: () => ({
			type: 'button-layered',
			steps: { '0': { action_sets: { down, up: [] }, options: { runWhileHeld: [] } } },
			style: { layers: elements },
		}),
		layeredStyleGetElements: () => elements,
		layeredStyleGetElementById: (id: string) => elements.find((e) => e.id === id),
		layeredStyleUpdateOptions: vi.fn((id: string, values: Record<string, unknown>) => {
			const element = elements.find((e) => e.id === id)
			if (!element) return false
			Object.assign(element, values)
			return true
		}),
	}

	return {
		control: control as unknown as SomeControl,
		updateStyleOptions: control.layeredStyleUpdateOptions,
		optionsSetField: control.optionsSetField,
		entities,
		down,
		elements,
	}
}

type TestService = {
	app: express.Express
	controls: Map<string, SomeControl>
	button: ReturnType<typeof createFakeButton>
	resetControlAt: ReturnType<typeof vi.fn>
	pageStore: DeepMockProxy<IPageStore>
	definitions: DeepMockProxy<InstanceDefinitions>
}

function createService(editable = true, allowStyleChanges = true): TestService {
	const button = createFakeButton(editable, allowStyleChanges)
	const controls = new Map<string, SomeControl>([[CONTROL_ID, button.control]])
	const pageStore = mockDeep<IPageStore>(mockOptions)
	const definitions = mockDeep<InstanceDefinitions>(mockOptions)

	pageStore.getLocationOfControlId.mockReturnValue({ pageNumber: 1, row: 0, column: 1 })
	pageStore.getPageId.mockReturnValue(PAGE_ID)
	pageStore.getPageNumber.mockImplementation((id) => (id === PAGE_ID ? 1 : null))
	pageStore.getPageIds.mockReturnValue([PAGE_ID])
	pageStore.getPageName.mockReturnValue('Main')
	pageStore.getPageInfo.mockReturnValue({ id: PAGE_ID, name: 'Main', controls: { 0: { 1: CONTROL_ID } } })
	pageStore.getControlIdAt.mockImplementation((location) =>
		location.row === 0 && location.column === 1 ? CONTROL_ID : null
	)

	definitions.getEntityDefinition.mockImplementation((type, connectionId, definitionId) => {
		if (connectionId !== CONNECTION_ID) return undefined
		if (type === EntityModelType.Action && definitionId === 'program') return programDefinition
		if (type === EntityModelType.Action && definitionId === 'wait') return waitDefinition
		if (type === EntityModelType.Feedback && definitionId === 'on_program') return conditionDefinition
		return undefined
	})
	definitions.getCompositeElementDefinition.mockImplementation((connectionId, elementId) =>
		connectionId === CONNECTION_ID && elementId === 'meter' ? meterDefinition : undefined
	)
	let created = 0
	definitions.createEntityItem.mockImplementation(() => {
		created++
		return makeAction(created === 1 ? 'new-action' : `new-action-${created}`, 1)
	})

	const resetControlAt = vi.fn((_location: unknown, newType: string | null) => (newType ? CONTROL_ID : null))
	const userconfig = {
		getKey: () => ({ minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }),
	}

	const restApiRouter = createRestApiRouter(
		createTestRestApiResources({
			controls: {
				createRestApiRouter: () =>
					createControlsRestApiRouter(controls, { resetControlAt }, pageStore, definitions, userconfig as any),
			},
		}),
		createTestEnabledUserConfig(),
		tokenStore,
		{ appVersion: '5.0.0-test' }
	)

	const app = express()
	app.use(express.json())
	app.use(REST_API_BASE_PATH, restApiRouter)

	return { app, controls, button, resetControlAt, pageStore, definitions }
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

	test('creates a button the way the web UI resets one', async () => {
		const { app, resetControlAt } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/2/3`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({ type: 'button-layered' })

		expect(res.status).toBe(201)
		expect(res.headers.location).toBe(`${BUTTONS_PATH}/${CONTROL_ID}`)
		expect(res.body.data.id).toBe(CONTROL_ID)
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

	test('turns on style changes for a new button when asked', async () => {
		const { app, button } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/2/3`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({ allowStyleChanges: true })

		expect(res.status).toBe(201)
		expect(button.optionsSetField).toHaveBeenCalledWith({ key: 'canModifyStyleInApis', value: true })
	})

	test('leaves style changes off for a new button by default, as the web UI does', async () => {
		const { app, button } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/2/3`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({})

		expect(res.status).toBe(201)
		expect(button.optionsSetField).not.toHaveBeenCalled()
	})

	test('refuses allowStyleChanges for a button type without a style', async () => {
		const { app, resetControlAt } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/2/3`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({ type: 'pageup', allowStyleChanges: true })

		expect(res.status).toBe(400)
		expect(resetControlAt).not.toHaveBeenCalled()
	})

	test('refuses a button type that can not be created', async () => {
		const { app } = createService()
		const res = await supertest(app)
			.put(`${PAGES_PATH}/${PAGE_ID}/controls/0/0`)
			.set('Authorization', `Bearer ${tokens.write}`)
			.send({ type: 'preset-reference' })

		expect(res.status).toBe(400)
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
		expect(button.style.elements.map((e: any) => e.id)).toEqual(['canvas', 'text1', 'meter1'])
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
								type: 'action',
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

	test('a linked preset is not editable', async () => {
		const { app } = createService(false)
		const res = await supertest(app).get(`${BUTTONS_PATH}/${CONTROL_ID}`).set('Authorization', `Bearer ${tokens.read}`)

		expect(res.status).toBe(200)
		expect(res.body.data.editable).toBe(false)
	})

	describe('style elements', () => {
		test('sets the text of a text element', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/text1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { text: { isExpression: false, value: 'CAM 2' } } })

			expect(res.status).toBe(200)
			expect(res.body.data.options.text).toEqual({ isExpression: false, value: 'CAM 2' })
			expect(button.updateStyleOptions).toHaveBeenCalledWith('text1', {
				text: { isExpression: false, value: 'CAM 2' },
			})
		})

		test('accepts an expression', async () => {
			const { app } = createService()
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/text1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { text: { isExpression: true, value: '$(internal:time_hms)' } } })

			expect(res.status).toBe(200)
		})

		test('refuses a value of the wrong type', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/text1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { text: { isExpression: false, value: 42 } } })

			expect(res.status).toBe(422)
			expect(res.body.error.details).toEqual({ 'options.text': 'Invalid value for "text"' })
			expect(button.updateStyleOptions).not.toHaveBeenCalled()
		})

		test('refuses unknown and structural properties', async () => {
			const { app } = createService()
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/text1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({
					options: {
						nope: { isExpression: false, value: 1 },
						type: { isExpression: false, value: 'box' },
					},
				})

			expect(res.status).toBe(422)
			expect(Object.keys(res.body.error.details).sort()).toEqual(['options.nope', 'options.type'])
		})

		test('unknown element is 404', async () => {
			const { app } = createService()
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/nope`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { text: { isExpression: false, value: 'X' } } })

			expect(res.status).toBe(404)
		})

		test('a button that does not allow style changes is 409', async () => {
			const { app, button } = createService(true, false)
			const get = await supertest(app)
				.get(`${BUTTONS_PATH}/${CONTROL_ID}`)
				.set('Authorization', `Bearer ${tokens.read}`)
			expect(get.body.data.allowStyleChanges).toBe(false)

			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/text1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { text: { isExpression: false, value: 'X' } } })

			expect(res.status).toBe(409)
			expect(res.body.error.message).toBe('Style changes from APIs are not allowed for this button')
			expect(button.updateStyleOptions).not.toHaveBeenCalled()
		})

		test('refuses a style expression that does not parse', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/text1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { text: { isExpression: true, value: '(' } } })

			expect(res.status).toBe(422)
			expect(res.body.error.details).toEqual({ 'options.text': 'Property "text" is not a valid expression' })
			expect(button.updateStyleOptions).not.toHaveBeenCalled()
		})

		test('changes an option of a composite element', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/meter1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { 'opt:level': { isExpression: false, value: 50 }, x: { isExpression: false, value: 10 } } })

			expect(res.status).toBe(200)
			expect(button.updateStyleOptions).toHaveBeenCalledWith('meter1', {
				'opt:level': { isExpression: false, value: 50 },
				x: { isExpression: false, value: 10 },
			})
		})

		test('checks composite options against the composite definition', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/meter1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({
					options: {
						'opt:level': { isExpression: false, value: 500 },
						'opt:nope': { isExpression: false, value: 1 },
						nope: { isExpression: false, value: 1 },
					},
				})

			expect(res.status).toBe(422)
			expect(Object.keys(res.body.error.details).sort()).toEqual([
				'options.nope',
				'options.opt:level',
				'options.opt:nope',
			])
			expect(button.updateStyleOptions).not.toHaveBeenCalled()
		})

		test('a composite whose definition is not loaded is 409', async () => {
			const { app, button, definitions } = createService()
			definitions.getCompositeElementDefinition.mockReturnValue(undefined)
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/meter1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { 'opt:level': { isExpression: false, value: 50 } } })

			expect(res.status).toBe(409)
			expect(button.updateStyleOptions).not.toHaveBeenCalled()
		})

		test('a read-only button is 409', async () => {
			const { app } = createService(false)
			const res = await supertest(app)
				.patch(`${BUTTONS_PATH}/${CONTROL_ID}/style/elements/text1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { text: { isExpression: false, value: 'X' } } })

			expect(res.status).toBe(409)
		})
	})

	describe('actions', () => {
		test('adds an action with options', async () => {
			const { app, button, definitions } = createService()
			const res = await supertest(app)
				.post(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({
					connectionId: CONNECTION_ID,
					definitionId: 'program',
					options: { input: { isExpression: false, value: 2 } },
				})

			expect(res.status).toBe(201)
			expect(res.headers.location).toBe(`${DOWN_PATH}/new-action`)
			expect(res.body.data).toMatchObject({
				id: 'new-action',
				definitionId: 'program',
				options: { input: { isExpression: false, value: 2 } },
			})
			expect(definitions.createEntityItem).toHaveBeenCalledWith(
				CONNECTION_ID,
				EntityModelType.Action,
				'program',
				'bank',
				null
			)
			expect(button.entities.entityAdd).toHaveBeenCalledWith(
				{ stepId: '0', setId: 'down' },
				null,
				expect.objectContaining({ id: 'new-action' })
			)
			expect(button.down.map((a) => a.id)).toEqual(['action1', 'new-action'])
		})

		test('refuses an unknown action', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.post(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ connectionId: CONNECTION_ID, definitionId: 'nope' })

			expect(res.status).toBe(422)
			expect(button.entities.entityAdd).not.toHaveBeenCalled()
		})

		test('refuses invalid option values without adding anything', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.post(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({
					connectionId: CONNECTION_ID,
					definitionId: 'program',
					options: {
						input: { isExpression: false, value: 99 },
						note: { isExpression: false, value: 'x' },
						nope: { isExpression: false, value: 1 },
					},
				})

			expect(res.status).toBe(422)
			expect(Object.keys(res.body.error.details).sort()).toEqual(['options.input', 'options.nope', 'options.note'])
			expect(button.entities.entityAdd).not.toHaveBeenCalled()
		})

		test('unknown action set is 404', async () => {
			const { app } = createService()
			const res = await supertest(app)
				.post(`${BUTTONS_PATH}/${CONTROL_ID}/steps/0/action-sets/rotate_left/actions`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ connectionId: CONNECTION_ID, definitionId: 'program' })

			expect(res.status).toBe(404)
		})

		test('updates options, enabled and headline', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.patch(`${DOWN_PATH}/action1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { input: { isExpression: false, value: 2 } }, enabled: false, headline: 'Wide' })

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({
				id: 'action1',
				enabled: false,
				headline: 'Wide',
				options: { input: { isExpression: false, value: 2 } },
			})
			expect(button.entities.entitySetOption).toHaveBeenCalledWith({ stepId: '0', setId: 'down' }, 'action1', 'input', {
				isExpression: false,
				value: 2,
			})
		})

		test('an invalid option changes nothing', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.patch(`${DOWN_PATH}/action1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { input: { isExpression: false, value: 99 } }, enabled: false })

			expect(res.status).toBe(422)
			expect(button.entities.entitySetOption).not.toHaveBeenCalled()
			expect(button.entities.entityEnabled).not.toHaveBeenCalled()
		})

		test('refuses a value that would be coerced to another type', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.patch(`${DOWN_PATH}/action1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { wide: { isExpression: false, value: 'yes' } } })

			expect(res.status).toBe(422)
			expect(res.body.error.details).toEqual({ 'options.wide': 'Invalid value for "wide": expected true' })
			expect(button.entities.entitySetOption).not.toHaveBeenCalled()
		})

		test('accepts an expression for an option', async () => {
			const { app } = createService()
			const res = await supertest(app)
				.patch(`${DOWN_PATH}/action1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { wide: { isExpression: true, value: '$(internal:time_s) > 30' } } })

			expect(res.status).toBe(200)
		})

		test('an empty update is refused', async () => {
			const { app } = createService()
			const res = await supertest(app)
				.patch(`${DOWN_PATH}/action1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({})

			expect(res.status).toBe(400)
		})

		test('adds an action that is disabled and has a headline', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.post(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ connectionId: CONNECTION_ID, definitionId: 'program', enabled: false, headline: 'Wide' })

			expect(res.status).toBe(201)
			expect(res.body.data).toMatchObject({ enabled: false, headline: 'Wide' })
			expect(button.down[1]).toMatchObject({ disabled: true, headline: 'Wide' })
		})

		test('replaces every action of a set in one change', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.put(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({
					actions: [
						{
							connectionId: CONNECTION_ID,
							definitionId: 'program',
							options: { input: { isExpression: false, value: 2 } },
						},
						{ connectionId: CONNECTION_ID, definitionId: 'program', enabled: false, headline: 'Second' },
					],
				})

			expect(res.status).toBe(200)
			expect(button.entities.entityReplaceAll).toHaveBeenCalledTimes(1)
			expect(button.entities.entityReplaceAll).toHaveBeenCalledWith({ stepId: '0', setId: 'down' }, expect.any(Array))
			expect(button.entities.entityRemove).not.toHaveBeenCalled()
			expect(button.entities.entityAdd).not.toHaveBeenCalled()
			expect(res.body.data).toEqual([
				{
					id: 'new-action',
					type: 'action',
					connectionId: CONNECTION_ID,
					definitionId: 'program',
					enabled: true,
					headline: null,
					options: { input: { isExpression: false, value: 2 } },
					children: null,
				},
				{
					id: 'new-action-2',
					type: 'action',
					connectionId: CONNECTION_ID,
					definitionId: 'program',
					enabled: false,
					headline: 'Second',
					options: { input: { isExpression: false, value: 1 } },
					children: null,
				},
			])
			expect(button.down.map((a) => a.id)).toEqual(['new-action', 'new-action-2'])
		})

		test('one invalid action in a replace changes nothing', async () => {
			const { app, button, definitions } = createService()
			const res = await supertest(app)
				.put(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({
					actions: [
						{ connectionId: CONNECTION_ID, definitionId: 'program' },
						{
							connectionId: CONNECTION_ID,
							definitionId: 'program',
							options: { input: { isExpression: false, value: 99 } },
						},
						{ connectionId: CONNECTION_ID, definitionId: 'nope' },
					],
				})

			expect(res.status).toBe(422)
			expect(Object.keys(res.body.error.details).sort()).toEqual(['actions.1.options.input', 'actions.2.definitionId'])
			expect(definitions.createEntityItem).not.toHaveBeenCalled()
			expect(button.entities.entityReplaceAll).not.toHaveBeenCalled()
			expect(button.down.map((a) => a.id)).toEqual(['action1'])
		})

		test('replacing with an empty list removes every action', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.put(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ actions: [] })

			expect(res.status).toBe(200)
			expect(res.body.data).toEqual([])
			expect(button.down).toEqual([])
		})

		test('replacing on a read-only button is 409', async () => {
			const { app, button } = createService(false)
			const res = await supertest(app)
				.put(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ actions: [] })

			expect(res.status).toBe(409)
			expect(button.entities.entityReplaceAll).not.toHaveBeenCalled()
		})

		test('reads a condition inside an action as a feedback', async () => {
			const { app, button } = createService()
			addCondition(button.down[0])
			const res = await supertest(app)
				.get(`${BUTTONS_PATH}/${CONTROL_ID}`)
				.set('Authorization', `Bearer ${tokens.read}`)

			expect(res.status).toBe(200)
			const action = res.body.data.steps[0].actionSets[0].actions[0]
			expect(action.type).toBe('action')
			expect(action.children.condition[0]).toMatchObject({ id: 'cond1', type: 'feedback', definitionId: 'on_program' })
		})

		test('changes an option of a condition, checked against its feedback definition', async () => {
			const { app, button, definitions } = createService()
			addCondition(button.down[0])
			const res = await supertest(app)
				.patch(`${DOWN_PATH}/cond1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { input: { isExpression: false, value: 3 } } })

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ id: 'cond1', type: 'feedback', options: { input: { value: 3 } } })
			expect(definitions.getEntityDefinition).toHaveBeenCalledWith(
				EntityModelType.Feedback,
				CONNECTION_ID,
				'on_program'
			)
			expect(button.entities.entitySetOption).toHaveBeenCalledWith({ stepId: '0', setId: 'down' }, 'cond1', 'input', {
				isExpression: false,
				value: 3,
			})
		})

		test('refuses an invalid option of a condition', async () => {
			const { app, button } = createService()
			addCondition(button.down[0])
			const res = await supertest(app)
				.patch(`${DOWN_PATH}/cond1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { input: { isExpression: false, value: 99 } } })

			expect(res.status).toBe(422)
			expect(button.entities.entitySetOption).not.toHaveBeenCalled()
		})

		test('refuses an expression that does not parse', async () => {
			const { app, button } = createService()
			const res = await supertest(app)
				.patch(`${DOWN_PATH}/action1`)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({ options: { wide: { isExpression: true, value: '(' } } })

			expect(res.status).toBe(422)
			expect(res.body.error.details).toEqual({ 'options.wide': 'Option "wide" is not a valid expression' })
			expect(button.entities.entitySetOption).not.toHaveBeenCalled()
		})

		test('parses an expression field even when it allows invalid values', async () => {
			const { app, button } = createService()
			const bad = await supertest(app)
				.post(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({
					connectionId: CONNECTION_ID,
					definitionId: 'wait',
					options: { time: { isExpression: false, value: '(' } },
				})

			expect(bad.status).toBe(422)
			expect(bad.body.error.details).toEqual({ 'options.time': 'Option "time" is not a valid expression' })
			expect(button.entities.entityAdd).not.toHaveBeenCalled()

			const good = await supertest(app)
				.post(DOWN_PATH)
				.set('Authorization', `Bearer ${tokens.write}`)
				.send({
					connectionId: CONNECTION_ID,
					definitionId: 'wait',
					options: { time: { isExpression: false, value: '$(internal:time_s) * 1000' } },
				})
			expect(good.status).toBe(201)
		})

		test('removes an action', async () => {
			const { app, button } = createService()
			const res = await supertest(app).delete(`${DOWN_PATH}/action1`).set('Authorization', `Bearer ${tokens.write}`)

			expect(res.status).toBe(204)
			expect(button.down).toEqual([])
		})

		test('removing an unknown action is 404', async () => {
			const { app, button } = createService()
			const res = await supertest(app).delete(`${DOWN_PATH}/nope`).set('Authorization', `Bearer ${tokens.write}`)

			expect(res.status).toBe(404)
			expect(button.entities.entityRemove).not.toHaveBeenCalled()
		})

		test('a read-only button is 409', async () => {
			const { app } = createService(false)
			const res = await supertest(app).delete(`${DOWN_PATH}/action1`).set('Authorization', `Bearer ${tokens.write}`)

			expect(res.status).toBe(409)
		})
	})
})
