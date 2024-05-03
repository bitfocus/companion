import { ClientDevicesListItem, SurfacesUpdate } from '@companion-app/shared/Model/Surfaces.js'
import { action, observable } from 'mobx'
import { assertNever } from '../util.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'

export class SurfacesStore {
	readonly store = observable.map<string, ClientDevicesListItem>()

	public reset = action((newData: Record<string, ClientDevicesListItem | undefined> | null): void => {
		this.store.clear()

		if (newData) {
			for (const [id, item] of Object.entries(newData)) {
				if (item) {
					this.store.set(id, item)
				}
			}
		}
	})

	public applyChange = action((change: SurfacesUpdate) => {
		const changeType = change.type
		switch (change.type) {
			case 'add':
				this.store.set(change.itemId, change.info)
				break
			case 'remove':
				this.store.delete(change.itemId)
				break
			case 'update': {
				const oldObj = this.store.get(change.itemId)
				if (!oldObj) throw new Error(`Got update for unknown surface item: ${change.itemId}`)
				const newObj = applyPatch(cloneDeep(oldObj), change.patch)
				this.store.set(change.itemId, newObj.newDocument)
				break
			}
			default:
				console.error(`Unknown surfaces change change: ${changeType}`)
				assertNever(change)
				break
		}
	})
}
