import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ApiMessageError, ServiceTcpUdpApi } from '../../lib/Service/TcpUdpApi'
import { rgb } from '../../lib/Resources/Util'
import type { ServiceApi, ServiceApiControl } from '../../lib/Service/ServiceApi'
import type { DataUserConfig } from '../../lib/Data/UserConfig'

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
				expect(router.processMessage('location 1/2/3 down')).rejects.toEqual(
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
				router.processMessage('location 1/2/3 down')

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
				expect(router.processMessage('location 1a/2/3 down')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 down')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a down')).rejects.toHaveProperty('message', 'Syntax error')

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
				expect(router.processMessage('location 1/2/3 up')).rejects.toEqual(
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
				router.processMessage('location 1/2/3 up')

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
				expect(router.processMessage('location 1a/2/3 up')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 up')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a up')).rejects.toHaveProperty('message', 'Syntax error')

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
				expect(router.processMessage('location 1/2/3 press')).rejects.toEqual(
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
				router.processMessage('location 1/2/3 press')

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
				expect(router.processMessage('location 1a/2/3 press')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 press')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a press')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate left', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 rotate-left')).rejects.toEqual(
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
				router.processMessage('location 1/2/3 rotate-left')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.rotateControl).toHaveBeenCalledWith('control123', false, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1a/2/3 rotate-left')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 rotate-left')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a rotate-left')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate right', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 rotate-right')).rejects.toEqual(
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
				router.processMessage('location 1/2/3 rotate-right')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.rotateControl).toHaveBeenCalledWith('control123', true, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1a/2/3 rotate-right')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 rotate-right')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a rotate-right')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('set step', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 set-step 2')).rejects.toEqual(
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
				expect(router.processMessage('location 1/2/3 step')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.getControl).toHaveBeenCalledTimes(0)
				expect(mockControl.setCurrentStep).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)
				mockControl.setCurrentStep = vi.fn().mockReturnValue(true)

				// Perform the request
				router.processMessage('location 1/2/3 set-step 2')

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
				expect(router.processMessage('location 1a/2/3 set-step 2')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 set-step 2')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(router.processMessage('location 1/2/3a set-step 2')).rejects.toHaveProperty('message', 'Syntax error')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			})
		})

		describe('set style: text', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 style text abc')).rejects.toEqual(
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
				router.processMessage('location 1/2/3 style text def two')

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
				router.processMessage('location 1/2/3 style text de/f two')

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
				router.processMessage('location 1/2/3 style text')

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
				expect(router.processMessage('location 1/2/3 style color abc')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(input, expected) {
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
				router.processMessage(`location 1/2/3 style color ${input}`)

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
				expect(router.processMessage('location 1/2/3 style bgcolor abc')).rejects.toEqual(
					new ApiMessageError('No control at location')
				)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(input, expected) {
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
				router.processMessage(`location 1/2/3 style bgcolor ${input}`)

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
})
