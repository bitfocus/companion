import {
	getControlIdKind,
	isControlIdOfKind,
	ParseControlId,
	type SomeControlId,
} from '@companion-app/shared/ControlId.js'
import { assertNever } from '~/Resources/util.js'
import type { CustomActionsListStore } from '~/Stores/CustomActionsListStore.js'
import type { CustomFeedbacksListStore } from '~/Stores/CustomFeedbacksListStore.js'
import type { PagesStore } from '~/Stores/PagesStore.js'
import type { TriggersListStore } from '~/Stores/TriggersListStore.js'

export interface UseControlStores {
	readonly pages: PagesStore
	readonly triggersList: TriggersListStore
	readonly customActionsList: CustomActionsListStore
	readonly customFeedbacksList: CustomFeedbacksListStore
}

/** Where to go to find a control which uses a custom action or feedback */
export type UseControlLink =
	| { readonly type: 'buttons-page'; readonly pageNumber: number }
	| { readonly type: 'trigger'; readonly triggerId: string }
	| { readonly type: 'custom-action'; readonly customActionId: string }
	| { readonly type: 'custom-feedback'; readonly customFeedbackId: string }

/** What a control which uses a custom action or feedback is, for showing in a list of its uses */
export interface UseControlDescription {
	readonly kind: string
	readonly name: string
	/** Where it can be found, or null if it can't be shown */
	readonly link: UseControlLink | null
}

/**
 * Describe a control which uses a custom action or feedback, such as a button by its location or a trigger by its name
 */
export function describeUseControl(controlId: SomeControlId, stores: UseControlStores): UseControlDescription {
	const kind = getControlIdKind(controlId)
	switch (kind) {
		case 'bank': {
			const location = isControlIdOfKind(controlId, 'bank') ? stores.pages.getLocationOfControlId(controlId) : undefined
			return {
				kind: 'Button',
				name: location ? `${location.pageNumber}/${location.row}/${location.column}` : 'Not on a page',
				// A button can only be found by its page
				link: location ? { type: 'buttons-page', pageNumber: location.pageNumber } : null,
			}
		}
		case 'trigger': {
			const trigger = isControlIdOfKind(controlId, 'trigger') ? stores.triggersList.triggers.get(controlId) : undefined
			const parsedId = ParseControlId(controlId)
			return {
				kind: 'Trigger',
				name: trigger?.name || 'Unnamed trigger',
				link: parsedId?.type === 'trigger' ? { type: 'trigger', triggerId: parsedId.trigger } : null,
			}
		}
		case 'custom-action': {
			const customAction = isControlIdOfKind(controlId, 'custom-action')
				? stores.customActionsList.customActions.get(controlId)
				: undefined
			const parsedId = ParseControlId(controlId)
			return {
				kind: 'Custom action',
				name: customAction?.name || 'Unnamed custom action',
				link:
					parsedId?.type === 'custom-action'
						? { type: 'custom-action', customActionId: parsedId.customActionId }
						: null,
			}
		}
		case 'custom-feedback': {
			const customFeedback = isControlIdOfKind(controlId, 'custom-feedback')
				? stores.customFeedbacksList.customFeedbacks.get(controlId)
				: undefined
			const parsedId = ParseControlId(controlId)
			return {
				kind: 'Custom feedback',
				name: customFeedback?.name || 'Unnamed custom feedback',
				link:
					parsedId?.type === 'custom-feedback'
						? { type: 'custom-feedback', customFeedbackId: parsedId.customFeedbackId }
						: null,
			}
		}
		case 'expression-variable':
		case 'page':
		case 'preset':
		case undefined:
			return { kind: 'Control', name: controlId, link: null }
		default:
			assertNever(kind)
			return { kind: 'Control', name: controlId, link: null }
	}
}

/**
 * How long something has been running for, such as `45s`, `3m 05s` or `1h 02m`
 */
export function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
	if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
	return `${seconds}s`
}
