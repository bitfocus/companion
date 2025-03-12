import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { action, computed, makeObservable, observable, toJS } from 'mobx'

export class LayeredStyleStore {
	readonly elements = observable.array<SomeButtonGraphicsElement>([])

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
			updateData: action,
			setSelectedElementId: action,
			setElementVisibility: action,
			hiddenElements: computed, // This caches the JS set, allowing for efficient change detection
		})
	}

	public getElementById(id: string): SomeButtonGraphicsElement | undefined {
		return this.elements.find((element) => element.id === id)
	}

	public updateData(elements: SomeButtonGraphicsElement[]) {
		console.log('update data')

		this.elements.replace(elements)
	}

	public setSelectedElementId(id: string | null) {
		this.#selectedElementId.set(id)
	}

	public getSelectedElement(): SomeButtonGraphicsElement | undefined {
		return this.selectedElementId ? this.getElementById(this.selectedElementId) : undefined
	}

	public setElementVisibility(layer: string, visible?: boolean) {
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
}
