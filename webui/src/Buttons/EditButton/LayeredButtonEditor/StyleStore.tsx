import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { action, makeObservable, observable } from 'mobx'

export class LayeredStyleStore {
	readonly elements = observable.array<SomeButtonGraphicsElement>([])

	readonly #selectedElementId = observable.box<string | null>(null)

	get selectedElementId(): string | null {
		return this.#selectedElementId.get()
	}

	constructor() {
		makeObservable(this, {
			updateData: action,
			setSelectedElementId: action,
		})
	}

	public getElementById(id: string): SomeButtonGraphicsElement | undefined {
		return this.elements.find((element) => element.id === id)
	}

	public updateData(elements: SomeButtonGraphicsElement[]) {
		this.elements.replace(elements)
	}

	public setSelectedElementId(id: string | null) {
		this.#selectedElementId.set(id)
	}

	public getSelectedElement(): SomeButtonGraphicsElement | undefined {
		return this.selectedElementId ? this.getElementById(this.selectedElementId) : undefined
	}
}
