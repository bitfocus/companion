import { nanoid } from 'nanoid'
import { ControlEntityListPoolButton } from '../../Controls/Entities/EntityListPoolButton.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { CompanionButtonStepActions, CompanionPresetAction } from '@companion-module/base'
import { type Logger } from '../../Log/Controller.js'
import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import { EntityModelType, type ActionEntityModel } from '@companion-app/shared/Model/EntityModel.js'

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
				options: structuredClone(ControlEntityListPoolButton.DefaultStepOptions),
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
			options: structuredClone(ControlEntityListPoolButton.DefaultStepOptions),
		}
	}

	return steps
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
