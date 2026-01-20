import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import type { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { PresetDefinition, PresetDefinitionButton } from '@companion-app/shared/Model/Presets.js'
import type {
	CompanionButtonPresetDefinition,
	CompanionPresetAction,
	CompanionTextPresetDefinition,
	Complete,
	ModuleLogger,
} from '@companion-module/base'
import { convertActionsDelay, convertPresetFeedbacksToEntities, ConvertPresetStyleToDrawStyle } from './PresetUtils.js'

const DefaultStepOptions: Complete<ActionStepOptions> = {
	runWhileHeld: [],
	name: undefined,
}

export function ConvertPresetDefinition(
	logger: ModuleLogger,
	connectionId: string,
	connectionUpgradeIndex: number | undefined,
	presetId: string,

	rawPreset: CompanionButtonPresetDefinition | CompanionTextPresetDefinition
): PresetDefinition | null {
	try {
		if (rawPreset.type === 'button') {
			const presetDefinition: PresetDefinitionButton = {
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
								true, // Always relative now
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
		} else if (rawPreset.type === 'text') {
			return {
				id: presetId,
				category: rawPreset.category,
				name: rawPreset.name,
				type: rawPreset.type,
				text: rawPreset.text,
			}
		} else {
			return null
		}
	} catch (e) {
		logger.warn(`Received invalid preset "${rawPreset.name}"(${presetId}): ${e}`)
		return null
	}
}
