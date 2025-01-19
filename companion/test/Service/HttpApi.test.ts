import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ServiceHttpApi } from '../../lib/Service/HttpApi'
import express from 'express'
import supertest from 'supertest'
import Express from 'express'
import { rgb } from '../../lib/Resources/Util'
import type { Registry } from '../../lib/Registry'
import type { ControlButtonNormal } from '../../lib/Controls/ControlTypes/Button/Normal'
import type { UIExpress } from '../../lib/UI/Express'
import type { ControlEntityListPoolButton } from '../../lib/Controls/Entities/EntityListPoolButton'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('HttpApi', () => {
	function createService() {
		// const logger = mock(
		// 	{
		// 		info: vi.fn(),
		// 		debug: vi.fn(),
		// 	},
		// 	mockOptions
		// )
		// const logController = mock(
		// 	{
		// 		createLogger: () => logger,
		// 	},
		// 	mockOptions
		// )
		const registry = mockDeep<Registry>(mockOptions, {
			// log: logController,
			surfaces: mock({}, mockOptions),
			page: mock({}, mockOptions),
			controls: mock({}, mockOptions),
			userconfig: {
				// Force config to return true
				getKey: () => true,
			},
			variables: mock(
				{
					custom: mock({}, mockOptions),
					values: mock({}, mockOptions),
				},
				mockOptions
			),
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

		const service = new ServiceHttpApi(registry, appHandler)

		return {
			app,
			registry,
			service,
			// logger,
		}
	}

	describe('legacy api', () => {
		describe('custom-variable', () => {
			describe('set value', () => {
				test('no value', async () => {
					const { app, registry } = createService()

					const mockFn = registry.variables.custom.setValue
					mockFn.mockReturnValue(null)

					// Perform the request
					const res = await supertest(app).get('/set/custom-variable/my-var-name').send()
					expect(res.status).toBe(200)
					expect(res.text).toBe('ok')
					expect(mockFn).toHaveBeenCalledTimes(1)
					expect(mockFn).toHaveBeenCalledWith('my-var-name', 'undefined')
				})

				test('ok from query', async () => {
					const { app, registry } = createService()

					const mockFn = registry.variables.custom.setValue
					mockFn.mockReturnValue(null)

					// Perform the request
					const res = await supertest(app).get('/set/custom-variable/my-var-name?value=123').send()
					expect(res.status).toBe(200)
					expect(res.text).toBe('ok')

					expect(mockFn).toHaveBeenCalledTimes(1)
					expect(mockFn).toHaveBeenCalledWith('my-var-name', '123')
				})

				test('unknown name', async () => {
					const { app, registry } = createService()

					const mockFn = registry.variables.custom.setValue
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
				const { app, registry } = createService()
				registry.surfaces.triggerRefreshDevices.mockResolvedValue(undefined)

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

				const mockFn = registry.variables.custom.setValue
				mockFn.mockReturnValue(null)

				// Perform the request
				const res = await supertest(app).post('/api/custom-variable/my-var-name/value?value=123').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('ok')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '123')
			})

			test('ok from body', async () => {
				const { app, registry } = createService()

				const mockFn = registry.variables.custom.setValue
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
				const { app, registry } = createService()

				const mockFn = registry.variables.custom.setValue
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

				const mockFn = registry.variables.custom.getValue
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

				const mockFn = registry.variables.custom.getValue
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

				const mockFn = registry.variables.custom.getValue
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

				const mockFn = registry.variables.custom.getValue
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

				const mockFn = registry.variables.custom.getValue
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

				const mockFn = registry.variables.custom.getValue
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

				const mockFn = registry.variables.custom.getValue
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

				const mockFn = registry.variables.custom.getValue
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
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
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
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/down').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/down').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/down').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('up', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
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
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/up').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/up').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/up').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('press', () => {
			beforeEach(() => {
				vi.useFakeTimers()
			})

			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
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

				vi.advanceTimersByTime(100)

				expect(registry.controls.pressControl).toHaveBeenCalledTimes(2)
				expect(registry.controls.pressControl).toHaveBeenLastCalledWith('control123', false, 'http')
			})

			test('bad page', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/press').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/press').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/press').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate left', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
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
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/rotate-left').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/rotate-left').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/rotate-left').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate right', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
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
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/rotate-right').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/rotate-right').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/rotate-right').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('set step', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
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

				const mockControlEntities = mock<ControlEntityListPoolButton>(
					{
						stepMakeCurrent: vi.fn(),
					},
					mockOptions
				)
				const mockControl = mock<ControlButtonNormal>(
					{
						actionSets: mockControlEntities,
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

				expect(mockControlEntities.stepMakeCurrent).toHaveBeenCalledTimes(1)
				expect(mockControlEntities.stepMakeCurrent).toHaveBeenCalledWith(NaN)
			})

			test('ok', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')

				const mockControlEntities = mock<ControlEntityListPoolButton>(
					{
						stepMakeCurrent: vi.fn(),
					},
					mockOptions
				)
				const mockControl = mock<ControlButtonNormal>(
					{
						actionSets: mockControlEntities,
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)
				mockControlEntities.stepMakeCurrent.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3/step?step=2')
				expect(res.status).toBe(200)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(mockControlEntities.stepMakeCurrent).toHaveBeenCalledTimes(1)
				expect(mockControlEntities.stepMakeCurrent).toHaveBeenCalledWith(2)
			})

			test('bad page', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/step').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/step').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/step').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('set style', () => {
			test('no control', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

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

				registry.controls.getControl.mockReturnValue({ abc: null } as any)

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
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1a/2/3/style').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2a/3/style').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).post('/api/location/1/2/3a/style').send()
				expect(res.status).toBe(204)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			async function testSetStyle(queryStr, body, expected) {
				const { app, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock<ControlButtonNormal>(
					{
						styleSetFields: vi.fn(),
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

	describe('module-variable', () => {
		describe('get value', () => {
			test('no value', async () => {
				const { app, registry } = createService()

				const mockFn = registry.variables.values.getVariableValue
				mockFn.mockReturnValue(undefined)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(404)
				expect(res.text).toBe('Not found')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value empty string', async () => {
				const { app, registry } = createService()

				const mockFn = registry.variables.values.getVariableValue
				mockFn.mockReturnValue('')

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})
			test('value proper string', async () => {
				const { app, registry } = createService()

				const mockFn = registry.variables.values.getVariableValue
				mockFn.mockReturnValue('something 123')

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('something 123')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value zero number', async () => {
				const { app, registry } = createService()

				const mockFn = registry.variables.values.getVariableValue
				mockFn.mockReturnValue(0)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('0')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value real number', async () => {
				const { app, registry } = createService()

				const mockFn = registry.variables.values.getVariableValue
				mockFn.mockReturnValue(455.8)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('455.8')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value false', async () => {
				const { app, registry } = createService()

				const mockFn = registry.variables.values.getVariableValue
				mockFn.mockReturnValue(false)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('false')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})

			test('value true', async () => {
				const { app, registry } = createService()

				const mockFn = registry.variables.values.getVariableValue
				mockFn.mockReturnValue(true)

				// Perform the request
				const res = await supertest(app).get('/api/variable/ConnectionLabel/variableName/value').send()
				expect(res.status).toBe(200)
				expect(res.text).toBe('true')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('ConnectionLabel', 'variableName')
			})
			test('value object', async () => {
				const { app, registry } = createService()

				const mockFn = registry.variables.values.getVariableValue
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
