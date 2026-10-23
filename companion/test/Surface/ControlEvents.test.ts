import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { IpcWrapper } from '../../lib/Instance/Common/IpcWrapper.js'
import type {
	HostOpenDeviceResult,
	HostToSurfaceModuleEvents,
	SurfaceModuleToHostEvents,
} from '../../lib/Instance/Surface/IpcTypes.js'
import LogController, { type Logger } from '../../lib/Log/Controller.js'
import { createOrSanitizeSurfaceHandlerConfig } from '../../lib/Surface/Config.js'
import type { SurfaceController } from '../../lib/Surface/Controller.js'
import { SurfaceHandler } from '../../lib/Surface/Handler.js'
import { SurfacePluginPanel } from '../../lib/Surface/PluginPanel.js'
import type { SurfaceHandlerDependencies } from '../../lib/Surface/Types.js'

function makePanel(connectionId: string | null) {
	const ipc = mockDeep<IpcWrapper<HostToSurfaceModuleEvents, SurfaceModuleToHostEvents>>()
	ipc.sendWithCb.mockResolvedValue(undefined)
	const info: HostOpenDeviceResult = {
		surfaceId: 'test:deck',
		description: 'Test deck',
		supportsBrightness: false,
		controlEvents: connectionId ? { connectionId } : undefined,
		surfaceLayout: {
			stylePresets: { default: { bitmap: { w: 1, h: 1 } } },
			controls: { key: { row: 0, column: 0 }, other: { row: 0, column: 1 } },
		},
		surfaceAppearance: null,
		modelId: null,
		transferVariables: null,
		location: null,
		isRemote: false,
		configFields: null,
	}
	const panel = new SurfacePluginPanel(ipc, 'test-instance', info, vi.fn())
	return { panel, ipc }
}

function makeHandler(connectionId: string | null) {
	const { panel, ipc } = makePanel(connectionId)
	vi.spyOn(panel, 'draw').mockImplementation(() => {})
	const surfaces = mockDeep<SurfaceController>()
	const deps = mockDeep<SurfaceHandlerDependencies>()
	deps.userconfig.getKey.mockImplementation((key: string) => (key === 'pin' ? '1234' : undefined))
	deps.pageStore.getFirstPageId.mockReturnValue('page1')
	deps.pageStore.getPageNumber.mockReturnValue(1)
	deps.pageStore.getPageCount.mockReturnValue(2)
	deps.pageStore.getControlIdAt.mockReturnValue('control1')
	const config = createOrSanitizeSurfaceHandlerConfig('test', panel, undefined, {
		minColumn: 0,
		maxColumn: 7,
		minRow: 0,
		maxRow: 3,
	})
	const handler = new SurfaceHandler(surfaces, deps, new EventEmitter(), panel, config)
	return { panel, ipc, handler, deps }
}

function controlEventCalls(ipc: ReturnType<typeof makePanel>['ipc']) {
	return ipc.sendWithCb.mock.calls.filter(([type]) => type === 'controlEvent').map(([, msg]) => msg)
}

describe('surface control event routing', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	test('panel sends the control at that position with its own connection id, and stops once closed', () => {
		const { panel, ipc } = makePanel('open1')
		expect(panel.info.supportsControlEvents).toBe(true)
		panel.controlEvent(1, 0, 'press')
		expect(controlEventCalls(ipc)).toEqual([
			{ surfaceId: 'test:deck', connectionId: 'open1', controlId: 'other', event: 'press' },
		])
		panel.controlEvent(5, 3, 'press')
		expect(controlEventCalls(ipc)).toHaveLength(1)
		panel.quit()
		panel.controlEvent(0, 0, 'hold')
		expect(controlEventCalls(ipc)).toHaveLength(1)
		const legacy = makePanel(null)
		expect(legacy.panel.info.supportsControlEvents).toBe(false)
		legacy.panel.controlEvent(0, 0, 'press')
		expect(controlEventCalls(legacy.ipc)).toHaveLength(0)
	})

	test('panel contains synchronous and asynchronous IPC failures', async () => {
		const logger = mockDeep<Logger>()
		const createLogger = vi.spyOn(LogController, 'createLogger').mockReturnValue(logger)
		const { panel, ipc } = makePanel('open1')
		createLogger.mockRestore()
		ipc.sendWithCb.mockImplementationOnce(() => {
			throw new Error('closed')
		})
		expect(() => panel.controlEvent(0, 0, 'press')).not.toThrow()
		ipc.sendWithCb.mockRejectedValueOnce(new Error('disconnected'))
		panel.controlEvent(0, 0, 'press')
		await vi.waitFor(() => expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('disconnected')))
		expect(logger.debug).toHaveBeenCalledTimes(2)
	})

	test('events go to the pressed control, and release reuses the press after a page and offset change', () => {
		const { panel, handler, deps, ipc } = makeHandler('open1')
		panel.inputPress('other', true)
		const context = deps.controls.pressControl.mock.lastCall?.[3]
		expect(context).toBeTruthy()
		context?.request('down')
		handler.storeNewDevicePage('page2', true)
		deps.pageStore.getPageNumber.mockReturnValue(2)
		handler.setPosition(3, 2)
		panel.inputPress('other', false)
		expect(deps.controls.pressControl.mock.lastCall?.[3]).toBe(context)
		expect(deps.pageStore.getControlIdAt).toHaveBeenLastCalledWith({ pageNumber: 1, column: 1, row: 0 })
		expect(controlEventCalls(ipc)).toEqual([
			{ surfaceId: 'test:deck', connectionId: 'open1', controlId: 'other', event: 'press' },
		])
	})

	test('a run-while-held group sends hold while the press is active', () => {
		const { panel, deps, ipc } = makeHandler('open1')
		panel.inputPress('key', true)
		deps.controls.pressControl.mock.lastCall?.[3]?.request('held')
		expect(controlEventCalls(ipc)).toEqual([
			{ surfaceId: 'test:deck', connectionId: 'open1', controlId: 'key', event: 'hold' },
		])
	})

	test.each(['replace', 'lock', 'unload'] as const)('%s invalidates a pending press', (reason) => {
		const { panel, handler, deps, ipc } = makeHandler('open1')
		panel.inputPress('key', true)
		const context = deps.controls.pressControl.mock.lastCall?.[3]
		expect(context).toBeTruthy()
		if (reason === 'replace') panel.inputPress('key', true)
		else if (reason === 'lock') handler.setLocked(true, true)
		else handler.unload()
		context?.request('held')
		expect(controlEventCalls(ipc)).toHaveLength(0)
	})

	test('release still invalidates the press when the current page no longer exists', () => {
		const { panel, deps, ipc } = makeHandler('open1')
		panel.inputPress('key', true)
		const context = deps.controls.pressControl.mock.lastCall?.[3]
		deps.pageStore.getPageNumber.mockReturnValue(null)
		panel.inputPress('key', false)
		context?.request('held')
		expect(controlEventCalls(ipc)).toHaveLength(0)
	})

	test('plain input, rotary, PIN and legacy input never directly send events', () => {
		const { panel, handler, deps, ipc } = makeHandler('open1')
		panel.inputPress('key', true)
		panel.inputRotate('key', 1)
		handler.setLocked(true, true)
		panel.inputPress('key', true)
		panel.inputPincode(1)
		expect(deps.controls.pressControl).toHaveBeenCalledTimes(1)
		expect(controlEventCalls(ipc)).toHaveLength(0)
		const legacy = makeHandler(null)
		legacy.panel.inputPress('key', true)
		expect(legacy.deps.controls.pressControl.mock.lastCall?.[3]).toBeNull()
	})

	test('explicit cues go to the control showing that location, only while it is shown', () => {
		const { handler, deps, ipc } = makeHandler('open2')
		handler.sendControlEventAt({ pageNumber: 1, row: 0, column: 1 }, 'hold')
		expect(controlEventCalls(ipc)).toEqual([
			{ surfaceId: 'test:deck', connectionId: 'open2', controlId: 'other', event: 'hold' },
		])

		handler.sendControlEventAt({ pageNumber: 2, row: 0, column: 1 }, 'press')
		handler.sendControlEventAt({ pageNumber: 1, row: 3, column: 7 }, 'press')
		expect(controlEventCalls(ipc)).toHaveLength(1)

		handler.setPosition(1, 0)
		handler.sendControlEventAt({ pageNumber: 1, row: 0, column: 1 }, 'press')
		expect(controlEventCalls(ipc).at(-1)).toMatchObject({ controlId: 'key' })

		handler.setLocked(true, true)
		handler.sendControlEventAt({ pageNumber: 1, row: 0, column: 1 }, 'press')
		expect(controlEventCalls(ipc)).toHaveLength(2)
		expect(deps.controls.pressControl).not.toHaveBeenCalled()
	})
})
