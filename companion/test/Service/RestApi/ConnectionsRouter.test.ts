import express from 'express'
import Express from 'express'
import supertest from 'supertest'
import { describe, expect, test } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { ClientConnectionConfig } from '../../../../shared-lib/lib/Model/Connections.js'
import {
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
	type InstanceConfig,
} from '../../../../shared-lib/lib/Model/Instance.js'
import type { InstanceController } from '../../../lib/Instance/Controller.js'
import { createRestApiRouter } from '../../../lib/Service/RestApi/RestApiRouter.js'
import { RestApiTokenStoreMemory } from '../../../lib/Service/RestApi/RestApiTokenStore.js'
import { ConnectionCreateBodySchema } from '../../../lib/Service/RestApi/schemas/connections.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('REST API v1 — Connections', () => {
	function createService() {
		const instanceController = mockDeep<InstanceController>(mockOptions)

		const tokenStore = new RestApiTokenStoreMemory()

		// Use the static dev tokens for testing
		const validToken = 'cpn_admin'
		const readOnlyToken = 'cpn_read'
		const writeToken = 'cpn_write'
		const secretsToken = 'cpn_secrets'

		const restApiRouter = createRestApiRouter(instanceController, tokenStore)

		const app = express()
		app.use(Express.json())
		app.use('/api', restApiRouter)

		return {
			app,
			instanceController,
			tokenStore,
			validToken,
			readOnlyToken,
			writeToken,
			secretsToken,
		}
	}

	function createConnectionConfigs(): Record<string, ClientConnectionConfig> {
		return {
			'conn-1': {
				id: 'conn-1',
				label: 'My OBS',
				moduleId: 'obs-websocket',
				enabled: true,
				sortOrder: 0,
				moduleType: ModuleInstanceType.Connection,
				moduleVersionId: null,
				updatePolicy: InstanceVersionUpdatePolicy.Stable,
				hasRecordActionsHandler: false,
				collectionId: null,
			},
			'conn-2': {
				id: 'conn-2',
				label: 'My ATEM',
				moduleId: 'bmd-atem',
				enabled: false,
				sortOrder: 1,
				moduleType: ModuleInstanceType.Connection,
				moduleVersionId: 'v1.2.0',
				updatePolicy: InstanceVersionUpdatePolicy.Manual,
				hasRecordActionsHandler: true,
				collectionId: 'group-a',
			},
		}
	}

	function createInstanceConfigs(): Record<string, InstanceConfig> {
		return {
			'conn-1': {
				moduleInstanceType: ModuleInstanceType.Connection,
				moduleId: 'obs-websocket',
				moduleVersionId: null,
				label: 'My OBS',
				config: { host: 'localhost', port: 4455 },
				secrets: { password: 'secret123' },
				isFirstInit: false,
				lastUpgradeIndex: 0,
				enabled: true,
				sortOrder: 0,
				updatePolicy: InstanceVersionUpdatePolicy.Stable,
			},
			'conn-2': {
				moduleInstanceType: ModuleInstanceType.Connection,
				moduleId: 'bmd-atem',
				moduleVersionId: 'v1.2.0',
				label: 'My ATEM',
				config: { ip: '192.168.1.100' },
				secrets: undefined,
				isFirstInit: false,
				lastUpgradeIndex: 0,
				enabled: false,
				sortOrder: 1,
				updatePolicy: InstanceVersionUpdatePolicy.Manual,
				collectionId: 'group-a',
			},
		}
	}

	const mockStatus = { category: 'good', level: 'ok', message: 'Connected' }

	describe('authentication', () => {
		test('falls through for non-REST API routes', async () => {
			const { app } = createService()

			app.use('/api', (_req, res) => {
				res.status(204).send()
			})

			const res = await supertest(app).get('/api/get_userconfig_all').send()
			expect(res.status).toBe(204)
		})

		test('returns 401 without Authorization header', async () => {
			const { app } = createService()

			const res = await supertest(app).get('/api/connections/v1').send()
			expect(res.status).toBe(401)
			expect(res.body.error.code).toBe('UNAUTHORIZED')
		})

		test('returns 401 with invalid token', async () => {
			const { app } = createService()

			const res = await supertest(app)
				.get('/api/connections/v1')
				.set('Authorization', 'Bearer cpn_invalid_token')
				.send()
			expect(res.status).toBe(401)
			expect(res.body.error.code).toBe('UNAUTHORIZED')
		})

		test('returns 401 with malformed Authorization header', async () => {
			const { app } = createService()

			const res = await supertest(app).get('/api/connections/v1').set('Authorization', 'Basic abc123').send()
			expect(res.status).toBe(401)
		})
	})

	describe('scope enforcement', () => {
		test('read-only token can access GET endpoints', async () => {
			const { app, instanceController, readOnlyToken } = createService()
			instanceController.getConnectionClientJson.mockReturnValue({})

			const res = await supertest(app).get('/api/connections/v1').set('Authorization', `Bearer ${readOnlyToken}`).send()
			expect(res.status).toBe(200)
		})

		test('read-only token gets 403 on write endpoints', async () => {
			const { app, readOnlyToken } = createService()

			const res = await supertest(app)
				.post('/api/connections/v1')
				.set('Authorization', `Bearer ${readOnlyToken}`)
				.send({ moduleId: 'obs', label: 'test' })
			expect(res.status).toBe(403)
			expect(res.body.error.code).toBe('FORBIDDEN')
		})

		test('read-only token gets 403 on execute endpoints', async () => {
			const { app, readOnlyToken } = createService()

			const res = await supertest(app)
				.post('/api/connections/v1/conn-1/restart')
				.set('Authorization', `Bearer ${readOnlyToken}`)
				.send()
			expect(res.status).toBe(403)
		})

		test('write token gets 403 when patching secrets', async () => {
			const { app, instanceController, writeToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${writeToken}`)
				.send({ secrets: { password: 'new' } })
			expect(res.status).toBe(403)
			expect(res.body.error.code).toBe('FORBIDDEN')
		})

		test('write token gets 403 when requesting include_secrets', async () => {
			const { app, instanceController, writeToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())

			const res = await supertest(app)
				.get('/api/connections/v1?include_config=true&include_secrets=true')
				.set('Authorization', `Bearer ${writeToken}`)
				.send()
			expect(res.status).toBe(403)
		})

		test('secrets token can patch secrets', async () => {
			const { app, instanceController, secretsToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())

			const mockInstance = {
				requestConfigFields: async () => [{ id: 'password', type: 'secret-text' as const, label: 'Password' }],
			}
			instanceController.processManager.getConnectionChild.mockReturnValue(mockInstance as any)
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })

			const updatedConfigs = createConnectionConfigs()
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(undefined)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-1'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${secretsToken}`)
				.send({ secrets: { password: 'new' } })
			expect(res.status).toBe(200)
		})
	})

	describe('GET /connections', () => {
		test('returns paginated list of connections without config by default', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.getInstanceStatus.mockImplementation((id: string) => {
				if (id === 'conn-1') return mockStatus
				return undefined
			})

			const res = await supertest(app).get('/api/connections/v1').set('Authorization', `Bearer ${validToken}`).send()

			expect(res.status).toBe(200)
			expect(res.body.data).toHaveLength(2)
			expect(res.body.meta).toEqual({ total: 2, limit: 2, offset: 0 })

			expect(res.body.data[0]).toEqual({
				id: 'conn-1',
				label: 'My OBS',
				moduleId: 'obs-websocket',
				moduleVersionId: null,
				updatePolicy: 'stable',
				enabled: true,
				sortOrder: 0,
				collectionId: null,
				status: mockStatus,
			})

			// Config and secrets not included by default
			expect(res.body.data[0]).not.toHaveProperty('config')
			expect(res.body.data[0]).not.toHaveProperty('secrets')
		})

		test('includes config when include_config=true', async () => {
			const { app, instanceController, validToken } = createService()

			const instanceConfigs = createInstanceConfigs()
			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.getInstanceStatus.mockReturnValue(undefined)
			instanceController.getInstanceConfigOfType.mockImplementation((id: string) => instanceConfigs[id])

			const res = await supertest(app)
				.get('/api/connections/v1?include_config=true')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(200)
			expect(res.body.data[0].config).toEqual({ host: 'localhost', port: 4455 })
			expect(res.body.data[0]).not.toHaveProperty('secrets')
		})

		test('includes secrets when include_config=true&include_secrets=true', async () => {
			const { app, instanceController, validToken } = createService()

			const instanceConfigs = createInstanceConfigs()
			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.getInstanceStatus.mockReturnValue(undefined)
			instanceController.getInstanceConfigOfType.mockImplementation((id: string) => instanceConfigs[id])

			const res = await supertest(app)
				.get('/api/connections/v1?include_config=true&include_secrets=true')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(200)
			expect(res.body.data[0].config).toEqual({ host: 'localhost', port: 4455 })
			expect(res.body.data[0].secrets).toEqual({ password: 'secret123' })
		})

		test('returns empty array when no connections', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue({})

			const res = await supertest(app).get('/api/connections/v1').set('Authorization', `Bearer ${validToken}`).send()

			expect(res.status).toBe(200)
			expect(res.body.data).toEqual([])
			expect(res.body.meta).toEqual({ total: 0, limit: 0, offset: 0 })
		})

		test('strips extra fields from response via Zod (e.g. hasRecordActionsHandler)', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.getInstanceStatus.mockReturnValue(undefined)

			const res = await supertest(app).get('/api/connections/v1').set('Authorization', `Bearer ${validToken}`).send()

			expect(res.status).toBe(200)
			// hasRecordActionsHandler and moduleType should NOT appear in response
			for (const conn of res.body.data) {
				expect(conn).not.toHaveProperty('hasRecordActionsHandler')
				expect(conn).not.toHaveProperty('moduleType')
			}
		})
	})

	describe('GET /connections/:connectionId', () => {
		test('returns a single connection with config', async () => {
			const { app, instanceController, validToken } = createService()

			const instanceConfigs = createInstanceConfigs()
			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.getInstanceStatus.mockReturnValue(mockStatus)
			instanceController.getInstanceConfigOfType.mockReturnValue(instanceConfigs['conn-1'])

			const res = await supertest(app)
				.get('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(200)
			expect(res.body.data).toEqual({
				id: 'conn-1',
				label: 'My OBS',
				moduleId: 'obs-websocket',
				moduleVersionId: null,
				updatePolicy: 'stable',
				enabled: true,
				sortOrder: 0,
				collectionId: null,
				status: mockStatus,
				config: { host: 'localhost', port: 4455 },
			})
			// Secrets not included by default
			expect(res.body.data).not.toHaveProperty('secrets')
		})

		test('returns 404 for unknown connection', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())

			const res = await supertest(app)
				.get('/api/connections/v1/unknown-id')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(404)
			expect(res.body.error.code).toBe('NOT_FOUND')
		})
	})

	describe('POST /connections', () => {
		test('defaults disabled to false', () => {
			const parsed = ConnectionCreateBodySchema.parse({
				moduleId: 'obs-websocket',
				label: 'New OBS',
			})

			expect(parsed.disabled).toBe(false)
			expect(parsed.updatePolicy).toBe(InstanceVersionUpdatePolicy.Stable)
			expect(parsed.versionId).toBeNull()
		})

		test('creates a new connection', async () => {
			const { app, instanceController, validToken } = createService()

			const newConfig: InstanceConfig = {
				moduleInstanceType: ModuleInstanceType.Connection,
				moduleId: 'obs-websocket',
				moduleVersionId: 'v2.0.0',
				label: 'New OBS',
				config: {},
				secrets: undefined,
				isFirstInit: true,
				lastUpgradeIndex: 0,
				enabled: true,
				sortOrder: 2,
				updatePolicy: InstanceVersionUpdatePolicy.Stable,
			}

			instanceController.modules.hasModule.mockReturnValue(true)
			instanceController.modules.getModuleManifest.mockReturnValue({} as any)
			instanceController.addConnectionWithLabel.mockReturnValue(['new-id', newConfig])
			instanceController.getInstanceConfigOfType.mockReturnValue(newConfig)
			instanceController.getConnectionClientJson.mockReturnValue({
				'new-id': {
					id: 'new-id',
					label: 'New OBS',
					moduleId: 'obs-websocket',
					moduleVersionId: 'v2.0.0',
					updatePolicy: InstanceVersionUpdatePolicy.Stable,
					enabled: true,
					sortOrder: 2,
					moduleType: ModuleInstanceType.Connection,
					hasRecordActionsHandler: false,
					collectionId: null,
				},
			})
			instanceController.getInstanceStatus.mockReturnValue(undefined)

			const res = await supertest(app).post('/api/connections/v1').set('Authorization', `Bearer ${validToken}`).send({
				moduleId: 'obs-websocket',
				label: 'New OBS',
				versionId: 'v2.0.0',
				updatePolicy: InstanceVersionUpdatePolicy.Manual,
			})

			expect(res.status).toBe(201)
			expect(res.headers.location).toBe('/api/connections/v1/new-id')
			expect(res.body.data.id).toBe('new-id')
			expect(res.body.data.label).toBe('New OBS')
			expect(res.body.data.moduleId).toBe('obs-websocket')
			expect(res.body.data.config).toEqual({})
			expect(res.body.data).not.toHaveProperty('hasRecordActionsHandler')

			expect(instanceController.addConnectionWithLabel).toHaveBeenCalledTimes(1)
			expect(instanceController.addConnectionWithLabel).toHaveBeenCalledWith({ type: 'obs-websocket' }, 'New OBS', {
				versionId: 'v2.0.0',
				updatePolicy: InstanceVersionUpdatePolicy.Manual,
				disabled: false,
			})
		})

		test('creates a connection for a store-known module that is not installed', async () => {
			const { app, instanceController, validToken } = createService()

			const newConfig: InstanceConfig = {
				moduleInstanceType: ModuleInstanceType.Connection,
				moduleId: 'bmd-atem',
				moduleVersionId: null,
				label: 'New ATEM',
				config: {},
				secrets: undefined,
				isFirstInit: true,
				lastUpgradeIndex: 0,
				enabled: true,
				sortOrder: 2,
				updatePolicy: InstanceVersionUpdatePolicy.Stable,
			}

			instanceController.modules.hasModule.mockReturnValue(false)
			instanceController.modulesStore.fetchModuleVersionInfo.mockResolvedValue({
				id: '1.0.0',
				releaseChannel: 'stable',
				releasedAt: 0,
				tarUrl: 'https://example.com/bmd-atem.tgz',
				tarSha: 'sha',
				deprecationReason: null,
				apiVersion: '1.12.0',
				helpUrl: null,
			})
			instanceController.addConnectionWithLabel.mockReturnValue(['new-id', newConfig])
			instanceController.getInstanceConfigOfType.mockReturnValue(newConfig)
			instanceController.getConnectionClientJson.mockReturnValue({
				'new-id': {
					id: 'new-id',
					label: 'New ATEM',
					moduleId: 'bmd-atem',
					moduleVersionId: null,
					updatePolicy: InstanceVersionUpdatePolicy.Stable,
					enabled: true,
					sortOrder: 2,
					moduleType: ModuleInstanceType.Connection,
					hasRecordActionsHandler: false,
					collectionId: null,
				},
			})
			instanceController.getInstanceStatus.mockReturnValue(undefined)

			const res = await supertest(app).post('/api/connections/v1').set('Authorization', `Bearer ${validToken}`).send({
				moduleId: 'bmd-atem',
				label: 'New ATEM',
			})

			expect(res.status).toBe(201)
			expect(instanceController.modulesStore.fetchModuleVersionInfo).toHaveBeenCalledWith(
				ModuleInstanceType.Connection,
				'bmd-atem',
				null,
				true
			)
			expect(instanceController.addConnectionWithLabel).toHaveBeenCalledWith({ type: 'bmd-atem' }, 'New ATEM', {
				versionId: null,
				updatePolicy: InstanceVersionUpdatePolicy.Stable,
				disabled: false,
			})
		})

		test('creates a disabled connection', async () => {
			const { app, instanceController, validToken } = createService()

			const newConfig: InstanceConfig = {
				moduleInstanceType: ModuleInstanceType.Connection,
				moduleId: 'obs-websocket',
				moduleVersionId: null,
				label: 'New OBS',
				config: {},
				secrets: undefined,
				isFirstInit: true,
				lastUpgradeIndex: 0,
				enabled: false,
				sortOrder: 2,
				updatePolicy: InstanceVersionUpdatePolicy.Stable,
			}

			instanceController.modules.hasModule.mockReturnValue(true)
			instanceController.addConnectionWithLabel.mockReturnValue(['new-id', newConfig])
			instanceController.getInstanceConfigOfType.mockReturnValue(newConfig)
			instanceController.getConnectionClientJson.mockReturnValue({
				'new-id': {
					id: 'new-id',
					label: 'New OBS',
					moduleId: 'obs-websocket',
					moduleVersionId: null,
					updatePolicy: InstanceVersionUpdatePolicy.Stable,
					enabled: false,
					sortOrder: 2,
					moduleType: ModuleInstanceType.Connection,
					hasRecordActionsHandler: false,
					collectionId: null,
				},
			})
			instanceController.getInstanceStatus.mockReturnValue(undefined)

			const res = await supertest(app).post('/api/connections/v1').set('Authorization', `Bearer ${validToken}`).send({
				moduleId: 'obs-websocket',
				label: 'New OBS',
				disabled: true,
			})

			expect(res.status).toBe(201)
			expect(res.body.data.enabled).toBe(false)
			expect(instanceController.addConnectionWithLabel).toHaveBeenCalledWith({ type: 'obs-websocket' }, 'New OBS', {
				versionId: null,
				updatePolicy: InstanceVersionUpdatePolicy.Stable,
				disabled: true,
			})
		})

		test('returns 400 for invalid body', async () => {
			const { app, validToken } = createService()

			const res = await supertest(app)
				.post('/api/connections/v1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ invalid: true })

			expect(res.status).toBe(400)
			expect(res.body.error.code).toBe('BAD_REQUEST')
		})

		test('returns 400 for unknown module id', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.modules.hasModule.mockReturnValue(false)
			instanceController.modulesStore.fetchModuleVersionInfo.mockResolvedValue(null)

			const res = await supertest(app).post('/api/connections/v1').set('Authorization', `Bearer ${validToken}`).send({
				moduleId: 'nonexistent',
				label: 'test',
			})

			expect(res.status).toBe(400)
			expect(res.body.error.code).toBe('BAD_REQUEST')
			expect(res.body.error.message).toContain('nonexistent')
			expect(instanceController.addConnectionWithLabel).not.toHaveBeenCalled()
		})

		test('returns 400 for unknown version id', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.modules.hasModule.mockReturnValue(true)
			instanceController.modules.getModuleManifest.mockReturnValue(undefined)

			const res = await supertest(app).post('/api/connections/v1').set('Authorization', `Bearer ${validToken}`).send({
				moduleId: 'obs-websocket',
				label: 'test',
				versionId: 'v99.0.0',
			})

			expect(res.status).toBe(400)
			expect(res.body.error.code).toBe('BAD_REQUEST')
			expect(res.body.error.message).toContain('v99.0.0')
			expect(instanceController.addConnectionWithLabel).not.toHaveBeenCalled()
		})

		test('returns 400 when addConnectionWithLabel throws', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.modules.hasModule.mockReturnValue(true)
			instanceController.addConnectionWithLabel.mockImplementation(() => {
				throw new Error('Label already in use')
			})

			const res = await supertest(app).post('/api/connections/v1').set('Authorization', `Bearer ${validToken}`).send({
				moduleId: 'obs-websocket',
				label: 'test',
			})

			expect(res.status).toBe(400)
			expect(res.body.error.message).toBe('Label already in use')
		})
	})

	describe('PATCH /connections/:connectionId', () => {
		test('updates connection label', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })

			const updatedConfigs = createConnectionConfigs()
			updatedConfigs['conn-1'].label = 'Renamed OBS'
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(mockStatus)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-1'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ label: 'Renamed OBS' })

			expect(res.status).toBe(200)
			expect(res.body.data.label).toBe('Renamed OBS')
			// Secrets not echoed back when not part of the update
			expect(res.body.data).not.toHaveProperty('secrets')

			expect(instanceController.setConnectionLabelAndConfig).toHaveBeenCalledWith(
				'conn-1',
				{
					label: 'Renamed OBS',
					enabled: null,
					config: null,
					secrets: null,
					updatePolicy: null,
					upgradeIndex: null,
				},
				{ patchConfig: true, patchSecrets: true }
			)
		})

		test('updates connection disabled state', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })

			const updatedConfigs = createConnectionConfigs()
			updatedConfigs['conn-1'].enabled = false
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(undefined)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-1'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ disabled: true })

			expect(res.status).toBe(200)
			expect(res.body.data.enabled).toBe(false)
			expect(instanceController.setConnectionLabelAndConfig).toHaveBeenCalledWith(
				'conn-1',
				{
					label: null,
					enabled: false,
					config: null,
					secrets: null,
					updatePolicy: null,
					upgradeIndex: null,
				},
				{ patchConfig: true, patchSecrets: true }
			)
		})

		test('updates connection disabled state to false', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })

			const updatedConfigs = createConnectionConfigs()
			updatedConfigs['conn-2'].enabled = true
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(undefined)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-2'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-2')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ disabled: false })

			expect(res.status).toBe(200)
			expect(res.body.data.enabled).toBe(true)
			expect(instanceController.setConnectionLabelAndConfig).toHaveBeenCalledWith(
				'conn-2',
				{
					label: null,
					enabled: true,
					config: null,
					secrets: null,
					updatePolicy: null,
					upgradeIndex: null,
				},
				{ patchConfig: true, patchSecrets: true }
			)
		})

		test('updates connection version', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())
			instanceController.modules.getModuleManifest.mockReturnValue({} as any)
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })
			instanceController.setModuleVersionAndActivate.mockReturnValue(true)

			const updatedConfigs = createConnectionConfigs()
			updatedConfigs['conn-1'].moduleVersionId = 'v2.0.0'
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(undefined)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-1'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ versionId: 'v2.0.0' })

			expect(res.status).toBe(200)
			expect(res.body.data.moduleVersionId).toBe('v2.0.0')
			expect(instanceController.modules.getModuleManifest).toHaveBeenCalledWith(
				ModuleInstanceType.Connection,
				'obs-websocket',
				'v2.0.0'
			)
			expect(instanceController.setConnectionLabelAndConfig).toHaveBeenCalledWith(
				'conn-1',
				{
					label: null,
					enabled: null,
					config: null,
					secrets: null,
					updatePolicy: null,
					upgradeIndex: null,
				},
				{ patchConfig: true, patchSecrets: true }
			)
			expect(instanceController.setModuleVersionAndActivate).toHaveBeenCalledWith('conn-1', 'v2.0.0', null)
		})

		test('updates connection version before validating config', async () => {
			const { app, instanceController, validToken } = createService()
			const callOrder: string[] = []

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())
			instanceController.modules.getModuleManifest.mockReturnValue({} as any)
			instanceController.setModuleVersionAndActivate.mockImplementation(() => {
				callOrder.push('version')
				return true
			})

			const mockInstance = {
				requestConfigFields: async () => {
					callOrder.push('config-fields')
					return [{ id: 'host', type: 'textinput' as const, label: 'Host', default: '' }]
				},
			}
			instanceController.processManager.getConnectionChild.mockReturnValue(mockInstance as any)
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })

			const updatedConfigs = createConnectionConfigs()
			updatedConfigs['conn-1'].moduleVersionId = 'v2.0.0'
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(undefined)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-1'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ versionId: 'v2.0.0', config: { host: 'localhost' } })

			expect(res.status).toBe(200)
			expect(callOrder).toEqual(['version', 'config-fields'])
			expect(instanceController.setConnectionLabelAndConfig).toHaveBeenCalledWith(
				'conn-1',
				{
					label: null,
					enabled: null,
					config: { host: 'localhost' },
					secrets: null,
					updatePolicy: null,
					upgradeIndex: null,
				},
				{ patchConfig: true, patchSecrets: true }
			)
		})

		test('updates connection version to latest stable', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })
			instanceController.setModuleVersionAndActivate.mockReturnValue(true)

			const updatedConfigs = createConnectionConfigs()
			updatedConfigs['conn-1'].moduleVersionId = null
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(undefined)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-1'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ versionId: null })

			expect(res.status).toBe(200)
			expect(res.body.data.moduleVersionId).toBeNull()
			expect(instanceController.modules.getModuleManifest).not.toHaveBeenCalled()
			expect(instanceController.setModuleVersionAndActivate).toHaveBeenCalledWith('conn-1', null, null)
		})

		test('returns 400 for unknown connection version', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())
			instanceController.modules.getModuleManifest.mockReturnValue(undefined)
			instanceController.modulesStore.fetchModuleVersionInfo.mockResolvedValue(null)

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ versionId: 'v99.0.0' })

			expect(res.status).toBe(400)
			expect(res.body.error.code).toBe('BAD_REQUEST')
			expect(res.body.error.message).toContain('v99.0.0')
			expect(instanceController.setConnectionLabelAndConfig).not.toHaveBeenCalled()
			expect(instanceController.setModuleVersionAndActivate).not.toHaveBeenCalled()
		})

		test('returns 404 for unknown connection', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())

			const res = await supertest(app)
				.patch('/api/connections/v1/unknown-id')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ label: 'test' })

			expect(res.status).toBe(404)
		})

		test('returns 400 when setConnectionLabelAndConfig fails', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: false, message: 'duplicate label' })

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ label: 'duplicate' })

			expect(res.status).toBe(400)
			expect(res.body.error.message).toBe('duplicate label')
		})

		test('returns 400 for invalid body', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ disabled: 'not-a-boolean' })

			expect(res.status).toBe(400)
			expect(res.body.error.code).toBe('BAD_REQUEST')
		})

		test('validates config keys against module field definitions', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())

			const mockInstance = {
				requestConfigFields: async () => [
					{ id: 'host', type: 'textinput' as const, label: 'Host', default: '' },
					{ id: 'port', type: 'number' as const, label: 'Port', default: 4455, min: 1, max: 65535 },
					{ id: 'password', type: 'secret-text' as const, label: 'Password' },
				],
			}
			instanceController.processManager.getConnectionChild.mockReturnValue(mockInstance as any)

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ config: { host: 'localhost', port: 99999 } })

			expect(res.status).toBe(400)
			expect(res.body.error.code).toBe('BAD_REQUEST')
			expect(res.body.error.details['config.port']).toBeDefined()
		})

		test('rejects config field that should be in secrets', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())

			const mockInstance = {
				requestConfigFields: async () => [
					{ id: 'host', type: 'textinput' as const, label: 'Host', default: '' },
					{ id: 'password', type: 'secret-text' as const, label: 'Password' },
				],
			}
			instanceController.processManager.getConnectionChild.mockReturnValue(mockInstance as any)

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ config: { password: 'secret123' } })

			expect(res.status).toBe(400)
			expect(res.body.error.details['config.password']).toContain('secret')
		})

		test('rejects secrets field that should be in config', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())

			const mockInstance = {
				requestConfigFields: async () => [
					{ id: 'host', type: 'textinput' as const, label: 'Host', default: '' },
					{ id: 'password', type: 'secret-text' as const, label: 'Password' },
				],
			}
			instanceController.processManager.getConnectionChild.mockReturnValue(mockInstance as any)

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ secrets: { host: 'localhost' } })

			expect(res.status).toBe(400)
			expect(res.body.error.details['secrets.host']).toContain('not a secret')
		})

		test('rejects unknown config keys', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())

			const mockInstance = {
				requestConfigFields: async () => [{ id: 'host', type: 'textinput' as const, label: 'Host', default: '' }],
			}
			instanceController.processManager.getConnectionChild.mockReturnValue(mockInstance as any)

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ config: { nonexistent: 'value' } })

			expect(res.status).toBe(400)
			expect(res.body.error.details['config.nonexistent']).toContain('Unknown')
		})

		test('passes valid config through to setConnectionLabelAndConfig', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())

			const mockInstance = {
				requestConfigFields: async () => [
					{ id: 'host', type: 'textinput' as const, label: 'Host', default: '' },
					{ id: 'port', type: 'number' as const, label: 'Port', default: 4455, min: 1, max: 65535 },
					{ id: 'password', type: 'secret-text' as const, label: 'Password' },
				],
			}
			instanceController.processManager.getConnectionChild.mockReturnValue(mockInstance as any)
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })

			const updatedConfigs = createConnectionConfigs()
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(mockStatus)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-1'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ config: { host: 'localhost', port: 4455 }, secrets: { password: 'abc' } })

			expect(res.status).toBe(200)
			// Secrets echoed back because they were part of the update
			expect(res.body.data.secrets).toEqual({ password: 'secret123' })
			expect(instanceController.setConnectionLabelAndConfig).toHaveBeenCalledWith(
				'conn-1',
				{
					label: null,
					enabled: null,
					config: { host: 'localhost', port: 4455 },
					secrets: { password: 'abc' },
					updatePolicy: null,
					upgradeIndex: null,
				},
				{ patchConfig: true, patchSecrets: true }
			)
		})

		test('clears a config field by sending null (reset to default)', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())

			const mockInstance = {
				requestConfigFields: async () => [
					{ id: 'host', type: 'textinput' as const, label: 'Host', default: 'localhost' },
					{ id: 'port', type: 'number' as const, label: 'Port', default: 4455, min: 1, max: 65535 },
				],
			}
			instanceController.processManager.getConnectionChild.mockReturnValue(mockInstance as any)
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })

			const updatedConfigs = createConnectionConfigs()
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(undefined)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-1'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ config: { host: null } })

			expect(res.status).toBe(200)
			expect(instanceController.setConnectionLabelAndConfig).toHaveBeenCalledWith(
				'conn-1',
				{
					label: null,
					enabled: null,
					config: { host: null },
					secrets: null,
					updatePolicy: null,
					upgradeIndex: null,
				},
				{ patchConfig: true, patchSecrets: true }
			)
		})

		test('returns 409 when patching config but connection is not running', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())
			instanceController.processManager.getConnectionChild.mockReturnValue(null as any)

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ config: { anything: 'goes' } })

			expect(res.status).toBe(409)
			expect(res.body.error.code).toBe('CONFLICT')
			expect(instanceController.setConnectionLabelAndConfig).not.toHaveBeenCalled()
		})

		test('allows non-config patches when connection is not running', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValueOnce(createConnectionConfigs())
			instanceController.setConnectionLabelAndConfig.mockReturnValue({ ok: true })

			const updatedConfigs = createConnectionConfigs()
			updatedConfigs['conn-1'].label = 'New Label'
			instanceController.getConnectionClientJson.mockReturnValueOnce(updatedConfigs)
			instanceController.getInstanceStatus.mockReturnValue(mockStatus)
			instanceController.getInstanceConfigOfType.mockReturnValue(createInstanceConfigs()['conn-1'])

			const res = await supertest(app)
				.patch('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send({ label: 'New Label', disabled: true })

			expect(res.status).toBe(200)
		})
	})

	describe('GET /connections/:connectionId/config-fields', () => {
		test('returns config field definitions for a running connection', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())

			const mockInstance = {
				requestConfigFields: async () => [
					{
						id: 'host',
						type: 'textinput' as const,
						label: 'Host',
						default: 'localhost',
						placeholder: 'IP or hostname',
						isVisible: true,
					},
					{ id: 'port', type: 'number' as const, label: 'Port', default: 4455, min: 1, max: 65535, step: 1 },
					{
						id: 'protocol',
						type: 'dropdown' as const,
						label: 'Protocol',
						default: 'ws',
						choices: [
							{ id: 'ws', label: 'WebSocket' },
							{ id: 'wss', label: 'WebSocket Secure' },
						],
					},
					{ id: 'password', type: 'secret-text' as const, label: 'Password' },
					{ id: 'info', type: 'static-text' as const, label: 'Info', value: 'Some info text' },
				],
			}
			instanceController.processManager.getConnectionChild.mockReturnValue(mockInstance as any)

			const res = await supertest(app)
				.get('/api/connections/v1/conn-1/config-fields')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(200)
			// static-text fields are filtered out
			expect(res.body.data).toHaveLength(4)

			expect(res.body.data[0]).toEqual({
				id: 'host',
				type: 'textinput',
				label: 'Host',
				default: 'localhost',
				placeholder: 'IP or hostname',
				isVisible: true,
			})

			expect(res.body.data[1]).toEqual({
				id: 'port',
				type: 'number',
				label: 'Port',
				default: 4455,
				min: 1,
				max: 65535,
				step: 1,
			})

			expect(res.body.data[2]).toEqual({
				id: 'protocol',
				type: 'dropdown',
				label: 'Protocol',
				default: 'ws',
				choices: [
					{ id: 'ws', label: 'WebSocket' },
					{ id: 'wss', label: 'WebSocket Secure' },
				],
			})

			expect(res.body.data[3]).toEqual({
				id: 'password',
				type: 'secret-text',
				label: 'Password',
			})
		})

		test('returns 409 when connection is not running', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.processManager.getConnectionChild.mockReturnValue(null as any)

			const res = await supertest(app)
				.get('/api/connections/v1/conn-1/config-fields')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(409)
		})

		test('returns 404 for unknown connection', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())

			const res = await supertest(app)
				.get('/api/connections/v1/unknown-id/config-fields')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(404)
		})
	})

	describe('DELETE /connections/:connectionId', () => {
		test('deletes a connection', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.removeConnection.mockResolvedValue(undefined)

			const res = await supertest(app)
				.delete('/api/connections/v1/conn-1')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(204)
			expect(instanceController.removeConnection).toHaveBeenCalledWith('conn-1')
		})

		test('returns 404 for unknown connection', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())

			const res = await supertest(app)
				.delete('/api/connections/v1/unknown-id')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(404)
		})
	})

	describe('POST /connections/:connectionId/restart', () => {
		test('triggers restart for existing enabled connection', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.restartConnection.mockReturnValue(true)

			const res = await supertest(app)
				.post('/api/connections/v1/conn-1/restart')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(200)
			expect(res.body.data).toEqual({ id: 'conn-1', message: 'Restart triggered' })
			expect(instanceController.restartConnection).toHaveBeenCalledWith('conn-1')
		})

		test('returns 409 for inactive connection', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())
			instanceController.restartConnection.mockReturnValue(false)

			const res = await supertest(app)
				.post('/api/connections/v1/conn-2/restart')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(409)
			expect(res.body.error.code).toBe('CONFLICT')
		})

		test('returns 404 for unknown connection', async () => {
			const { app, instanceController, validToken } = createService()

			instanceController.getConnectionClientJson.mockReturnValue(createConnectionConfigs())

			const res = await supertest(app)
				.post('/api/connections/v1/unknown-id/restart')
				.set('Authorization', `Bearer ${validToken}`)
				.send()

			expect(res.status).toBe(404)
		})
	})
})
