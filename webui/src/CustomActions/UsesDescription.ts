import { getControlIdKind, isControlIdOfKind, type SomeControlId } from '@companion-app/shared/ControlId.js'
import { assertNever } from '~/Resources/util.js'
import type { CustomActionsListStore } from '~/Stores/CustomActionsListStore.js'
import type { PagesStore } from '~/Stores/PagesStore.js'
import type { TriggersListStore } from '~/Stores/TriggersListStore.js'

export interface UseControlStores {
	readonly pages: PagesStore
	readonly triggersList: TriggersListStore
	readonly customActionsList: CustomActionsListStore
}

/** What a control which calls a custom action is, for showing in a list of its uses */
export interface UseControlDescription {
	readonly kind: string
	readonly name: string
}

/**
 * Describe a control which calls a custom action, such as a button by its location or a trigger by its name
 */
export function describeUseControl(controlId: SomeControlId, stores: UseControlStores): UseControlDescription {
	const kind = getControlIdKind(controlId)
	switch (kind) {
		case 'bank': {
			const location = isControlIdOfKind(controlId, 'bank') ? stores.pages.getLocationOfControlId(controlId) : undefined
			return {
				kind: 'Button',
				name: location ? `${location.pageNumber}/${location.row}/${location.column}` : 'Not on a page',
			}
		}
		case 'trigger': {
			const trigger = isControlIdOfKind(controlId, 'trigger') ? stores.triggersList.triggers.get(controlId) : undefined
			return { kind: 'Trigger', name: trigger?.name || 'Unnamed trigger' }
		}
		case 'custom-action': {
			const customAction = isControlIdOfKind(controlId, 'custom-action')
				? stores.customActionsList.customActions.get(controlId)
				: undefined
			return { kind: 'Custom action', name: customAction?.name || 'Unnamed custom action' }
		}
		case 'expression-variable':
		case 'page':
		case 'preset':
		case undefined:
			return { kind: 'Control', name: controlId }
		default:
			assertNever(kind)
			return { kind: 'Control', name: controlId }
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
