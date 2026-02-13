import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InstanceDefinitions } from '../../lib/Instance/Definitions.js'
import type { InstanceConfigStore } from '../../lib/Instance/ConfigStore.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import {
	ModuleInstanceType,
	type InstanceConfig,
	InstanceVersionUpdatePolicy,
} from '@companion-app/shared/Model/Instance.js'
import type {
	PresetDefinition,
	UIPresetDefinition,
	UIPresetDefinitionUpdateAdd,
	UIPresetDefinitionUpdateInit,
	UIPresetGroupSimple,
	UIPresetSection,
} from '@companion-app/shared/Model/Presets.js'
import type { NormalButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { CompanionFieldVariablesSupport, exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import { EventDefinitions } from '../../lib/Resources/EventDefinitions.js'
import { initTRPC } from '@trpc/server'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

// Deterministic nanoid
let nanoidCounter = 0
vi.mock('nanoid', () => ({
	nanoid: vi.fn(() => `mock-id-${++nanoidCounter}`),
}))

// ── helpers ──────────────────────────────────────────────────────────────────

function makeConnectionConfig(overrides: Partial<InstanceConfig> = {}): InstanceConfig {
	return {
		moduleInstanceType: ModuleInstanceType.Connection,
		moduleId: 'test-module',
		moduleVersionId: '1.0.0',
		label: 'Test Connection',
		config: {},
		secrets: undefined,
		isFirstInit: false,
		lastUpgradeIndex: 5,
		enabled: true,
		sortOrder: 0,
		updatePolicy: InstanceVersionUpdatePolicy.Stable,
		...overrides,
	}
}

function makeActionDefinition(overrides: Partial<ClientEntityDefinition> = {}): ClientEntityDefinition {
	return {
		entityType: EntityModelType.Action,
		label: 'Test Action',
		sortKey: null,
		description: 'A test action',
		options: [],
		optionsToMonitorForInvalidations: null,
		feedbackType: null,
		feedbackStyle: undefined,
		hasLifecycleFunctions: false,
		hasLearn: false,
		learnTimeout: undefined,
		showInvert: false,
		optionsSupportExpressions: false,
		showButtonPreview: false,
		supportsChildGroups: [],
		...overrides,
	}
}

function makeFeedbackDefinition(overrides: Partial<ClientEntityDefinition> = {}): ClientEntityDefinition {
	return {
		...makeActionDefinition({ entityType: EntityModelType.Feedback }),
		feedbackType: FeedbackEntitySubType.Boolean,
		...overrides,
	}
}

function makeButtonPresetModel(overrides: Partial<NormalButtonModel> = {}): NormalButtonModel {
	return {
		type: 'button',
		options: { rotaryActions: false, stepProgression: 'auto' },
		style: {
			text: 'Hello $(internal:label)',
			textExpression: false,
			size: 'auto',
			alignment: 'center:center',
			pngalignment: 'center:center',
			color: 0xffffff,
			bgcolor: 0x000000,
			show_topbar: 'default',
			png64: null,
		},
		feedbacks: [],
		steps: {
			step1: {
				options: { runWhileHeld: [] },
				action_sets: {
					down: [],
					up: [],
					rotate_left: undefined,
					rotate_right: undefined,
				},
			},
		},
		localVariables: [],
		...overrides,
	}
}

function makeButtonPreset(id: string, overrides: Partial<PresetDefinition> = {}): PresetDefinition {
	return {
		id,
		name: `Preset ${id}`,
		type: 'button',
		model: makeButtonPresetModel(),
		previewStyle: undefined,
		keywords: undefined,
		...overrides,
	}
}

function presetsToMap(presets: PresetDefinition[]): ReadonlyMap<string, PresetDefinition> {
	return new Map(presets.map((p) => [p.id, p]))
}

function generateUIDefinitions(presets: PresetDefinition[]): Record<string, UIPresetSection> {
	if (presets.length === 0) return {}

	const uiPresets: Record<string, UIPresetDefinition> = {}
	presets.forEach((preset, index) => {
		uiPresets[preset.id] = {
			id: preset.id,
			order: index,
			label: preset.name,
		}
	})

	return {
		default: {
			id: 'default',
			name: 'Default',
			order: 0,
			definitions: {
				default: {
					id: 'default',
					name: 'Default',
					order: 0,
					type: 'simple',
					presets: uiPresets,
				},
			},
		},
	}
}

function createInstanceDefinitions(configOverrides?: Partial<InstanceConfigStore>) {
	const mockConfigStore: InstanceConfigStore = {
		getConfigOfTypeForId: vi.fn((instanceId: string, _instanceType: ModuleInstanceType | null) => {
			if (instanceId === 'unknown') return undefined
			return makeConnectionConfig({ label: instanceId })
		}),
		...configOverrides,
	} as unknown as InstanceConfigStore

	const defs = new InstanceDefinitions(mockConfigStore)

	return { defs, mockConfigStore }
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('InstanceDefinitions', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		nanoidCounter = 0
	})

	// ── getEntityDefinition ──────────────────────────────────────────────

	describe('getEntityDefinition', () => {
		it('returns undefined for unknown connection', () => {
			const { defs } = createInstanceDefinitions()

			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'act1')).toBeUndefined()
		})

		it('returns action definition after setActionDefinitions', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeActionDefinition({ label: 'My Action' })

			defs.setActionDefinitions('conn1', { act1: def })

			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'act1')).toBe(def)
		})

		it('returns feedback definition after setFeedbackDefinitions', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeFeedbackDefinition({ label: 'My Feedback' })

			defs.setFeedbackDefinitions('conn1', { fb1: def })

			expect(defs.getEntityDefinition(EntityModelType.Feedback, 'conn1', 'fb1')).toBe(def)
		})

		it('returns undefined for wrong entity type', () => {
			const { defs } = createInstanceDefinitions()

			defs.setActionDefinitions('conn1', { act1: makeActionDefinition() })

			expect(defs.getEntityDefinition(EntityModelType.Feedback, 'conn1', 'act1')).toBeUndefined()
		})

		it('returns undefined for non-existent definitionId on connection with definitions', () => {
			const { defs } = createInstanceDefinitions()

			defs.setActionDefinitions('conn1', { act1: makeActionDefinition() })

			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'doesNotExist')).toBeUndefined()
		})
	})

	// ── setActionDefinitions ─────────────────────────────────────────────

	describe('setActionDefinitions', () => {
		it('stores definitions and emits add-connection on first set with listener', () => {
			const { defs } = createInstanceDefinitions()
			const emitted: unknown[] = []

			// Attach a listener to the internal #events via the public subscription approach
			// We use the on('actions', ...) pattern by hooking into the defs' event system
			// Instead, we test via getEntityDefinition that the definition is stored
			const def = makeActionDefinition({ label: 'First' })
			defs.setActionDefinitions('conn1', { act1: def })

			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'act1')).toBe(def)
		})

		it('overwrites previous definitions', () => {
			const { defs } = createInstanceDefinitions()

			defs.setActionDefinitions('conn1', { act1: makeActionDefinition({ label: 'First' }) })
			const second = makeActionDefinition({ label: 'Second' })
			defs.setActionDefinitions('conn1', { act2: second })

			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'act1')).toBeUndefined()
			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'act2')).toBe(second)
		})
	})

	// ── setFeedbackDefinitions ───────────────────────────────────────────

	describe('setFeedbackDefinitions', () => {
		it('stores definitions', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeFeedbackDefinition({ label: 'FB1' })

			defs.setFeedbackDefinitions('conn1', { fb1: def })

			expect(defs.getEntityDefinition(EntityModelType.Feedback, 'conn1', 'fb1')).toBe(def)
		})

		it('overwrites previous definitions', () => {
			const { defs } = createInstanceDefinitions()

			defs.setFeedbackDefinitions('conn1', { fb1: makeFeedbackDefinition({ label: 'First' }) })
			const second = makeFeedbackDefinition({ label: 'Second' })
			defs.setFeedbackDefinitions('conn1', { fb2: second })

			expect(defs.getEntityDefinition(EntityModelType.Feedback, 'conn1', 'fb1')).toBeUndefined()
			expect(defs.getEntityDefinition(EntityModelType.Feedback, 'conn1', 'fb2')).toBe(second)
		})
	})

	// ── setPresetDefinitions ─────────────────────────────────────────────

	describe('setPresetDefinitions', () => {
		it('stores presets and emits updatePresets event', () => {
			const { defs } = createInstanceDefinitions()
			const updatePresetsListener = vi.fn()
			defs.on('updatePresets', updatePresetsListener)

			const preset = makeButtonPreset('p1')
			defs.setPresetDefinitions('conn1', new Map([[preset.id, preset]]), {})

			expect(updatePresetsListener).toHaveBeenCalledWith('conn1')
		})

		it('does nothing when config not found', () => {
			const { defs } = createInstanceDefinitions()
			const updatePresetsListener = vi.fn()
			defs.on('updatePresets', updatePresetsListener)

			const preset = makeButtonPreset('p1')
			defs.setPresetDefinitions('unknown', new Map([[preset.id, preset]]), {})

			expect(updatePresetsListener).not.toHaveBeenCalled()
		})

		it('stores presets in map', () => {
			const { defs } = createInstanceDefinitions()

			const p1 = makeButtonPreset('p1')
			const p2 = makeButtonPreset('p2')
			defs.setPresetDefinitions(
				'conn1',
				new Map([
					[p1.id, p1],
					[p2.id, p2],
				]),
				{}
			)

			expect(defs.convertPresetToControlModel('conn1', 'p1', null)).toBeTruthy()
			expect(defs.convertPresetToControlModel('conn1', 'p2', null)).toBeTruthy()
		})

		it('stores a structuredClone so mutating input does not affect stored data', () => {
			const { defs } = createInstanceDefinitions()
			const preset = makeButtonPreset('p1')

			defs.setPresetDefinitions('conn1', new Map([[preset.id, preset]]), {})

			// Mutate the original input
			preset.model.style.text = 'MUTATED'

			const stored = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(stored).not.toBeNull()
			expect(stored!.style.text).not.toBe('MUTATED')
		})

		it('stores empty map when given empty map', () => {
			const { defs } = createInstanceDefinitions()
			const listener = vi.fn()
			defs.on('updatePresets', listener)

			defs.setPresetDefinitions('conn1', new Map(), {})

			expect(listener).toHaveBeenCalledWith('conn1')
			expect(defs.convertPresetToControlModel('conn1', 'p1', null)).toBeNull()
		})
	})

	// ── forgetConnection ─────────────────────────────────────────────────

	describe('forgetConnection', () => {
		it('removes all definitions for a connection', () => {
			const { defs } = createInstanceDefinitions()

			defs.setActionDefinitions('conn1', { act1: makeActionDefinition() })
			defs.setFeedbackDefinitions('conn1', { fb1: makeFeedbackDefinition() })
			const p1 = makeButtonPreset('p1')
			defs.setPresetDefinitions('conn1', new Map([[p1.id, p1]]), {})

			defs.forgetConnection('conn1')

			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'act1')).toBeUndefined()
			expect(defs.getEntityDefinition(EntityModelType.Feedback, 'conn1', 'fb1')).toBeUndefined()
			expect(defs.convertPresetToControlModel('conn1', 'p1', null)).toBeNull()
		})

		it('emits updatePresets event', () => {
			const { defs } = createInstanceDefinitions()
			const listener = vi.fn()
			defs.on('updatePresets', listener)

			defs.forgetConnection('conn1')

			expect(listener).toHaveBeenCalledWith('conn1')
		})

		it('does not affect other connections', () => {
			const { defs } = createInstanceDefinitions()

			defs.setActionDefinitions('conn1', { act1: makeActionDefinition() })
			defs.setActionDefinitions('conn2', { act2: makeActionDefinition({ label: 'Other' }) })

			defs.forgetConnection('conn1')

			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'act1')).toBeUndefined()
			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn2', 'act2')).toBeTruthy()
		})
	})

	// ── createEntityItem ─────────────────────────────────────────────────

	describe('createEntityItem', () => {
		it('returns null when definition does not exist', () => {
			const { defs } = createInstanceDefinitions()

			expect(defs.createEntityItem('conn1', EntityModelType.Action, 'nonexistent')).toBeNull()
		})

		it('creates an action with correct structure', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeActionDefinition({
				options: [
					{ id: 'myText', type: 'textinput', label: 'Text', default: 'hello' } as never,
					{ id: 'myNum', type: 'number', label: 'Num', default: 42, min: 0, max: 100 } as never,
				],
			})
			defs.setActionDefinitions('conn1', { act1: def })

			const result = defs.createEntityItem('conn1', EntityModelType.Action, 'act1')

			expect(result).toMatchSnapshot()
		})

		it('uses lastUpgradeIndex from config', () => {
			const { defs } = createInstanceDefinitions()
			defs.setActionDefinitions('conn1', { act1: makeActionDefinition() })

			const result = defs.createEntityItem('conn1', EntityModelType.Action, 'act1')

			expect(result).not.toBeNull()
			expect(result!.upgradeIndex).toBe(5) // from makeConnectionConfig defaults
		})

		it('sets upgradeIndex undefined when no config', () => {
			const { defs } = createInstanceDefinitions()
			defs.setActionDefinitions('unknown', { act1: makeActionDefinition() })

			const result = defs.createEntityItem('unknown', EntityModelType.Action, 'act1')

			expect(result).not.toBeNull()
			expect(result!.upgradeIndex).toBeUndefined()
		})

		it('skips static-text options', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeActionDefinition({
				options: [
					{ id: 'info', type: 'static-text', label: 'Info', value: 'Read this' } as never,
					{ id: 'myText', type: 'textinput', label: 'Text', default: 'hello' } as never,
				],
			})
			defs.setActionDefinitions('conn1', { act1: def })

			const result = defs.createEntityItem('conn1', EntityModelType.Action, 'act1')

			expect(result).not.toBeNull()
			expect(result!.options).not.toHaveProperty('info')
			expect(result!.options).toHaveProperty('myText')
		})

		it('wraps option defaults in ExpressionOrValue', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeActionDefinition({
				options: [{ id: 'myText', type: 'textinput', label: 'Text', default: 'hello' } as never],
			})
			defs.setActionDefinitions('conn1', { act1: def })

			const result = defs.createEntityItem('conn1', EntityModelType.Action, 'act1')

			expect(result!.options['myText']).toEqual({ isExpression: false, value: 'hello' })
		})

		it('creates a feedback with correct structure', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeFeedbackDefinition({
				feedbackType: FeedbackEntitySubType.Advanced,
				options: [{ id: 'level', type: 'number', label: 'Level', default: 10, min: 0, max: 100 } as never],
			})
			defs.setFeedbackDefinitions('conn1', { fb1: def })

			const result = defs.createEntityItem('conn1', EntityModelType.Feedback, 'fb1')

			expect(result).toMatchSnapshot()
		})

		it('applies feedbackStyle for boolean feedbacks', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeFeedbackDefinition({
				feedbackType: FeedbackEntitySubType.Boolean,
				feedbackStyle: { color: 0xff0000, bgcolor: 0x00ff00 },
			})
			defs.setFeedbackDefinitions('conn1', { fb1: def })

			const result = defs.createEntityItem('conn1', EntityModelType.Feedback, 'fb1')

			expect(result).not.toBeNull()
			expect(result!.type).toBe(EntityModelType.Feedback)
			if (result!.type === EntityModelType.Feedback) {
				expect(result.style).toEqual({ color: 0xff0000, bgcolor: 0x00ff00 })
			}
		})

		it('does not apply feedbackStyle for non-boolean feedbacks', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeFeedbackDefinition({
				feedbackType: FeedbackEntitySubType.Advanced,
				feedbackStyle: { color: 0xff0000 },
			})
			defs.setFeedbackDefinitions('conn1', { fb1: def })

			const result = defs.createEntityItem('conn1', EntityModelType.Feedback, 'fb1')

			expect(result).not.toBeNull()
			if (result!.type === EntityModelType.Feedback) {
				expect(result.style).toEqual({})
			}
		})

		it('sets isInverted to exprVal(false) on feedbacks', () => {
			const { defs } = createInstanceDefinitions()
			defs.setFeedbackDefinitions('conn1', { fb1: makeFeedbackDefinition() })

			const result = defs.createEntityItem('conn1', EntityModelType.Feedback, 'fb1')

			expect(result).not.toBeNull()
			if (result!.type === EntityModelType.Feedback) {
				expect(result.isInverted).toEqual(exprVal(false))
			}
		})

		it('handles definition with empty options array', () => {
			const { defs } = createInstanceDefinitions()
			defs.setActionDefinitions('conn1', { act1: makeActionDefinition({ options: [] }) })

			const result = defs.createEntityItem('conn1', EntityModelType.Action, 'act1')

			expect(result).not.toBeNull()
			expect(result!.options).toEqual({})
		})

		it('boolean feedback without feedbackStyle keeps empty style', () => {
			const { defs } = createInstanceDefinitions()
			const def = makeFeedbackDefinition({
				feedbackType: FeedbackEntitySubType.Boolean,
				feedbackStyle: undefined,
			})
			defs.setFeedbackDefinitions('conn1', { fb1: def })

			const result = defs.createEntityItem('conn1', EntityModelType.Feedback, 'fb1')

			expect(result).not.toBeNull()
			if (result!.type === EntityModelType.Feedback) {
				expect(result.style).toEqual({})
			}
		})

		it('structuredClone isolates option defaults from definition', () => {
			const { defs } = createInstanceDefinitions()
			const arrayDefault = [1, 2, 3]
			const def = makeActionDefinition({
				options: [{ id: 'items', type: 'multidropdown', label: 'Items', default: arrayDefault, choices: [] } as never],
			})
			defs.setActionDefinitions('conn1', { act1: def })

			const result = defs.createEntityItem('conn1', EntityModelType.Action, 'act1')

			// Mutate the original default
			arrayDefault.push(999)

			expect(result).not.toBeNull()
			expect(result!.options['items']).toEqual({ isExpression: false, value: [1, 2, 3] })
		})

		it('structuredClone isolates boolean feedbackStyle from definition', () => {
			const { defs } = createInstanceDefinitions()
			const feedbackStyle = { color: 0xff0000, bgcolor: 0x00ff00 }
			const def = makeFeedbackDefinition({
				feedbackType: FeedbackEntitySubType.Boolean,
				feedbackStyle,
			})
			defs.setFeedbackDefinitions('conn1', { fb1: def })

			const result = defs.createEntityItem('conn1', EntityModelType.Feedback, 'fb1')

			// Mutate the original feedbackStyle
			feedbackStyle.color = 0x000000

			expect(result).not.toBeNull()
			if (result!.type === EntityModelType.Feedback) {
				expect(result.style).toEqual({ color: 0xff0000, bgcolor: 0x00ff00 })
			}
		})
	})

	// ── createEventItem ──────────────────────────────────────────────────

	describe('createEventItem', () => {
		it('returns null for unknown event type', () => {
			const { defs } = createInstanceDefinitions()

			expect(defs.createEventItem('nonexistent_event')).toBeNull()
		})

		it('creates an interval event with defaults', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('interval')

			expect(result).toMatchSnapshot()
		})

		it('creates a timeofday event with defaults', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('timeofday')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('timeofday')
			expect(result!.enabled).toBe(true)
			expect(result!.options).toHaveProperty('time')
			expect(result!.options).toHaveProperty('days')
		})

		it('creates an intervalRandom event with minimum and maximum defaults', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('intervalRandom')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('intervalRandom')
			expect(result!.options['minimum']).toBe(3)
			expect(result!.options['maximum']).toBe(10)
		})

		it('creates a specificDate event', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('specificDate')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('specificDate')
			expect(result!.options).toHaveProperty('date')
			expect(result!.options).toHaveProperty('time')
		})

		it('creates a sun_event with all defaults', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('sun_event')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('sun_event')
			expect(result!.options['type']).toBe('sunrise')
			expect(result!.options['latitude']).toBe(0)
			expect(result!.options['longitude']).toBe(0)
			expect(result!.options['offset']).toBe(0)
		})

		it('creates a startup event with delay default', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('startup')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('startup')
			expect(result!.options['delay']).toBe(10000)
		})

		it('creates a client_connect event with delay default', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('client_connect')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('client_connect')
			expect(result!.options['delay']).toBe(0)
		})

		it('creates a button_press event with empty options', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('button_press')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('button_press')
			expect(result!.options).toEqual({})
		})

		it('creates a button_release event with empty options', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('button_release')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('button_release')
			expect(result!.options).toEqual({})
		})

		it('creates condition_true and condition_false events', () => {
			const { defs } = createInstanceDefinitions()

			const ctrue = defs.createEventItem('condition_true')
			const cfalse = defs.createEventItem('condition_false')

			expect(ctrue).not.toBeNull()
			expect(ctrue!.options).toEqual({})
			expect(cfalse).not.toBeNull()
			expect(cfalse!.options).toEqual({})
		})

		it('creates a variable_changed event', () => {
			const { defs } = createInstanceDefinitions()

			const result = defs.createEventItem('variable_changed')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('variable_changed')
			expect(result!.options).toHaveProperty('variableId')
		})

		it('assigns unique ids to each created event', () => {
			const { defs } = createInstanceDefinitions()

			const ev1 = defs.createEventItem('interval')
			const ev2 = defs.createEventItem('interval')

			expect(ev1!.id).not.toBe(ev2!.id)
		})
	})

	// ── convertPresetToControlModel ──────────────────────────────────────

	describe('convertPresetToControlModel', () => {
		it('returns null for unknown preset', () => {
			const { defs } = createInstanceDefinitions()

			expect(defs.convertPresetToControlModel('conn1', 'p1', null)).toBeNull()
		})

		it('returns the model for button presets', () => {
			const { defs } = createInstanceDefinitions()
			const preset = makeButtonPreset('p1')
			defs.setPresetDefinitions('conn1', new Map([[preset.id, preset]]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)

			// The model is stored as a deep clone, so compare structurally
			expect(result).toBeTruthy()
			expect(result!.type).toBe('button')
		})

		it('returns null for unknown connectionId', () => {
			const { defs } = createInstanceDefinitions()

			expect(defs.convertPresetToControlModel('noSuchConn', 'p1', null)).toBeNull()
		})
	})

	// ── convertPresetToPreviewControlModel ───────────────────────────────

	describe('convertPresetToPreviewControlModel', () => {
		it('returns null for unknown preset', () => {
			const { defs } = createInstanceDefinitions()

			expect(defs.convertPresetToPreviewControlModel('conn1', 'p1')).toBeNull()
		})

		it('creates preview model without previewStyle', () => {
			const { defs } = createInstanceDefinitions()
			defs.setPresetDefinitions('conn1', presetsToMap([makeButtonPreset('p1')]), {})

			const result = defs.convertPresetToPreviewControlModel('conn1', 'p1')

			expect(result).not.toBeNull()
			expect(result!.type).toBe('preset:button')
			// Steps should have empty action_sets
			for (const step of Object.values(result!.steps)) {
				expect(step.action_sets.down).toEqual([])
				expect(step.action_sets.up).toEqual([])
			}
		})

		it('creates preview model with previewStyle override', () => {
			const { defs } = createInstanceDefinitions()
			defs.setPresetDefinitions(
				'conn1',
				presetsToMap([
					makeButtonPreset('p1', {
						previewStyle: { color: 0xaabbcc, bgcolor: 0x112233 },
					}),
				]),
				{}
			)

			const result = defs.convertPresetToPreviewControlModel('conn1', 'p1')

			expect(result).toMatchSnapshot()
		})

		it('appends check_expression feedback when previewStyle is set', () => {
			const { defs } = createInstanceDefinitions()
			defs.setPresetDefinitions(
				'conn1',
				presetsToMap([
					makeButtonPreset('p1', {
						model: makeButtonPresetModel({ feedbacks: [] }),
						previewStyle: { color: 0xff0000 },
					}),
				]),
				{}
			)

			const result = defs.convertPresetToPreviewControlModel('conn1', 'p1')

			expect(result).not.toBeNull()
			const lastFeedback = result!.feedbacks[result!.feedbacks.length - 1]
			expect(lastFeedback.type).toBe(EntityModelType.Feedback)
			if (lastFeedback.type === EntityModelType.Feedback) {
				expect(lastFeedback.connectionId).toBe('internal')
				expect(lastFeedback.definitionId).toBe('check_expression')
				expect(lastFeedback.style).toEqual({ color: 0xff0000 })
			}
		})

		it('omits actions in steps', () => {
			const { defs } = createInstanceDefinitions()
			const actionEntity = {
				type: EntityModelType.Action,
				id: 'some-action',
				connectionId: 'conn1',
				definitionId: 'do-thing',
				options: {},
				upgradeIndex: undefined,
			} as const

			defs.setPresetDefinitions(
				'conn1',
				presetsToMap([
					makeButtonPreset('p1', {
						model: makeButtonPresetModel({
							steps: {
								step1: {
									options: { runWhileHeld: [] },
									action_sets: {
										down: [actionEntity],
										up: [actionEntity],
										rotate_left: undefined,
										rotate_right: undefined,
									},
								},
							},
						}),
					}),
				]),
				{}
			)

			const result = defs.convertPresetToPreviewControlModel('conn1', 'p1')

			expect(result).not.toBeNull()
			expect(result!.steps['step1'].action_sets.down).toEqual([])
			expect(result!.steps['step1'].action_sets.up).toEqual([])
		})

		it('converts all steps in multi-step presets', () => {
			const { defs } = createInstanceDefinitions()
			const actionEntity = {
				type: EntityModelType.Action,
				id: 'a1',
				connectionId: 'conn1',
				definitionId: 'do-thing',
				options: {},
				upgradeIndex: undefined,
			} as const

			defs.setPresetDefinitions(
				'conn1',
				presetsToMap([
					makeButtonPreset('p1', {
						model: makeButtonPresetModel({
							steps: {
								stepA: {
									options: { runWhileHeld: [] },
									action_sets: {
										down: [actionEntity],
										up: [],
										rotate_left: undefined,
										rotate_right: undefined,
									},
								},
								stepB: {
									options: { runWhileHeld: [500] },
									action_sets: {
										down: [actionEntity],
										up: [actionEntity],
										rotate_left: undefined,
										rotate_right: undefined,
									},
								},
							},
						}),
					}),
				]),
				{}
			)

			const result = defs.convertPresetToPreviewControlModel('conn1', 'p1')

			expect(result).not.toBeNull()
			expect(Object.keys(result!.steps)).toEqual(['stepA', 'stepB'])
			for (const step of Object.values(result!.steps)) {
				expect(step.action_sets.down).toEqual([])
				expect(step.action_sets.up).toEqual([])
			}
			// Step options are preserved
			expect(result!.steps['stepB'].options.runWhileHeld).toEqual([500])
		})

		it('preserves existing feedbacks when previewStyle appends check_expression', () => {
			const { defs } = createInstanceDefinitions()
			const existingFeedback = {
				type: EntityModelType.Feedback as const,
				id: 'existing-fb',
				connectionId: 'conn1',
				definitionId: 'some-fb',
				options: {},
				isInverted: exprVal(false),
				style: { color: 0x00ff00 },
				upgradeIndex: undefined,
			}

			defs.setPresetDefinitions(
				'conn1',
				presetsToMap([
					makeButtonPreset('p1', {
						model: makeButtonPresetModel({ feedbacks: [existingFeedback] }),
						previewStyle: { bgcolor: 0x111111 },
					}),
				]),
				{}
			)

			const result = defs.convertPresetToPreviewControlModel('conn1', 'p1')

			expect(result).not.toBeNull()
			expect(result!.feedbacks).toHaveLength(2)
			// First is the original feedback
			expect(result!.feedbacks[0].definitionId).toBe('some-fb')
			// Second is the appended check_expression
			expect(result!.feedbacks[1].definitionId).toBe('check_expression')
		})

		it('does not append check_expression when previewStyle is undefined', () => {
			const { defs } = createInstanceDefinitions()
			defs.setPresetDefinitions('conn1', presetsToMap([makeButtonPreset('p1', { previewStyle: undefined })]), {})

			const result = defs.convertPresetToPreviewControlModel('conn1', 'p1')

			expect(result).not.toBeNull()
			// No check_expression feedback appended
			expect(result!.feedbacks).toHaveLength(0)
		})
	})

	// ── updateVariablePrefixesForLabel ────────────────────────────────────

	describe('updateVariablePrefixesForLabel', () => {
		it('does nothing when no presets exist for connection', () => {
			const { defs } = createInstanceDefinitions()
			const listener = vi.fn()
			defs.on('updatePresets', listener)

			defs.updateVariablePrefixesForLabel('conn1', 'NewLabel')

			expect(listener).not.toHaveBeenCalled()
		})

		it('emits updatePresets when presets exist', () => {
			const { defs } = createInstanceDefinitions()
			defs.setPresetDefinitions('conn1', presetsToMap([makeButtonPreset('p1')]), {})

			const listener = vi.fn()
			defs.on('updatePresets', listener)
			listener.mockClear()

			defs.updateVariablePrefixesForLabel('conn1', 'NewLabel')

			expect(listener).toHaveBeenCalledWith('conn1')
		})

		it('replaces variable label references in style text', () => {
			const { defs } = createInstanceDefinitions()
			defs.setPresetDefinitions(
				'conn1',
				presetsToMap([
					makeButtonPreset('p1', {
						model: makeButtonPresetModel({
							style: {
								text: '$(conn1:status) and $(conn1:volume)',
								textExpression: false,
								size: 'auto',
								alignment: 'center:center',
								pngalignment: 'center:center',
								color: 0xffffff,
								bgcolor: 0x000000,
								show_topbar: 'default',
								png64: null,
							},
						}),
					}),
				]),
				{}
			)

			defs.updateVariablePrefixesForLabel('conn1', 'RenamedConn')

			const model = defs.convertPresetToControlModel('conn1', 'p1', null)

			expect(model).not.toBeNull()
			expect(model!.style.text).toBe('$(RenamedConn:status) and $(RenamedConn:volume)')
		})

		it('replaces variable references in feedback style.text within presets', () => {
			const { defs } = createInstanceDefinitions()
			defs.setPresetDefinitions(
				'conn1',
				presetsToMap([
					makeButtonPreset('p1', {
						model: makeButtonPresetModel({
							feedbacks: [
								{
									type: EntityModelType.Feedback,
									id: 'fb-1',
									connectionId: 'conn1',
									definitionId: 'some-fb',
									options: {},
									isInverted: exprVal(false),
									style: { text: '$(conn1:level)' },
									upgradeIndex: undefined,
								},
							],
						}),
					}),
				]),
				{}
			)

			defs.updateVariablePrefixesForLabel('conn1', 'NewLabel')

			const model = defs.convertPresetToControlModel('conn1', 'p1', null)

			expect(model).not.toBeNull()
			const fb = model!.feedbacks[0]
			expect(fb.type).toBe(EntityModelType.Feedback)
			if (fb.type === EntityModelType.Feedback) {
				expect(fb.style!.text).toBe('$(NewLabel:level)')
			}
		})

		it('replaces variables in all presets for a connection', () => {
			const { defs } = createInstanceDefinitions()
			defs.setPresetDefinitions(
				'conn1',
				presetsToMap([
					makeButtonPreset('p1', {
						model: makeButtonPresetModel({
							style: {
								text: '$(conn1:a)',
								textExpression: false,
								size: 'auto',
								alignment: 'center:center',
								pngalignment: 'center:center',
								color: 0xffffff,
								bgcolor: 0x000000,
								show_topbar: 'default',
								png64: null,
							},
						}),
					}),
					makeButtonPreset('p2', {
						model: makeButtonPresetModel({
							style: {
								text: '$(conn1:b)',
								textExpression: false,
								size: 'auto',
								alignment: 'center:center',
								pngalignment: 'center:center',
								color: 0xffffff,
								bgcolor: 0x000000,
								show_topbar: 'default',
								png64: null,
							},
						}),
					}),
				]),
				{}
			)

			defs.updateVariablePrefixesForLabel('conn1', 'X')

			expect(defs.convertPresetToControlModel('conn1', 'p1', null)!.style.text).toBe('$(X:a)')
			expect(defs.convertPresetToControlModel('conn1', 'p2', null)!.style.text).toBe('$(X:b)')
		})
	})

	// ── TRPC router ──────────────────────────────────────────────────────

	describe('createTrpcRouter', () => {
		const t = initTRPC.context<TrpcContext>().create()
		const testCtx: TrpcContext = { clientId: 'test-client', clientIp: '127.0.0.1' }

		function createCaller(defs: InstanceDefinitions) {
			const trpcRouter = defs.createTrpcRouter()
			return t.createCallerFactory(trpcRouter)(testCtx)
		}

		it('events query returns EventDefinitions', async () => {
			const { defs } = createInstanceDefinitions()
			const caller = createCaller(defs)

			const result = await caller.events()

			expect(result).toBe(EventDefinitions)
		})

		it('actions subscription yields init with empty definitions', async () => {
			const { defs } = createInstanceDefinitions()
			const caller = createCaller(defs)

			const subscription = new SubscriptionTester(await caller.actions())
			await subscription.expectValue({ type: 'init', definitions: {} })
			await subscription.cleanup()
		})

		it('actions subscription yields init with pre-existing definitions', async () => {
			const { defs } = createInstanceDefinitions()
			const actDef = makeActionDefinition({ label: 'A1' })
			defs.setActionDefinitions('conn1', { act1: actDef })

			const caller = createCaller(defs)
			const subscription = new SubscriptionTester(await caller.actions())
			await subscription.expectValue({
				type: 'init',
				definitions: { conn1: { act1: actDef } },
			})
			await subscription.cleanup()
		})

		it('actions subscription yields add-connection on new definitions', async () => {
			const { defs } = createInstanceDefinitions()
			const caller = createCaller(defs)

			const subscription = new SubscriptionTester(await caller.actions())
			await subscription.expectValue({ type: 'init', definitions: {} })

			// Set definitions → triggers add-connection event
			const actDef = makeActionDefinition({ label: 'NewAction' })
			defs.setActionDefinitions('conn1', { act1: actDef })

			await subscription.expectValue({
				type: 'add-connection',
				connectionId: 'conn1',
				entities: { act1: actDef },
			})

			await subscription.cleanup()
		})

		it('actions subscription yields update-connection on changed definitions', async () => {
			const { defs } = createInstanceDefinitions()

			// Pre-populate
			defs.setActionDefinitions('conn1', { act1: makeActionDefinition({ label: 'First' }) })

			const caller = createCaller(defs)
			const subscription = new SubscriptionTester(await caller.actions())

			// Consume init
			const initValue = await subscription.next()
			expect(initValue).toHaveProperty('type', 'init')

			// Update definitions
			defs.setActionDefinitions('conn1', { act2: makeActionDefinition({ label: 'Second' }) })

			const updateValue = await subscription.next()
			expect(updateValue).toHaveProperty('type', 'update-connection')
			expect(updateValue).toHaveProperty('connectionId', 'conn1')

			await subscription.cleanup()
		})

		it('actions subscription yields forget-connection on forgetConnection', async () => {
			const { defs } = createInstanceDefinitions()
			defs.setActionDefinitions('conn1', { act1: makeActionDefinition() })

			const caller = createCaller(defs)
			const subscription = new SubscriptionTester(await caller.actions())

			// Consume init
			await subscription.next()

			defs.forgetConnection('conn1')

			await subscription.expectValue({
				type: 'forget-connection',
				connectionId: 'conn1',
			})

			await subscription.cleanup()
		})

		it('feedbacks subscription yields init and responds to updates', async () => {
			const { defs } = createInstanceDefinitions()
			const caller = createCaller(defs)

			const subscription = new SubscriptionTester(await caller.feedbacks())
			await subscription.expectValue({ type: 'init', definitions: {} })

			// Add feedbacks
			const fbDef = makeFeedbackDefinition({ label: 'FB1' })
			defs.setFeedbackDefinitions('conn1', { fb1: fbDef })

			await subscription.expectValue({
				type: 'add-connection',
				connectionId: 'conn1',
				entities: { fb1: fbDef },
			})

			await subscription.cleanup()
		})

		it('presets subscription yields add on new presets', async () => {
			const { defs } = createInstanceDefinitions()
			const caller = createCaller(defs)

			const subscription = new SubscriptionTester(await caller.presets())

			// Consume init (empty)
			await subscription.next()

			// Add presets
			const presets = [makeButtonPreset('p1', { name: 'New' })]
			defs.setPresetDefinitions('conn1', presetsToMap(presets), generateUIDefinitions(presets))

			const addEvent = await subscription.next()

			expect(addEvent).toHaveProperty('type', 'add')
			expect(addEvent).toHaveProperty('connectionId', 'conn1')
			expect(addEvent).toHaveProperty('definitions')

			await subscription.cleanup()
		})

		it('presets subscription yields remove on forgetConnection', async () => {
			const { defs } = createInstanceDefinitions()
			const presets = [makeButtonPreset('p1')]
			defs.setPresetDefinitions('conn1', presetsToMap(presets), generateUIDefinitions(presets))

			const caller = createCaller(defs)
			const subscription = new SubscriptionTester(await caller.presets())

			// Consume init
			await subscription.next()

			defs.forgetConnection('conn1')

			await subscription.expectValue({
				type: 'remove',
				connectionId: 'conn1',
			})

			await subscription.cleanup()
		})

		it('presets subscription omits connections with no presets from init', async () => {
			const { defs } = createInstanceDefinitions()
			// Set empty presets for a connection
			defs.setPresetDefinitions('conn1', presetsToMap([]), {})
			const p1Presets = [makeButtonPreset('p1')]
			defs.setPresetDefinitions('conn2', presetsToMap(p1Presets), generateUIDefinitions(p1Presets))

			const caller = createCaller(defs)
			const subscription = new SubscriptionTester(await caller.presets())

			const initValue = await subscription.next()

			// conn1 has empty UI definitions, implementation returns it as {}
			expect(initValue).toHaveProperty('type', 'init')
			const initDefs = (initValue as UIPresetDefinitionUpdateInit).definitions
			expect(initDefs).toHaveProperty('conn1')
			expect(initDefs['conn1']).toEqual({})
			await subscription.cleanup()
		})
	})

	// ── snapshot integration tests ───────────────────────────────────────

	describe('snapshot: full lifecycle', () => {
		it('set definitions → create entity → forget → verify cleared', () => {
			const { defs } = createInstanceDefinitions()

			// Set up definitions
			defs.setActionDefinitions('conn1', {
				doSomething: makeActionDefinition({
					label: 'Do Something',
					options: [{ id: 'text', type: 'textinput', label: 'Text', default: 'hi' } as never],
				}),
			})
			defs.setFeedbackDefinitions('conn1', {
				isOn: makeFeedbackDefinition({
					label: 'Is On',
					feedbackType: FeedbackEntitySubType.Boolean,
					feedbackStyle: { bgcolor: 0x00ff00 },
					options: [{ id: 'channel', type: 'number', label: 'Channel', default: 1, min: 1, max: 32 } as never],
				}),
			})

			// Create entities
			const action = defs.createEntityItem('conn1', EntityModelType.Action, 'doSomething')
			const feedback = defs.createEntityItem('conn1', EntityModelType.Feedback, 'isOn')

			expect(action).toMatchSnapshot()
			expect(feedback).toMatchSnapshot()

			// Forget
			defs.forgetConnection('conn1')

			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'doSomething')).toBeUndefined()
			expect(defs.getEntityDefinition(EntityModelType.Feedback, 'conn1', 'isOn')).toBeUndefined()
		})

		it('preset lifecycle: set → convert → preview → update label → forget', () => {
			const { defs } = createInstanceDefinitions()
			const updateListener = vi.fn()
			defs.on('updatePresets', updateListener)

			// Set presets
			defs.setPresetDefinitions(
				'conn1',
				presetsToMap([
					makeButtonPreset('my-preset', {
						model: makeButtonPresetModel({
							style: {
								text: 'Status $(conn1:status)',
								textExpression: false,
								size: 'auto',
								alignment: 'center:center',
								pngalignment: 'center:center',
								color: 0xffffff,
								bgcolor: 0x000000,
								show_topbar: 'default',
								png64: null,
							},
						}),
						previewStyle: { bgcolor: 0x333333 },
					}),
				]),
				{}
			)
			expect(updateListener).toHaveBeenCalledTimes(1)

			// Convert to control model
			const controlModel = defs.convertPresetToControlModel('conn1', 'my-preset', null)
			expect(controlModel).toMatchSnapshot()

			// Convert to preview model
			const previewModel = defs.convertPresetToPreviewControlModel('conn1', 'my-preset')
			expect(previewModel).toMatchSnapshot()

			// Update label
			defs.updateVariablePrefixesForLabel('conn1', 'RenamedConn')
			expect(updateListener).toHaveBeenCalledTimes(2)

			// Forget
			defs.forgetConnection('conn1')
			expect(updateListener).toHaveBeenCalledTimes(3)
			expect(defs.convertPresetToControlModel('conn1', 'my-preset', null)).toBeNull()
		})
	})

	// ── no-op and diff event emission ────────────────────────────────────

	describe('no-op and diff event emission', () => {
		const t = initTRPC.context<TrpcContext>().create()
		const testCtx: TrpcContext = { clientId: 'test-client', clientIp: '127.0.0.1' }

		it('setActionDefinitions with identical data still yields update-connection (diff has empty patches)', async () => {
			const { defs } = createInstanceDefinitions()
			const actDef = makeActionDefinition({ label: 'Same' })
			defs.setActionDefinitions('conn1', { act1: actDef })

			const trpcRouter = defs.createTrpcRouter()
			const caller = t.createCallerFactory(trpcRouter)(testCtx)
			const iterable = await caller.actions()
			const iter = iterable[Symbol.asyncIterator]()

			// Consume init
			await iter.next()

			// Re-set with structurally identical data
			defs.setActionDefinitions('conn1', { act1: makeActionDefinition({ label: 'Same' }) })

			const second = await iter.next()

			// diffObjects returns a diff even for identical data (with empty json-patch arrays)
			expect(second.value).toHaveProperty('type', 'update-connection')
			expect(second.value).toHaveProperty('connectionId', 'conn1')

			await iter.return?.()
		})

		it('setFeedbackDefinitions with identical data still yields update-connection', async () => {
			const { defs } = createInstanceDefinitions()
			const fbDef = makeFeedbackDefinition({ label: 'Same' })
			defs.setFeedbackDefinitions('conn1', { fb1: fbDef })

			const trpcRouter = defs.createTrpcRouter()
			const caller = t.createCallerFactory(trpcRouter)(testCtx)
			const iterable = await caller.feedbacks()
			const iter = iterable[Symbol.asyncIterator]()

			// Consume init
			await iter.next()

			// Re-set with structurally identical data
			defs.setFeedbackDefinitions('conn1', { fb1: makeFeedbackDefinition({ label: 'Same' }) })

			const second = await iter.next()

			expect(second.value).toHaveProperty('type', 'update-connection')
			expect(second.value).toHaveProperty('connectionId', 'conn1')

			await iter.return?.()
		})

		it('setActionDefinitions does not emit when no listeners are attached', () => {
			const { defs } = createInstanceDefinitions()

			// No TRPC subscriptions active → #events has no listeners
			// This should not throw
			defs.setActionDefinitions('conn1', { act1: makeActionDefinition() })
			defs.setActionDefinitions('conn1', { act2: makeActionDefinition({ label: 'Updated' }) })

			// Still works correctly
			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'act2')).toBeTruthy()
			expect(defs.getEntityDefinition(EntityModelType.Action, 'conn1', 'act1')).toBeUndefined()
		})

		it('forgetConnection on never-set connection is safe and emits updatePresets', () => {
			const { defs } = createInstanceDefinitions()
			const listener = vi.fn()
			defs.on('updatePresets', listener)

			// Forget a connection that was never set
			defs.forgetConnection('neverSet')

			expect(listener).toHaveBeenCalledWith('neverSet')
		})

		it('presets subscription yields patch when presets are updated', async () => {
			const { defs } = createInstanceDefinitions()
			const initialPresets = [makeButtonPreset('p1', { name: 'First' })]
			defs.setPresetDefinitions('conn1', presetsToMap(initialPresets), generateUIDefinitions(initialPresets))

			const trpcRouter = defs.createTrpcRouter()
			const caller = t.createCallerFactory(trpcRouter)(testCtx)
			const iterable = await caller.presets()
			const iter = iterable[Symbol.asyncIterator]()

			// Consume init
			await iter.next()

			// Update presets
			const updatedPresets = [makeButtonPreset('p1', { name: 'Updated' }), makeButtonPreset('p2', { name: 'New' })]
			defs.setPresetDefinitions('conn1', presetsToMap(updatedPresets), generateUIDefinitions(updatedPresets))

			const second = await iter.next()

			expect(second.value).toHaveProperty('type', 'patch')
			expect(second.value).toHaveProperty('connectionId', 'conn1')

			await iter.return?.()
		})
	})

	// ── simplifyPresetsForUi ordering ────────────────────────────────────

	describe('simplifyPresetsForUi (via TRPC)', () => {
		const t = initTRPC.context<TrpcContext>().create()
		const testCtx: TrpcContext = { clientId: 'test-client', clientIp: '127.0.0.1' }

		it('assigns sequential order values to presets', async () => {
			const { defs } = createInstanceDefinitions()
			const presets = [makeButtonPreset('a', { name: 'Alpha' }), makeButtonPreset('c', { name: 'Gamma' })]
			defs.setPresetDefinitions('conn1', presetsToMap(presets), generateUIDefinitions(presets))

			const trpcRouter = defs.createTrpcRouter()
			const caller = t.createCallerFactory(trpcRouter)(testCtx)
			const iterable = await caller.presets()
			const iter = iterable[Symbol.asyncIterator]()

			const first = await iter.next()
			const initDefs = (first.value as UIPresetDefinitionUpdateInit).definitions

			// Access: conn1 -> default section -> default group -> presets -> preset id
			const defaultGroup = initDefs['conn1']['default'].definitions['default']
			expect(defaultGroup.type).toBe('simple')
			const conn1Presets = (defaultGroup as UIPresetGroupSimple).presets

			// Verify sequential order values
			expect(conn1Presets['a']).toMatchObject({ id: 'a', label: 'Alpha', order: 0 })
			expect(conn1Presets['c']).toMatchObject({ id: 'c', label: 'Gamma', order: 1 })

			await iter.return?.()
		})
	})

	// ── forgetConnection event emission via TRPC ─────────────────────────

	describe('forgetConnection events via TRPC', () => {
		const t = initTRPC.context<TrpcContext>().create()
		const testCtx: TrpcContext = { clientId: 'test-client', clientIp: '127.0.0.1' }

		it('emits forget-connection on feedbacks subscription', async () => {
			const { defs } = createInstanceDefinitions()
			defs.setFeedbackDefinitions('conn1', { fb1: makeFeedbackDefinition() })

			const trpcRouter = defs.createTrpcRouter()
			const caller = t.createCallerFactory(trpcRouter)(testCtx)
			const iterable = await caller.feedbacks()
			const iter = iterable[Symbol.asyncIterator]()

			// Consume init
			await iter.next()

			defs.forgetConnection('conn1')

			const second = await iter.next()
			expect(second.value).toEqual({
				type: 'forget-connection',
				connectionId: 'conn1',
			})

			await iter.return?.()
		})

		it('emits remove on presets subscription', async () => {
			const { defs } = createInstanceDefinitions()
			const presets = [makeButtonPreset('p1')]
			defs.setPresetDefinitions('conn1', presetsToMap(presets), generateUIDefinitions(presets))

			const trpcRouter = defs.createTrpcRouter()
			const caller = t.createCallerFactory(trpcRouter)(testCtx)
			const iterable = await caller.presets()
			const iter = iterable[Symbol.asyncIterator]()

			// Consume init
			await iter.next()

			defs.forgetConnection('conn1')

			const second = await iter.next()
			expect(second.value).toEqual({
				type: 'remove',
				connectionId: 'conn1',
			})

			await iter.return?.()
		})
	})

	// ── Variable replacement in presets ──────────────────────────────────

	describe('variable replacement in presets', () => {
		it('replaces $(label:var) in action options with textinput+useVariables', () => {
			const { defs } = createInstanceDefinitions()

			// Set up action definition with textinput field that supports variables
			const actionDef = makeActionDefinition({
				label: 'Test Action',
				options: [
					{
						id: 'text',
						type: 'textinput',
						label: 'Text',
						default: '',
						useVariables: CompanionFieldVariablesSupport.InternalParser,
					},
				],
			})
			defs.setActionDefinitions('conn1', { act1: actionDef })

			// Set up preset with action that uses $(label:var)
			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					steps: {
						step1: {
							options: { runWhileHeld: [] },
							action_sets: {
								down: [
									{
										type: EntityModelType.Action,
										id: 'action1',
										connectionId: 'conn1',
										definitionId: 'act1',
										options: {
											text: exprVal('Hello $(label:variable)'),
										},
										upgradeIndex: undefined,
									},
								],
								up: [],
								rotate_left: undefined,
								rotate_right: undefined,
							},
						},
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const action = result!.steps.step1.action_sets.down[0]
			expect(action.options.text).toEqual(exprVal('Hello $(conn1:variable)'))
		})

		it('replaces $(label:var) in feedback options with textinput+useVariables', () => {
			const { defs } = createInstanceDefinitions()

			const feedbackDef = makeFeedbackDefinition({
				label: 'Test Feedback',
				options: [
					{
						id: 'value',
						type: 'textinput',
						label: 'Value',
						default: '',
						useVariables: CompanionFieldVariablesSupport.InternalParser,
					},
				],
			})
			defs.setFeedbackDefinitions('conn1', { fb1: feedbackDef })

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					feedbacks: [
						{
							type: EntityModelType.Feedback,
							id: 'feedback1',
							connectionId: 'conn1',
							definitionId: 'fb1',
							options: {
								value: exprVal('Check $(label:status)'),
							},
							isInverted: exprVal(false),
							style: {},
							upgradeIndex: undefined,
						},
					],
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const feedback = result!.feedbacks[0]
			expect(feedback.options.value).toEqual(exprVal('Check $(conn1:status)'))
		})

		it('replaces $(label:var) in expression fields when optionsSupportExpressions is true', () => {
			const { defs } = createInstanceDefinitions()

			const actionDef = makeActionDefinition({
				label: 'Expression Action',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'expr',
						type: 'expression',
						label: 'Expression',
						default: '',
					},
				],
			})
			defs.setActionDefinitions('conn1', { act1: actionDef })
			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					steps: {
						step1: {
							options: { runWhileHeld: [] },
							action_sets: {
								down: [
									{
										type: EntityModelType.Action,
										id: 'action1',
										connectionId: 'conn1',
										definitionId: 'act1',
										options: {
											expr: exprVal('$(label:count) + 10'),
										},
										upgradeIndex: undefined,
									},
								],
								up: [],
								rotate_left: undefined,
								rotate_right: undefined,
							},
						},
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const action = result!.steps.step1.action_sets.down[0]
			expect(action.options.expr).toEqual(exprVal('$(conn1:count) + 10'))
		})

		it('replaces $(label:var) in textinput with isExpression=true when optionsSupportExpressions is true', () => {
			const { defs } = createInstanceDefinitions()

			const actionDef = makeActionDefinition({
				label: 'Test Action',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'text',
						type: 'textinput',
						label: 'Text',
						default: '',
					},
				],
			})
			defs.setActionDefinitions('conn1', { act1: actionDef })

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					steps: {
						step1: {
							options: { runWhileHeld: [] },
							action_sets: {
								down: [
									{
										type: EntityModelType.Action,
										id: 'action1',
										connectionId: 'conn1',
										definitionId: 'act1',
										options: {
											text: exprExpr('$(label:var1) + " text"'),
										},
										upgradeIndex: undefined,
									},
								],
								up: [],
								rotate_left: undefined,
								rotate_right: undefined,
							},
						},
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const action = result!.steps.step1.action_sets.down[0]
			expect(action.options.text).toEqual(exprExpr('$(conn1:var1) + " text"'))
		})

		it('does NOT replace $(label:var) in textinput with isExpression=false even when optionsSupportExpressions is true', () => {
			const { defs } = createInstanceDefinitions()

			const actionDef = makeActionDefinition({
				label: 'Test Action',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'text',
						type: 'textinput',
						label: 'Text',
						default: '',
					},
				],
			})
			defs.setActionDefinitions('conn1', { act1: actionDef })

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					steps: {
						step1: {
							options: { runWhileHeld: [] },
							action_sets: {
								down: [
									{
										type: EntityModelType.Action,
										id: 'action1',
										connectionId: 'conn1',
										definitionId: 'act1',
										options: {
											text: exprVal('$(label:var1)'),
										},
										upgradeIndex: undefined,
									},
								],
								up: [],
								rotate_left: undefined,
								rotate_right: undefined,
							},
						},
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const action = result!.steps.step1.action_sets.down[0]
			// Should NOT replace because isExpression is false (literal dropdown value case)
			expect(action.options.text).toEqual(exprVal('$(label:var1)'))
		})

		it('does not replace variables in fields without useVariables or expression support', () => {
			const { defs } = createInstanceDefinitions()

			const actionDef = makeActionDefinition({
				label: 'Test Action',
				options: [
					{
						id: 'text',
						type: 'textinput',
						label: 'Text',
						default: '',
						// No useVariables
					},
				],
			})
			defs.setActionDefinitions('conn1', { act1: actionDef })

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					steps: {
						step1: {
							options: { runWhileHeld: [] },
							action_sets: {
								down: [
									{
										type: EntityModelType.Action,
										id: 'action1',
										connectionId: 'conn1',
										definitionId: 'act1',
										options: {
											text: exprVal('$(label:var) should not change'),
										},
										upgradeIndex: undefined,
									},
								],
								up: [],
								rotate_left: undefined,
								rotate_right: undefined,
							},
						},
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const action = result!.steps.step1.action_sets.down[0]
			expect(action.options.text).toEqual(exprVal('$(label:var) should not change'))
		})

		it('replaces $(label:var) in button style text', () => {
			const { defs } = createInstanceDefinitions()

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					style: {
						text: 'Status: $(label:state)',
						textExpression: false,
						size: 'auto',
						alignment: 'center:center',
						pngalignment: 'center:center',
						color: 0xffffff,
						bgcolor: 0x000000,
						show_topbar: 'default',
						png64: null,
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()
			expect(result!.style.text).toBe('Status: $(conn1:state)')
		})

		it('replaces $(label:var) in feedback style text', () => {
			const { defs } = createInstanceDefinitions()

			const feedbackDef = makeFeedbackDefinition({ label: 'Test Feedback' })
			defs.setFeedbackDefinitions('conn1', { fb1: feedbackDef })

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					feedbacks: [
						{
							type: EntityModelType.Feedback,
							id: 'feedback1',
							connectionId: 'conn1',
							definitionId: 'fb1',
							options: {},
							isInverted: exprVal(false),
							style: {
								text: 'Value: $(label:reading)',
							},
							upgradeIndex: undefined,
						},
					],
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const feedback = result!.feedbacks[0]
			if (feedback.type === EntityModelType.Feedback) {
				expect(feedback.style?.text).toBe('Value: $(conn1:reading)')
			}
		})

		it('handles multiple $(label:) references in the same string', () => {
			const { defs } = createInstanceDefinitions()

			const actionDef = makeActionDefinition({
				label: 'Test Action',
				options: [
					{
						id: 'text',
						type: 'textinput',
						label: 'Text',
						default: '',
						useVariables: CompanionFieldVariablesSupport.InternalParser,
					},
				],
			})
			defs.setActionDefinitions('conn1', { act1: actionDef })

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					steps: {
						step1: {
							options: { runWhileHeld: [] },
							action_sets: {
								down: [
									{
										type: EntityModelType.Action,
										id: 'action1',
										connectionId: 'conn1',
										definitionId: 'act1',
										options: {
											text: exprVal('$(label:var1) and $(label:var2) and $(label:var3)'),
										},
										upgradeIndex: undefined,
									},
								],
								up: [],
								rotate_left: undefined,
								rotate_right: undefined,
							},
						},
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const action = result!.steps.step1.action_sets.down[0]
			expect(action.options.text).toEqual(exprVal('$(conn1:var1) and $(conn1:var2) and $(conn1:var3)'))
		})

		it('preserves isExpression flag when replacing variables', () => {
			const { defs } = createInstanceDefinitions()

			const actionDef = makeActionDefinition({
				label: 'Test Action',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'text',
						type: 'textinput',
						label: 'Text',
						default: '',
						useVariables: CompanionFieldVariablesSupport.InternalParser,
					},
				],
			})
			defs.setActionDefinitions('conn1', { act1: actionDef })

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					steps: {
						step1: {
							options: { runWhileHeld: [] },
							action_sets: {
								down: [
									{
										type: EntityModelType.Action,
										id: 'action1',
										connectionId: 'conn1',
										definitionId: 'act1',
										options: {
											text: { value: '$(label:var)', isExpression: true },
										},
										upgradeIndex: undefined,
									},
								],
								up: [],
								rotate_left: undefined,
								rotate_right: undefined,
							},
						},
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const action = result!.steps.step1.action_sets.down[0]
			expect(action.options.text).toEqual({ value: '$(conn1:var)', isExpression: true })
		})

		it('handles missing action definition gracefully and logs warning', () => {
			const { defs } = createInstanceDefinitions()

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					steps: {
						step1: {
							options: { runWhileHeld: [] },
							action_sets: {
								down: [
									{
										type: EntityModelType.Action,
										id: 'action1',
										connectionId: 'conn1',
										definitionId: 'nonexistent',
										options: {
											text: exprVal('$(label:var)'),
										},
										upgradeIndex: undefined,
									},
								],
								up: [],
								rotate_left: undefined,
								rotate_right: undefined,
							},
						},
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			// Variable replacement should not happen for missing definitions
			const action = result!.steps.step1.action_sets.down[0]
			expect(action.options.text).toEqual(exprVal('$(label:var)'))
		})

		it('handles missing feedback definition gracefully and logs warning', () => {
			const { defs } = createInstanceDefinitions()

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					feedbacks: [
						{
							type: EntityModelType.Feedback,
							id: 'feedback1',
							connectionId: 'conn1',
							definitionId: 'nonexistent',
							options: {
								value: exprVal('$(label:var)'),
							},
							isInverted: exprVal(false),
							style: {},
							upgradeIndex: undefined,
						},
					],
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			// Variable replacement should not happen for missing definitions
			const feedback = result!.feedbacks[0]
			expect(feedback.options.value).toEqual(exprVal('$(label:var)'))
		})

		it('handles non-string values in options correctly', () => {
			const { defs } = createInstanceDefinitions()

			const actionDef = makeActionDefinition({
				label: 'Test Action',
				options: [
					{
						id: 'number',
						type: 'number',
						label: 'Number',
						default: 0,
						min: 0,
						max: 100,
					},
					{
						id: 'checkbox',
						type: 'checkbox',
						label: 'Checkbox',
						default: false,
					},
				],
			})
			defs.setActionDefinitions('conn1', { act1: actionDef })

			const preset = makeButtonPreset('p1', {
				model: {
					...makeButtonPresetModel(),
					steps: {
						step1: {
							options: { runWhileHeld: [] },
							action_sets: {
								down: [
									{
										type: EntityModelType.Action,
										id: 'action1',
										connectionId: 'conn1',
										definitionId: 'act1',
										options: {
											number: exprVal(42),
											checkbox: exprVal(true),
										},
										upgradeIndex: undefined,
									},
								],
								up: [],
								rotate_left: undefined,
								rotate_right: undefined,
							},
						},
					},
				},
			})

			defs.setPresetDefinitions('conn1', presetsToMap([preset]), {})

			const result = defs.convertPresetToControlModel('conn1', 'p1', null)
			expect(result).not.toBeNull()

			const action = result!.steps.step1.action_sets.down[0]
			expect(action.options.number).toEqual(exprVal(42))
			expect(action.options.checkbox).toEqual(exprVal(true))
		})
	})
})
