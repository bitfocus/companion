import { jest } from '@jest/globals'
import { mock } from 'jest-mock-extended'
import ServiceRosstalk from '../../lib/Service/Rosstalk'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('Rosstalk', () => {
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
				page: mock(
					{
						getControlIdAt: jest.fn(),
					},
					mockOptions
				),
				controls: mock(
					{
						pressControl: jest.fn(),
					},
					mockOptions
				),
				userconfig: {
					// Force config to return true
					getKey: () => false,
				},
			},
			mockOptions
		)

		const service = new ServiceRosstalk(registry)

		return {
			registry,
			service,
			logger,
		}
	}

	describe('CC - bank', () => {
		beforeEach(() => {
			jest.useFakeTimers()
		})

		test('no control', async () => {
			const { registry, service } = createService()

			service.processIncoming(null, 'CC 12:24')

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

			service.processIncoming(null, 'CC 12:34')

			expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(0)
			expect(registry.controls.pressControl).toHaveBeenCalledTimes(0)
		})

		test('ok', async () => {
			const { registry, service } = createService()
			registry.page.getControlIdAt.mockReturnValue('myControl')

			service.processIncoming(null, 'CC 12:24')

			expect(registry.page.getControlIdAt).toHaveBeenCalledTimes(1)
			expect(registry.page.getControlIdAt).toHaveBeenLastCalledWith({
				pageNumber: 12,
				row: 2,
				column: 7,
			})

			expect(registry.controls.pressControl).toHaveBeenCalledTimes(1)
			expect(registry.controls.pressControl).toHaveBeenLastCalledWith('myControl', true, 'rosstalk')

			jest.advanceTimersByTime(100)

			expect(registry.controls.pressControl).toHaveBeenCalledTimes(2)
			expect(registry.controls.pressControl).toHaveBeenLastCalledWith('myControl', false, 'rosstalk')
		})
	})
})
