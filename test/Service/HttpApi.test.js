import { jest } from '@jest/globals'
import { mock } from 'jest-mock-extended'
import { ServiceHttpApi } from '../../lib/Service/HttpApi'
import express from 'express'
import supertest from 'supertest'
import bodyParser from 'body-parser'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('HttpApi', () => {
	function createService() {
		const logger = mock(
			{
				info: jest.fn(),
				debug: jest.fn(),
			},
			mockOptions
		)
		const logController = mock(
			{
				createLogger: () => logger,
			},
			mockOptions
		)
		const registry = mock(
			{
				log: logController,
				surfaces: mock({}, mockOptions),
				instance: mock(
					{
						variable: mock(
							{
								custom: mock({}, mockOptions),
							},
							mockOptions
						),
					},
					mockOptions
				),
			},
			mockOptions
		)

		const router = express.Router()
		const service = new ServiceHttpApi(registry, router)

		const app = express()

		// parse text/plain
		app.use(bodyParser.text())

		app.use(router)

		return {
			app,
			registry,
			router,
			service,
			logger,
		}
	}

	describe('surfaces', () => {
		test('rescan ok', async () => {
			const { app, registry } = createService()
			registry.surfaces.triggerRefreshDevices.mockResolvedValue()

			// Perform the request
			const res = await supertest(app).post('/api/surfaces/rescan').send()
			expect(res.status).toBe(200)
			expect(res.text).toBe('ok')
		})

		test('rescan failed', async () => {
			const { app, registry } = createService()
			registry.surfaces.triggerRefreshDevices.mockRejectedValue('internal error')

			// Perform the request
			const res = await supertest(app).post('/api/surfaces/rescan').send()
			expect(res.status).toBe(500)
			expect(res.text).toBe('fail')
		})
	})

	describe('custom-variable', () => {
		test('set-value: no value', async () => {
			const { app } = createService()

			// Perform the request
			const res = await supertest(app).post('/api/custom-variable/my-var-name/set-value').send()
			expect(res.status).toBe(400)
			expect(res.text).toBe('No value')
		})

		test('set-value: ok from query', async () => {
			const { app, registry } = createService()

			const mockFn = registry.instance.variable.custom.setValue
			mockFn.mockReturnValue()

			// Perform the request
			const res = await supertest(app).post('/api/custom-variable/my-var-name/set-value?value=123').send()
			expect(res.status).toBe(200)
			expect(res.text).toBe('ok')

			expect(mockFn).toHaveBeenCalledTimes(1)
			expect(mockFn).toHaveBeenCalledWith('my-var-name', '123')
		})

		test('set-value: ok from body', async () => {
			const { app, registry } = createService()

			const mockFn = registry.instance.variable.custom.setValue
			mockFn.mockReturnValue()

			// Perform the request
			const res = await supertest(app)
				.post('/api/custom-variable/my-var-name/set-value')
				.set('Content-Type', 'text/plain')
				.send('def')
			expect(res.status).toBe(200)
			expect(res.text).toBe('ok')

			expect(mockFn).toHaveBeenCalledTimes(1)
			expect(mockFn).toHaveBeenCalledWith('my-var-name', 'def')
		})

		test('set-value: unknown name', async () => {
			const { app, registry } = createService()

			const mockFn = registry.instance.variable.custom.setValue
			mockFn.mockReturnValue('Unknown name')

			// Perform the request
			const res = await supertest(app)
				.post('/api/custom-variable/my-var-name/set-value')
				.set('Content-Type', 'text/plain')
				.send('def')
			expect(res.status).toBe(404)
			expect(res.text).toBe('Not found')

			expect(mockFn).toHaveBeenCalledTimes(1)
			expect(mockFn).toHaveBeenCalledWith('my-var-name', 'def')
		})
	})
})
