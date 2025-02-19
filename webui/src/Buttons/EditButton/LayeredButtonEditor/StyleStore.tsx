import type {
	ButtonGraphicsElementBase,
	ExpressionOrValue,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { action, makeObservable, observable } from 'mobx'
import { useCallback, useContext } from 'react'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'

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
		console.log('set id', id)
		this.#selectedElementId.set(id)
	}

	public getSelectedElement(): SomeButtonGraphicsElement | undefined {
		return this.selectedElementId ? this.getElementById(this.selectedElementId) : undefined
	}
}

export function useElementMutatorCallback<T extends ButtonGraphicsElementBase, K extends string & keyof T>(
	controlId: string,
	elementId: string,
	property: K
) {
	const { socket } = useContext(RootAppStoreContext)

	return useCallback(
		(value: T[K] extends ExpressionOrValue<infer U> ? U : never) => {
			socket
				.emitPromise('controls:style:update-option-value', [controlId, elementId, property, value])
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[socket, controlId, elementId, property]
	)
}

export function useElementIsExpressionMutatorCallback<T extends ButtonGraphicsElementBase, K extends string & keyof T>(
	controlId: string,
	elementId: string,
	property: K
) {
	const { socket } = useContext(RootAppStoreContext)

	return useCallback(
		(value: boolean) => {
			socket
				.emitPromise('controls:style:update-option-is-expression', [controlId, elementId, property, value])
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[socket, controlId, elementId, property]
	)
}
