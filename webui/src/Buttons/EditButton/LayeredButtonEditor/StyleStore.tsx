import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { action, computed, makeObservable, observable, toJS } from 'mobx'

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

	public updateData = action((elements: SomeButtonGraphicsElement[]): void => {
		console.log('update data')

		this.elements.replace(elements)
	})

	public updateOverridesData = action((feedbacks: SomeEntityModel[]): void => {
		if (feedbacks.length === 0) return

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
