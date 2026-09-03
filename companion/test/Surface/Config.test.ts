import { describe, expect, test } from 'vitest'
import type { SurfaceConfig, SurfaceSchemaLayoutDefinition } from '@companion-app/shared/Model/Surfaces.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { createDefaultSurfacePanelConfig, createOrSanitizeSurfaceHandlerConfig } from '../../lib/Surface/Config.js'
import type { SurfacePanel } from '../../lib/Surface/Types.js'

const layout: SurfaceSchemaLayoutDefinition = {
	stylePresets: { default: { bitmap: { w: 96, h: 96 } } },
	controls: { '0/0': { row: 0, column: 0 } },
}

const defaultGridSize: UserConfigGridSize = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }

function makePanel(overrides: Partial<SurfacePanel> = {}): SurfacePanel {
	return {
		info: {
			surfaceId: 'surface0',
			description: 'Test Deck',
			configFields: [],
			location: null,
			isRemote: false,
		},
		gridSize: { columns: 1, rows: 1 },
		surfaceLayout: layout,
		...overrides,
	} as unknown as SurfacePanel
}

describe('createDefaultSurfacePanelConfig', () => {
	test('is the shared defaults for a panel with no config fields', () => {
		expect(createDefaultSurfacePanelConfig(makePanel())).toEqual({
			brightness: 100,
			rotation: 0,
			xOffset: 0,
			yOffset: 0,
			groupId: null,
		})
	})

	test('adds the defaults of the fields the panel defines', () => {
		const panel = makePanel({
			info: {
				surfaceId: 'surface0',
				description: 'Test Deck',
				configFields: [
					{ id: 'someToggle', type: 'checkbox', label: 'Toggle', default: true },
					{ id: 'someText', type: 'textinput', label: 'Text', default: 'hello' },
				],
				location: null,
				isRemote: false,
			},
		})

		const config = createDefaultSurfacePanelConfig(panel)

		expect(config.someToggle).toBe(true)
		expect(config.someText).toBe('hello')
	})

	test('does not share state between calls', () => {
		const first = createDefaultSurfacePanelConfig(makePanel())
		first.brightness = 20

		expect(createDefaultSurfacePanelConfig(makePanel()).brightness).toBe(100)
	})
})

describe('createOrSanitizeSurfaceHandlerConfig', () => {
	test('creates a config from scratch', () => {
		const config = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), undefined, defaultGridSize)

		expect(config.type).toBe('Test Deck')
		expect(config.integrationType).toBe('test')
		expect(config.gridSize).toEqual({ columns: 1, rows: 1 })
		expect(config.enabled).toBe(true)
		expect(config.config.brightness).toBe(100)
	})

	test('stores the layout reported by the panel', () => {
		const config = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), undefined, defaultGridSize)

		expect(config.layout).toEqual(layout)
	})

	test('replaces a stale stored layout with the one the panel now reports', () => {
		const newLayout: SurfaceSchemaLayoutDefinition = {
			stylePresets: { default: { bitmap: { w: 120, h: 120 } } },
			controls: { '0/0': { row: 0, column: 0 }, '0/1': { row: 0, column: 1 } },
		}
		const existing = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), undefined, defaultGridSize)

		const updated = createOrSanitizeSurfaceHandlerConfig(
			'test',
			makePanel({ surfaceLayout: newLayout }),
			existing,
			defaultGridSize
		)

		expect(updated.layout).toEqual(newLayout)
	})

	test('fills in the layout of a config saved before layouts were stored', () => {
		const existing = {
			config: { brightness: 50, rotation: 0, xOffset: 2, yOffset: 1, groupId: null },
			groupConfig: {
				name: '',
				last_page_id: '1',
				startup_page_id: '1',
				use_last_page: true,
				never_lock: false,
			},
			groupId: null,
			type: 'Test Deck',
			integrationType: 'test',
			gridSize: { columns: 1, rows: 1 },
		} as unknown as SurfaceConfig

		const config = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), existing, defaultGridSize)

		expect(config.layout).toEqual(layout)
	})

	test('keeps the existing panel config rather than resetting it', () => {
		const existing = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), undefined, defaultGridSize)
		existing.config.brightness = 42
		existing.name = 'Desk'

		const updated = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), existing, defaultGridSize)

		expect(updated.config.brightness).toBe(42)
		expect(updated.name).toBe('Desk')
	})

	test('adds newly defined config fields to an existing config', () => {
		const existing = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), undefined, defaultGridSize)

		const panelWithField = makePanel({
			info: {
				surfaceId: 'surface0',
				description: 'Test Deck',
				configFields: [{ id: 'someToggle', type: 'checkbox', label: 'Toggle', default: true }],
				location: null,
				isRemote: false,
			},
		})

		const updated = createOrSanitizeSurfaceHandlerConfig('test', panelWithField, existing, defaultGridSize)

		expect(updated.config.someToggle).toBe(true)
	})

	test('a new config starts at the top left of the grid bounds', () => {
		const config = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), undefined, {
			minColumn: -2,
			maxColumn: 7,
			minRow: 3,
			maxRow: 6,
		})

		// A negative bound means the grid extends left of the origin, and the surface still starts at the origin
		expect(config.config.xOffset).toBe(0)
		expect(config.config.yOffset).toBe(3)
	})

	// Documents existing behaviour, which does not look intentional: the "check for new properties" loop above
	// copies xOffset/yOffset in from PanelDefaults (both 0), so the `=== undefined` branch which would place the
	// surface at the top left of the grid bounds can never be reached for an existing config.
	test('offsets missing from an existing config are filled from the panel defaults, not the grid bounds', () => {
		const existing = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), undefined, defaultGridSize)
		delete (existing.config as Record<string, unknown>).xOffset
		delete (existing.config as Record<string, unknown>).yOffset

		const updated = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), existing, {
			minColumn: 1,
			maxColumn: 7,
			minRow: 2,
			maxRow: 3,
		})

		expect(updated.config.xOffset).toBe(0)
		expect(updated.config.yOffset).toBe(0)
	})

	test('migrates the deprecated page fields into the group config', () => {
		const existing = {
			config: { brightness: 100, rotation: 0, xOffset: 0, yOffset: 0, groupId: null, page: 4 },
			groupId: null,
		} as unknown as SurfaceConfig

		const config = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), existing, defaultGridSize)

		expect(config.groupConfig.startup_page).toBe(4)
		// A page had been chosen, so the surface should not resume on the last page it was on
		expect(config.groupConfig.use_last_page).toBe(false)
		expect(config.config.page).toBeUndefined()
	})

	test('a config with no chosen page resumes on the last page', () => {
		const existing = {
			config: { brightness: 100, rotation: 0, xOffset: 0, yOffset: 0, groupId: null },
			groupId: null,
		} as unknown as SurfaceConfig

		const config = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), existing, defaultGridSize)

		expect(config.groupConfig.use_last_page).toBe(true)
		expect(config.groupConfig.startup_page).toBe(1)
	})

	test('keeps a surface which had been disabled disabled', () => {
		const existing = createOrSanitizeSurfaceHandlerConfig('test', makePanel(), undefined, defaultGridSize)
		existing.enabled = false

		expect(createOrSanitizeSurfaceHandlerConfig('test', makePanel(), existing, defaultGridSize).enabled).toBe(false)
	})
})
