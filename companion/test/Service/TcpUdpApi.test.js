import { jest } from '@jest/globals'
import { mock } from 'jest-mock-extended'
import { ApiMessageError, ServiceTcpUdpApi } from '../../lib/Service/TcpUdpApi'
import { rgb } from '../../lib/Resources/Util'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('TcpUdpApi', () => {
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

		const service = new ServiceTcpUdpApi(registry, 'fake-proto', null)
		const router = service.router

		return {
			registry,
			router,
			service,
			logger,
		}
	}

	describe('surfaces', () => {
		describe('rescan', () => {
			test('ok', async () => {
				const { router, registry } = createService()
				registry.surfaces.triggerRefreshDevices.mockResolvedValue()

				// Perform the request
				await router.processMessage('surfaces rescan')

				expect(registry.surfaces.triggerRefreshDevices).toHaveBeenCalledTimes(1)
			})

			test('failed', async () => {
				const { router, registry } = createService()
				registry.surfaces.triggerRefreshDevices.mockRejectedValue('internal error')

				// Perform the request
				await expect(router.processMessage('surfaces rescan')).rejects.toEqual(new ApiMessageError('Scan failed'))

				expect(registry.surfaces.triggerRefreshDevices).toHaveBeenCalledTimes(1)
			})
		})
	})

	describe('custom-variable', () => {
		describe('set value', () => {
			test('ok from query', async () => {
				const { router, registry } = createService()

				const mockFn = registry.instance.variable.custom.setValue
				mockFn.mockReturnValue()

				// Perform the request
				await router.processMessage('custom-variable my-var-name set-value 123')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '123')
			})

			test('ok empty', async () => {
				const { router, registry } = createService()

				const mockFn = registry.instance.variable.custom.setValue
				mockFn.mockReturnValue()

				// Perform the request
				await router.processMessage('custom-variable my-var-name set-value ')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '')
			})
		})
	})

	describe('controls by location', () => {
		describe('down', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 down')).toThrow(
					new ApiMessageError('No control at location')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.getControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('location 1/2/3 down')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.pressControl).toHaveBeenCalledWith('control123', true, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1a/2/3 down')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2a/3 down')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3a down')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('up', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 up')).toThrow(new ApiMessageError('No control at location'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.getControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('location 1/2/3 up')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.pressControl).toHaveBeenCalledWith('control123', false, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1a/2/3 up')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2a/3 up')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3a up')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('press', () => {
			beforeEach(() => {
				jest.useFakeTimers()
			})

			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 press')).toThrow(
					new ApiMessageError('No control at location')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('location 1/2/3 press')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.pressControl).toHaveBeenCalledWith('control123', true, 'fake-proto')

				jest.advanceTimersByTime(100)

				expect(registry.controls.pressControl).toHaveBeenCalledTimes(2)
				expect(registry.controls.pressControl).toHaveBeenLastCalledWith('control123', false, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1a/2/3 press')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2a/3 press')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3a press')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate left', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 rotate-left')).toThrow(
					new ApiMessageError('No control at location')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('location 1/2/3 rotate-left')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.rotateControl).toHaveBeenCalledWith('control123', false, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1a/2/3 rotate-left')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2a/3 rotate-left')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3a rotate-left')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate right', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 rotate-right')).toThrow(
					new ApiMessageError('No control at location')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('location 1/2/3 rotate-right')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.rotateControl).toHaveBeenCalledWith('control123', true, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1a/2/3 rotate-right')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2a/3 rotate-right')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3a rotate-right')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('set step', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 set-step 2')).toThrow(
					new ApiMessageError('No control at location')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.getControl).toHaveBeenCalledTimes(0)
			})

			test('no payload', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('test')

				const mockControl = mock(
					{
						stepMakeCurrent: jest.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 step')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.getControl).toHaveBeenCalledTimes(0)
				expect(mockControl.stepMakeCurrent).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, registry } = createService()
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
				router.processMessage('location 1/2/3 set-step 2')

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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(() => router.processMessage('location 1a/2/3 set-step 2')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(() => router.processMessage('location 1/2a/3 set-step 2')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3a set-step 2')).toThrow(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			})
		})

		describe('set style: text', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 style text abc')).toThrow(
					new ApiMessageError('No control at location')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			test('ok', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock(
					{
						styleSetFields: jest.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('location 1/2/3 style text def')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(registry.controls.getControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.styleSetFields).toHaveBeenCalledTimes(1)
				expect(mockControl.styleSetFields).toHaveBeenCalledWith({ text: 'def' })
			})

			test('ok no text', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock(
					{
						styleSetFields: jest.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('location 1/2/3 style text')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(registry.controls.getControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.styleSetFields).toHaveBeenCalledTimes(1)
				expect(mockControl.styleSetFields).toHaveBeenCalledWith({ text: '' })
			})
		})

		describe('set style: color', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 style color abc')).toThrow(
					new ApiMessageError('No control at location')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(input, expected) {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock(
					{
						styleSetFields: jest.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage(`location 1/2/3 style color ${input}`)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(registry.controls.getControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.styleSetFields).toHaveBeenCalledTimes(1)
				expect(mockControl.styleSetFields).toHaveBeenCalledWith({ color: expected })
			}

			test('ok hex', async () => {
				await runColor('#abcdef', rgb('ab', 'cd', 'ef', 16))
			})

			test('ok css', async () => {
				await runColor('rgb(1,4,5)', rgb(1, 4, 5))
			})
		})

		describe('set style: bgcolor', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(undefined)

				// Perform the request
				expect(() => router.processMessage('location 1/2/3 style bgcolor abc')).toThrow(
					new ApiMessageError('No control at location')
				)
				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(input, expected) {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock(
					{
						styleSetFields: jest.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage(`location 1/2/3 style bgcolor ${input}`)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(registry.controls.getControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.styleSetFields).toHaveBeenCalledTimes(1)
				expect(mockControl.styleSetFields).toHaveBeenCalledWith({ bgcolor: expected })
			}

			test('ok hex', async () => {
				await runColor('#abcdef', rgb('ab', 'cd', 'ef', 16))
			})

			test('ok css', async () => {
				await runColor('rgb(1,4,5)', rgb(1, 4, 5))
			})
		})
	})
})
