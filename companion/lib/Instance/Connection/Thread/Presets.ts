import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import type { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { PresetDefinition, PresetDefinitionButton } from '@companion-app/shared/Model/Presets.js'
import {
	assertNever,
	type CompanionButtonStepActions,
	type CompanionLayeredButtonPresetDefinition,
	type CompanionPresetAction,
	type CompanionPresetDefinition,
	type Complete,
	type ModuleLogger,
} from '@companion-module/host'
import { convertActionsDelay, convertPresetFeedbacksToEntities, ConvertPresetStyleToDrawStyle } from './PresetUtils.js'
import { ConvertLayeredPresetFeedbacksToEntities, ConvertLayerPresetElements } from './PresetsLayered.js'
import { ConvertLegacyStyleToElements } from '../../../Resources/ConvertLegacyStyleToElements.js'

const DefaultStepOptions: Complete<ActionStepOptions> = {
	runWhileHeld: [],
	name: undefined,
}

export function ConvertPresetDefinition(
	logger: ModuleLogger,
	connectionId: string,
	connectionUpgradeIndex: number | undefined,
	presetId: string,

	rawPreset: CompanionLayeredButtonPresetDefinition | CompanionPresetDefinition
): PresetDefinition | null {
	try {
		const presetType = rawPreset.type
		const presetName = rawPreset.name

		switch (rawPreset.type) {
			case 'button': {
				const presetDefinition: PresetDefinitionButton = {
					id: presetId,
					category: rawPreset.category,
					name: rawPreset.name,
					type: rawPreset.type,
					model: {
						type: 'button-layered',
						options: {
							rotaryActions: rawPreset.options?.rotaryActions ?? false,
							stepProgression: (rawPreset.options?.stepAutoProgress ?? true) ? 'auto' : 'manual',
							canModifyStyleInApis: false,
						},
						...ConvertLegacyStyleToElements(
							ConvertPresetStyleToDrawStyle(rawPreset.style),
							convertPresetFeedbacksToEntities(rawPreset.feedbacks, connectionId, connectionUpgradeIndex)
						),

						steps: ConvertStepsForPreset(logger, connectionId, connectionUpgradeIndex, rawPreset.steps),
						localVariables: [],
					},
					presetExtraFeedbacks: [],
				}

				return presetDefinition
			}
			case 'layered-button': {
				const presetDefinition: PresetDefinitionButton = {
					id: presetId,
					category: rawPreset.category,
					name: rawPreset.name,
					type: 'button',
					model: {
						type: 'button-layered',
						options: {
							rotaryActions: rawPreset.options?.rotaryActions ?? false,
							stepProgression: (rawPreset.options?.stepAutoProgress ?? true) ? 'auto' : 'manual',
							canModifyStyleInApis: false,
						},

						style: {
							layers: ConvertLayerPresetElements(logger, connectionId, rawPreset.canvas, rawPreset.elements),
						},
						feedbacks: ConvertLayeredPresetFeedbacksToEntities(
							rawPreset.feedbacks,
							connectionId,
							connectionUpgradeIndex
						),

						steps: ConvertStepsForPreset(logger, connectionId, connectionUpgradeIndex, rawPreset.steps),
						localVariables: [],
					},
					presetExtraFeedbacks: [], // No preview style for layered-button presets
				}

				return presetDefinition
			}
			case 'text':
				return {
					id: presetId,
					category: rawPreset.category,
					name: rawPreset.name,
					type: rawPreset.type,
					text: rawPreset.text,
				}
			default:
				assertNever(rawPreset)
				logger.warn(`Received invalid preset "${presetName}"(${presetId}) with unsupported type "${presetType}"`)
				return null
		}
	} catch (e) {
		logger.warn(`Received invalid preset "${rawPreset.name}"(${presetId}): ${e}`)
		return null
	}
}

function ConvertStepsForPreset(
	logger: ModuleLogger,
	connectionId: string,
	connectionUpgradeIndex: number | undefined,
	rawSteps: CompanionButtonStepActions[] | undefined
): NormalButtonSteps {
	const steps: NormalButtonSteps = {}

	if (rawSteps) {
		for (let i = 0; i < rawSteps.length; i++) {
			const newStep: NormalButtonSteps[0] = {
				action_sets: {
					down: [],
					up: [],
					rotate_left: undefined,
					rotate_right: undefined,
				},
				options: structuredClone(DefaultStepOptions),
			}
			steps[i] = newStep

			const rawStep = rawSteps[i]
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
	if (Object.keys(steps).length === 0) {
		steps[0] = {
			action_sets: { down: [], up: [], rotate_left: undefined, rotate_right: undefined },
			options: structuredClone(DefaultStepOptions),
		}
	}

	return steps
}
