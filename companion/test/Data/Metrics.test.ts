import express from 'express'
import Express from 'express'
import supertest from 'supertest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { DataMetrics } from '../../lib/Data/Metrics.js'
import type { AppInfo } from '../../lib/Registry.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { UIExpress } from '../../lib/UI/Express.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('DataMetrics', () => {
	function createService(config: { enabled: boolean; token: string }) {
		const appInfo = { appVersion: '1.2.3', appBuild: 'abc123' } as AppInfo

		const userconfig = mockDeep<DataUserConfig>(mockOptions, {
			getKey: (key: keyof typeof config | string) => {
				if (key === 'prometheus_enabled') return config.enabled
				if (key === 'prometheus_token') return config.token
				throw new Error(`unexpected key ${String(key)}`)
			},
		})

		let metricsRouter = express.Router()
		const appHandler = {
			set metricsRouter(newRouter: express.Router) {
				metricsRouter = newRouter
			},
		} as any as UIExpress

		const app = express()
		app.use('/api/metrics', (r, s, n) => metricsRouter(r, s, n))
		app.get('*any', (_req, res) => {
			res.status(421).send('')
		})

		const metrics = new DataMetrics(appInfo, userconfig, appHandler)

		return { app, userconfig, metrics }
	}

	test('returns 404 when disabled', async () => {
		const { app } = createService({ enabled: false, token: 'secret-token' })

		const res = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(res.status).toBe(404)
	})

	test('returns 401 without a token', async () => {
		const { app } = createService({ enabled: true, token: 'secret-token' })

		const res = await supertest(app).get('/api/metrics')
		expect(res.status).toBe(401)
		expect(res.headers['www-authenticate']).toBe('Bearer')
	})

	test('returns 401 with the wrong token', async () => {
		const { app } = createService({ enabled: true, token: 'secret-token' })

		const res = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer wrong-token')
		expect(res.status).toBe(401)
	})

	test('returns 401 when enabled but no token is configured', async () => {
		const { app } = createService({ enabled: true, token: '' })

		const res = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer ')
		expect(res.status).toBe(401)
	})

	test('serves prometheus metrics with a valid bearer token', async () => {
		const { app } = createService({ enabled: true, token: 'secret-token' })

		const res = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(res.status).toBe(200)
		expect(res.headers['content-type']).toContain('text/plain')

		// Default process metrics are present (standard, unprefixed names) - including the process start
		// time used to derive uptime in Prometheus
		expect(res.text).toContain('process_cpu_user_seconds_total')
		expect(res.text).toContain('process_start_time_seconds')
		// The build_info metric carries version/build labels
		expect(res.text).toContain('companion_build_info{version="1.2.3",build="abc123"')
	})

	test('registered gauges and counters appear in the output', async () => {
		const { app, metrics } = createService({ enabled: true, token: 'secret-token' })

		let counterSource = 0
		metrics.gauge('companion_test_gauge', 'A test gauge', () => 42)
		metrics.counter('companion_test_counter_total', 'A test counter', () => counterSource)

		counterSource = 5
		const first = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(first.text).toContain('companion_test_gauge 42')
		expect(first.text).toContain('companion_test_counter_total 5')

		// The counter bridges a monotonic source: a later scrape reflects the new cumulative total
		counterSource = 8
		const second = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(second.text).toContain('companion_test_counter_total 8')
	})

	test('labeled gauges and counters emit one series per label combination', async () => {
		const { app, metrics } = createService({ enabled: true, token: 'secret-token' })

		metrics.labeledGauge('companion_test_queue', 'A test labeled gauge', ['state'], () => [
			{ labels: { state: 'pending' }, value: 3 },
			{ labels: { state: 'in_progress' }, value: 1 },
		])

		const sources = { hit: 0, render: 0 }
		metrics.labeledCounter('companion_test_requests_total', 'A test labeled counter', ['result'], () => [
			{ labels: { result: 'cache_hit' }, value: sources.hit },
			{ labels: { result: 'render' }, value: sources.render },
		])

		sources.hit = 7
		sources.render = 2
		const first = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(first.text).toContain('companion_test_queue{state="pending"} 3')
		expect(first.text).toContain('companion_test_queue{state="in_progress"} 1')
		expect(first.text).toContain('companion_test_requests_total{result="cache_hit"} 7')
		expect(first.text).toContain('companion_test_requests_total{result="render"} 2')

		// Each label combination bridges its own monotonic source independently
		sources.hit = 10
		const second = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(second.text).toContain('companion_test_requests_total{result="cache_hit"} 10')
		expect(second.text).toContain('companion_test_requests_total{result="render"} 2')
	})
})
