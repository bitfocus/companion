import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import type { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import {
	EntityModelType,
	type ActionEntityModel,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { PresetDefinition, PresetDefinitionButton } from '@companion-app/shared/Model/Presets.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type {
	CompanionButtonStepActions,
	CompanionButtonStyleProps,
	CompanionLayeredButtonPresetDefinition,
	CompanionPresetAction,
	CompanionPresetDefinition,
	CompanionPresetFeedback,
} from '@companion-module/base'
import type { Logger } from '../../Log/Controller.js'
import { nanoid } from 'nanoid'
import { assertNever, type Complete } from '@companion-module/base/dist/util.js'
import { ConvertLegacyStyleToElements } from '../../Resources/ConvertLegacyStyleToElements.js'
import { ConvertLayeredPresetFeedbacksToEntities, ConvertLayerPresetElements } from './PresetsLayered.js'

const DefaultStepOptions: Complete<ActionStepOptions> = {
	runWhileHeld: [],
	name: undefined,
}

export function ConvertPresetDefinition(
	logger: Logger,
	connectionId: string,
	connectionUpgradeIndex: number | undefined,
	presetId: string,
	rawPreset: CompanionPresetDefinition | CompanionLayeredButtonPresetDefinition
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

						steps: ConvertStepsForPreset(
							logger,
							connectionId,
							connectionUpgradeIndex,
							rawPreset.steps,
							rawPreset.options?.relativeDelay
						),
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
							layers: ConvertLayerPresetElements(logger, rawPreset.canvas, rawPreset.elements),
						},
						feedbacks: ConvertLayeredPresetFeedbacksToEntities(
							rawPreset.feedbacks,
							connectionId,
							connectionUpgradeIndex
						),

						steps: ConvertStepsForPreset(
							logger,
							connectionId,
							connectionUpgradeIndex,
							rawPreset.steps,
							rawPreset.options?.relativeDelay
						),
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

export function ConvertStepsForPreset(
	logger: Logger,
	connectionId: string,
	connectionUpgradeIndex: number | undefined,
	rawSteps: CompanionButtonStepActions[] | undefined,
	relativeDelay: boolean | undefined
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
						relativeDelay,
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

function convertActionsDelay(
	actions: CompanionPresetAction[],
	connectionId: string,
	relativeDelays: boolean | undefined,
	connectionUpgradeIndex: number | undefined
): ActionEntityModel[] {
	if (relativeDelays) {
		const newActions: ActionEntityModel[] = []

		for (const action of actions) {
			const delay = Number(action.delay)

			// Add the wait action
			if (!isNaN(delay) && delay > 0) {
				newActions.push(createWaitAction(delay))
			}

			newActions.push(toActionInstance(action, connectionId, connectionUpgradeIndex))
		}

		return newActions
	} else {
		let currentDelay = 0
		let currentDelayGroupChildren: ActionEntityModel[] = []

		const delayGroups: ActionEntityModel[] = [wrapActionsInGroup(currentDelayGroupChildren)]

		for (const action of actions) {
			const delay = Number(action.delay)

			if (!isNaN(delay) && delay >= 0 && delay !== currentDelay) {
				// action has different delay to the last one
				if (delay > currentDelay) {
					// delay is greater than the last one, translate it to a relative delay
					currentDelayGroupChildren.push(createWaitAction(delay - currentDelay))
				} else {
					// delay is less than the last one, preserve the weird order
					currentDelayGroupChildren = []
					if (delay > 0) currentDelayGroupChildren.push(createWaitAction(delay))
					delayGroups.push(wrapActionsInGroup(currentDelayGroupChildren))
				}

				currentDelay = delay
			}

			currentDelayGroupChildren.push(toActionInstance(action, connectionId, connectionUpgradeIndex))
		}

		if (delayGroups.length > 1) {
			// Weird delay ordering was found, preserve it
			return delayGroups
		} else {
			// Order was incrementing, don't add the extra group layer
			return currentDelayGroupChildren
		}
	}
}

function wrapActionsInGroup(actions: ActionEntityModel[]): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: 'internal',
		definitionId: 'action_group',
		options: {
			execution_mode: 'concurrent',
		},
		children: {
			default: actions,
		},
		upgradeIndex: undefined,
	}
}
function createWaitAction(delay: number): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: 'internal',
		definitionId: 'wait',
		options: {
			time: delay,
		},
		upgradeIndex: undefined,
	}
}

function convertPresetFeedbacksToEntities(
	rawFeedbacks: CompanionPresetFeedback[] | undefined,
	connectionId: string,
	connectionUpgradeIndex: number | undefined
): FeedbackEntityModel[] {
	if (!rawFeedbacks) return []

	return rawFeedbacks.map((feedback) => ({
		type: EntityModelType.Feedback,
		id: nanoid(),
		connectionId: connectionId,
		definitionId: feedback.feedbackId,
		options: structuredClone(feedback.options ?? {}),
		isInverted: !!feedback.isInverted,
		style: structuredClone(feedback.style),
		headline: feedback.headline,
		upgradeIndex: connectionUpgradeIndex,
	}))
}

export function ConvertPresetStyleToDrawStyle(rawStyle: CompanionButtonStyleProps): ButtonStyleProperties {
	return {
		textExpression: false,
		...structuredClone(rawStyle),
		// TODO - avoid defaults..
		alignment: rawStyle.alignment ?? 'center:center',
		pngalignment: rawStyle.pngalignment ?? 'center:center',
		png64: rawStyle.png64 ?? null,
		show_topbar: rawStyle.show_topbar ?? 'default',
	}
}

function toActionInstance(
	action: CompanionPresetAction,
	connectionId: string,
	connectionUpgradeIndex: number | undefined
): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: connectionId,
		definitionId: action.actionId,
		options: structuredClone(action.options ?? {}),
		headline: action.headline,
		upgradeIndex: connectionUpgradeIndex,
	}
}
