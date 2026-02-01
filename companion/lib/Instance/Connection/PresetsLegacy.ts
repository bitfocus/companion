import type { Logger } from '../../Log/Controller.js'
import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import type { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type {
	PresetDefinition,
	UIPresetDefinition,
	UIPresetGroupCustom,
	UIPresetSection,
} from '@companion-app/shared/Model/Presets.js'
import type {
	CompanionButtonPresetDefinition,
	CompanionPresetAction,
	CompanionPresetDefinition,
} from '@companion-module/base-old'
import {
	convertActionsDelay,
	convertPresetFeedbacksToEntities,
	ConvertPresetStyleToDrawStyle,
} from './Thread/PresetUtils.js'
import type { Complete } from '@companion-module/host'

const DefaultStepOptions: Complete<ActionStepOptions> = {
	runWhileHeld: [],
	name: undefined,
}

export function ConvertPresetDefinitions(
	logger: Logger,
	connectionId: string,
	connectionUpgradeIndex: number | undefined,
	rawPresets: (CompanionPresetDefinition & { id: string })[]
): {
	presets: ReadonlyMap<string, PresetDefinition>
	uiPresets: Record<string, UIPresetSection>
} {
	if (!rawPresets || rawPresets.length === 0) {
		return {
			presets: new Map(),
			uiPresets: {},
		}
	}

	// First, lets convert all the presets to the representation we need internally
	const presets = new Map<string, PresetDefinition>()
	rawPresets.forEach((preset, i) => {
		if (preset.type !== 'button') return

		if (!preset.id) preset.id = `_tmp_id_${i}`

		const convertedPreset = ConvertPresetDefinition(logger, connectionId, connectionUpgradeIndex, preset.id, preset)
		if (convertedPreset) presets.set(convertedPreset.id, convertedPreset)
	})

	// Now, convert the ui representation
	const uiPresets: Record<string, UIPresetSection> = {}

	const sortedCategories = new Set<string>(rawPresets.map((p) => p.category)).values().toArray().sort()
	sortedCategories.forEach((category, i) => {
		// This is not very efficient, but probably good enough?
		const presetsInCategory = rawPresets.filter((p) => p.category === category)

		const groupedPresets = splitPresetsIntoGroups2(presetsInCategory)
		if (groupedPresets.length === 0) return

		uiPresets[category] = {
			id: category,
			name: category,
			order: i,
			description: undefined, // Not supported
			definitions: Object.fromEntries(groupedPresets.map((g) => [g.id, g])),
			tags: undefined,
		} satisfies Complete<UIPresetSection>
	})

	return {
		presets,
		uiPresets,
	}
}

function splitPresetsIntoGroups2(presets: (CompanionPresetDefinition & { id: string })[]): UIPresetGroupCustom[] {
	const groups: UIPresetGroupCustom[] = []

	let currentGroup: UIPresetGroupCustom | null = null
	let currentIndex = 0

	for (const preset of presets) {
		if (preset.type === 'text') {
			// Start a new group with this text preset as the heading
			currentGroup = {
				id: 'unknown',
				name: preset.name,
				order: groups.length,
				description: preset.text,
				presets: {},
				tags: undefined,
			} satisfies Complete<UIPresetGroupCustom>
			currentIndex = 0
			groups.push(currentGroup)
		} else if (preset.type === 'button') {
			// Add to current group, or create a new group without heading if needed
			if (!currentGroup) {
				currentGroup = {
					id: 'unknown',
					name: '',
					order: 0,
					description: undefined,
					presets: {},
					tags: undefined,
				} satisfies Complete<UIPresetGroupCustom>
				groups.push(currentGroup)
			}

			// Fill in a group id if this is the first preset in the group
			if (currentIndex === 0) currentGroup.id = `group___${preset.id}`

			currentGroup.presets[preset.id] = {
				id: preset.id,
				order: currentIndex++,
				label: preset.name,
			} satisfies Complete<UIPresetDefinition>
		}
	}

	return groups
}

function ConvertPresetDefinition(
	logger: Logger,
	connectionId: string,
	connectionUpgradeIndex: number | undefined,
	presetId: string,
	rawPreset: CompanionButtonPresetDefinition
): PresetDefinition | null {
	try {
		if (rawPreset.type !== 'button') return null

		const presetDefinition: PresetDefinition = {
			id: presetId,
			category: rawPreset.category,
			name: rawPreset.name,
			type: rawPreset.type,
			previewStyle: rawPreset.previewStyle,
			model: {
				type: 'button',
				options: {
					rotaryActions: rawPreset.options?.rotaryActions ?? false,
					stepProgression: (rawPreset.options?.stepAutoProgress ?? true) ? 'auto' : 'manual',
				},
				style: ConvertPresetStyleToDrawStyle(rawPreset.style),
				feedbacks: convertPresetFeedbacksToEntities(rawPreset.feedbacks, connectionId, connectionUpgradeIndex),
				steps: {},
				localVariables: [],
			},
		}

		if (rawPreset.steps) {
			for (let i = 0; i < rawPreset.steps.length; i++) {
				const newStep: NormalButtonSteps[0] = {
					action_sets: {
						down: [],
						up: [],
						rotate_left: undefined,
						rotate_right: undefined,
					},
					options: structuredClone(DefaultStepOptions),
				}
				presetDefinition.model.steps[i] = newStep

				const rawStep = rawPreset.steps[i]
				if (!rawStep) continue

				if (rawStep.name) newStep.options.name = rawStep.name

				for (const [setId, set] of Object.entries(rawStep)) {
					if (setId === 'name') continue

					const setIdSafe = validateActionSetId(setId as any)
					if (setIdSafe === undefined) {
						logger.warn(`Invalid set id: ${setId}`)
						continue
					}

					const setActions: CompanionPresetAction[] = Array.isArray(set) ? set : set.actions
					if (!isNaN(Number(setId)) && set.options?.runWhileHeld) newStep.options.runWhileHeld.push(Number(setId))

					if (setActions) {
						newStep.action_sets[setIdSafe] = convertActionsDelay(
							setActions,
							connectionId,
							rawPreset.options?.relativeDelay,
							connectionUpgradeIndex
						)
					}
				}
			}
		}

		// Ensure that there is at least one step
		if (Object.keys(presetDefinition.model.steps).length === 0) {
			presetDefinition.model.steps[0] = {
				action_sets: { down: [], up: [], rotate_left: undefined, rotate_right: undefined },
				options: structuredClone(DefaultStepOptions),
			}
		}

		return presetDefinition
	} catch (e) {
		logger.warn(`Received invalid preset "${rawPreset.name}"(${presetId}): ${e}`)
		return null
	}
}
