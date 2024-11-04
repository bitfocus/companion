import { action, observable } from 'mobx'
import type { ModuleInfoUpdate, NewClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { assertNever } from '../util.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'

export class ModuleInfoStore {
	// TODO - should this be more granular/observable?
	readonly modules = observable.map<string, NewClientModuleInfo>()

	public get count() {
		return this.modules.size
	}

	public reset = action((newData: Record<string, NewClientModuleInfo | undefined> | null) => {
		this.modules.clear()

		if (newData) {
			for (const [moduleId, moduleInfo] of Object.entries(newData)) {
				if (!moduleInfo) continue

				this.modules.set(moduleId, moduleInfo)
			}
		}
	})

	public applyChange = action((change: ModuleInfoUpdate) => {
		const changeType = change.type
		switch (change.type) {
			case 'add':
				this.modules.set(change.id, change.info)
				break
			case 'remove':
				this.modules.delete(change.id)
				break
			case 'update': {
				const oldObj = this.modules.get(change.id)
				if (!oldObj) throw new Error(`Got update for unknown module: ${change.id}`)

				const newObj = applyPatch(cloneDeep(oldObj), change.patch)
				this.modules.set(change.id, newObj.newDocument)
				break
			}
			default:
				console.error(`Unknown action definitions change: ${changeType}`)
				assertNever(change)
				break
		}
	})
}
