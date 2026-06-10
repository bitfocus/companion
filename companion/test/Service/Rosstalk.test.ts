import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import { ServiceRosstalk } from '../../lib/Service/Rosstalk.js'
import type { ServiceApi } from '../../lib/Service/ServiceApi.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('Rosstalk', () => {
	function createService() {
		const serviceApi = mockDeep<ServiceApi>(mockOptions, {
			getControlIdAt: vi.fn(),
			pressControl: vi.fn(),
		})
		const userconfig = mockDeep<DataUserConfig>(mockOptions, {
			getKey: () => false,
		})

		const service = new ServiceRosstalk(serviceApi, userconfig)

		return {
			serviceApi,
			userconfig,
			service,
			// logger,
		}
	}

	describe('CC - bank', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		test('no control', async () => {
			const { serviceApi, service } = createService()

			service.processIncoming(null as any, 'CC 12:24')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
			expect(serviceApi.getControlIdAt).toHaveBeenLastCalledWith({
				pageNumber: 12,
				row: 2,
				column: 7,
			})

			expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
		})

		test('out of range', async () => {
			const { serviceApi, service } = createService()

			service.processIncoming(null as any, 'CC 12:34')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
		})

		test('bad format', async () => {
			const { serviceApi, service } = createService()

			service.processIncoming(null as any, 'CC 12:')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
		})

		test('ok - index', async () => {
			const { serviceApi, service } = createService()
			serviceApi.getControlIdAt.mockReturnValue('myControl')

			service.processIncoming(null as any, 'CC 12:24')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
			expect(serviceApi.getControlIdAt).toHaveBeenLastCalledWith({
				pageNumber: 12,
				row: 2,
				column: 7,
			})

			expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
			expect(serviceApi.pressControl).toHaveBeenLastCalledWith('myControl', true, 'rosstalk')

			vi.advanceTimersByTime(100)

			expect(serviceApi.pressControl).toHaveBeenCalledTimes(2)
			expect(serviceApi.pressControl).toHaveBeenLastCalledWith('myControl', false, 'rosstalk')
		})

		test('command surrounded by garbage is ignored', async () => {
			const { serviceApi, service } = createService()

			service.processIncoming(null as any, 'garbage CC 12:24 more garbage')
			service.processIncoming(null as any, 'XX CC 12/3/4')
			service.processIncoming(null as any, 'CC 12/3/4 trailing')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
		})

		test('command with line terminator', async () => {
			const { serviceApi, service } = createService()
			serviceApi.getControlIdAt.mockReturnValue('myControl')

			service.processIncoming(null as any, 'CC 12:24\r\n')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
			expect(serviceApi.getControlIdAt).toHaveBeenLastCalledWith({
				pageNumber: 12,
				row: 2,
				column: 7,
			})

			expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
		})

		test('multiple commands in one chunk', async () => {
			const { serviceApi, service } = createService()
			serviceApi.getControlIdAt.mockReturnValue('myControl')

			service.processIncoming(null as any, 'CC 12:24\nCC 13/3/4\n')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(2)
			expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
				pageNumber: 12,
				row: 2,
				column: 7,
			})
			expect(serviceApi.getControlIdAt).toHaveBeenLastCalledWith({
				pageNumber: 13,
				row: 3,
				column: 4,
			})

			expect(serviceApi.pressControl).toHaveBeenCalledTimes(2)
		})

		test('bad format coordinates', async () => {
			const { serviceApi, service } = createService()

			service.processIncoming(null as any, 'CC 12/3/')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(0)
			expect(serviceApi.pressControl).toHaveBeenCalledTimes(0)
		})

		test('ok - coordinates', async () => {
			const { serviceApi, service } = createService()
			serviceApi.getControlIdAt.mockReturnValue('myControl')

			service.processIncoming(null as any, 'CC 12/3/4')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledTimes(1)
			expect(serviceApi.getControlIdAt).toHaveBeenLastCalledWith({
				pageNumber: 12,
				row: 3,
				column: 4,
			})

			expect(serviceApi.pressControl).toHaveBeenCalledTimes(1)
			expect(serviceApi.pressControl).toHaveBeenLastCalledWith('myControl', true, 'rosstalk')

			vi.advanceTimersByTime(100)

			expect(serviceApi.pressControl).toHaveBeenCalledTimes(2)
			expect(serviceApi.pressControl).toHaveBeenLastCalledWith('myControl', false, 'rosstalk')
		})
	})
})
