import type { LayeredButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { CustomPresetCollection } from '@companion-app/shared/Model/CustomPresetModel.js'
import type { PresetDefinition, UIPresetDefinition, UIPresetSection } from '@companion-app/shared/Model/Presets.js'

/** The id of the section holding the custom presets which are not in a collection */
export const UNGROUPED_CUSTOM_PRESETS_SECTION_ID = '__ungrouped__'

/** The id of the one group in each section of custom presets */
const CUSTOM_PRESETS_GROUP_ID = 'presets'

/** What a custom preset is offered as, from the control which holds it */
export interface CustomPresetSource {
	/** The id of the custom preset, which is the id of its preset */
	readonly id: string
	readonly name: string
	readonly description: string
	readonly sortOrder: number
	readonly collectionId: string | undefined
	/** The button it places */
	readonly model: LayeredButtonModel
}

export interface CustomPresetDefinitions {
	readonly presets: ReadonlyMap<string, PresetDefinition>
	readonly sections: Record<string, UIPresetSection>
}

/**
 * Build the presets and the sections of the presets list from the custom presets. Each collection is a section, named
 * by its path through its parent collections, in the order the collections are listed, followed by a section for the
 * custom presets in no collection. A section has only the custom presets directly in its collection, and one without
 * any is left out
 */
export function buildCustomPresetDefinitions(
	customPresets: Iterable<CustomPresetSource>,
	collections: readonly CustomPresetCollection[]
): CustomPresetDefinitions {
	const presets = new Map<string, PresetDefinition>()
	const presetsBySection = new Map<string, CustomPresetSource[]>()

	const sectionInfos: { id: string; name: string }[] = []
	const addCollections = (list: readonly CustomPresetCollection[], parentNames: readonly string[]) => {
		for (const collection of [...list].sort((a, b) => a.sortOrder - b.sortOrder)) {
			const names = [...parentNames, collection.label || 'Unnamed collection']
			sectionInfos.push({ id: collection.id, name: names.join(' / ') })
			addCollections(collection.children, names)
		}
	}
	addCollections(collections, [])
	sectionInfos.push({ id: UNGROUPED_CUSTOM_PRESETS_SECTION_ID, name: 'Ungrouped' })

	const knownSectionIds = new Set(sectionInfos.map((info) => info.id))

	for (const customPreset of customPresets) {
		presets.set(customPreset.id, {
			id: customPreset.id,
			name: customPreset.name,
			type: 'button',
			model: customPreset.model,
			presetExtraFeedbacks: [],
			keywords: undefined,
		})

		const sectionId =
			customPreset.collectionId && knownSectionIds.has(customPreset.collectionId)
				? customPreset.collectionId
				: UNGROUPED_CUSTOM_PRESETS_SECTION_ID

		let sectionPresets = presetsBySection.get(sectionId)
		if (!sectionPresets) {
			sectionPresets = []
			presetsBySection.set(sectionId, sectionPresets)
		}
		sectionPresets.push(customPreset)
	}

	const sections: Record<string, UIPresetSection> = {}
	sectionInfos.forEach((info, sectionIndex) => {
		const sectionPresets = presetsBySection.get(info.id)
		if (!sectionPresets) return

		const uiPresets: Record<string, UIPresetDefinition> = {}
		sectionPresets
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.forEach((customPreset, presetIndex) => {
				uiPresets[customPreset.id] = {
					id: customPreset.id,
					order: presetIndex,
					label: customPreset.name,
					keywords: customPreset.description ? [customPreset.description] : undefined,
				}
			})

		sections[info.id] = {
			id: info.id,
			name: info.name,
			order: sectionIndex,
			definitions: {
				[CUSTOM_PRESETS_GROUP_ID]: {
					type: 'simple',
					id: CUSTOM_PRESETS_GROUP_ID,
					name: '',
					order: 0,
					presets: uiPresets,
				},
			},
		}
	})

	return { presets, sections }
}
