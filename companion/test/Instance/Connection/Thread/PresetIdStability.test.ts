import { describe, expect, test, vi } from 'vitest'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { CompanionPresetDefinitions, CompanionPresetSection, ModuleLogger } from '@companion-module/host'
import type { InstanceConfigStore } from '../../../../lib/Instance/ConfigStore.js'
import { ConvertPresetDefinitions as ConvertLegacyPresetDefinitions } from '../../../../lib/Instance/Connection/PresetsLegacy.js'
import { ConvertPresetDefinitions } from '../../../../lib/Instance/Connection/Thread/Presets.js'
import { InstanceDefinitions } from '../../../../lib/Instance/Definitions.js'

/**
 * The converted model is content-hashed (`InstanceDefinitions.#getPresetChecksum`) to decide whether a
 * re-reported preset actually changed. Ids are part of that content, so converting the same raw preset
 * twice must produce byte-identical output.
 */

const logger = { warn: () => {}, error: () => {}, info: () => {}, debug: () => {} } as unknown as ModuleLogger

const sections: CompanionPresetSection[] = [{ id: 'sec', name: 'Section', definitions: ['p1', 'p2'] }]

/** A `simple` and a `layered` preset, between them covering every id-generating path in the conversion. */
function makeRawPresets(p1Text: string): CompanionPresetDefinitions {
	return {
		p1: {
			type: 'simple',
			name: 'Preset One',
			style: { text: p1Text, size: 14, color: 0xffffff, bgcolor: 0 },
			previewStyle: { bgcolor: 0x0000ff },
			feedbacks: [
				{ feedbackId: 'fb-boolean', options: {}, style: { bgcolor: 0xff0000 } },
				{ feedbackId: 'fb-advanced', options: {} },
				{ feedbackId: 'internal:checkExpression', options: { expression: '1 > 0' } },
			],
			steps: [
				{
					down: [
						{ actionId: 'act1', options: {} },
						{ actionId: 'act2', options: {}, delay: 500 },
						{ actionId: 'internal:localVariableSet', options: { name: 'diff', value: 5 } },
						{
							actionId: 'internal:logicIf',
							options: {},
							children: {
								condition: [{ feedbackId: 'internal:checkExpression', options: { expression: 'true' } }],
								actions: [{ actionId: 'act3', options: {} }],
								elseActions: [{ actionId: 'act4', options: {} }],
							},
						},
					],
					up: [],
				},
			],
			localVariables: [
				{ variableType: 'simple', variableName: 'diff', startupValue: 500 },
				{ variableType: 'feedback', variableName: 'tap', feedbackId: 'fb-value', options: {} },
			],
		},
		p2: {
			type: 'layered',
			name: 'Preset Two',
			canvas: {},
			elements: [
				{ id: 'named-box', type: 'box', x: 0, y: 0, width: 100, height: 100, color: 0x00ff00 },
				{ type: 'text', x: 0, y: 0, width: 100, height: 50, text: 'hello' },
				{
					type: 'group',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					children: [{ type: 'circle', x: 0, y: 0, width: 10, height: 10 }],
				},
				{
					type: 'gauge',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					stops: [
						{ value: 0, color: 0x00ff00, gradient: false },
						{ value: 100, color: 0xff0000, gradient: true },
					],
				},
			],
			feedbacks: [
				{
					feedbackId: 'fb-layered',
					options: {},
					styleOverrides: [
						{ elementId: 'named-box', elementProperty: 'color', override: { isExpression: false, value: 1 } },
					],
				},
			],
			steps: [],
			localVariables: [],
		},
	} as unknown as CompanionPresetDefinitions
}

function convert(rawPresets: CompanionPresetDefinitions) {
	return ConvertPresetDefinitions(logger, 'conn1', 0, sections, rawPresets, new Map()).presets
}

/** Every id appearing anywhere in a converted preset definition */
function collectIds(value: unknown, found: string[] = []): string[] {
	if (Array.isArray(value)) {
		for (const item of value) collectIds(item, found)
	} else if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) {
			if ((key === 'id' || key === 'overrideId' || key === '_id') && typeof item === 'string') found.push(item)
			collectIds(item, found)
		}
	}
	return found
}

describe('preset conversion id stability', () => {
	test('re-converting identical raw presets produces an identical model', () => {
		const first = convert(makeRawPresets('one'))
		const second = convert(makeRawPresets('one'))

		// Deep equality covers the ids, which is what the content checksum is computed over
		expect(second).toEqual(first)
	})

	test('changing one preset does not change the model of another', () => {
		const before = convert(makeRawPresets('one'))
		const after = convert(makeRawPresets('CHANGED'))

		expect(after.p1).not.toEqual(before.p1)
		// p1 gained no entities here, but p2 must be insulated from p1's numbering regardless
		expect(after.p2).toEqual(before.p2)
	})

	test('a content change is still visible in the model', () => {
		const before = convert(makeRawPresets('one'))
		const after = convert(makeRawPresets('two'))

		expect(after.p1).not.toEqual(before.p1)
	})

	test('ids are unique within a preset, and generated ids are namespaced per preset', () => {
		const presets = convert(makeRawPresets('one'))

		// Preset ids, the fixed layer ids, and module-named elements are constant already - not ours to allocate
		const notGenerated = new Set(['p1', 'p2', 'canvas', 'box0', 'image0', 'text0', 'imageBuffers', 'named-box'])

		const p1Ids = collectIds(presets.p1)
		const p2Ids = collectIds(presets.p2)

		expect(new Set(p1Ids).size).toBe(p1Ids.length)
		expect(new Set(p2Ids).size).toBe(p2Ids.length)

		// Namespacing by preset id is what lets each preset be numbered independently
		expect(p1Ids.filter((id) => !notGenerated.has(id) && !id.startsWith('p1_'))).toEqual([])
		expect(p2Ids.filter((id) => !notGenerated.has(id) && !id.startsWith('p2_'))).toEqual([])
	})

	test('an element id the module named itself is preserved, so renaming it is still a change', () => {
		const presets = convert(makeRawPresets('one'))

		expect(collectIds(presets.p2)).toContain('named-box')
	})

	test('the fixture actually exercises every id-generating path', () => {
		// Guards against the suite quietly passing because the fixture stopped producing entities
		const presets = convert(makeRawPresets('one'))
		const p1 = presets.p1 as any
		const p2 = presets.p2 as any

		expect(p1.model.feedbacks.length).toBeGreaterThanOrEqual(3)
		expect(p1.model.feedbacks.some((f: any) => f.styleOverrides?.length > 0)).toBe(true)
		expect(p1.presetExtraFeedbacks.length).toBeGreaterThan(0)
		expect(p1.model.localVariables).toHaveLength(2)
		const downActions = p1.model.steps['0'].action_sets.down
		expect(downActions.some((a: any) => a.definitionId === 'wait')).toBe(true)
		expect(downActions.some((a: any) => a.children?.actions?.length > 0)).toBe(true)

		const layers = p2.model.style.layers
		expect(layers.length).toBeGreaterThanOrEqual(5)
		expect(layers.find((l: any) => l.type === 'group')?.children).toHaveLength(1)
		expect(layers.find((l: any) => l.type === 'gauge')?.stops.value).toHaveLength(2)
		expect(p2.model.feedbacks[0].styleOverrides).toHaveLength(1)
	})
})

describe('preset checksum, end to end from the raw preset', () => {
	function createDefinitions() {
		const configStore = {
			getConfigOfTypeForId: vi.fn((instanceId: string, _type: ModuleInstanceType | null) => ({
				label: instanceId,
				moduleId: 'mod1',
			})),
		} as unknown as InstanceConfigStore
		return new InstanceDefinitions(configStore)
	}

	/** Convert raw presets the way a module reports them, store them, and read back p1's checksum */
	function reportAndGetChecksum(defs: InstanceDefinitions, rawPresets: CompanionPresetDefinitions) {
		const presets = convert(rawPresets)
		defs.setPresetDefinitions('conn1', new Map(Object.entries(presets)), {}, true)
		return defs.convertPresetToReferenceControlModel('conn1', 'p1', null)?.checksum
	}

	test('a module re-reporting identical presets does not change the checksum', () => {
		const defs = createDefinitions()

		const first = reportAndGetChecksum(defs, makeRawPresets('one'))
		expect(first).toBeTruthy()

		expect(reportAndGetChecksum(defs, makeRawPresets('one'))).toBe(first)
	})

	test('a real content change does change the checksum', () => {
		const defs = createDefinitions()

		const first = reportAndGetChecksum(defs, makeRawPresets('one'))

		expect(reportAndGetChecksum(defs, makeRawPresets('two'))).not.toBe(first)
	})
})

describe('legacy preset conversion id stability', () => {
	// Not linkable, but still content-hashed for the preset preview's rebuild guard.
	function makeRawLegacyPresets(text: string) {
		return [
			{
				id: 'p1',
				type: 'button',
				category: 'Cat',
				name: 'My Preset',
				style: { text, size: 14, color: 0xffffff, bgcolor: 0 },
				feedbacks: [{ feedbackId: 'fb1', options: {} }],
				steps: [{ down: [{ actionId: 'act1', options: {} }], up: [] }],
			},
		] as any
	}

	function convertLegacy(rawPresets: any) {
		return ConvertLegacyPresetDefinitions(logger as never, 'conn1', 0, rawPresets).presets.get('p1')
	}

	test('re-converting identical raw presets produces an identical model', () => {
		expect(convertLegacy(makeRawLegacyPresets('one'))).toEqual(convertLegacy(makeRawLegacyPresets('one')))
	})

	test('a content change is still visible in the model', () => {
		expect(convertLegacy(makeRawLegacyPresets('two'))).not.toEqual(convertLegacy(makeRawLegacyPresets('one')))
	})
})
