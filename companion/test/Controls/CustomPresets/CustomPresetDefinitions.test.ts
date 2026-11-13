import { describe, expect, test } from 'vitest'
import type { LayeredButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { CustomPresetCollection } from '@companion-app/shared/Model/CustomPresetModel.js'
import {
	buildCustomPresetDefinitions,
	UNGROUPED_CUSTOM_PRESETS_SECTION_ID,
	type CustomPresetSource,
} from '../../../lib/Controls/CustomPresets/CustomPresetDefinitions.js'

function makeModel(text: string): LayeredButtonModel {
	return {
		type: 'button-layered',
		options: {
			stepProgression: 'auto',
			stepExpression: '',
			rotaryActions: false,
			canModifyStyleInApis: false,
			notes: '',
		},
		style: { layers: [{ id: text } as any] },
		feedbacks: [],
		steps: {},
		localVariables: [],
	}
}

function makePreset(id: string, overrides: Partial<CustomPresetSource> = {}): CustomPresetSource {
	return {
		id,
		name: `Preset ${id}`,
		description: '',
		sortOrder: 0,
		collectionId: undefined,
		model: makeModel(id),
		...overrides,
	}
}

function makeCollection(
	id: string,
	label: string,
	sortOrder: number,
	children: CustomPresetCollection[] = []
): CustomPresetCollection {
	return { id, label, sortOrder, children, metaData: null }
}

describe('buildCustomPresetDefinitions', () => {
	test('each custom preset is a preset of its button', () => {
		const preset = makePreset('a')
		const { presets } = buildCustomPresetDefinitions([preset], [])

		expect(presets.get('a')).toEqual({
			id: 'a',
			name: 'Preset a',
			type: 'button',
			model: preset.model,
			presetExtraFeedbacks: [],
			keywords: undefined,
		})
	})

	test('there are no sections when there are no custom presets', () => {
		const { presets, sections } = buildCustomPresetDefinitions([], [makeCollection('c1', 'One', 0)])

		expect(presets.size).toBe(0)
		expect(sections).toEqual({})
	})

	test('custom presets in no collection are in the ungrouped section, in their order', () => {
		const { sections } = buildCustomPresetDefinitions(
			[makePreset('b', { sortOrder: 2 }), makePreset('a', { sortOrder: 1, description: 'Find me' })],
			[]
		)

		expect(Object.keys(sections)).toEqual([UNGROUPED_CUSTOM_PRESETS_SECTION_ID])
		const group = sections[UNGROUPED_CUSTOM_PRESETS_SECTION_ID].definitions.presets
		expect(group).toEqual({
			type: 'simple',
			id: 'presets',
			name: '',
			order: 0,
			presets: {
				a: { id: 'a', order: 0, label: 'Preset a', keywords: ['Find me'] },
				b: { id: 'b', order: 1, label: 'Preset b', keywords: undefined },
			},
		})
	})

	test('each collection is a section named by its path, in the order of the collections, before the ungrouped', () => {
		const collections = [
			makeCollection('second', 'Second', 1),
			makeCollection('first', 'First', 0, [makeCollection('child', 'Child', 0)]),
		]
		const { sections } = buildCustomPresetDefinitions(
			[
				makePreset('loose'),
				makePreset('in-second', { collectionId: 'second' }),
				makePreset('in-child', { collectionId: 'child' }),
				makePreset('in-first', { collectionId: 'first' }),
			],
			collections
		)

		const ordered = Object.values(sections).sort((a, b) => a.order - b.order)
		expect(ordered.map((section) => [section.id, section.name])).toEqual([
			['first', 'First'],
			['child', 'First / Child'],
			['second', 'Second'],
			[UNGROUPED_CUSTOM_PRESETS_SECTION_ID, 'Ungrouped'],
		])
		const childGroup = sections.child.definitions.presets
		expect(childGroup.type === 'simple' && Object.keys(childGroup.presets)).toEqual(['in-child'])
	})

	test('a custom preset in a collection which is gone is ungrouped', () => {
		const { sections } = buildCustomPresetDefinitions([makePreset('a', { collectionId: 'missing' })], [])

		expect(Object.keys(sections)).toEqual([UNGROUPED_CUSTOM_PRESETS_SECTION_ID])
	})

	test('an empty collection has no section', () => {
		const { sections } = buildCustomPresetDefinitions([makePreset('a')], [makeCollection('empty', 'Empty', 0)])

		expect(sections.empty).toBeUndefined()
	})
})
