import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ServiceHttpApi } from '../../lib/Service/HttpApi'
import express from 'express'
import supertest from 'supertest'
import Express from 'express'
import { rgb } from '../../lib/Resources/Util'
import type { UIExpress } from '../../lib/UI/Express'
import type { ControlEntityListPoolButton } from '../../lib/Controls/Entities/EntityListPoolButton'
import type { DataUserConfig } from '../../lib/Data/UserConfig'
import type { ServiceApi, ServiceApiControl } from '../../lib/Service/ServiceApi'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('HttpApi', () => {
	function createService() {
		const serviceApi = mockDeep<ServiceApi>(mockOptions)
		const userconfig = mockDeep<DataUserConfig>(mockOptions, {
			// Force config to return true
			getKey: () => true,
		})

		let router = express.Router()
		let legacyRouter = express.Router()

		const app = express()

		const appHandler = {
			set apiRouter(newRouter: express.Router) {
				router = newRouter
			},
			set legacyApiRouter(newRouter: express.Router) {
				legacyRouter = newRouter
			},
		} as any as UIExpress

		app.use(Express.text())
		app.use(Express.json())
		app.use('/api', (r, s, n) => router(r, s, n))
		app.use((r, s, n) => legacyRouter(r, s, n))
		app.get('*any', (_req, res, _next) => {
			res.status(421).send('')
		})

		const service = new ServiceHttpApi(serviceApi, userconfig, appHandler)

		return {
			app,
			serviceApi,
			userconfig,
			service,
			// logger,
		}
	}

	describe('legacy api', () => {
		describe('custom-variable', () => {
			describe('set value', () => {
				test('no value', async () => {
					const { app, serviceApi } = createService()

					const mockFn = serviceApi.setCustomVariableValue
					mockFn.mockReturnValue(null)

					// Perform the request
					const res = await supertest(app).get('/set/custom-variable/my-var-name').send()
					expect(res.status).toBe(200)
					expect(res.text).toBe('ok')
					expect(mockFn).toHaveBeenCalledTimes(1)
					expect(mockFn).toHaveBeenCalledWith('my-var-name', 'undefined')
				})

				test('ok from query', async () => {
					const { app, serviceApi } = createService()

					const mockFn = serviceApi.setCustomVariableValue
					mockFn.mockReturnValue(null)

					// Perform the request
					const res = await supertest(app).get('/set/custom-variable/my-var-name?value=123').send()
					expect(res.status).toBe(200)
					expect(res.text).toBe('ok')

					expect(mockFn).toHaveBeenCalledTimes(1)
					expect(mockFn).toHaveBeenCalledWith('my-var-name', '123')
				})

				test('unknown name', async () => {
					const { app, serviceApi } = createService()

					const mockFn = serviceApi.setCustomVariableValue
					mockFn.mockReturnValue('Unknown name')

					// Perform the request
					const res = await supertest(app).get('/set/custom-variable/unknown-var-name?value=42').send()
					expect(res.status).toBe(200)
					expect(res.text).toBe('Unknown name')

					expect(mockFn).toHaveBeenCalledTimes(1)
					expect(mockFn).toHaveBeenCalledWith('unknown-var-name', '42')
				})
			})
		})
	})

	describe('surfaces', () => {
		describe('rescan', () => {
			test('ok', async () => {
				const { app, serviceApi } = createService()
				serviceApi.triggerRescanForSurfaces.mockResolvedValue(undefined)

				// Perform the request
				const res = await supertest(app).post('/api/surfaces/rescan').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')
			})

			test('failed', async () => {
				const { app, serviceApi } = createService()
				serviceApi.triggerRescanForSurfaces.mockRejectedValue('internal error')

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
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.setCustomVariableValue
				mockFn.mockReturnValue(null)

				// Perform the request
				const res = await supertest(app).post('/api/custom-variable/my-var-name/value?value=123').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '123')
			})

			test('ok from body', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.setCustomVariableValue
				mockFn.mockReturnValue(null)

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
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.setCustomVariableValue
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
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getCustomVariableValue
				mockFn.mockReturnValue(undefined)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(404)
				expect(res.text).toBe('Not found')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value empty string', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getCustomVariableValue
				mockFn.mockReturnValue('')

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value proper string', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getCustomVariableValue
				mockFn.mockReturnValue('something 123')

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('something 123')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value zero number', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getCustomVariableValue
				mockFn.mockReturnValue(0)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('0')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value real number', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getCustomVariableValue
				mockFn.mockReturnValue(455.8)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('455.8')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value false', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getCustomVariableValue
				mockFn.mockReturnValue(false)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('false')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value true', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getCustomVariableValue
				mockFn.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).get('/api/custom-variable/my-var-name/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('true')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name')
			})

			test('value object', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getCustomVariableValue
				mockFn.mockReturnValue({
					a: 1,
					b: 'str',
				} as any)

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
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/down').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/down').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', true, 'http')
			})

			test('bad page', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/down').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/down').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/down').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('up', () => {
			test('no control', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/up').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/up').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', false, 'http')
			})

			test('bad page', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/up').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/up').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/up').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('press', () => {
			beforeEach(() => {
				vi.useFakeTimers()
			})

			test('no control', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/press').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/press').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', true, 'http')

				vi.advanceTimersByTime(100)

				expect(serviceApi.pressControl).toHaveBeenCalledTimes(2)
				expect(serviceApi.pressControl).toHaveBeenLastCalledWith('control123', false, 'http')
			})

			test('bad page', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/press').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/press').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/press').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate left', () => {
			test('no control', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/rotate-left').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/rotate-left').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.rotateControl).toHaveBeenCalledWith('control123', false, 'http')
			})

			test('bad page', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/rotate-left').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/rotate-left').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/rotate-left').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate right', () => {
			test('no control', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/rotate-right').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/rotate-right').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.rotateControl).toHaveBeenCalledWith('control123', true, 'http')
			})

			test('bad page', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/rotate-right').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/rotate-right').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/rotate-right').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('set step', () => {
			test('no control', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/step?step=2')
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.getControl).toHaveBeenCalledTimes(0)
			})

			test('no payload', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('test')

				const mockControl = mock<ServiceApiControl>(
					{
						setCurrentStep: vi.fn().mockReturnValue(false),
					},
					mockOptions
				)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/step')
				console.log(res)
				expect(res.status).toBe(400)
				expect(res.text).toBe('Bad step')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.getControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControl).toHaveBeenCalledWith('test')

				expect(mockControl.setCurrentStep).toHaveBeenCalledTimes(1)
				expect(mockControl.setCurrentStep).toHaveBeenCalledWith(NaN)
			})

			test('ok', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>(
					{
						setCurrentStep: vi.fn().mockReturnValue(true),
					},
					mockOptions
				)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/step?step=2')
				expect(res.status).toBe(200)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(mockControl.setCurrentStep).toHaveBeenCalledTimes(1)
				expect(mockControl.setCurrentStep).toHaveBeenCalledWith(2)
			})

			test('bad page', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/step').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/step').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/step').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('set style', () => {
			test('no control', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/style').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			test('control without style', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('abc')

				serviceApi.getControl.mockReturnValue({ abc: null } as any)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/style').send()
				expect(res.status).toBe(204)
				// expect(res.text).toBe('No control')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(serviceApi.getControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControl).toHaveBeenCalledWith('abc')
			})

			test('bad page', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/style').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/style').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/style').send()
				expect(res.status).toBe(204)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			async function testSetStyle(queryStr, body, expected) {
				const { app, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock<ServiceApiControl>(
					{
						setStyleFields: vi.fn(),
					},
					mockOptions
				)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				const res = await (body !== null
					? supertest(app)
							.post(`/api/location/1/2/3/style?${queryStr}`)
							.set('Content-Type', 'application/json')
							.send(body)
					: supertest(app).post(`/api/location/1/2/3/style?${queryStr}`).send())
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(serviceApi.getControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControl).toHaveBeenCalledWith('abc')

				if (expected) {
					expect(mockControl.setStyleFields).toHaveBeenCalledTimes(1)
					expect(mockControl.setStyleFields).toHaveBeenCalledWith(expected)
				} else {
					expect(mockControl.setStyleFields).toHaveBeenCalledTimes(0)
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

			test('set color properties query only', async () => {
				await testSetStyle('bgcolor=%23abcdef', null, {
					bgcolor: rgb('ab', 'cd', 'ef', 16),
				})
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

	describe('module-variable', () => {
		describe('get value', () => {
			test('no value', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getConnectionVariableValue
				mockFn.mockReturnValue(undefined)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(404)
				expect(res.text).toBe('Not found')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value empty string', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getConnectionVariableValue
				mockFn.mockReturnValue('')

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})
			test('value proper string', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getConnectionVariableValue
				mockFn.mockReturnValue('something 123')

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('something 123')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value zero number', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getConnectionVariableValue
				mockFn.mockReturnValue(0)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('0')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value real number', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getConnectionVariableValue
				mockFn.mockReturnValue(455.8)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('455.8')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value false', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getConnectionVariableValue
				mockFn.mockReturnValue(false)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('false')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value true', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getConnectionVariableValue
				mockFn.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('true')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})
			test('value object', async () => {
				const { app, serviceApi } = createService()

				const mockFn = serviceApi.getConnectionVariableValue
				mockFn.mockReturnValue({
					a: 1,
					b: 'str',
				} as any)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('{"a":1,"b":"str"}')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})
		})
	})
})
