import { usb } from 'usb'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import { SurfaceController } from '../../lib/Surface/Controller.js'
import type { SurfaceHandlerDependencies } from '../../lib/Surface/Types.js'

vi.mock('usb', () => ({
	usb: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
}))

class TestDatabase extends DataStoreBase<any> {
	constructor() {
		super(':memory:', '', 'main', 'Data/Database', () => {})
		this.startSQLite()
	}
	protected create(): void {
		createTables(this.store, this.defaultTable, this.logger)
	}
	protected loadDefaults(): void {}
	protected migrateFileToSqlite(): void {}
}

function createController(usbHotplug: boolean) {
	const deps = mockDeep<SurfaceHandlerDependencies>({
		fallbackMockImplementation: () => undefined,
	})
	deps.userconfig.getKey.mockImplementation((key: string) => {
		if (key === 'usb_hotplug') return usbHotplug
		if (key === 'gridSize') return { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }
		return undefined
	})
	deps.pageStore.getFirstPageId.mockReturnValue('page1')

	return new SurfaceController(new TestDatabase() as any, deps)
}

describe('SurfaceController usb hotplug lifecycle', () => {
	beforeEach(() => {
		vi.mocked(usb.addEventListener).mockClear()
		vi.mocked(usb.removeEventListener).mockClear()
	})

	test('quit stops watching for usb connect events', () => {
		const controller = createController(true)

		expect(usb.addEventListener).toHaveBeenCalledTimes(1)
		const [event, listener] = vi.mocked(usb.addEventListener).mock.calls[0]
		expect(event).toBe('connect')

		controller.quit()
		expect(usb.removeEventListener).toHaveBeenCalledTimes(1)
		expect(usb.removeEventListener).toHaveBeenCalledWith('connect', listener)

		// Already stopped, so disabling hotplug afterwards has nothing left to remove
		controller.updateUserConfig('usb_hotplug', false)
		expect(usb.removeEventListener).toHaveBeenCalledTimes(1)
	})

	test('quit does not touch usb when hotplug was never enabled', () => {
		const controller = createController(false)
		expect(usb.addEventListener).not.toHaveBeenCalled()

		controller.quit()
		expect(usb.removeEventListener).not.toHaveBeenCalled()
	})
})
