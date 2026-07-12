import express from 'express'
import Express from 'express'
import supertest from 'supertest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { DataMetrics } from '../../lib/Data/Metrics.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { AppInfo } from '../../lib/Registry.js'
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

	test('histograms record observations (count/sum/buckets)', async () => {
		const { app, metrics } = createService({ enabled: true, token: 'secret-token' })

		const observe = metrics.histogram('companion_test_duration_seconds', 'A test histogram', [0.01, 0.1, 1])
		observe(0.05)
		observe(0.5)

		const res = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(res.text).toContain('companion_test_duration_seconds_count 2')
		expect(res.text).toContain('companion_test_duration_seconds_sum 0.55')
		// 0.05 falls in the 0.1 bucket but not the 0.01 bucket
		expect(res.text).toContain('companion_test_duration_seconds_bucket{le="0.01"} 0')
		expect(res.text).toContain('companion_test_duration_seconds_bucket{le="0.1"} 1')
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

	test('labeled counters drop series that disappear from the source', async () => {
		const { app, metrics } = createService({ enabled: true, token: 'secret-token' })

		// Simulate per-instance counters where an instance can be removed at runtime
		const instances = new Map<string, number>([
			['inst-a', 4],
			['inst-b', 9],
		])
		metrics.labeledCounter('companion_test_instance_total', 'A test labeled counter', ['instance_id'], () =>
			Array.from(instances, ([instance_id, value]) => ({ labels: { instance_id }, value }))
		)

		const first = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(first.text).toContain('companion_test_instance_total{instance_id="inst-a"} 4')
		expect(first.text).toContain('companion_test_instance_total{instance_id="inst-b"} 9')

		// inst-b is removed - its series must not linger in later scrapes
		instances.delete('inst-b')
		const second = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(second.text).toContain('companion_test_instance_total{instance_id="inst-a"} 4')
		expect(second.text).not.toContain('instance_id="inst-b"')
	})

	// The instance restarts counter is bridged from a source (ProcessManager) that must stay monotonic per
	// instance. These two tests pin the contract that makes that safe: a disable/re-enable keeps the total,
	// a genuine delete drops it, and a source that ever goes backwards breaks the scrape (hence the total is
	// persisted outside the disposable child, not reset when the child is recreated).
	test('labeled counter survives a disable/re-enable with no scrape in between', async () => {
		const { app, metrics } = createService({ enabled: true, token: 'secret-token' })

		// Mirror the ProcessManager pipeline: `restartsTotal` is the persisted, monotonic per-instance total,
		// `live` is the set of instances currently present in #children (what getRuntimeMetrics iterates).
		const restartsTotal = new Map<string, number>([['inst-a', 2]])
		const live = new Set<string>(['inst-a'])
		metrics.labeledCounter('companion_test_restarts_total', 'A test labeled counter', ['instance_id'], () =>
			Array.from(live, (instance_id) => ({ labels: { instance_id }, value: restartsTotal.get(instance_id) ?? 0 }))
		)

		// Establish the bridge's lastValue at 2
		const first = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(first.status).toBe(200)
		expect(first.text).toContain('companion_test_restarts_total{instance_id="inst-a"} 2')

		// Disable then re-enable between scrapes: the child is gone and recreated, but because the total is
		// persisted outside it, the source value is unchanged. This must not throw a negative delta.
		live.delete('inst-a')
		live.add('inst-a')
		const second = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(second.status).toBe(200)
		expect(second.text).toContain('companion_test_restarts_total{instance_id="inst-a"} 2')

		// A further restart continues from the preserved total
		restartsTotal.set('inst-a', 3)
		const third = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(third.text).toContain('companion_test_restarts_total{instance_id="inst-a"} 3')

		// A genuine delete drops both the live entry and the persisted total, so the series disappears
		live.delete('inst-a')
		restartsTotal.delete('inst-a')
		const fourth = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(fourth.text).not.toContain('instance_id="inst-a"')
	})

	test('a source that decreases while its series is still present breaks the scrape', async () => {
		// This is the failure the persisted total avoids: if restartsTotal were reset to 0 when a still-live
		// instance's child is recreated, the bridge would try to increment by a negative delta. prom-client
		// rejects that, and because one collector throwing fails the whole registry, the entire endpoint 500s.
		const { app, metrics } = createService({ enabled: true, token: 'secret-token' })

		const source = new Map<string, number>([['inst-a', 2]])
		metrics.labeledCounter('companion_test_broken_total', 'A test labeled counter', ['instance_id'], () =>
			Array.from(source, ([instance_id, value]) => ({ labels: { instance_id }, value }))
		)

		const first = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(first.status).toBe(200)

		// Same series, lower value - the non-monotonic case the fix prevents
		source.set('inst-a', 0)
		const second = await supertest(app).get('/api/metrics').set('Authorization', 'Bearer secret-token')
		expect(second.status).toBe(500)
	})
})
