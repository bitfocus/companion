import { nanoid } from 'nanoid'
import {
	EntityModelType,
	type ActionEntityModel,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { exprVal, optionsObjectToExpressionOptions } from '@companion-app/shared/Model/Options.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type {
	CompanionButtonStyleProps,
	SomePresetActionEntry,
	SomePresetSimpleFeedbackEntry,
} from '@companion-module/host'
import {
	convertModulePresetAction,
	convertPresetActionEntries,
	createWaitAction,
	isInternalPresetEntryId,
	tryConvertInternalSimpleFeedbackEntry,
	type PresetEntryConversionContext,
} from './PresetInternalEntities.js'

export function convertActionsDelay(
	actions: SomePresetActionEntry[],
	relativeDelays: boolean | undefined,
	ctx: PresetEntryConversionContext
): ActionEntityModel[] {
	if (relativeDelays) {
		return convertPresetActionEntries(actions, ctx)
	} else {
		// Note: only reachable for legacy modules, which are too old to use `internal:*` entries

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

			currentDelayGroupChildren.push(convertModulePresetAction(action, ctx.connectionId, ctx.connectionUpgradeIndex))
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

export function convertPresetFeedbacksToEntities(
	rawFeedbacks: SomePresetSimpleFeedbackEntry[] | undefined,
	ctx: PresetEntryConversionContext
): FeedbackEntityModel[] {
	if (!rawFeedbacks) return []

	const feedbacks: FeedbackEntityModel[] = []

	for (const feedback of rawFeedbacks) {
		if (ctx.allowInternalEntities && isInternalPresetEntryId(feedback.feedbackId)) {
			const entity = tryConvertInternalSimpleFeedbackEntry(feedback, ctx)
			if (entity) feedbacks.push(entity)
		} else {
			// `style` is carried outside the FeedbackEntityModel type, to be converted to style
			// overrides by ConvertLegacyStyleToElements
			feedbacks.push({
				type: EntityModelType.Feedback,
				id: nanoid(),
				connectionId: ctx.connectionId,
				definitionId: feedback.feedbackId,
				options: structuredClone(optionsObjectToExpressionOptions(feedback.options ?? {}, true)),
				isInverted: exprVal(!!feedback.isInverted),
				style: structuredClone(feedback.style),
				headline: feedback.headline,
				upgradeIndex: ctx.connectionUpgradeIndex,
			} as FeedbackEntityModel)
		}
	}

	return feedbacks
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
