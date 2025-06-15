import { action, observable, runInAction } from 'mobx'
import type {
	ModuleInfoUpdate,
	ClientModuleInfo,
	ModuleUpgradeToOtherVersion,
} from '@companion-app/shared/Model/ModuleInfo.js'
import { assertNever, CompanionSocketWrapped } from '~/util.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import {
	ModuleStoreListCacheEntry,
	ModuleStoreListCacheStore,
	ModuleStoreModuleInfoStore,
} from '@companion-app/shared/Model/ModulesStore.js'
import { nanoid } from 'nanoid'

export class ModuleInfoStore {
	// TODO - should this be more granular/observable?
	readonly modules = observable.map<string, ClientModuleInfo>()

	readonly storeVersions: ModuleStoreVersionsStore

	readonly storeUpdateInfo: Omit<ModuleStoreListCacheStore, 'modules'> = observable.object({
		lastUpdated: 0,
		lastUpdateAttempt: 0,
		updateWarning: null,
	})
	readonly storeList = observable.map<string, ModuleStoreListCacheEntry>()

	constructor(socket: CompanionSocketWrapped) {
		this.storeVersions = new ModuleStoreVersionsStore(socket)
	}

	public get count(): number {
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

		// TODO - is this too aggressive?
		this.storeList.replace(storeInfo.modules)
	})

	getModuleFriendlyName(moduleId: string): string | undefined {
		return this.modules.get(moduleId)?.display.name?.replace(/;.*/, '...')
	}
}

export class ModuleStoreVersionsStore {
	readonly #socket: CompanionSocketWrapped

	readonly #versionsState = observable.map<string, ModuleStoreModuleInfoStore>()
	readonly #versionsSubscribers = new Map<string, Set<string>>()

	readonly #upgradeToVersionsState = observable.map<string, ModuleUpgradeToOtherVersion[]>()
	readonly #upgradeToVersionsSubscribers = new Map<string, Set<string>>()

	constructor(socket: CompanionSocketWrapped) {
		this.#socket = socket

		socket.on('modules-store:info:data', (msgModuleId, data) => {
			if (!this.#versionsSubscribers.has(msgModuleId)) return

			runInAction(() => {
				this.#versionsState.set(msgModuleId, data)
			})
		})
		socket.on('modules-upgrade-to-other:data', (msgModuleId, data) => {
			if (!this.#upgradeToVersionsSubscribers.has(msgModuleId)) return

			runInAction(() => {
				this.#upgradeToVersionsState.set(msgModuleId, data)
			})
		})
	}

	getModuleStoreVersions(moduleId: string): ModuleStoreModuleInfoStore | null {
		return this.#versionsState.get(moduleId) ?? null
	}

	subscribeToModuleStoreVersions(moduleId: string): () => void {
		const sessionId = nanoid()
		const unsub = () => {
			const subs = this.#versionsSubscribers.get(moduleId)
			if (!subs) return

			subs.delete(sessionId)

			if (subs.size === 0) {
				this.#versionsSubscribers.delete(moduleId)
				this.#socket.emitPromise('modules-store:info:unsubscribe', [moduleId]).catch((err) => {
					console.error('Failed to unsubscribe to module store', err)
				})
			}
		}

		let subscribers = this.#versionsSubscribers.get(moduleId)
		if (subscribers) {
			// Add to existing
			subscribers.add(sessionId)

			return unsub
		}

		// Setup new store
		subscribers = new Set([sessionId])
		this.#versionsSubscribers.set(moduleId, subscribers)

		// First subscriber, actually subscribe
		this.#socket
			.emitPromise('modules-store:info:subscribe', [moduleId])
			.then((data) => {
				if (!data || !this.#versionsSubscribers.has(moduleId)) return

				runInAction(() => {
					this.#versionsState.set(moduleId, data)
				})
			})
			.catch((err) => {
				console.error('Failed to subscribe to module store', err)
			})

		return unsub
	}

	getModuleUpgradeToVersions(moduleId: string): ModuleUpgradeToOtherVersion[] {
		return this.#upgradeToVersionsState.get(moduleId) ?? []
	}

	subscribeToModuleUpgradeToVersions(moduleId: string): () => void {
		const sessionId = nanoid()
		const unsub = () => {
			const subs = this.#upgradeToVersionsSubscribers.get(moduleId)
			if (!subs) return

			subs.delete(sessionId)

			if (subs.size === 0) {
				this.#upgradeToVersionsSubscribers.delete(moduleId)
				this.#socket.emitPromise('modules-upgrade-to-other:unsubscribe', [moduleId]).catch((err) => {
					console.error('Failed to unsubscribe to module-upgrade-to-other', err)
				})
			}
		}

		let subscribers = this.#upgradeToVersionsSubscribers.get(moduleId)
		if (subscribers) {
			// Add to existing
			subscribers.add(sessionId)

			return unsub
		}

		// Setup new store
		subscribers = new Set([sessionId])
		this.#upgradeToVersionsSubscribers.set(moduleId, subscribers)

		// First subscriber, actually subscribe
		this.#socket
			.emitPromise('modules-upgrade-to-other:subscribe', [moduleId])
			.then((data) => {
				if (!data || !this.#upgradeToVersionsSubscribers.has(moduleId)) return

				runInAction(() => {
					this.#upgradeToVersionsState.set(moduleId, data)
				})
			})
			.catch((err) => {
				console.error('Failed to subscribe to modules-upgrade-to-other', err)
			})

		return unsub
	}
}
