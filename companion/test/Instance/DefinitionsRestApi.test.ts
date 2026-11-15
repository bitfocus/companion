import express from 'express'
import supertest from 'supertest'
import { describe, expect, test } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { elementSchemas } from '../../../shared-lib/lib/Graphics/ElementPropertiesSchemas.js'
import type { ClientEntityDefinition } from '../../../shared-lib/lib/Model/EntityDefinitionModel.js'
import type { CompositeElementDefinition, InstanceDefinitions } from '../../lib/Instance/Definitions.js'
import { createDefinitionsRouter, DEFINITIONS_API_BASE_PATH } from '../../lib/Instance/DefinitionsRestApi.js'
import { REST_API_BASE_PATH } from '../../lib/Service/RestApi/constants.js'
import { createRestApiRouter } from '../../lib/Service/RestApi/RestApiRouter.js'
import {
	createTestEnabledUserConfig,
	createTestRestApiResources,
	createTestTokenStore,
} from '../Service/RestApi/RestApiTestHelpers.js'

const { store: tokenStore, mint } = createTestTokenStore()
const readToken = mint(['read'])

const ACTIONS_PATH = `${REST_API_BASE_PATH}${DEFINITIONS_API_BASE_PATH}/actions`
const ELEMENTS_PATH = `${REST_API_BASE_PATH}${DEFINITIONS_API_BASE_PATH}/elements`

function compositeDefinition(id: string, name: string): CompositeElementDefinition {
	return {
		id,
		name,
		sortKey: null,
		description: undefined,
		options: [{ id: 'level', type: 'number', label: 'Level', default: 0, min: 0, max: 100 }],
		elements: [],
	} as unknown as CompositeElementDefinition
}

function definition(label: string, props: Partial<ClientEntityDefinition> = {}): ClientEntityDefinition {
	return {
		label,
		description: undefined,
		options: [{ id: 'input', type: 'number', label: 'Input', default: 1, min: 1, max: 8 }],
		hasLearn: false,
		actionHasResult: undefined,
		...props,
	} as unknown as ClientEntityDefinition
}

function createService() {
	const definitions = mockDeep<InstanceDefinitions>()
	definitions.getAllActionDefinitions.mockReturnValue({
		conn1: {
			program: definition('Set program'),
			broken: definition('Broken', { hiddenFromPicker: true }),
		},
		internal: {
			button_text: definition('Set button text', { hasLearn: true, actionHasResult: true }),
		},
	})
	definitions.getAllCompositeElementDefinitions.mockReturnValue({
		conn2: { meter: compositeDefinition('meter', 'Meter') },
		conn1: {
			tally: compositeDefinition('tally', 'Tally'),
			clock: { ...compositeDefinition('clock', 'Clock'), description: 'Time of day' },
		},
	})

	const restApiRouter = createRestApiRouter(
		createTestRestApiResources({
			instance: {
				createRestApiRouter: () => {
					const router = express.Router()
					router.use(DEFINITIONS_API_BASE_PATH, createDefinitionsRouter(definitions))
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
	return app
}

describe('REST API action definitions', () => {
	test('lists the actions of every connection, without hidden placeholders', async () => {
		const res = await supertest(createService()).get(ACTIONS_PATH).set('Authorization', `Bearer ${readToken}`)

		expect(res.status).toBe(200)
		expect(res.body.meta).toEqual({ total: 2, limit: 2, offset: 0 })
		expect(res.body.data).toEqual([
			{
				connectionId: 'conn1',
				id: 'program',
				label: 'Set program',
				description: null,
				options: [{ id: 'input', type: 'number', label: 'Input', default: 1, min: 1, max: 8 }],
				hasLearn: false,
				hasResult: false,
			},
			{
				connectionId: 'internal',
				id: 'button_text',
				label: 'Set button text',
				description: null,
				options: [{ id: 'input', type: 'number', label: 'Input', default: 1, min: 1, max: 8 }],
				hasLearn: true,
				hasResult: true,
			},
		])
	})

	test('filters by connection', async () => {
		const res = await supertest(createService())
			.get(`${ACTIONS_PATH}?connectionId=internal`)
			.set('Authorization', `Bearer ${readToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data.map((d: any) => d.id)).toEqual(['button_text'])
	})

	test('needs a token', async () => {
		const res = await supertest(createService()).get(ACTIONS_PATH)
		expect(res.status).toBe(401)
	})
})

describe('REST API element definitions', () => {
	test('lists the built-in element types with the fields the web UI edits them with', async () => {
		const res = await supertest(createService()).get(ELEMENTS_PATH).set('Authorization', `Bearer ${readToken}`)

		expect(res.status).toBe(200)
		const builtin = res.body.data.filter((d: any) => d.connectionId === null)
		expect(builtin.map((d: any) => d.type)).toEqual(Object.keys(elementSchemas).filter((t) => t !== 'composite'))

		const text = builtin.find((d: any) => d.type === 'text')
		expect(text).toMatchObject({ type: 'text', connectionId: null, elementId: null, name: 'Text', description: null })
		expect(text.sections).toEqual(JSON.parse(JSON.stringify(elementSchemas.text)))
		expect(builtin.find((d: any) => d.type === 'canvas').name).toBe('Canvas')
	})

	test('lists composite elements per connection, with their options as stored on the element', async () => {
		const res = await supertest(createService()).get(ELEMENTS_PATH).set('Authorization', `Bearer ${readToken}`)

		expect(res.status).toBe(200)
		const composites = res.body.data.filter((d: any) => d.type === 'composite')
		expect(composites.map((d: any) => `${d.connectionId}/${d.elementId}`)).toEqual([
			'conn1/clock',
			'conn1/tally',
			'conn2/meter',
		])
		expect(composites[0]).toMatchObject({ name: 'Clock', description: 'Time of day' })
		expect(composites[2].sections).toEqual([
			...JSON.parse(JSON.stringify(elementSchemas.composite)),
			{
				id: 'properties',
				label: 'Properties',
				fields: [{ id: 'opt:level', type: 'number', label: 'Level', default: 0, min: 0, max: 100 }],
			},
		])
		expect(res.body.meta.total).toBe(res.body.data.length)
	})

	test('needs a token', async () => {
		const res = await supertest(createService()).get(ELEMENTS_PATH)
		expect(res.status).toBe(401)
	})
})
