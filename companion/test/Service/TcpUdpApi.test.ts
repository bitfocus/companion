import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import { rgb } from '../../lib/Resources/Util.js'
import type { ServiceApi, ServiceApiControl } from '../../lib/Service/ServiceApi.js'
import { ApiMessageError, ServiceTcpUdpApi } from '../../lib/Service/TcpUdpApi.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('TcpUdpApi', () => {
	function createService() {
		const serviceApi = mockDeep<ServiceApi>(mockOptions)
		const userconfig = mockDeep<DataUserConfig>(mockOptions)

		const service = new ServiceTcpUdpApi(serviceApi, userconfig, 'fake-proto', null)
		const router = service.router

		return {
			serviceApi,
			userconfig,
			router,
			service,
			// logger,
		}
	}

	describe('surfaces', () => {
		describe('rescan', () => {
			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.triggerRescanForSurfaces.mockResolvedValue(undefined)

				// Perform the request
				await router.processMessage('surfaces rescan')

				expect(serviceApi.triggerRescanForSurfaces).toHaveBeenCalledTimes(1)
			})

			test('failed', async () => {
				const { router, serviceApi } = createService()
				serviceApi.triggerRescanForSurfaces.mockRejectedValue('internal error')

				// Perform the request
				await expect(router.processMessage('surfaces rescan')).rejects.toEqual(new ApiMessageError('Rescan USB failed'))

				expect(serviceApi.triggerRescanForSurfaces).toHaveBeenCalledTimes(1)
			})
		})
	})

	describe('custom-variable', () => {
		describe('set value', () => {
			test('ok from query', async () => {
				const { router, serviceApi } = createService()

				const mockFn = serviceApi.setCustomVariableValue
				mockFn.mockReturnValue(null)

				// Perform the request
				await router.processMessage('custom-variable my-var-name set-value 123 def')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '123 def')
			})

			test('ok from query with slash', async () => {
				const { router, serviceApi } = createService()

				const mockFn = serviceApi.setCustomVariableValue
				mockFn.mockReturnValue(null)

				// Perform the request
				await router.processMessage('custom-variable my-var-name set-value 12/3 def')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '12/3 def')
			})

			test('ok empty', async () => {
				const { router, serviceApi } = createService()

				const mockFn = serviceApi.setCustomVariableValue
				mockFn.mockReturnValue(null)

				// Perform the request
				await router.processMessage('custom-variable my-var-name set-value ')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '')
			})

			test('error', async () => {
				const { router, serviceApi } = createService()
				serviceApi.setCustomVariableValue.mockReturnValue('Unknown name')

				await expect(router.processMessage('custom-variable my-var-name set-value 1')).rejects.toEqual(
					new ApiMessageError('Unknown name')
				)
			})
		})

		describe('get value', () => {
			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getCustomVariableValue.mockReturnValue('abc def')

				await expect(router.processMessage('custom-variable my-var-name get-value')).resolves.toBe('"abc def"')

				expect(serviceApi.getCustomVariableValue).toHaveBeenCalledWith('my-var-name')
			})

			test('not found', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getCustomVariableValue.mockReturnValue(undefined)

				await expect(router.processMessage('custom-variable my-var-name get-value')).rejects.toEqual(
					new ApiMessageError('Variable not found')
				)
			})
		})
	})

	describe('controls by location', () => {
		describe('down', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 down')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.getControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await router.processMessage('location 1/2/3 down')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', true, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1a/2/3 down')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2a/3 down')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2/3a down')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('up', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 up')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.getControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await router.processMessage('location 1/2/3 up')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', false, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1a/2/3 up')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2a/3 up')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2/3a up')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('press', () => {
			beforeEach(() => {
				vi.useFakeTimers()
			})

			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 press')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await router.processMessage('location 1/2/3 press')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', true, 'fake-proto')

				vi.advanceTimersByTime(100)

				expect(serviceApi.pressControl).toHaveBeenCalledTimes(2)
				expect(serviceApi.pressControl).toHaveBeenLastCalledWith('control123', false, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1a/2/3 press')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2a/3 press')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2/3a press')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate left', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 rotate-left')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				await router.processMessage('location 1/2/3 rotate-left')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.rotateControl).toHaveBeenCalledWith('control123', -1, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1a/2/3 rotate-left')).rejects.toHaveProperty(
					'message',
					'Syntax error'
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2a/3 rotate-left')).rejects.toHaveProperty(
					'message',
					'Syntax error'
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2/3a rotate-left')).rejects.toHaveProperty(
					'message',
					'Syntax error'
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate right', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 rotate-right')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				await router.processMessage('location 1/2/3 rotate-right')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.rotateControl).toHaveBeenCalledWith('control123', 1, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1a/2/3 rotate-right')).rejects.toHaveProperty(
					'message',
					'Syntax error'
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2a/3 rotate-right')).rejects.toHaveProperty(
					'message',
					'Syntax error'
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				await expect(router.processMessage('location 1/2/3a rotate-right')).rejects.toHaveProperty(
					'message',
					'Syntax error'
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('set step', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 set-step 2')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.getControl).toHaveBeenCalledTimes(0)
			})

			test('no payload', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('test')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 step')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.getControl).toHaveBeenCalledTimes(0)
				expect(mockControl.setCurrentStep).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)
				mockControl.setCurrentStep = vi.fn<(step: number) => boolean>().mockReturnValue(true)

				// Perform the request
				await router.processMessage('location 1/2/3 set-step 2')

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
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await expect(router.processMessage('location 1a/2/3 set-step 2')).rejects.toHaveProperty(
					'message',
					'Syntax error'
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await expect(router.processMessage('location 1/2a/3 set-step 2')).rejects.toHaveProperty(
					'message',
					'Syntax error'
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await expect(router.processMessage('location 1/2/3a set-step 2')).rejects.toHaveProperty(
					'message',
					'Syntax error'
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			})
		})

		describe('set style: text', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 style text abc')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock<ServiceApiControl>(
					{
						setStyleFields: vi.fn(),
					},
					mockOptions
				)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await router.processMessage('location 1/2/3 style text def two')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(serviceApi.getControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.setStyleFields).toHaveBeenCalledTimes(1)
				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ text: 'def two' })
			})

			test('ok with slash', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock<ServiceApiControl>(
					{
						setStyleFields: vi.fn(),
					},
					mockOptions
				)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await router.processMessage('location 1/2/3 style text de/f two')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(serviceApi.getControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.setStyleFields).toHaveBeenCalledTimes(1)
				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ text: 'de/f two' })
			})

			test('ok no text', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock<ServiceApiControl>(
					{
						setStyleFields: vi.fn(),
					},
					mockOptions
				)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await router.processMessage('location 1/2/3 style text')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(serviceApi.getControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.setStyleFields).toHaveBeenCalledTimes(1)
				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ text: '' })
			})
		})

		describe('set style: color', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 style color abc')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(input: string, expected: number | false) {
				expect(expected).toBeTypeOf('number') // just to satisfy TS that expected is the right type for the mock call

				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock<ServiceApiControl>(
					{
						setStyleFields: vi.fn(),
					},
					mockOptions
				)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await router.processMessage(`location 1/2/3 style color ${input}`)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(serviceApi.getControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.setStyleFields).toHaveBeenCalledTimes(1)
				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ color: expected })
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
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				await expect(router.processMessage('location 1/2/3 style bgcolor abc')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(input: string, expected: number | false) {
				expect(expected).toBeTypeOf('number') // just to satisfy TS that expected is the right type for the mock call

				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock<ServiceApiControl>(
					{
						setStyleFields: vi.fn(),
					},
					mockOptions
				)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				await router.processMessage(`location 1/2/3 style bgcolor ${input}`)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(serviceApi.getControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.setStyleFields).toHaveBeenCalledTimes(1)
				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ bgcolor: expected })
			}

			test('ok hex', async () => {
				await runColor('#abcdef', rgb('ab', 'cd', 'ef', 16))
			})

			test('ok css', async () => {
				await runColor('rgb(1,4,5)', rgb(1, 4, 5))
			})
		})
	})

	describe('surface', () => {
		test('page-set', async () => {
			const { router, serviceApi } = createService()
			serviceApi.getPageIdForNumber.mockReturnValue('page-id')
			serviceApi.surfaceSetPage.mockReturnValue(undefined)

			await expect(router.processMessage('surface emulator:abc page-set 3')).resolves.toBe(
				'If emulator:abc is connected'
			)

			expect(serviceApi.getPageIdForNumber).toHaveBeenCalledWith(3)
			expect(serviceApi.surfaceSetPage).toHaveBeenCalledTimes(1)
			expect(serviceApi.surfaceSetPage).toHaveBeenCalledWith('emulator:abc', 'page-id')
		})

		test('page-set surface with space', async () => {
			const { router, serviceApi } = createService()
			serviceApi.getPageIdForNumber.mockReturnValue('page-id')
			serviceApi.surfaceSetPage.mockReturnValue(undefined)

			await router.processMessage('surface my surface page-set 3')

			expect(serviceApi.surfaceSetPage).toHaveBeenCalledWith('my surface', 'page-id')
		})

		test('page-set unknown page', async () => {
			const { router, serviceApi } = createService()
			serviceApi.getPageIdForNumber.mockReturnValue(null)

			await expect(router.processMessage('surface abc page-set 99')).resolves.toBe('Page not found')

			expect(serviceApi.surfaceSetPage).toHaveBeenCalledTimes(0)
		})

		test('page-up', async () => {
			const { router, serviceApi } = createService()
			serviceApi.surfacePageUp.mockReturnValue(undefined)

			await expect(router.processMessage('surface abc page-up')).resolves.toBe('If abc is connected')

			expect(serviceApi.surfacePageUp).toHaveBeenCalledTimes(1)
			expect(serviceApi.surfacePageUp).toHaveBeenCalledWith('abc')
		})

		test('page-down', async () => {
			const { router, serviceApi } = createService()
			serviceApi.surfacePageDown.mockReturnValue(undefined)

			await expect(router.processMessage('surface abc page-down')).resolves.toBe('If abc is connected')

			expect(serviceApi.surfacePageDown).toHaveBeenCalledTimes(1)
			expect(serviceApi.surfacePageDown).toHaveBeenCalledWith('abc')
		})
	})

	describe('syntax error', () => {
		test('unknown command', async () => {
			const { router } = createService()

			await expect(router.processMessage('not-a-command')).rejects.toEqual(
				new ApiMessageError('Syntax error', 'in: "not-a-command"')
			)
		})

		test('missing argument', async () => {
			const { router } = createService()

			await expect(router.processMessage('location 1/2 press')).rejects.toEqual(
				new ApiMessageError('Syntax error', 'in: "location 1/2 press"')
			)
			await expect(router.processMessage('custom-variable abc set-value')).rejects.toEqual(
				new ApiMessageError('Syntax error', 'in: "custom-variable abc set-value"')
			)
		})

		test('parseApiCommand trims input', async () => {
			const { service, serviceApi } = createService()
			serviceApi.surfacePageUp.mockReturnValue(undefined)

			await expect(service.parseApiCommand('  surface abc page-up \r\n')).resolves.toBe('If abc is connected')

			expect(serviceApi.surfacePageUp).toHaveBeenCalledWith('abc')
		})
	})

	describe('legacy', () => {
		test('disabled', async () => {
			const serviceApi = mockDeep<ServiceApi>(mockOptions)
			const userconfig = mockDeep<DataUserConfig>(mockOptions)
			userconfig.getKey.mockReturnValue(false)

			const service = new ServiceTcpUdpApi(serviceApi, userconfig, 'fake-proto', 'tcp_legacy_api_enabled')

			await expect(service.router.processMessage('page-up abc')).rejects.toEqual(
				new ApiMessageError('Deprecated commands are disabled')
			)
			expect(userconfig.getKey).toHaveBeenCalledWith('tcp_legacy_api_enabled')
		})

		test('page-set', async () => {
			const { router, serviceApi } = createService()
			serviceApi.getPageIdForNumber.mockReturnValue('page-id')
			serviceApi.surfaceSetPage.mockReturnValue(undefined)

			await expect(router.processMessage('page-set 2 emulator:abc')).resolves.toBe('If emulator:abc is connected')

			expect(serviceApi.getPageIdForNumber).toHaveBeenCalledWith(2)
			expect(serviceApi.surfaceSetPage).toHaveBeenCalledWith('emulator:abc', 'page-id')
		})

		test('page-set surface with space', async () => {
			const { router, serviceApi } = createService()
			serviceApi.getPageIdForNumber.mockReturnValue('page-id')
			serviceApi.surfaceSetPage.mockReturnValue(undefined)

			await router.processMessage('page-set 2 my surface')

			expect(serviceApi.getPageIdForNumber).toHaveBeenCalledWith(2)
			expect(serviceApi.surfaceSetPage).toHaveBeenCalledWith('my surface', 'page-id')
		})

		test('page-set unknown page', async () => {
			const { router, serviceApi } = createService()
			serviceApi.getPageIdForNumber.mockReturnValue(null)

			await expect(router.processMessage('page-set 99 abc')).resolves.toBe('Page not found')

			expect(serviceApi.surfaceSetPage).toHaveBeenCalledTimes(0)
		})

		test('page-up', async () => {
			const { router, serviceApi } = createService()
			serviceApi.surfacePageUp.mockReturnValue(undefined)

			await expect(router.processMessage('page-up abc')).resolves.toBe('If abc is connected')

			expect(serviceApi.surfacePageUp).toHaveBeenCalledWith('abc')
		})

		test('page-down', async () => {
			const { router, serviceApi } = createService()
			serviceApi.surfacePageDown.mockReturnValue(undefined)

			await expect(router.processMessage('page-down abc')).resolves.toBe('If abc is connected')

			expect(serviceApi.surfacePageDown).toHaveBeenCalledWith('abc')
		})

		describe('bank-press', () => {
			beforeEach(() => {
				vi.useFakeTimers()
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAtOldBankIndex.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				await router.processMessage('bank-press 1 2')

				expect(serviceApi.getControlIdAtOldBankIndex).toHaveBeenCalledWith(1, 2)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', true, 'fake-proto')

				vi.advanceTimersByTime(100)

				expect(serviceApi.pressControl).toHaveBeenCalledTimes(2)
				expect(serviceApi.pressControl).toHaveBeenLastCalledWith('control123', false, 'fake-proto')
			})

			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAtOldBankIndex.mockReturnValue(null)

				await expect(router.processMessage('bank-press 1 2')).rejects.toEqual(
					new ApiMessageError('Page/bank out of range')
				)

				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('extra argument', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAtOldBankIndex.mockReturnValue(null)

				await expect(router.processMessage('bank-press 1 2 3')).rejects.toEqual(
					new ApiMessageError('Page/bank out of range')
				)

				expect(serviceApi.getControlIdAtOldBankIndex).toHaveBeenCalledWith(1, NaN)
			})
		})

		test('bank-down', async () => {
			const { router, serviceApi } = createService()
			serviceApi.getControlIdAtOldBankIndex.mockReturnValue('control123')
			serviceApi.pressControl.mockReturnValue(true)

			await router.processMessage('bank-down 1 2')

			expect(serviceApi.getControlIdAtOldBankIndex).toHaveBeenCalledWith(1, 2)
			expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
			expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', true, 'fake-proto')
		})

		test('bank-up', async () => {
			const { router, serviceApi } = createService()
			serviceApi.getControlIdAtOldBankIndex.mockReturnValue('control123')
			serviceApi.pressControl.mockReturnValue(true)

			await router.processMessage('bank-up 1 2')

			expect(serviceApi.getControlIdAtOldBankIndex).toHaveBeenCalledWith(1, 2)
			expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
			expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', false, 'fake-proto')
		})

		describe('bank-step', () => {
			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAtOldBankIndex.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({ setCurrentStep: vi.fn(() => true) }, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				await router.processMessage('bank-step 1 2 3')

				expect(serviceApi.getControlIdAtOldBankIndex).toHaveBeenCalledWith(1, 2)
				expect(serviceApi.getControl).toHaveBeenCalledWith('control123')
				expect(mockControl.setCurrentStep).toHaveBeenCalledWith(3)
			})

			test('bad step', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAtOldBankIndex.mockReturnValue('control123')

				await expect(router.processMessage('bank-step 1 2 abc')).rejects.toEqual(
					new ApiMessageError('Step out of range')
				)
			})
		})

		describe('style bank', () => {
			function setupControl() {
				const ctx = createService()
				ctx.serviceApi.getControlIdAtOldBankIndex.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({ setStyleFields: vi.fn() }, mockOptions)
				ctx.serviceApi.getControl.mockReturnValue(mockControl)

				return { ...ctx, mockControl }
			}

			test('text', async () => {
				const { router, serviceApi, mockControl } = setupControl()

				await router.processMessage('style bank 1 2 text hello/world two')

				expect(serviceApi.getControlIdAtOldBankIndex).toHaveBeenCalledWith(1, 2)
				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ text: 'hello/world two' })
			})

			test('no text', async () => {
				const { router, mockControl } = setupControl()

				await router.processMessage('style bank 1 2 text')

				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ text: '' })
			})

			test('bgcolor', async () => {
				const { router, serviceApi, mockControl } = setupControl()

				await router.processMessage('style bank 1 2 bgcolor #ff0080')

				expect(serviceApi.getControlIdAtOldBankIndex).toHaveBeenCalledWith(1, 2)
				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ bgcolor: 0xff0080 })
			})

			test('color', async () => {
				const { router, serviceApi, mockControl } = setupControl()

				await router.processMessage('style bank 1 2 color #00ff80')

				expect(serviceApi.getControlIdAtOldBankIndex).toHaveBeenCalledWith(1, 2)
				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ color: 0x00ff80 })
			})

			test('invalid color', async () => {
				const { router, mockControl } = setupControl()

				await expect(router.processMessage('style bank 1 2 color #xyz')).rejects.toEqual(
					new ApiMessageError('Invalid color')
				)

				expect(mockControl.setStyleFields).toHaveBeenCalledTimes(0)
			})

			test('color without hash', async () => {
				const { router } = setupControl()

				await expect(router.processMessage('style bank 1 2 color 00ff80')).rejects.toEqual(
					new ApiMessageError('Syntax error', 'in: "style bank 1 2 color 00ff80"')
				)
			})
		})

		test('rescan', async () => {
			const { router, serviceApi } = createService()
			serviceApi.triggerRescanForSurfaces.mockResolvedValue(undefined)

			await router.processMessage('rescan')

			expect(serviceApi.triggerRescanForSurfaces).toHaveBeenCalledTimes(1)
		})
	})
})
