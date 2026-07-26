import { action, computed, makeObservable, observable, toJS } from 'mobx'
import { z } from 'zod'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'

// Remembers the last element the user selected, so the same one can be restored when opening
// another button. Matched by element type + its ordinal among same-typed elements (e.g. "the 2nd
// image"), counted top-first in the visual list - never by id or absolute position.
const LAST_SELECTED_ELEMENT_STORAGE_KEY = 'layeredEditor.lastSelectedElement'

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

export class LayeredStyleStore {
	readonly elements = observable.array<SomeButtonGraphicsElement>([])
	readonly #feedbackOverrideIds = observable.set<string>()

	readonly #selectedElementId = observable.box<string | null>(null)

	readonly #hiddenElements = observable.set<string>()

	get selectedElementId(): string | null {
		return this.#selectedElementId.get()
	}

	get hiddenElements(): Set<string> {
		return toJS(this.#hiddenElements)
	}

	constructor() {
		makeObservable(this, {
			setSelectedElementId: action,
			setElementVisibility: action,
			hiddenElements: computed, // This caches the JS set, allowing for efficient change detection
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
	static #flattenVisual(elements: readonly SomeButtonGraphicsElement[]): SomeButtonGraphicsElement[] {
		const out: SomeButtonGraphicsElement[] = []
		for (const element of [...elements].reverse()) {
			if (element.type === 'canvas') continue
			out.push(element)
			if (element.type === 'group') out.push(...LayeredStyleStore.#flattenVisual(element.children))
		}
		return out
	}

	public updateData = action((elements: SomeButtonGraphicsElement[]): void => {
		this.elements.replace(elements)
		this.#reconcileSelection()
	})

	// Keep a valid current selection; otherwise seed one so the properties editor is ready to edit
	// (e.g. text) without an extra click. Runs on every button open (the store is recreated per button).
	#reconcileSelection(): void {
		const currentId = this.selectedElementId
		if (currentId && this.findElementById(currentId)) return

		// Set the box directly rather than via setSelectedElementId, so seeding doesn't re-persist the
		// derived choice over the user's remembered reference.
		this.#selectedElementId.set(this.#pickDefaultElementId())
	}

	#pickDefaultElementId(): string | null {
		const visual = LayeredStyleStore.#flattenVisual(this.elements)

		const ref = readLastSelectedElementRef()
		if (ref) {
			if (ref.type === 'canvas') {
				const canvas = this.elements.find((element) => element.type === 'canvas')
				if (canvas) return canvas.id
			} else {
				const sameType = visual.filter((element) => element.type === ref.type)
				if (sameType.length > 0) {
					// Restore the Nth of that type, clamping down when this button has fewer.
					const chosen = sameType[Math.min(Math.max(ref.ordinal, 0), sameType.length - 1)]
					return chosen.id
				}
			}
		}

		// Fall back to the topmost element.
		return visual[0]?.id ?? null
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

	public setSelectedElementId(id: string | null): void {
		this.#selectedElementId.set(id)

		if (id) this.#persistSelectedElementRef(id)
	}

	// Remember the user's choice as { type, ordinal } so it can be restored on the next button.
	#persistSelectedElementRef(id: string): void {
		const element = this.findElementById(id)
		if (!element) return

		let ordinal = 0
		if (element.type !== 'canvas') {
			const sameType = LayeredStyleStore.#flattenVisual(this.elements).filter((e) => e.type === element.type)
			ordinal = sameType.findIndex((e) => e.id === id)
			if (ordinal < 0) return // couldn't place it - leave the previous reference untouched
		}

		writeLastSelectedElementRef({ type: element.type, ordinal })
	}

	public getSelectedElement(): SomeButtonGraphicsElement | undefined {
		return this.selectedElementId
			? LayeredStyleStore.#findElementById(this.elements, this.selectedElementId)
			: undefined
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
