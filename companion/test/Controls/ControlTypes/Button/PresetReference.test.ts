import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PresetReferenceButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlDependencies } from '../../../../lib/Controls/ControlDependencies.js'
import { ControlButtonPresetReference } from '../../../../lib/Controls/ControlTypes/Button/PresetReference.js'

/** A feedback as it comes from the preset definition - its id is owned by the definition, not by any control */
function makeDefinitionFeedback(id: string) {
	return {
		id,
		type: EntityModelType.Feedback,
		definitionId: 'fb1',
		connectionId: 'conn1',
		options: {},
	} as any
}

function makeModel(overrides: Partial<PresetReferenceButtonModel> = {}): PresetReferenceButtonModel {
	return {
		type: 'preset-reference',
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
		presetRef: { connectionId: 'conn1', moduleId: 'mod1', presetId: 'p1', variableValues: { channel: 1 } },
		...overrides,
	}
}

describe('ControlButtonPresetReference', () => {
	let definitions: EventEmitter & {
		convertPresetToReferenceControlModel: ReturnType<typeof vi.fn>
		doesConnectionSupportPresetReferences: ReturnType<typeof vi.fn>
	}
	let deps: ControlDependencies

	beforeEach(() => {
		definitions = Object.assign(new EventEmitter(), {
			convertPresetToReferenceControlModel: vi.fn(),
			doesConnectionSupportPresetReferences: vi.fn(() => true),
			getEntityDefinition: vi.fn(() => undefined),
		}) as any

		const graphics = Object.assign(new EventEmitter(), {
			renderPixelBuffers: vi.fn(),
			getCachedRender: vi.fn(() => undefined),
		})

		deps = {
			surfaces: {} as any,
			pageStore: { getLocationOfControlId: vi.fn(() => null) } as any,
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
			renderClock: {} as any,
		}
	})

	function createControl(model = makeModel()) {
		return new ControlButtonPresetReference(deps, 'bank:test01', model, false)
	}

	it('exposes the reference metadata from storage', () => {
		const control = createControl()
		expect(control.type).toBe('preset-reference')
		expect(control.connectionId).toBe('conn1')
		expect(control.moduleId).toBe('mod1')
		expect(control.presetId).toBe('p1')
		expect(control.supportsConvert).toBe(true)
		expect(control.supportsLayeredStyle).toBe(false)
		expect(control.supportsOptions).toBe(true)
	})

	describe('optionsSetField', () => {
		it('allows editing notes', () => {
			const control = createControl()
			expect(control.optionsSetField('notes', 'my note')).toBe(true)
			expect(control.toJSON().options.notes).toBe('my note')
		})

		it('rejects any option other than notes (stays read-only)', () => {
			const control = createControl()
			expect(control.optionsSetField('rotaryActions', true)).toBe(false)
			expect(control.optionsSetField('stepProgression', 'manual')).toBe(false)
		})

		it('preserves user notes across a preset refresh', () => {
			definitions.convertPresetToReferenceControlModel.mockReturnValue(makeModel())
			const control = createControl()

			control.optionsSetField('notes', 'keep me')
			definitions.emit('updatePresets', 'conn1')

			expect(control.toJSON().options.notes).toBe('keep me')
		})
	})

	it('subscribes to preset definition updates', () => {
		createControl()
		expect(definitions.listenerCount('updatePresets')).toBe(1)
	})

	it('exposes a (read-only) drawer that handles composite element changes', () => {
		const control = createControl()
		expect(control.drawing).toBeTruthy()
		// The controls controller dispatches composite changes via control.drawing directly
		expect(() => control.drawing?.onCompositeElementsChanged(new Set(['conn1:el1']))).not.toThrow()
	})

	describe('setTemplateVariableValue', () => {
		it('rejects variables that were not templated', () => {
			const control = createControl()
			expect(control.setTemplateVariableValue('not-templated', 5)).toBe(false)
			expect(definitions.convertPresetToReferenceControlModel).not.toHaveBeenCalled()
		})

		it('updates a templated variable and re-resolves the preset with the merged overrides', () => {
			definitions.convertPresetToReferenceControlModel.mockReturnValue(makeModel())
			const control = createControl()

			expect(control.setTemplateVariableValue('channel', 5)).toBe(true)
			expect(definitions.convertPresetToReferenceControlModel).toHaveBeenCalledWith('conn1', 'p1', { channel: 5 })
		})
	})

	describe('setReferencedConnection', () => {
		it('no-ops (returns true) when switching to the same connection', () => {
			const control = createControl()
			expect(control.setReferencedConnection('conn1')).toBe(true)
			expect(definitions.convertPresetToReferenceControlModel).not.toHaveBeenCalled()
		})

		it('switches to another connection and updates the metadata', () => {
			definitions.convertPresetToReferenceControlModel.mockReturnValue(
				makeModel({
					presetRef: { connectionId: 'conn2', moduleId: 'mod1', presetId: 'p1', variableValues: { channel: 1 } },
				})
			)
			const control = createControl()

			expect(control.setReferencedConnection('conn2')).toBe(true)
			expect(definitions.convertPresetToReferenceControlModel).toHaveBeenCalledWith('conn2', 'p1', { channel: 1 })
			expect(control.connectionId).toBe('conn2')
		})

		it('returns false when the target connection does not provide the preset', () => {
			definitions.convertPresetToReferenceControlModel.mockReturnValue(null)
			const control = createControl()

			expect(control.setReferencedConnection('conn3')).toBe(false)
			expect(control.connectionId).toBe('conn1')
		})

		it('returns false when the target connection does not support preset references', () => {
			definitions.doesConnectionSupportPresetReferences.mockReturnValue(false)
			const control = createControl()

			expect(control.setReferencedConnection('conn3')).toBe(false)
			expect(definitions.convertPresetToReferenceControlModel).not.toHaveBeenCalled()
			expect(control.connectionId).toBe('conn1')
		})

		it('returns false when the target connection belongs to another module', () => {
			// Another module could reuse the same preset-id for something unrelated
			definitions.convertPresetToReferenceControlModel.mockReturnValue(
				makeModel({
					presetRef: { connectionId: 'conn3', moduleId: 'mod2', presetId: 'p1', variableValues: null },
				})
			)
			const control = createControl()

			expect(control.setReferencedConnection('conn3')).toBe(false)
			expect(control.connectionId).toBe('conn1')
			expect(control.moduleId).toBe('mod1')
		})
	})

	describe('entity ids', () => {
		it('generates new entity ids when refreshing from the preset definition', () => {
			// The ids in the built model are owned by the preset definition, and are shared with every other
			// reference to the same preset. They must not be adopted as-is
			definitions.convertPresetToReferenceControlModel.mockReturnValue(
				makeModel({ feedbacks: [makeDefinitionFeedback('definition-owned-id')] })
			)
			const control = createControl(makeModel({ feedbacks: [makeDefinitionFeedback('control-owned-id')] }))

			definitions.emit('updatePresets', 'conn1')

			const feedbacks = control.toJSON().feedbacks
			expect(feedbacks).toHaveLength(1)
			expect(feedbacks[0].id).not.toBe('definition-owned-id')
			expect(feedbacks[0].id).not.toBe('control-owned-id')
		})

		it('keeps the stored entity ids when loading from the db', () => {
			const control = createControl(makeModel({ feedbacks: [makeDefinitionFeedback('stored-id')] }))

			expect(control.toJSON().feedbacks[0].id).toBe('stored-id')
		})
	})

	describe('templated variable values', () => {
		it('tracks the applied overrides reported by the updated model, dropping ones which no longer exist', () => {
			// The module dropped the `channel` template variable and added `page`
			definitions.convertPresetToReferenceControlModel.mockReturnValue(
				makeModel({
					presetRef: { connectionId: 'conn1', moduleId: 'mod1', presetId: 'p1', variableValues: { page: 2 } },
				})
			)
			const control = createControl()

			definitions.emit('updatePresets', 'conn1')

			expect(control.getTemplateVariableNames()).toEqual(['page'])
			expect(control.toJSON().presetRef.variableValues).toEqual({ page: 2 })
			// The dropped variable is no longer editable
			expect(control.setTemplateVariableValue('channel', 5)).toBe(false)
		})
	})

	describe('convertControl', () => {
		it('produces a plain button-layered model from the cached data', () => {
			const control = createControl()
			const converted = control.convertControl()

			expect(converted.type).toBe('button-layered')
			expect(converted.style).toEqual({ layers: [] })
			expect('presetRef' in converted).toBe(false)
		})

		it('carries the user notes into the converted button', () => {
			const control = createControl()
			control.optionsSetField('notes', 'remember this')

			const converted = control.convertControl()
			expect(converted.options.notes).toBe('remember this')
		})
	})

	it('keeps the last-known data when the source preset disappears', () => {
		definitions.convertPresetToReferenceControlModel.mockReturnValue(null)
		const control = createControl()

		// Fire an update for our connection; the preset is gone (refresh returns null)
		definitions.emit('updatePresets', 'conn1')

		// Still pointed at the original reference - nothing cleared
		expect(control.connectionId).toBe('conn1')
		expect(control.toJSON().presetRef.presetId).toBe('p1')
	})
})
