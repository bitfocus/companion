import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { getCustomElementUseDefinition, type CustomElementUse } from '@companion-app/shared/Model/CustomElementModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { ControlStore } from '../ControlStore.js'

/**
 * The elements which use a custom element, in every control which has elements, including the other custom elements
 * @param controlStore The store of all the controls
 * @param customElementControlId The control id of the custom element
 */
export function getCustomElementUses(
	controlStore: ControlStore,
	customElementControlId: SomeControlId
): CustomElementUse[] {
	const definition = getCustomElementUseDefinition(customElementControlId)
	if (!definition) return []

	const uses: CustomElementUse[] = []
	for (const control of controlStore.controls.values()) {
		if (!control.supportsLayeredStyle) continue

		const visit = (elements: readonly SomeButtonGraphicsElement[], parentDisabled: boolean): void => {
			for (const element of elements) {
				if (element.type === 'canvas') continue

				// An element whose enabled is an expression may be drawn
				const disabled = parentDisabled || (!element.enabled.isExpression && !element.enabled.value)
				if (element.type === 'group') {
					visit(element.children, disabled)
				} else if (
					element.type === 'composite' &&
					element.connectionId === definition.connectionId &&
					element.elementId === definition.elementId
				) {
					uses.push({ controlId: control.controlId, elementId: element.id, disabled })
				}
			}
		}
		visit(control.layeredStyleGetElements(), false)
	}

	return uses
}

/**
 * Update the elements which use a custom element after one of its inputs has been renamed or removed, so that each
 * keeps its value for it, or a new input with the same id doesn't pick it up
 * @param controlStore The store of all the controls
 * @param customElementControlId The control id of the custom element
 * @param fromId The old id of the input
 * @param toId The new id of the input, or null if it was removed
 */
export function renameCustomElementInputInUses(
	controlStore: ControlStore,
	customElementControlId: SomeControlId,
	fromId: string,
	toId: string | null
): void {
	const definition = getCustomElementUseDefinition(customElementControlId)
	if (!definition) return

	for (const control of controlStore.controls.values()) {
		if (!control.supportsLayeredStyle) continue

		control.layeredStyleRenameCompositeOption(
			definition.connectionId,
			definition.elementId,
			`opt:${fromId}`,
			toId === null ? null : `opt:${toId}`
		)
	}
}
