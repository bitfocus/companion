import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ServiceOscApi } from '../../lib/Service/OscApi'
import { rgb } from '../../lib/Resources/Util'
import type { Registry } from '../../lib/Registry'
import type { ControlButtonNormal } from '../../lib/Controls/ControlTypes/Button/Normal'
import type { ControlEntityListPoolButton } from '../../lib/Controls/Entities/EntityListPoolButton'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('OscApi', () => {
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

		const service = new ServiceOscApi(registry)
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
				router.processMessage('/surfaces/rescan')

				expect(registry.surfaces.triggerRefreshDevices).toHaveBeenCalledTimes(1)
			})

			test('failed', async () => {
				const { router, registry } = createService()
				registry.surfaces.triggerRefreshDevices.mockRejectedValue('internal error')

				// Perform the request
				router.processMessage('/surfaces/rescan')

				expect(registry.surfaces.triggerRefreshDevices).toHaveBeenCalledTimes(1)
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
				const { router, registry } = createService()

				const mockFn = registry.variables.custom.setValue
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
				const { router, registry } = createService()

				const mockFn = registry.variables.custom.setValue
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
				const { router, registry } = createService()

				const mockFn = registry.variables.custom.setValue
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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2/3/down')

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
				router.processMessage('/location/1/2/3/down')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.pressControl).toHaveBeenCalledWith('control123', true, 'osc')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/down')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/down')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/down')

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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2/3/up')

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
				router.processMessage('/location/1/2/3/up')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.pressControl).toHaveBeenCalledWith('control123', false, 'osc')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/up')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/up')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/up')

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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/press')

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
				router.processMessage('/location/1/2/3/press')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.pressControl).toHaveBeenCalledWith('control123', true, 'osc')

				vi.advanceTimersByTime(100)

				expect(registry.controls.pressControl).toHaveBeenCalledTimes(2)
				expect(registry.controls.pressControl).toHaveBeenLastCalledWith('control123', false, 'osc')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/press')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/press')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.pressControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/press')

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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/rotate-left')

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
				router.processMessage('/location/1/2/3/rotate-left')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.rotateControl).toHaveBeenCalledWith('control123', false, 'osc')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/rotate-left')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/rotate-left')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/rotate-left')

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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/rotate-right')

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
				router.processMessage('/location/1/2/3/rotate-right')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(1)
				expect(registry.controls.rotateControl).toHaveBeenCalledWith('control123', true, 'osc')
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1a/2/3/rotate-right')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2a/3/rotate-right')

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
				expect(registry.controls.rotateControl).toHaveBeenCalledTimes(0)
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)
				registry.controls.rotateControl.mockReturnValue(true)

				// Perform the request
				router.processMessage('/location/1/2/3a/rotate-right')

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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2/3/step', { args: [{ value: 2 }] })

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

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2/3/step', { args: [] })

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
				expect(registry.controls.getControl).toHaveBeenCalledTimes(0)
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
				router.processMessage('/location/1/2/3/step', { args: [{ value: 2 }] })

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(mockControlEntities.stepMakeCurrent).toHaveBeenCalledTimes(1)
				expect(mockControlEntities.stepMakeCurrent).toHaveBeenCalledWith(2)
			})

			test('string step', async () => {
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
				router.processMessage('/location/1/2/3/step', { args: [{ value: '4' }] })

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
				expect(mockControlEntities.stepMakeCurrent).toHaveBeenCalledTimes(1)
				expect(mockControlEntities.stepMakeCurrent).toHaveBeenCalledWith(4)
			})

			test('bad page', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1a/2/3/step', { args: [{ value: 2 }] })

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: NaN,
					row: 2,
					column: 3,
				})
			})

			test('bad row', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2a/3/step', { args: [{ value: 2 }] })

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: NaN,
					column: 3,
				})
			})

			test('bad column', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				const mockControl = mock<ControlButtonNormal>({}, mockOptions)
				registry.controls.getControl.mockReturnValue(mockControl)

				// Perform the request
				router.processMessage('/location/1/2/3a/step', { args: [{ value: 2 }] })

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: NaN,
				})
			})
		})

		describe('set style: text', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/style/text', { args: [{ value: 'abc' }] })

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
				router.processMessage('/location/1/2/3/style/text', { args: [{ value: 'def' }] })

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
		})

		describe('set style: color', () => {
			test('no control', async () => {
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/style/color', { args: [{ value: 'abc' }] })

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(args, expected) {
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
				router.processMessage('/location/1/2/3/style/color', { args })

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
				const { router, registry } = createService()
				registry.page.getControlIdAt.mockReturnValue(null)

				// Perform the request
				router.processMessage('/location/1/2/3/style/bgcolor', { args: [{ value: 'abc' }] })

				expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
				expect(registry.page.getControlIdAt).toHaveBeenCalledWith({
					pageNumber: 1,
					row: 2,
					column: 3,
				})
			})

			async function runColor(args, expected) {
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
				router.processMessage('/location/1/2/3/style/bgcolor', { args })

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
