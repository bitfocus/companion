import { action, computed, makeObservable, observable, toJS } from 'mobx'
import { z } from 'zod'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'

// Remembers the last element the user selected, so the same one can be restored when opening
// another button. Matched by element type + its ordinal among same-typed elements (e.g. "the 2nd
// image"), counted top-first in the visual list - never by id or absolute position.
const LAST_SELECTED_ELEMENT_STORAGE_KEY = 'layeredEditor.lastSelectedElement'

/**
 * The layer list's pinned-properties entry. It is not an element, so it gets an id which no element can
 * have; unlike element ids that identity is the same on every button, which is what lets the
 * last-selected memory land on the pinned view for every button the user clicks through.
 */
export const PINNED_PROPERTIES_ENTRY_ID = '__pinned__'

// `type` is left as a plain string: an unknown/stale type simply matches no elements and falls back
// to the topmost element, so there's no need to keep an element-type enum in sync here.
const LastSelectedElementRefSchema = z.object({
	type: z.string(),
	ordinal: z.number().int().min(0),
})
type LastSelectedElementRef = z.infer<typeof LastSelectedElementRefSchema>

function readLastSelectedElementRef(): LastSelectedElementRef | null {
	try {
		const parsed = LastSelectedElementRefSchema.safeParse(
			JSON.parse(localStorage.getItem(LAST_SELECTED_ELEMENT_STORAGE_KEY) ?? '')
		)
		return parsed.success ? parsed.data : null
	} catch {
		return null
	}
}

function writeLastSelectedElementRef(ref: LastSelectedElementRef): void {
	safeSetLocalStorage(LAST_SELECTED_ELEMENT_STORAGE_KEY, JSON.stringify(ref))
}

export interface VisualElementEntry {
	element: SomeButtonGraphicsElement
	/** True when a group this element sits inside is disabled, so it isn't drawn whatever its own state says */
	ancestorDisabled: boolean
}

/** Whether an element is explicitly switched off. An expression can't be resolved here, so it counts as on. */
export function isElementDisabled(element: SomeButtonGraphicsElement): boolean {
	if (element.type === 'canvas') return false
	return !element.enabled.isExpression && element.enabled.value === false
}

export class LayeredStyleStore {
	readonly elements = observable.array<SomeButtonGraphicsElement>([])
	readonly #feedbackOverrideIds = observable.set<string>()

	// Holds an element id or PINNED_PROPERTIES_ENTRY_ID - whichever row of the layer list is selected
	readonly #selectedEntryId = observable.box<string | null>(null)

	readonly #hiddenElements = observable.set<string>()

	/** The selected row of the layer list, which may be the pinned-properties entry */
	get selectedEntryId(): string | null {
		return this.#selectedEntryId.get()
	}

	/** The selected element, or null when the selection isn't an element (the pinned view, or nothing) */
	get selectedElementId(): string | null {
		const entryId = this.#selectedEntryId.get()
		return entryId === PINNED_PROPERTIES_ENTRY_ID ? null : entryId
	}

	get isPinnedViewSelected(): boolean {
		return this.#selectedEntryId.get() === PINNED_PROPERTIES_ENTRY_ID
	}

	get hiddenElements(): Set<string> {
		return toJS(this.#hiddenElements)
	}

	/**
	 * Ids of every element the user can select, including those nested in groups. Used to tell real elements
	 * apart from the internal children a composite contributes to the rendered output, which carry generated
	 * ids that aren't part of this model.
	 */
	get selectableElementIds(): Set<string> {
		const ids = new Set<string>()

		const collect = (elements: readonly SomeButtonGraphicsElement[]) => {
			for (const element of elements) {
				ids.add(element.id)
				if (element.type === 'group') collect(element.children)
			}
		}
		collect(this.elements)

		return ids
	}

	constructor() {
		makeObservable(this, {
			setSelectedEntryId: action,
			setElementVisibility: action,
			hiddenElements: computed, // This caches the JS set, allowing for efficient change detection
			selectableElementIds: computed,
			visualElements: computed,
		})
	}

	static #findElementById(
		elementsToSearch: SomeButtonGraphicsElement[],
		id: string
	): SomeButtonGraphicsElement | undefined {
		for (const element of elementsToSearch) {
			if (element.id === id) return element
			if (element.type === 'group') {
				const found = this.#findElementById(element.children, id)
				if (found) return found
			}
		}
		return undefined
	}

	public findElementById(id: string): SomeButtonGraphicsElement | undefined {
		return LayeredStyleStore.#findElementById(this.elements, id)
	}

	// Flatten the element tree into visual (top-first) order, excluding the pinned canvas, so ordinals
	// count the same way the user reads the list (mirrors the reversed render in ElementsList).
	static #flattenVisual(
		elements: readonly SomeButtonGraphicsElement[],
		ancestorDisabled = false
	): VisualElementEntry[] {
		const out: VisualElementEntry[] = []
		for (const element of [...elements].reverse()) {
			if (element.type === 'canvas') continue
			out.push({ element, ancestorDisabled })
			if (element.type === 'group')
				out.push(...LayeredStyleStore.#flattenVisual(element.children, ancestorDisabled || isElementDisabled(element)))
		}
		return out
	}

	/**
	 * The elements in the order the layer list shows them (top-first, each group above its own children),
	 * excluding the canvas.
	 */
	get visualElements(): VisualElementEntry[] {
		return LayeredStyleStore.#flattenVisual(this.elements)
	}

	public updateData = action((elements: SomeButtonGraphicsElement[]): void => {
		this.elements.replace(elements)
		this.#reconcileSelection()
	})

	// Keep a valid current selection; otherwise seed one so the properties editor is ready to edit
	// (e.g. text) without an extra click. Runs on every button open (the store is recreated per button).
	#reconcileSelection(): void {
		const currentId = this.selectedEntryId
		if (currentId === PINNED_PROPERTIES_ENTRY_ID) return // Present on every button
		if (currentId && this.findElementById(currentId)) return

		// Set the box directly rather than via setSelectedEntryId, so seeding doesn't re-persist the
		// derived choice over the user's remembered reference.
		this.#selectedEntryId.set(this.#pickDefaultEntryId())
	}

	#pickDefaultEntryId(): string | null {
		const visual = LayeredStyleStore.#flattenVisual(this.elements)

		const ref = readLastSelectedElementRef()
		if (ref) {
			if (ref.type === PINNED_PROPERTIES_ENTRY_ID) {
				return PINNED_PROPERTIES_ENTRY_ID
			} else if (ref.type === 'canvas') {
				const canvas = this.elements.find((element) => element.type === 'canvas')
				if (canvas) return canvas.id
			} else {
				const sameType = visual.filter((entry) => entry.element.type === ref.type)
				if (sameType.length > 0) {
					// Restore the Nth of that type, clamping down when this button has fewer.
					const chosen = sameType[Math.min(Math.max(ref.ordinal, 0), sameType.length - 1)]
					return chosen.element.id
				}
			}
		}

		// Fall back to the pinned view: it exists on every button, and holds the properties a user is most
		// likely to have come here to edit.
		return PINNED_PROPERTIES_ENTRY_ID
	}

	public updateOverridesData = action((feedbacks: SomeEntityModel[]): void => {
		const newOverrideIds = new Set<string>()

		for (const feedback of feedbacks) {
			if (feedback.type !== EntityModelType.Feedback) continue
			for (const override of feedback.styleOverrides || []) {
				newOverrideIds.add(`${override.elementId};${override.elementProperty}`)
			}
		}

		this.#feedbackOverrideIds.replace(newOverrideIds)
	})

	public setSelectedEntryId(id: string | null): void {
		this.#selectedEntryId.set(id)

		if (id) this.#persistSelectedElementRef(id)
	}

	// Remember the user's choice as { type, ordinal } so it can be restored on the next button.
	#persistSelectedElementRef(id: string): void {
		if (id === PINNED_PROPERTIES_ENTRY_ID) {
			writeLastSelectedElementRef({ type: PINNED_PROPERTIES_ENTRY_ID, ordinal: 0 })
			return
		}

		const element = this.findElementById(id)
		if (!element) return

		let ordinal = 0
		if (element.type !== 'canvas') {
			const sameType = LayeredStyleStore.#flattenVisual(this.elements).filter(
				(entry) => entry.element.type === element.type
			)
			ordinal = sameType.findIndex((entry) => entry.element.id === id)
			if (ordinal < 0) return // couldn't place it - leave the previous reference untouched
		}

		writeLastSelectedElementRef({ type: element.type, ordinal })
	}

	public getSelectedElement(): SomeButtonGraphicsElement | undefined {
		const selectedElementId = this.selectedElementId
		return selectedElementId ? LayeredStyleStore.#findElementById(this.elements, selectedElementId) : undefined
	}

	public setElementVisibility(layer: string, visible?: boolean): void {
		if (visible === undefined) {
			// Toggle visibility
			if (!this.#hiddenElements.delete(layer)) {
				this.#hiddenElements.add(layer)
			}
		} else if (visible) {
			this.#hiddenElements.delete(layer)
		} else {
			this.#hiddenElements.add(layer)
		}
	}

	public isElementVisible(layer: string): boolean {
		return !this.#hiddenElements.has(layer)
	}

	public isPropertyOverridden = (elementId: string, elementProperty: string): boolean => {
		return this.#feedbackOverrideIds.has(`${elementId};${elementProperty}`)
	}
}
