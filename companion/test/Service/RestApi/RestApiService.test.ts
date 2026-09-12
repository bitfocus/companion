import { DatabaseSync } from 'node:sqlite'
import express from 'express'
import supertest from 'supertest'
import { describe, expect, test } from 'vitest'
import { DataStoreTableView } from '../../../lib/Data/StoreBase.js'
import type { DataUserConfig } from '../../../lib/Data/UserConfig.js'
import LogController from '../../../lib/Log/Controller.js'
import type { Registry } from '../../../lib/Registry.js'
import { RestApiService } from '../../../lib/Service/RestApi/RestApiService.js'
import type { UIExpress } from '../../../lib/UI/Express.js'

const mockAppInfo = { appVersion: '5.0.0-test' }

/**
 * Build a RestApiService wired to real in-memory collaborators, plus a live view of whichever router
 * it has mounted so a test can drive requests against it.
 */
function createService(initialEnabled: boolean) {
	const logger = LogController.createLogger('test/api-keys')
	const db = new DatabaseSync(':memory:')
	const tableView = new DataStoreTableView<any>(logger, db, 'api_keys', {
		onDirty: () => {},
		onOperation: () => {},
	})

	const registry = {
		db: { getTableView: () => tableView },
		instance: { createRestApiRouter: () => express.Router() },
		surfaces: { createRestApiRouter: () => express.Router() },
	} as unknown as Registry

	let enabled = initialEnabled
	const userconfig = {
		getKey: (key: string) => (key === 'rest_api_enabled' ? enabled : undefined),
	} as unknown as DataUserConfig

	// Capture the router assigned via the setter and expose it through a stable app.
	let currentRouter: express.Router = express.Router()
	const uiExpress = {
		set restApiRouter(router: express.Router) {
			currentRouter = router
		},
	} as unknown as UIExpress

	const service = new RestApiService(registry, userconfig, uiExpress, mockAppInfo)

	const app = express()
	app.use('/api/v2', (req, res, next) => currentRouter(req, res, next))

	return {
		service,
		app,
		setEnabled: (value: boolean) => {
			enabled = value
			service.updateUserConfig('rest_api_enabled', value)
		},
	}
}

describe('RestApiService live toggle', () => {
	test('serves the API only while enabled', async () => {
		const { app, setEnabled } = createService(false)

		// Disabled at startup: nothing mounted, so the docs endpoint does not exist
		const whenDisabled = await supertest(app).get('/api/v2/openapi.json').send()
		expect(whenDisabled.status).toBe(404)

		// Enabling mounts the router live
		setEnabled(true)
		const whenEnabled = await supertest(app).get('/api/v2/openapi.json').send()
		expect(whenEnabled.status).toBe(200)
		expect(whenEnabled.body.openapi).toBeTruthy()

		// Disabling unmounts it again
		setEnabled(false)
		const whenDisabledAgain = await supertest(app).get('/api/v2/openapi.json').send()
		expect(whenDisabledAgain.status).toBe(404)
	})

	test('ignores unrelated config keys', async () => {
		const { app, service } = createService(true)

		service.updateUserConfig('some_other_key', true)

		const res = await supertest(app).get('/api/v2/openapi.json').send()
		expect(res.status).toBe(200)
	})
})
