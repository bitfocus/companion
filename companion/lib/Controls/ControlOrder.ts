import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { KeyValueChange } from '@companion-app/shared/Util/KeyValue.js'

/** A control which is ordered within collections, such as a trigger */
export interface OrderedControl {
	readonly controlId: SomeControlId
	readonly options: { readonly sortOrder: number; readonly collectionId?: string }
	optionsSetField(change: KeyValueChange<{ sortOrder: number; collectionId?: string }>, forceSet: boolean): boolean
}

/**
 * Move a control into a collection, at a position among the others in it, renumbering their sort order
 * @param controls Every control of its kind
 * @param moving The control to move
 * @param collectionId The collection to move it into, or null for none
 * @param dropIndex Where to put it among the others in the collection, or less than 0 for the end
 */
export function moveControlInCollection(
	controls: OrderedControl[],
	moving: OrderedControl,
	collectionId: string | null,
	dropIndex: number
): void {
	if (moving.options.collectionId !== (collectionId ?? undefined)) {
		moving.optionsSetField({ key: 'collectionId', value: collectionId ?? undefined }, true)
	}

	const sorted = controls
		.filter(
			(control) =>
				control.controlId !== moving.controlId &&
				((!control.options.collectionId && !collectionId) || control.options.collectionId === collectionId)
		)
		.sort((a, b) => (a.options.sortOrder || 0) - (b.options.sortOrder || 0))

	if (dropIndex < 0) {
		sorted.push(moving)
	} else {
		sorted.splice(dropIndex, 0, moving)
	}

	// Only those whose position changed are saved
	sorted.forEach((control, index) => {
		if (control.options.sortOrder === index) return
		control.optionsSetField({ key: 'sortOrder', value: index }, true)
	})
}
