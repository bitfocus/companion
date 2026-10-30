import os from 'node:os'
import * as Sentry from '@sentry/node'
import { initTRPC } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { DataUsageStatistics } from '../../lib/Data/UsageStatistics.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'

vi.mock(import('@sentry/node'), async (importOriginal) => ({ ...(await importOriginal()), captureException: vi.fn() }))

const t = initTRPC.context<TrpcContext>().create()

const GRID_SIZE = { minColumn: -1, maxColumn: 7, minRow: 0, maxRow: 3 }

function setup() {
	const config: Partial<UserConfigModel> = { gridSize: GRID_SIZE }

	const controls = {
		getAllButtons: vi.fn((): unknown[] => []),
		getAllTriggers: vi.fn((): unknown[] => []),
		getAllExpressionVariables: vi.fn((): unknown[] => []),
		getPageVariableCount: vi.fn(() => 0),
		getControlCountOfType: vi.fn((_type: string) => 0),
	}
	const surfaces = {
		getDevicesList: vi.fn((): any[] => []),
		getGroupCount: vi.fn(() => 0),
	}
	const instances = {
		getAllConnectionIds: vi.fn((): string[] => []),
		getConnectionsMetrics: vi.fn((): Record<string, any> => ({})),
		getSurfacesMetrics: vi.fn((): Record<string, any> => ({})),
		modulesStore: { getCachedStoreList: vi.fn((_type: ModuleInstanceType): Record<string, unknown> => ({})) },
	}
	const pages = { store: { getPageCount: vi.fn(() => 1) } }
	const graphics = { imageLibrary: { listImages: vi.fn((): unknown[] => []) } }
	const variables = { custom: { getDefinitions: vi.fn((): Record<string, unknown> => ({})) } }
	const cloud = { data: { cloudActive: false } }
	const service = {
		satelliteTcp: { clientCount: 0 },
		satelliteWebsocket: { clientCount: 0 },
		restApi: { tokenStore: { list: vi.fn((): unknown[] => []) } },
	}
	const userConfig = { getKey: vi.fn((key: keyof UserConfigModel) => config[key]) }
	const appInfo: any = { machineId: 'machine-1', appVersion: '5.1.0', appBuild: '5.1.0+test' }

	const stats = new DataUsageStatistics(
		appInfo,
		surfaces as any,
		instances as any,
		pages as any,
		controls as any,
		graphics as any,
		variables as any,
		cloud as any,
		service as any,
		userConfig as any
	)

	const caller = t.createCallerFactory(stats.createTrpcRouter())(createMockTrpcContext())

	return {
		stats,
		config,
		controls,
		surfaces,
		instances,
		pages,
		graphics,
		variables,
		cloud,
		service,
		getPayload: async () => caller.getCurrentPayload(),
	}
}

describe('DataUsageStatistics', () => {
	beforeEach(() => {
		vi.mocked(Sentry.captureException).mockClear()
	})

	describe('payload', () => {
		it('includes the app and os info', async () => {
			const { getPayload } = setup()

			const payload = await getPayload()

			expect(payload.id).toBe('machine-1')
			expect(payload.app).toEqual({ name: 'companion', version: '5.1.0', build: '5.1.0+test' })
			expect(payload.os).toEqual({ platform: os.platform(), arch: os.arch(), release: os.release() })
			expect(payload.uptime).toBeTypeOf('number')
		})

		it('reports an empty install', async () => {
			const { getPayload } = setup()

			const payload = await getPayload()

			expect(payload.surfaces).toEqual([])
			expect(payload.connections).toEqual([])
			expect(payload.surfaceModules).toEqual([])
			expect(payload.features).toEqual({
				isBoundToLoopback: false,
				hasAdminPassword: false,
				hasPincodeLockout: false,
				cloudEnabled: false,
				httpsEnabled: false,
				buttonDecoration: undefined,
				buttonStatusIcons: undefined,
				httpEnabled: false,
				httpDeprecatedEnabled: false,
				satelliteSubscriptionsEnabled: false,
				mdnsAnnouncementsEnabled: false,
				tcpEnabled: false,
				tcpDeprecatedEnabled: false,
				udpEnabled: false,
				udpDeprecatedEnabled: false,
				oscEnabled: false,
				oscDeprecatedEnabled: false,
				rossTalkEnabled: false,
				emberPlusEnabled: false,
				artnetEnabled: false,
				connectionCount: 0,
				pageCount: 1,
				buttonCount: 0,
				triggerCount: 0,
				surfaceGroupCount: 0,
				customVariableCount: 0,
				expressionVariableCount: 0,
				gridSize: { minCol: -1, maxCol: 7, minRow: 0, maxRow: 3 },
				connectedSatellites: 0,
				imageLibraryCount: 0,
				enabledBackupRuleCount: 0,
				restApiEnabled: false,
				apiKeyCount: 0,
				prometheusEnabled: false,
				pageVariableCount: 0,
				buttonReferenceCount: 0,
				presetReferenceCount: 0,
				defaultExportFormat: undefined,
			})
		})

		it.each([
			['admin_lockout', 'hasAdminPassword'],
			['pin_enable', 'hasPincodeLockout'],
			['https_enabled', 'httpsEnabled'],
			['http_api_enabled', 'httpEnabled'],
			['http_legacy_api_enabled', 'httpDeprecatedEnabled'],
			['satellite_subscriptions_enabled', 'satelliteSubscriptionsEnabled'],
			['mdns_announcements_enabled', 'mdnsAnnouncementsEnabled'],
			['tcp_enabled', 'tcpEnabled'],
			['tcp_legacy_api_enabled', 'tcpDeprecatedEnabled'],
			['udp_enabled', 'udpEnabled'],
			['udp_legacy_api_enabled', 'udpDeprecatedEnabled'],
			['osc_enabled', 'oscEnabled'],
			['osc_legacy_api_enabled', 'oscDeprecatedEnabled'],
			['rosstalk_enabled', 'rossTalkEnabled'],
			['emberplus_enabled', 'emberPlusEnabled'],
			['artnet_enabled', 'artnetEnabled'],
			['rest_api_enabled', 'restApiEnabled'],
			['prometheus_enabled', 'prometheusEnabled'],
		] as const)('reports %s as %s', async (configKey, featureKey) => {
			const { config, getPayload } = setup()

			config[configKey] = true
			expect((await getPayload()).features[featureKey]).toBe(true)

			config[configKey] = false
			expect((await getPayload()).features[featureKey]).toBe(false)
		})

		it('passes through the raw button display settings and export format', async () => {
			const { config, getPayload } = setup()
			config.buttons_decoration = 'border' as any
			config.buttons_status_icons = 'none'
			config.default_export_format = 'yaml'

			const { features } = await getPayload()

			expect(features.buttonDecoration).toBe('border')
			expect(features.buttonStatusIcons).toBe('none')
			expect(features.defaultExportFormat).toBe('yaml')
		})

		it.each([
			['127.0.0.1', true],
			['::1', true],
			['0.0.0.0', false],
			['192.168.1.10', false],
		])('reports bind ip %s as loopback=%s', async (bindIp, expected) => {
			const { stats, getPayload } = setup()

			stats.updateBindIp(bindIp)

			expect((await getPayload()).features.isBoundToLoopback).toBe(expected)
		})

		it('reports whether the cloud is active', async () => {
			const { cloud, getPayload } = setup()
			cloud.data.cloudActive = true

			expect((await getPayload()).features.cloudEnabled).toBe(true)
		})

		it('reports the counts from each controller', async () => {
			const ctx = setup()
			ctx.instances.getAllConnectionIds.mockReturnValue(['a', 'b', 'c'])
			ctx.pages.store.getPageCount.mockReturnValue(5)
			ctx.controls.getAllButtons.mockReturnValue([{}, {}, {}, {}])
			ctx.controls.getAllTriggers.mockReturnValue([{}, {}])
			ctx.controls.getAllExpressionVariables.mockReturnValue([{}])
			ctx.surfaces.getGroupCount.mockReturnValue(2)
			ctx.variables.custom.getDefinitions.mockReturnValue({ one: {}, two: {}, three: {} })
			ctx.graphics.imageLibrary.listImages.mockReturnValue([{}, {}])
			ctx.service.satelliteTcp.clientCount = 2
			ctx.service.satelliteWebsocket.clientCount = 3

			const { features } = await ctx.getPayload()

			expect(features).toMatchObject({
				connectionCount: 3,
				pageCount: 5,
				buttonCount: 4,
				triggerCount: 2,
				expressionVariableCount: 1,
				surfaceGroupCount: 2,
				customVariableCount: 3,
				imageLibraryCount: 2,
				connectedSatellites: 5,
			})
		})

		it('reports the 5.1 feature counts', async () => {
			const ctx = setup()
			ctx.service.restApi.tokenStore.list.mockReturnValue([{}, {}, {}])
			ctx.controls.getPageVariableCount.mockReturnValue(4)
			ctx.controls.getControlCountOfType.mockImplementation((type) =>
				type === 'button-reference' ? 1 : type === 'preset-reference' ? 2 : 99
			)

			const { features } = await ctx.getPayload()

			expect(features).toMatchObject({
				apiKeyCount: 3,
				pageVariableCount: 4,
				buttonReferenceCount: 1,
				presetReferenceCount: 2,
			})
			expect(ctx.controls.getControlCountOfType).toHaveBeenCalledWith('button-reference')
			expect(ctx.controls.getControlCountOfType).toHaveBeenCalledWith('preset-reference')
		})

		it('counts only the enabled backup rules', async () => {
			const { config, getPayload } = setup()
			config.backups = [{ enabled: true }, { enabled: false }, { enabled: true }] as any

			expect((await getPayload()).features.enabledBackupRuleCount).toBe(2)
		})

		describe('surfaces', () => {
			it('reports connected surfaces, stripping the satellite prefix', async () => {
				const { surfaces, getPayload } = setup()
				surfaces.getDevicesList.mockReturnValue([
					{
						surfaces: [
							{
								id: 'streamdeck:AB12',
								isConnected: true,
								integrationType: 'elgato-streamdeck',
								type: 'Stream Deck XL',
							},
							{ id: 'satellite-XY99', isConnected: true, integrationType: 'satellite', type: 'Satellite' },
						],
					},
					{
						surfaces: [{ id: 'other', isConnected: true, integrationType: undefined, type: undefined }],
					},
				])

				expect((await getPayload()).surfaces).toEqual([
					{ id: 'streamdeck:AB12', moduleId: 'elgato-streamdeck', description: 'Stream Deck XL' },
					{ id: 'XY99', moduleId: 'satellite', description: 'Satellite' },
					{ id: 'other', moduleId: '', description: '' },
				])
			})

			it('skips disconnected surfaces, surfaces without an id and empty groups', async () => {
				const { surfaces, getPayload } = setup()
				surfaces.getDevicesList.mockReturnValue([
					{ surfaces: undefined },
					{
						surfaces: [
							{ id: 'offline', isConnected: false, integrationType: 'x', type: 'x' },
							{ id: '', isConnected: true, integrationType: 'x', type: 'x' },
							{ id: 'online', isConnected: true, integrationType: 'x', type: 'y' },
						],
					},
				])

				expect((await getPayload()).surfaces).toEqual([{ id: 'online', moduleId: 'x', description: 'y' }])
			})

			it('still returns the rest of the payload when listing surfaces fails', async () => {
				const { surfaces, instances, getPayload } = setup()
				surfaces.getDevicesList.mockImplementation(() => {
					throw new Error('boom')
				})
				instances.getConnectionsMetrics.mockReturnValue({ 'mod-a': { '1.0.0': 1 } })
				instances.modulesStore.getCachedStoreList.mockReturnValue({ 'mod-a': {} })

				const payload = await getPayload()

				expect(payload.surfaces).toEqual([])
				expect(payload.connections).toEqual([{ moduleId: 'mod-a', counts: { '1.0.0': 1 } }])
				expect(Sentry.captureException).toHaveBeenCalledTimes(1)
			})
		})

		describe.each([
			['connections', 'getConnectionsMetrics', ModuleInstanceType.Connection],
			['surfaceModules', 'getSurfacesMetrics', ModuleInstanceType.Surface],
		] as const)('%s', (payloadKey, metricsFn, moduleType) => {
			it('reports only published modules', async () => {
				const { instances, getPayload } = setup()
				instances[metricsFn].mockReturnValue({
					'mod-a': { '1.0.0': 2, '1.1.0': 1 },
					'mod-dev': { '': 1 },
					'': { '1.0.0': 1 },
					'mod-empty': undefined,
				})
				instances.modulesStore.getCachedStoreList.mockImplementation((type) =>
					type === moduleType ? { 'mod-a': {}, '': {}, 'mod-empty': {} } : {}
				)

				expect((await getPayload())[payloadKey]).toEqual([{ moduleId: 'mod-a', counts: { '1.0.0': 2, '1.1.0': 1 } }])
				expect(instances.modulesStore.getCachedStoreList).toHaveBeenCalledWith(moduleType)
			})

			it('reports nothing when the module store list is not loaded', async () => {
				const { instances, getPayload } = setup()
				instances[metricsFn].mockReturnValue({ 'mod-a': { '1.0.0': 1 } })

				expect((await getPayload())[payloadKey]).toEqual([])
			})

			it('still returns the rest of the payload when collecting fails', async () => {
				const { instances, getPayload } = setup()
				instances[metricsFn].mockImplementation(() => {
					throw new Error('boom')
				})

				const payload = await getPayload()

				expect(payload[payloadKey]).toEqual([])
				expect(payload.features.pageCount).toBe(1)
				expect(Sentry.captureException).toHaveBeenCalledTimes(1)
			})
		})
	})

	describe('reporting cycle', () => {
		let fetchMock: ReturnType<typeof vi.fn<(req: Request) => Promise<Response>>>

		const okResponse = () =>
			new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })

		beforeEach(() => {
			vi.useFakeTimers()
			fetchMock = vi.fn(async (_req: Request) => okResponse())
			vi.stubGlobal('fetch', fetchMock)
		})

		afterEach(() => {
			vi.useRealTimers()
			vi.unstubAllGlobals()
		})

		function setupEnabled() {
			const ctx = setup()
			ctx.config.detailed_data_collection = true
			return ctx
		}

		it('does nothing when data collection is disabled', async () => {
			const { config, stats } = setup()
			config.detailed_data_collection = false

			stats.startStopCycle()
			await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000)

			expect(fetchMock).not.toHaveBeenCalled()
		})

		it('posts the payload after 2 minutes, then hourly', async () => {
			const { stats } = setupEnabled()

			stats.startStopCycle()

			await vi.advanceTimersByTimeAsync(119_000)
			expect(fetchMock).not.toHaveBeenCalled()

			await vi.advanceTimersByTimeAsync(1_000)
			expect(fetchMock).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
			expect(fetchMock).toHaveBeenCalledTimes(2)

			await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
			expect(fetchMock).toHaveBeenCalledTimes(3)

			stats.stop()
		})

		it('posts to the detailed-usage endpoint with the current payload', async () => {
			const { stats, getPayload } = setupEnabled()
			const expected = await getPayload()

			stats.startStopCycle()
			await vi.advanceTimersByTimeAsync(120_000)

			const req = fetchMock.mock.calls[0][0]
			expect(req.method).toBe('POST')
			expect(req.url).toBe('https://updates.companion.free/companion/detailed-usage')
			expect(req.headers.get('User-Agent')).toBe('Companion 5.1.0')

			const body = await req.json()
			expect(body).toEqual({ ...expected, uptime: expect.any(Number) })

			stats.stop()
		})

		it('does not run two cycles when started twice', async () => {
			const { stats } = setupEnabled()

			stats.startStopCycle()
			await vi.advanceTimersByTimeAsync(60_000)
			stats.startStopCycle()

			// The first cycle's 2 minute timer would have fired here
			await vi.advanceTimersByTimeAsync(60_000)
			expect(fetchMock).not.toHaveBeenCalled()

			await vi.advanceTimersByTimeAsync(60_000)
			expect(fetchMock).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
			expect(fetchMock).toHaveBeenCalledTimes(2)

			stats.stop()
		})

		it('stops posting after stop()', async () => {
			const { stats } = setupEnabled()

			stats.startStopCycle()
			await vi.advanceTimersByTimeAsync(120_000)
			expect(fetchMock).toHaveBeenCalledTimes(1)

			stats.stop()
			await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000)
			expect(fetchMock).toHaveBeenCalledTimes(1)
		})

		it('starts and stops when detailed_data_collection changes', async () => {
			const { config, stats } = setup()

			config.detailed_data_collection = true
			stats.updateUserConfig('detailed_data_collection', true)
			await vi.advanceTimersByTimeAsync(120_000)
			expect(fetchMock).toHaveBeenCalledTimes(1)

			config.detailed_data_collection = false
			stats.updateUserConfig('detailed_data_collection', false)
			await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000)
			expect(fetchMock).toHaveBeenCalledTimes(1)
		})

		it('ignores changes to other config keys', async () => {
			const { config, stats } = setup()
			config.detailed_data_collection = true

			stats.updateUserConfig('tcp_enabled', true)
			await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000)

			expect(fetchMock).not.toHaveBeenCalled()
		})

		it('retries once when the server rejects the metrics, then gives up', async () => {
			const { stats } = setupEnabled()
			fetchMock.mockImplementation(
				async () =>
					new Response(JSON.stringify({ ok: false }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					})
			)

			stats.startStopCycle()
			await vi.advanceTimersByTimeAsync(120_000)
			expect(fetchMock).toHaveBeenCalledTimes(1)

			// Retries are capped by maxRetryTime (40s), so only one more attempt fits
			await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
			expect(fetchMock).toHaveBeenCalledTimes(2)

			stats.stop()
		})

		it('retries when the server returns an error status', async () => {
			const { stats } = setupEnabled()
			fetchMock
				.mockImplementationOnce(
					async () =>
						new Response(JSON.stringify({ message: 'nope' }), {
							status: 500,
							headers: { 'Content-Type': 'application/json' },
						})
				)
				.mockImplementation(async () => okResponse())

			stats.startStopCycle()
			await vi.advanceTimersByTimeAsync(120_000)
			await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

			expect(fetchMock).toHaveBeenCalledTimes(2)

			stats.stop()
		})

		it('does not post when building the payload fails', async () => {
			const { controls, stats } = setupEnabled()
			controls.getAllButtons.mockImplementation(() => {
				throw new Error('boom')
			})

			stats.startStopCycle()
			await vi.advanceTimersByTimeAsync(120_000)

			expect(fetchMock).not.toHaveBeenCalled()
			expect(Sentry.captureException).toHaveBeenCalledTimes(1)

			stats.stop()
		})
	})
})
