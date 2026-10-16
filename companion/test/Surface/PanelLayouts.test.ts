import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import type { SatelliteSurfaceLayout } from '@companion-app/satellite-protocol'
import type { EmulatorImage } from '@companion-app/shared/Model/Common.js'
import type { SurfaceSchemaLayoutDefinition } from '@companion-app/shared/Model/Surfaces.js'
import { PREVIEW_RENDER_SIZE } from '../../lib/Graphics/ImageResult.js'
import { SurfaceIPElgatoEmulator } from '../../lib/Surface/IP/ElgatoEmulator.js'
import { SurfaceIPSatellite, type SatelliteDeviceInfo } from '../../lib/Surface/IP/Satellite.js'
import { SurfacePluginPanel } from '../../lib/Surface/PluginPanel.js'

describe('SurfaceIPSatellite', () => {
	function makeSatellite(surfaceManifest: SatelliteSurfaceLayout) {
		const deviceInfo: SatelliteDeviceInfo = {
			connectionId: 'conn1',
			deviceId: 'dev1',
			serial: 'serial1',
			serialIsUnique: true,
			productName: 'Test Deck',
			socket: { remoteAddress: '1.2.3.4', write: vi.fn() } as any,
			gridSize: { columns: 2, rows: 2 },
			supportsBrightness: true,
			transferVariables: [],
			supportsLockedState: false,
			surfaceManifestFromClient: true,
			surfaceManifest,
			configFields: undefined,
			canChangePage: undefined,
			bitmapFormat: 'rgb',
		}

		return new SurfaceIPSatellite(deviceInfo, 'satellite:dev1', vi.fn())
	}

	test('exposes the manifest reported by the client', () => {
		const manifest: SatelliteSurfaceLayout = {
			stylePresets: {
				default: { bitmap: { w: 96, h: 96 } },
				infoBar: { bitmap: { w: 248, h: 58 } },
			},
			controls: {
				'0/0': { row: 0, column: 0 },
				'1/0': { row: 1, column: 0, stylePreset: 'infoBar' },
			},
		}

		expect(makeSatellite(manifest).surfaceLayout).toEqual(manifest)
	})

	test('exposes a manifest which requests no bitmaps unchanged', () => {
		const manifest: SatelliteSurfaceLayout = {
			stylePresets: { default: { text: true } },
			controls: { '0/0': { row: 0, column: 0 } },
		}

		expect(makeSatellite(manifest).surfaceLayout).toEqual(manifest)
	})
})

describe('SurfaceIPElgatoEmulator', () => {
	function makeEmulator() {
		const events = new EventEmitter() as any
		return new SurfaceIPElgatoEmulator(events, 'emu1')
	}

	test('reports a grid of square controls matching the default size', () => {
		const layout: SurfaceSchemaLayoutDefinition = makeEmulator().surfaceLayout

		expect(layout.stylePresets).toEqual({
			default: { bitmap: { w: PREVIEW_RENDER_SIZE, h: PREVIEW_RENDER_SIZE } },
		})
		expect(Object.keys(layout.controls)).toHaveLength(8 * 4)
		expect(layout.controls['3/7']).toEqual({ row: 3, column: 7 })
	})

	test('follows the emulator being resized', () => {
		const emulator = makeEmulator()

		emulator.setConfig({ emulator_columns: 3, emulator_rows: 2 } as any, true)

		expect(emulator.gridSize).toEqual({ columns: 3, rows: 2 })
		expect(Object.keys(emulator.surfaceLayout.controls)).toEqual(['0/0', '0/1', '0/2', '1/0', '1/1', '1/2'])
	})

	const pngRender = () => ({ drawNativeEncoded: vi.fn(async () => 'data:image/png;base64,abc') }) as any

	test('a resize with no client connected leaves no blanks for a later client', async () => {
		const events = new EventEmitter()
		const emulator = new SurfaceIPElgatoEmulator(events as any, 'emu1')

		emulator.setConfig({ emulator_columns: 3, emulator_rows: 2 } as any, true)

		// The client connects some time after startup
		await new Promise((resolve) => setTimeout(resolve, 100))
		const emitted: unknown[][] = []
		events.on('emulatorImages', (...args) => emitted.push(args))

		emulator.draw({ x: 1, y: 0, defaultRender: pngRender(), location: null })

		await vi.waitFor(() => expect(emitted).toHaveLength(1))
		// Only the drawn button is sent, no stale blanks from the resize
		expect(emitted[0]).toEqual(['emu1', [{ x: 1, y: 0, buffer: 'data:image/png;base64,abc' }], false])
	})

	test('a resize keeps unsent renders for cells within the new size', async () => {
		const events = new EventEmitter()
		const emitted: EmulatorImage[][] = []
		events.on('emulatorImages', (_id, images: EmulatorImage[]) => emitted.push(images))
		const emulator = new SurfaceIPElgatoEmulator(events as any, 'emu1')

		const defaultRender = pngRender()
		emulator.draw({ x: 1, y: 0, defaultRender, location: null })
		await vi.waitFor(() => expect(defaultRender.drawNativeEncoded).toHaveBeenCalled(), { interval: 1 })
		await new Promise((resolve) => setImmediate(resolve))

		// Resize before the render is flushed to the client
		expect(emitted).toHaveLength(0)
		emulator.setConfig({ emulator_columns: 3, emulator_rows: 2 } as any, true)

		await vi.waitFor(() => expect(emitted).toHaveLength(1))
		expect(emitted[0]).toContainEqual({ x: 1, y: 0, buffer: 'data:image/png;base64,abc' })
	})

	test('a resize blanks only the cells outside the new size', async () => {
		const events = new EventEmitter()
		const emitted: EmulatorImage[][] = []
		events.on('emulatorImages', (_id, images: EmulatorImage[]) => emitted.push(images))
		const emulator = new SurfaceIPElgatoEmulator(events as any, 'emu1')

		emulator.setConfig({ emulator_columns: 3, emulator_rows: 2 } as any, true)
		emulator.draw({ x: 1, y: 0, defaultRender: pngRender(), location: null })

		await vi.waitFor(() => expect(emitted).toHaveLength(1))
		const images = emitted[0]
		expect(images.filter((img) => img.buffer === false)).toHaveLength(8 * 4 - 3 * 2)
		expect(images.some((img) => img.buffer === false && img.x < 3 && img.y < 2)).toBe(false)
		expect(images).toContainEqual({ x: 1, y: 0, buffer: 'data:image/png;base64,abc' })
	})
})

describe('SurfacePluginPanel', () => {
	test('exposes the layout reported by the surface module', () => {
		const surfaceLayout: SurfaceSchemaLayoutDefinition = {
			stylePresets: {
				default: { bitmap: { w: 120, h: 120 } },
				encoder: { bitmap: { w: 200, h: 100 }, leds: { segments: 16, mode: 'full-ring' } },
			},
			controls: {
				'0/0': { row: 0, column: 0 },
				'1/0': { row: 1, column: 0, stylePreset: 'encoder' },
			},
		}

		const panel = new SurfacePluginPanel(
			{ sendWithCb: vi.fn() } as any,
			'instance1',
			{
				surfaceId: 'plugin:dev1',
				description: 'Test Deck',
				surfaceLayout,
				supportsBrightness: true,
				isRemote: false,
				transferVariables: [],
			} as any,
			vi.fn()
		)

		expect(panel.surfaceLayout).toEqual(surfaceLayout)
		// The grid is derived from the same controls, so the two stay consistent
		expect(panel.gridSize).toEqual({ columns: 1, rows: 2 })
	})
})
