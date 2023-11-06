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
				page: mock({}, mockOptions),
				controls: mock({}, mockOptions),
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
		describe('rescan', () => {
			test('ok', async () => {
				const { app, registry } = createService()
				registry.surfaces.triggerRefreshDevices.mockResolvedValue()

				// Perform the request
				const res = await supertest(app).post('/api/surfaces/rescan').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')
			})

			test('failed', async () => {
				const { app, registry } = createService()
				registry.surfaces.triggerRefreshDevices.mockRejectedValue('internal error')

				// Perform the request
				const res = await supertest(app).post('/api/surfaces/rescan').send()
				expect(res.status).toBe(500)
				expect(res.text).toBe('fail')
			})
		})
	})

	describe('custom-variable', () => {
		describe('set value', () => {
			test('no value', async () => {
				const { app } = createService()

				// Perform the request
				const res = await supertest(app).post('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(400)
				expect(res.text).toBe('No value')
			})

			test('ok from query', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.setValue
				mockFn.mockReturnValue()

				// Perform the request
				const res = await supertest(app).post('/api/custom-variable/my-var-name/value?value=123').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '123')
			})

			test('ok from body', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.setValue
				mockFn.mockReturnValue()

				// Perform the request
				const res = await supertest(app)
					.post('/api/custom-variable/my-var-name/value')
					.set('Content-Type', 'text/plain')
					.send('def')
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', 'def')
			})

			test('unknown name', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.setValue
				mockFn.mockReturnValue('Unknown name')

				// Perform the request
				const res = await supertest(app)
					.post('/api/custom-variable/my-var-name/value')
					.set('Content-Type', 'text/plain')
					.send('def')
				expect(res.status).toBe(404)
				expect(res.text).toBe('Not found')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', 'def')
			})
		})

		describe('get value', () => {
			test('no value', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue(undefined)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(404)
				expect(res.text).toBe('Not found')
			})

			test('value empty string', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue('')

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('')
			})

			test('value proper string', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue('something 123')

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('something 123')
			})

			test('value zero number', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue(0)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				console.log(res)
				expect(res.status).toBe(200)
				expect(res.text).toBe('0')
			})

			test('value real number', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue(455.8)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('455.8')
			})

			test('value false', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue(false)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('false')
			})

			test('value true', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('true')
			})

			test('value object', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue({
					a: 1,
					b: 'str',
				})

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('{"a":1,"b":"str"}')
			})
		})
	})

	describe('controls by location', () => {
		describe('down', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/down').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			test('ok', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/down').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.pressControl).toHaveBeenCalledWith('control123', true, 'http')
			})

			test('bad page', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/down').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/down').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/down').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('up', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/up').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			test('ok', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/up').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.pressControl).toHaveBeenCalledWith('control123', false, 'http')
			})

			test('bad page', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/up').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/up').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/up').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('press', () => {
			beforeEach(() => {
				jest.useFakeTimers()
			})

			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/press').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			test('ok', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/press').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.pressControl).toHaveBeenCalledWith('control123', true, 'http')

				jest.advanceTimersByTime(100)

				expect(registry.controls.pressControl).toHaveBeenCalledTimes(2)
				expect(registry.controls.pressControl).toHaveBeenLastCalledWith('control123', false, 'http')
			})

			test('bad page', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/press').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/press').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/press').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate left', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/rotate-left').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			test('ok', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/rotate-left').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.rotateControl).toHaveBeenCalledWith('control123', false, 'http')
			})

			test('bad page', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/rotate-left').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/rotate-left').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/rotate-left').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate right', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/rotate-right').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			test('ok', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/rotate-right').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.rotateControl).toHaveBeenCalledWith('control123', true, 'http')
			})

			test('bad page', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/rotate-right').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/rotate-right').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/rotate-right').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})
	})
})
