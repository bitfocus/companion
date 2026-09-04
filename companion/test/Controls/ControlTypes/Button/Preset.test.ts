import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PresetButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlDependencies } from '../../../../lib/Controls/ControlDependencies.js'
import { ControlButtonPreset } from '../../../../lib/Controls/ControlTypes/Button/Preset.js'

function makeStorage(overrides: Partial<PresetButtonModel> = {}): PresetButtonModel {
	return {
		type: 'preset:button',
		options: { rotaryActions: false, stepProgression: 'auto', canModifyStyleInApis: false },
		style: { layers: [] },
		feedbacks: [],
		steps: {
			'0': {
				options: { runWhileHeld: [] },
				action_sets: { down: [], up: [], rotate_left: undefined, rotate_right: undefined },
			},
		},
		localVariables: [],
		...overrides,
	}
}

describe('ControlButtonPreset', () => {
	let definitions: EventEmitter & {
		convertPresetToPreviewControlModel: ReturnType<typeof vi.fn>
	}
	let deps: ControlDependencies

	beforeEach(() => {
		definitions = Object.assign(new EventEmitter(), {
			convertPresetToPreviewControlModel: vi.fn(() => makeStorage()),
			getEntityDefinition: vi.fn(() => undefined),
		}) as any

		const graphics = Object.assign(new EventEmitter(), {
			renderPixelBuffers: vi.fn(),
			getCachedRender: vi.fn(() => undefined),
		})

		deps = {
			surfaces: {} as any,
			pageStore: { getLocationOfControlId: vi.fn(() => null) } as any,
			getPageVariableEntities: () => null,
			triggerEvents: null as any,
			expressionVariableNamesMap: null as any,
			internalModule: { entityUpgrade: vi.fn(() => undefined), visitReferences: vi.fn() } as any,
			instance: {
				definitions,
				processManager: {
					connectionEntityUpdate: vi.fn(async () => undefined),
					connectionEntityDelete: vi.fn(async () => undefined),
					connectionEntityLearnOptions: vi.fn(async () => undefined),
				} as any,
				getInstanceStatus: vi.fn(() => undefined),
			} as any,
			variableValues: {
				createVariablesAndExpressionParser: vi.fn(() => ({ executeExpression: vi.fn() })),
			} as any,
			userconfig: {} as any,
			graphics: graphics as any,
			actionRunner: {} as any,
			dbTable: { set: vi.fn(), delete: vi.fn() } as any,
			events: new EventEmitter() as any,
			changeEvents: new EventEmitter() as any,
			renderClock: { subscribe: vi.fn(() => () => {}) } as any,
			controlsAccessor: {
				getControl: vi.fn(() => undefined),
				pressControl: vi.fn(() => false),
				rotateControl: vi.fn(() => false),
			},
		}
	})

	function createControl(checksum?: string) {
		return new ControlButtonPreset(deps, 'conn1', 'p1', 'novars', makeStorage({ checksum }))
	}

	it('ignores an unchanged preset re-report (no rebuild)', () => {
		// The re-resolved preview model carries the same checksum the preview was built from
		definitions.convertPresetToPreviewControlModel = vi.fn(() => makeStorage({ checksum: 'stable' }))
		const control = createControl('stable')
		expect(control.type).toBe('preset:button')
		const loadSpy = vi.spyOn(control.entities, 'loadStorage')

		definitions.emit('updatePresets', 'conn1')

		expect(loadSpy).not.toHaveBeenCalled()
	})

	it('rebuilds when the preset actually changed', () => {
		definitions.convertPresetToPreviewControlModel = vi.fn(() => makeStorage({ checksum: 'v2' }))
		const control = createControl('v1')
		const loadSpy = vi.spyOn(control.entities, 'loadStorage')

		definitions.emit('updatePresets', 'conn1')

		expect(loadSpy).toHaveBeenCalled()
	})

	it('ignores updates for a different connection', () => {
		const control = createControl()
		const loadSpy = vi.spyOn(control.entities, 'loadStorage')

		definitions.emit('updatePresets', 'other-connection')

		expect(loadSpy).not.toHaveBeenCalled()
	})

	it('keeps the last-known data when the preset is gone', () => {
		definitions.convertPresetToPreviewControlModel = vi.fn(() => null)
		const control = createControl()
		const loadSpy = vi.spyOn(control.entities, 'loadStorage')

		definitions.emit('updatePresets', 'conn1')

		expect(loadSpy).not.toHaveBeenCalled()
	})
})
