import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ServiceRosstalk } from '../../lib/Service/Rosstalk'
import type { Registry } from '../../lib/Registry'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('Rosstalk', () => {
	function createService() {
		// const logger = mock(
		// 	{
		// 		info: vi.fn(),
		// 		warn: vi.fn(),
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
			page: mock(
				{
					getControlIdAt: vi.fn(),
				},
				mockOptions
			),
			controls: mock(
				{
					pressControl: vi.fn(),
				},
				mockOptions
			),
			userconfig: {
				// Force config to return true
				getKey: () => false,
			},
		})

		const service = new ServiceRosstalk(registry)

		return {
			registry,
			service,
			// logger,
		}
	}

	describe('CC - bank', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		test('no control', async () => {
			const { registry, service } = createService()

			service.processIncoming(null as any, 'CC 12:24')

			expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
			expect(registry.page.getControlIdAt).toHaveBeenLastCalledWith({
				pageNumber: 12,
				row: 2,
				column: 7,
			})

			expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
		})

		test('out of range', async () => {
			const { registry, service } = createService()

			service.processIncoming(null as any, 'CC 12:34')

			expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
		})

		test('bad format', async () => {
			const { registry, service } = createService()

			service.processIncoming(null as any, 'CC 12:')

			expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
		})

		test('ok - index', async () => {
			const { registry, service } = createService()
			registry.page.getControlIdAt.mockReturnValue('myControl')

			service.processIncoming(null as any, 'CC 12:24')

			expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
			expect(registry.page.getControlIdAt).toHaveBeenLastCalledWith({
				pageNumber: 12,
				row: 2,
				column: 7,
			})

			expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
			expect(registry.controls.pressControl).toHaveBeenLastCalledWith('myControl', true, 'rosstalk')

			vi.advanceTimersByTime(100)

			expect(registry.controls.pressControl).toHaveBeenCalledTimes(2)
			expect(registry.controls.pressControl).toHaveBeenLastCalledWith('myControl', false, 'rosstalk')
		})

		test('bad format coordinates', async () => {
			const { registry, service } = createService()

			service.processIncoming(null as any, 'CC 12/3/')

			expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
		})

		test('ok - coordinates', async () => {
			const { registry, service } = createService()
			registry.page.getControlIdAt.mockReturnValue('myControl')

			service.processIncoming(null as any, 'CC 12/3/4')

			expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
			expect(registry.page.getControlIdAt).toHaveBeenLastCalledWith({
				pageNumber: 12,
				row: 3,
				column: 4,
			})

			expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
			expect(registry.controls.pressControl).toHaveBeenLastCalledWith('myControl', true, 'rosstalk')

			vi.advanceTimersByTime(100)

			expect(registry.controls.pressControl).toHaveBeenCalledTimes(2)
			expect(registry.controls.pressControl).toHaveBeenLastCalledWith('myControl', false, 'rosstalk')
		})
	})
})
