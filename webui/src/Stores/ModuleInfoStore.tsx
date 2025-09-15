import { action, observable, runInAction } from 'mobx'
import type {
	ModuleInfoUpdate,
	ClientModuleInfo,
	ModuleUpgradeToOtherVersion,
} from '@companion-app/shared/Model/ModuleInfo.js'
import { assertNever } from '~/Resources/util.js'
import {
	ModuleStoreListCacheEntry,
	ModuleStoreListCacheStore,
	ModuleStoreModuleInfoStore,
} from '@companion-app/shared/Model/ModulesStore.js'
import { nanoid } from 'nanoid'
import { trpc } from '~/Resources/TRPC'
import { applyJsonPatchInPlace } from './ApplyDiffToMap'

export class ModuleInfoStore {
	// TODO - should this be more granular/observable?
	readonly modules = observable.map<string, ClientModuleInfo>()

	readonly storeVersions = new ModuleStoreVersionsStore()

	readonly storeUpdateInfo: Omit<ModuleStoreListCacheStore, 'modules' | 'moduleApiVersion'> = observable.object({
		lastUpdated: 0,
		lastUpdateAttempt: 0,
		updateWarning: null,
	})
	readonly storeList = observable.map<string, ModuleStoreListCacheEntry>()

	public get count(): number {
		return this.modules.size
	}

	public updateStore = action((change: ModuleInfoUpdate | null) => {
		if (!change) {
			this.modules.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.modules.replace(change.info)
				break
			case 'add':
				this.modules.set(change.id, change.info)
				break
			case 'remove':
				this.modules.delete(change.id)
				break
			case 'update': {
				const oldObj = this.modules.get(change.id)
				if (!oldObj) throw new Error(`Got update for unknown module: ${change.id}`)

				applyJsonPatchInPlace(oldObj, change.patch)
				break
			}
			default:
				console.error(`Unknown action definitions change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public updateStoreInfo = action((storeInfo: ModuleStoreListCacheStore | null) => {
		storeInfo = storeInfo || {
			lastUpdated: 0,
			lastUpdateAttempt: 0,
			updateWarning: null,
			modules: {},
		}

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

interface VersionSubsInfo {
	subscribers: Set<string>
	sub: Unsubscribable
}
interface Unsubscribable {
	unsubscribe(): void
}

export class ModuleStoreVersionsStore {
	readonly #versionsState = observable.map<string, ModuleStoreModuleInfoStore>()
	readonly #versionsSubscribers = new Map<string, VersionSubsInfo>()

	readonly #upgradeToVersionsState = observable.map<string, ModuleUpgradeToOtherVersion[]>()
	readonly #upgradeToVersionsSubscribers = new Map<string, VersionSubsInfo>()

	getModuleStoreVersions(moduleId: string): ModuleStoreModuleInfoStore | null {
		return this.#versionsState.get(moduleId) ?? null
	}

	subscribeToModuleStoreVersions(moduleId: string): () => void {
		const sessionId = nanoid()
		const unsub = () => {
			const subs = this.#versionsSubscribers.get(moduleId)
			if (!subs) return

			subs.subscribers.delete(sessionId)

			if (subs.subscribers.size === 0) {
				this.#versionsSubscribers.delete(moduleId)

				subs.sub.unsubscribe()
			}
		}

		let subscribers = this.#versionsSubscribers.get(moduleId)
		if (subscribers) {
			// Add to existing
			subscribers.subscribers.add(sessionId)

			return unsub
		}

		// First subscriber, actually subscribe
		const sub = trpc.connections.modulesStore.watchModuleInfo
			.subscriptionOptions({
				moduleId,
			})
			.subscribe({
				onData: (data) => {
					runInAction(() => {
						if (data) {
							this.#versionsState.set(moduleId, data)
						} else {
							this.#versionsState.delete(moduleId)
						}
					})
				},
				onError: (err) => {
					console.error('Failed to subscribe to module store', err)
				},
			})

		// Setup new store
		subscribers = { subscribers: new Set([sessionId]), sub: sub }
		this.#versionsSubscribers.set(moduleId, subscribers)

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

			subs.subscribers.delete(sessionId)

			if (subs.subscribers.size === 0) {
				this.#upgradeToVersionsSubscribers.delete(moduleId)

				subs.sub.unsubscribe()
			}
		}

		let subscribers = this.#upgradeToVersionsSubscribers.get(moduleId)
		if (subscribers) {
			// Add to existing
			subscribers.subscribers.add(sessionId)

			return unsub
		}

		// First subscriber, actually subscribe
		const sub = trpc.connections.modules.watchUpgradeToOther
			.subscriptionOptions({
				moduleId,
			})
			.subscribe({
				onData: (data) => {
					runInAction(() => {
						if (data) {
							this.#upgradeToVersionsState.set(moduleId, data)
						} else {
							this.#upgradeToVersionsState.delete(moduleId)
						}
					})
				},
				onError: (err) => {
					console.error('Failed to subscribe to module store', err)
				},
			})

		// Setup new store
		subscribers = { subscribers: new Set([sessionId]), sub: sub }
		this.#upgradeToVersionsSubscribers.set(moduleId, subscribers)

		return unsub
	}
}
