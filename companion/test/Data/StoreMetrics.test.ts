import express from 'express'
import supertest from 'supertest'
import { describe, expect, test } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { DataCache } from '../../lib/Data/Cache.js'
import { DataMetrics } from '../../lib/Data/Metrics.js'
import { registerDatabaseDurationHistogram, registerDatabaseMetrics } from '../../lib/Data/StoreMetrics.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { AppInfo } from '../../lib/Registry.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

// End-to-end: register the SQLite metrics against a real in-memory store, exercise it, and confirm the
// companion_database_* families render through an actual Prometheus scrape.
describe('registerDatabaseMetrics', () => {
	test('exposes SQLite metrics for a store through a scrape', async () => {
		const appInfo = { appVersion: '1.2.3', appBuild: 'abc123' } as AppInfo
		const userconfig = mockDeep<DataUserConfig>(mockOptions, {
			getKey: (key: string) => {
				if (key === 'prometheus_enabled') return true
				if (key === 'prometheus_token') return 'secret-token'
				throw new Error(`unexpected key ${String(key)}`)
			},
		})
		const metrics = new DataMetrics(appInfo, () => userconfig)

		// The duration observer is injected at store construction (before the pull metrics are registered).
		const observerFor = registerDatabaseDurationHistogram(metrics)
		const cache = new DataCache(':memory:', observerFor('cache'))
		try {
			registerDatabaseMetrics(metrics, [{ name: 'cache', store: cache }])

			const view = cache.getTableView<Record<string, { x: number }>>('widgets')
			view.set('a', { x: 1 })
			view.set('b', { x: 2 })
			view.get('a')
			view.all()

			const app = express()
			app.use('/api/metrics', metrics.metricsRouter)
			const res = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')

			expect(res.status).toBe(200)
			// Operation counter, broken out by database/table/operation
			expect(res.text).toContain(
				'companion_database_operations_total{database="cache",table="widgets",operation="set"} 2'
			)
			expect(res.text).toContain(
				'companion_database_operations_total{database="cache",table="widgets",operation="get"} 1'
			)
			// Row-count gauge
			expect(res.text).toContain('companion_database_table_rows{database="cache",table="widgets"} 2')
			// Duration histogram was fed by the operation observer
			expect(res.text).toContain(
				'companion_database_operation_duration_seconds_count{database="cache",table="widgets",operation="set"} 2'
			)
			// Existing size gauge still registered here
			expect(res.text).toContain('companion_database_size_bytes{database="cache"}')
		} finally {
			cache.close()
		}
	})
})
