import {
	EntityModelType,
	type ActionEntityModel,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal, optionsObjectToExpressionOptions } from '@companion-app/shared/Model/Options.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionButtonStyleProps, CompanionPresetAction, CompanionPresetFeedback } from '@companion-module/base'
import { nanoid } from 'nanoid'

export function convertActionsDelay(
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
			execution_mode: exprVal('concurrent'),
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
			time: exprExpr(delay + ''),
		},
		upgradeIndex: undefined,
	}
}

export function convertPresetFeedbacksToEntities(
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
		options: structuredClone(optionsObjectToExpressionOptions(feedback.options ?? {}, false)),
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
		options: structuredClone(optionsObjectToExpressionOptions(action.options ?? {}, false)),
		headline: action.headline,
		upgradeIndex: connectionUpgradeIndex,
	}
}
