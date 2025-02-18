import type { SomeButtonGraphicsLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import { action, makeObservable, observable } from 'mobx'
import { useCallback, useContext } from 'react'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'

export class LayeredStyleStore {
	readonly layers = observable.array<SomeButtonGraphicsLayer>([])

	readonly #selectedLayerId = observable.box<string | null>(null)

	get selectedLayerId(): string | null {
		return this.#selectedLayerId.get()
	}

	constructor() {
		makeObservable(this, {
			updateData: action,
			setSelectedLayerId: action,
		})
	}

	public getLayerById(id: string): SomeButtonGraphicsLayer | undefined {
		return this.layers.find((layer) => layer.id === id)
	}

	public updateData(layers: SomeButtonGraphicsLayer[]) {
		this.layers.replace(layers)
	}

	public setSelectedLayerId(id: string | null) {
		console.log('set id', id)
		this.#selectedLayerId.set(id)
	}

	public getSelectedLayer(): SomeButtonGraphicsLayer | undefined {
		return this.selectedLayerId ? this.getLayerById(this.selectedLayerId) : undefined
	}
}

export function useLayerMutatorCallback<T extends SomeButtonGraphicsLayer, K extends keyof T>(
	controlId: string,
	layerId: string,
	property: K
) {
	const { socket } = useContext(RootAppStoreContext)

	return useCallback(
		(value: T[K]) => {
			socket
				.emitPromise('controls:style:update-options', [controlId, layerId, { [property]: value }])
				.then((res) => {
					console.log('Update layer', res)
				})
				.catch((e) => {
					console.error('Failed to Update layer', e)
				})
		},
		[socket, controlId, layerId, property]
	)
}
