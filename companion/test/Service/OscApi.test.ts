import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ServiceOscApi } from '../../lib/Service/OscApi.js'
import { rgb } from '../../lib/Resources/Util.js'
import type { ServiceApi, ServiceApiControl } from '../../lib/Service/ServiceApi.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('OscApi', () => {
	function createService() {
		const serviceApi = mockDeep<ServiceApi>(mockOptions)
		const userconfig = mockDeep<DataUserConfig>(mockOptions)

		const service = new ServiceOscApi(serviceApi, userconfig)
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
				router.processMessage('/surfaces/rescan')

				expect(serviceApi.triggerRescanForSurfaces).toHaveBeenCalledTimes(1)
			})

			test('failed', async () => {
				const { router, serviceApi } = createService()
				serviceApi.triggerRescanForSurfaces.mockRejectedValue('internal error')

				// Perform the request
				router.processMessage('/surfaces/rescan')

				expect(serviceApi.triggerRescanForSurfaces).toHaveBeenCalledTimes(1)
			})
		})
	})

	describe('custom-variable', () => {
		describe('set value', () => {
			test('no value', async () => {
				const { router } = createService()

				// Perform the request
				router.processMessage('/custom-variable/my-var-name/value', { args: [] })
			})

			test('ok from query', async () => {
				const { router, serviceApi } = createService()

				const mockFn = serviceApi.setCustomVariableValue
				mockFn.mockReturnValue(null)

				// Perform the request
				router.processMessage('/custom-variable/my-var-name/value', {
					args: [
						{
							value: '123',
						},
					],
				})

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '123')
			})

			test('ok from body', async () => {
				const { router, serviceApi } = createService()

				const mockFn = serviceApi.setCustomVariableValue
				mockFn.mockReturnValue(null)

				// Perform the request
				router.processMessage('/custom-variable/my-var-name/value', {
					args: [
						{
							value: 'def',
						},
					],
				})

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', 'def')
			})

			test('unknown name', async () => {
				const { router, serviceApi } = createService()

				const mockFn = serviceApi.setCustomVariableValue
				mockFn.mockReturnValue('Unknown name')

				// Perform the request
				router.processMessage('/custom-variable/my-var-name/value', {
					args: [
						{
							value: 'def',
						},
					],
				})

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', 'def')
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
				router.processMessage('/location/1/2/3/down')

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
				router.processMessage('/location/1/2/3/down')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', true, 'osc')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/down')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/down')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/down')

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
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2/3/up')

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
				router.processMessage('/location/1/2/3/up')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', false, 'osc')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/up')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/up')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/up')

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
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/press')

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
				router.processMessage('/location/1/2/3/press')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.pressControl).toHaveBeenCalledWith('control123', true, 'osc')

				vi.advanceTimersByTime(100)

				expect(serviceApi.pressControl).toHaveBeenCalledTimes(2)
				expect(serviceApi.pressControl).toHaveBeenLastCalledWith('control123', false, 'osc')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/press')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/press')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/press')

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
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/rotate-left')

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
				router.processMessage('/location/1/2/3/rotate-left')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.rotateControl).toHaveBeenCalledWith('control123', false, 'osc')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/rotate-left')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/rotate-left')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/rotate-left')

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
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/rotate-right')

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
				router.processMessage('/location/1/2/3/rotate-right')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.rotateControl).toHaveBeenCalledWith('control123', true, 'osc')
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/rotate-right')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/rotate-right')

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(serviceApi.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)
				serviceApi.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/rotate-right')

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
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2/3/step', { args: [{ value: 2 }] })

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
				router.processMessage('/location/1/2/3/step', { args: [] })

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(serviceApi.getControl).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)
				mockControl.setCurrentStep = vi.fn<typeof mockControl.setCurrentStep>().mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3/step', { args: [{ value: 2 }] })

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(mockControl.setCurrentStep).toHaveBeenCalledTimes(1)
				expect(mockControl.setCurrentStep).toHaveBeenCalledWith(2)
			})

			test('string step', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)
				mockControl.setCurrentStep = vi.fn<typeof mockControl.setCurrentStep>().mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3/step', { args: [{ value: '4' }] })

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(mockControl.setCurrentStep).toHaveBeenCalledTimes(1)
				expect(mockControl.setCurrentStep).toHaveBeenCalledWith(4)
			})

			test('bad page', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1a/2/3/step', { args: [{ value: 2 }] })

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
			})

			test('bad row', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2a/3/step', { args: [{ value: 2 }] })

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
			})

			test('bad column', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ServiceApiControl>({}, mockOptions)
				serviceApi.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2/3a/step', { args: [{ value: 2 }] })

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
			})
		})

		describe('set style: text', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/style/text', { args: [{ value: 'abc' }] })

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
				router.processMessage('/location/1/2/3/style/text', { args: [{ value: 'def' }] })

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(serviceApi.getControl).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.setStyleFields).toHaveBeenCalledTimes(1)
				expect(mockControl.setStyleFields).toHaveBeenCalledWith({ text: 'def' })
			})
		})

		describe('set style: color', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/style/color', { args: [{ value: 'abc' }] })

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(args, expected) {
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
				router.processMessage('/location/1/2/3/style/color', { args })

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
				await runColor([{ value: '#abcdef' }], rgb('ab', 'cd', 'ef', 16))
			})

			test('ok separate', async () => {
				await runColor([{ value: 5 }, { value: 8 }, { value: 11 }], rgb(5, 8, 11))
			})

			test('ok css', async () => {
				await runColor([{ value: 'rgb(1,4,5)' }], rgb(1, 4, 5))
			})
		})

		describe('set style: bgcolor', () => {
			test('no control', async () => {
				const { router, serviceApi } = createService()
				serviceApi.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/style/bgcolor', { args: [{ value: 'abc' }] })

				expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(args, expected) {
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
				router.processMessage('/location/1/2/3/style/bgcolor', { args })

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
				await runColor([{ value: '#abcdef' }], rgb('ab', 'cd', 'ef', 16))
			})

			test('ok separate', async () => {
				await runColor([{ value: 5 }, { value: 8 }, { value: 11 }], rgb(5, 8, 11))
			})

			test('ok css', async () => {
				await runColor([{ value: 'rgb(1,4,5)' }], rgb(1, 4, 5))
			})
		})
	})
})
