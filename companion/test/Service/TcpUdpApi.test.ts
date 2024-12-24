import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ApiMessageError, ServiceTcpUdpApi } from '../../lib/Service/TcpUdpApi'
import { rgb } from '../../lib/Resources/Util'
import type { Registry } from '../../lib/Registry'
import type { ControlButtonNormal } from '../../lib/Controls/ControlTypes/Button/Normal'
import type { ControlEntityListPoolButton } from '../../lib/Controls/Entities/EntityListPoolButton'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('TcpUdpApi', () => {
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
			variables: mock(
				{
					custom: mock({}, mockOptions),
				},
				mockOptions
			),
		})

		const service = new ServiceTcpUdpApi(registry, 'fake-proto', null)
		const router = service.router

		return {
			registry,
			router,
			service,
			// logger,
		}
	}

	describe('surfaces', () => {
		describe('rescan', () => {
			test('ok', async () => {
				const { router, registry } = createService()
				registry.surfaces.triggerRefreshDevices.mockResolvedValue(undefined)

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

				const mockFn = registry.variables.custom.setValue
				mockFn.mockReturnValue(null)

				// Perform the request
				await router.processMessage('custom-variable my-var-name set-value 123 def')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '123 def')
			})

			test('ok from query with slash', async () => {
				const { router, registry } = createService()

				const mockFn = registry.variables.custom.setValue
				mockFn.mockReturnValue(null)

				// Perform the request
				await router.processMessage('custom-variable my-var-name set-value 12/3 def')

				expect(mockFn).toHaveBeenCalledTimes(1)
				expect(mockFn).toHaveBeenCalledWith('my-var-name', '12/3 def')
			})

			test('ok empty', async () => {
				const { router, registry } = createService()

				const mockFn = registry.variables.custom.setValue
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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(router.processMessage('location 1/2/3 down')).rejects.toEqual(
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
				expect(router.processMessage('location 1a/2/3 down')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 down')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a down')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('up', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(router.processMessage('location 1/2/3 up')).rejects.toEqual(
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
				expect(router.processMessage('location 1a/2/3 up')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 up')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a up')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('press', () => {
			beforeEach(() => {
				vi.useFakeTimers()
			})

			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 press')).rejects.toEqual(
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

				vi.advanceTimersByTime(100)

				expect(registry.controls.pressControl).toHaveBeenCalledTimes(2)
				expect(registry.controls.pressControl).toHaveBeenLastCalledWith('control123', false, 'fake-proto')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1a/2/3 press')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 press')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a press')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate left', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 rotate-left')).rejects.toEqual(
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
				expect(router.processMessage('location 1a/2/3 rotate-left')).rejects.toEqual(
					new ApiMessageError('Syntax error')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 rotate-left')).rejects.toEqual(
					new ApiMessageError('Syntax error')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a rotate-left')).rejects.toEqual(
					new ApiMessageError('Syntax error')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('rotate right', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 rotate-right')).rejects.toEqual(
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
				expect(router.processMessage('location 1a/2/3 rotate-right')).rejects.toEqual(
					new ApiMessageError('Syntax error')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 rotate-right')).rejects.toEqual(
					new ApiMessageError('Syntax error')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				expect(router.processMessage('location 1/2/3a rotate-right')).rejects.toEqual(
					new ApiMessageError('Syntax error')
				)

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})
		})

		describe('set step', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 set-step 2')).rejects.toEqual(
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
				expect(router.processMessage('location 1/2/3 step')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.getControl).toHaveBeenCalledTimes(0)
				expect(mockControlEntities.stepMakeCurrent).toHaveBeenCalledTimes(0)
			})

			test('ok', async () => {
				const { router, registry } = createService()
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
				router.processMessage('location 1/2/3 set-step 2')

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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(router.processMessage('location 1a/2/3 set-step 2')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(router.processMessage('location 1/2a/3 set-step 2')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('control123')

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				expect(router.processMessage('location 1/2/3a set-step 2')).rejects.toEqual(new ApiMessageError('Syntax error'))

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			})
		})

		describe('set style: text', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 style text abc')).rejects.toEqual(
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

				const mockControl = mock<ControlButtonNormal>(
					{
						styleSetFields: vi.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('location 1/2/3 style text def two')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(registry.controls.getControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.styleSetFields).toHaveBeenCalledTimes(1)
				expect(mockControl.styleSetFields).toHaveBeenCalledWith({ text: 'def two' })
			})

			test('ok with slash', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock<ControlButtonNormal>(
					{
						styleSetFields: vi.fn(),
					},
					mockOptions
				)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('location 1/2/3 style text de/f two')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})

				expect(registry.controls.getControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.getControl).toHaveBeenCalledWith('abc')

				expect(mockControl.styleSetFields).toHaveBeenCalledTimes(1)
				expect(mockControl.styleSetFields).toHaveBeenCalledWith({ text: 'de/f two' })
			})

			test('ok no text', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue('abc')

				const mockControl = mock<ControlButtonNormal>(
					{
						styleSetFields: vi.fn(),
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
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 style color abc')).rejects.toEqual(
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

				const mockControl = mock<ControlButtonNormal>(
					{
						styleSetFields: vi.fn(),
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
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				expect(router.processMessage('location 1/2/3 style bgcolor abc')).rejects.toEqual(
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

				const mockControl = mock<ControlButtonNormal>(
					{
						styleSetFields: vi.fn(),
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
