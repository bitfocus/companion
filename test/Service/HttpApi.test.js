import { jest } from '@jest/globals'
import { mock } from 'jest-mock-extended'
import { ServiceHttpApi } from '../../lib/Service/HttpApi'
import express from 'express'
import supertest from 'supertest'
import bodyParser from 'body-parser'
import { rgb } from '../../lib/Resources/Util'

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
				userconfig: {
					// Force config to return true
					getKey: () => true,
				},
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

		const legacyRouter = express.Router()
		const service = new ServiceHttpApi(registry, legacyRouter)

		const app = express()

		app.use(bodyParser.text())
		app.use(bodyParser.json())

		app.use(legacyRouter)
		service.bindToApp(app)

		return {
			app,
			registry,
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

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value empty string', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue('')

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value proper string', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue('something 123')

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('something 123')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value zero number', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue(0)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('0')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value real number', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue(455.8)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('455.8')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value false', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue(false)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('false')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value true', async () => {
				const { app, registry } = createService()

				const mockFn = registry.instance.variable.custom.getValue
				mockFn.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('true')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
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

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
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
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
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
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
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
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
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
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
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
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
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

		describe('set step', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/step?step=2')
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.getControl).toHaveBeenCalledTimes(0)
			})

			test('no payload', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('test')

				const mockControl = mock(
					{
						stepMakeCurrent: jest.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/step')
				expect(res.status).toBe(400)
				expect(res.text).toBe('Bad step')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.getControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.getControl).toHaveBeenCalledWith('test')

				expect(mockControl.stepMakeCurrent).toHaveBeenCalledTimes(1)
				expect(mockControl.stepMakeCurrent).toHaveBeenCalledWith(NaN)
			})

			test('ok', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock(
					{
						stepMakeCurrent: jest.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)
				mockControl.stepMakeCurrent.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/step?step=2')
				expect(res.status).toBe(200)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(mockControl.stepMakeCurrent).toHaveBeenCalledTimes(1)
				expect(mockControl.stepMakeCurrent).toHaveBeenCalledWith(2)
			})

			test('bad page', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/step').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/step').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/step').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('set style', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/style').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			test('control without style', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('abc')

				registry.controls.getControl.mockReturnValue({ abc: null })

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/style').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(registry.controls.getControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.getControl).toHaveBeenCalledWith('abc')
			})

			test('bad page', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/style').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/style').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/style').send()
				expect(res.status).toBe(404)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			async function testSetStyle(queryStr, body, expected) {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock(
					{
						styleSetFields: jest.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app)
					.post(`/api/location/1/2/3/style?${queryStr}`)
					.set('Content-Type', 'application/json')
					.send(body)
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(registry.controls.getControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.getControl).toHaveBeenCalledWith('abc')

				if (expected) {
					expect(mockControl.styleSetFields).toHaveBeenCalledTimes(1)
					expect(mockControl.styleSetFields).toHaveBeenCalledWith(expected)
				} else {
					expect(mockControl.styleSetFields).toHaveBeenCalledTimes(0)
				}
			}

			test('set style without properties', async () => {
				await testSetStyle('', undefined, null)
			})

			test('set style unknown properties', async () => {
				await testSetStyle('abc=123', { def: 456 }, null)
			})

			test('set color properties', async () => {
				await testSetStyle(
					'bgcolor=%23abcdef',
					{ color: 'rgb(1,2,3)' },
					{
						bgcolor: rgb('ab', 'cd', 'ef', 16),
						color: rgb(1, 2, 3),
					}
				)
			})

			test('set color properties bad', async () => {
				await testSetStyle('bgcolor=bad', { color: 'rgb(1,2,an)' }, null)
			})

			test('set text size auto', async () => {
				await testSetStyle('', { size: 'auto' }, { size: 'auto' })
			})

			test('set text size bad', async () => {
				await testSetStyle('', { size: 'bad' }, null)
			})

			test('set text size number', async () => {
				await testSetStyle('size=134.2', {}, { size: 134 })
			})

			test('set text', async () => {
				await testSetStyle('text=something%20%23%20new', {}, { text: 'something # new' })
			})

			test('set empty text', async () => {
				await testSetStyle('text=', {}, { text: '' })
				await testSetStyle('', { text: '' }, { text: '' })
			})

			test('set empty png', async () => {
				await testSetStyle('png64=', {}, { png64: null })
				await testSetStyle('', { png64: '' }, { png64: null })
			})

			test('set bad png', async () => {
				await testSetStyle('', { png64: 'something' }, null)
			})

			test('set png', async () => {
				await testSetStyle('', { png64: 'data:image/png;base64,aaabncc' }, { png64: 'data:image/png;base64,aaabncc' })
			})

			test('set bad alignment', async () => {
				await testSetStyle('', { alignment: 'something' }, { alignment: 'center:center' })
				await testSetStyle('', { alignment: 'top:nope' }, { alignment: 'center:center' })
			})

			test('set alignment', async () => {
				await testSetStyle('', { alignment: 'left:top' }, { alignment: 'left:top' })
			})

			test('set bad pngalignment', async () => {
				await testSetStyle('', { pngalignment: 'something' }, { pngalignment: 'center:center' })
				await testSetStyle('', { pngalignment: 'top:nope' }, { pngalignment: 'center:center' })
			})

			test('set pngalignment', async () => {
				await testSetStyle('', { pngalignment: 'left:top' }, { pngalignment: 'left:top' })
			})
		})
	})
})
