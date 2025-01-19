import { action, observable } from 'mobx'
import type { ModuleInfoUpdate, ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { assertNever } from '../util.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { ModuleStoreListCacheEntry, ModuleStoreListCacheStore } from '@companion-app/shared/Model/ModulesStore.js'

export class ModuleInfoStore {
	// TODO - should this be more granular/observable?
	readonly modules = observable.map<string, ClientModuleInfo>()

	readonly storeUpdateInfo: Omit<ModuleStoreListCacheStore, 'modules'> = observable.object({
		lastUpdated: 0,
		lastUpdateAttempt: 0,
		updateWarning: null,
	})
	readonly storeList = observable.map<string, ModuleStoreListCacheEntry>()

	public get count() {
		return this.modules.size
	}

	public resetModules = action((newData: Record<string, ClientModuleInfo | undefined> | null) => {
		this.modules.clear()

		if (newData) {
			for (const [moduleId, moduleInfo] of Object.entries(newData)) {
				if (!moduleInfo) continue

				this.modules.set(moduleId, moduleInfo)
			}
		}
	})

	public applyModuleChange = action((change: ModuleInfoUpdate) => {
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

	public updateStoreInfo = action((storeInfo: ModuleStoreListCacheStore) => {
		this.storeUpdateInfo.lastUpdated = storeInfo.lastUpdated
		this.storeUpdateInfo.lastUpdateAttempt = storeInfo.lastUpdateAttempt
		this.storeUpdateInfo.updateWarning = storeInfo.updateWarning

		// TODO - is this too agressive?
		this.storeList.replace(storeInfo.modules)
	})

	getModuleFriendlyName(moduleId: string): string | undefined {
		return this.modules.get(moduleId)?.display.name?.replace(/\;.*/, '...')
	}
}
