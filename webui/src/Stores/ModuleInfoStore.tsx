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
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

export type ModuleInfoId = `${ModuleInstanceType}:${string}`

export interface ModuleStoreListCacheEntryExt extends ModuleStoreListCacheEntry {
	moduleType: ModuleInstanceType
}

export class ModuleInfoStore {
	readonly allModules = observable.map<ModuleInfoId, ClientModuleInfo>()

	readonly storeVersions = new ModuleStoreVersionsStore()

	readonly storeRefreshProgress = observable.map<ModuleInfoId | null, number>()

	readonly storeUpdateInfo: Omit<ModuleStoreListCacheStore, 'connectionModules' | 'connectionModuleApiVersion'> =
		observable.object({
			lastUpdated: 0,
			lastUpdateAttempt: 0,
			updateWarning: null,
		})

	readonly storeList = observable.map<ModuleInfoId, ModuleStoreListCacheEntryExt>()

	public get count(): number {
		return this.allModules.size
	}

	public countStoreModulesOfType(moduleType: ModuleInstanceType): number {
		let count = 0

		for (const storeModule of this.storeList.values()) {
			if (storeModule.moduleType === moduleType) count++
		}

		return count
	}

	public getModuleInfo(moduleType: ModuleInstanceType, moduleId: string): ClientModuleInfo | undefined {
		return this.allModules.get(`${moduleType}:${moduleId}`)
	}

	public getStoreInfo(moduleType: ModuleInstanceType, moduleId: string): ModuleStoreListCacheEntry | undefined {
		return this.storeList.get(`${moduleType}:${moduleId}`)
	}

	public getStoreListRefreshProgress(): number {
		return this.storeRefreshProgress.get(null) ?? 1
	}

	public getStoreRefreshProgress(moduleType: ModuleInstanceType, moduleId: string): number {
		const id = `${moduleType}:${moduleId}` as const
		return this.storeRefreshProgress.get(id) ?? 1
	}

	public updateStore = action((change: ModuleInfoUpdate | null) => {
		if (!change) {
			this.allModules.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.allModules.replace(change.info)
				break
			case 'add':
				this.allModules.set(change.id, change.info)
				break
			case 'remove':
				this.allModules.delete(change.id)
				break
			case 'update': {
				const oldObj = this.allModules.get(change.id)
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
			connectionModuleApiVersion: null,
			connectionModules: null,
		}

		this.storeUpdateInfo.lastUpdated = storeInfo.lastUpdated
		this.storeUpdateInfo.lastUpdateAttempt = storeInfo.lastUpdateAttempt
		this.storeUpdateInfo.updateWarning = storeInfo.updateWarning

		const allModules: [ModuleInfoId, ModuleStoreListCacheEntryExt][] = Object.entries(
			storeInfo.connectionModules || {}
		).map(([id, entry]) => [
			`${ModuleInstanceType.Connection}:${id}`,
			{
				...entry,
				moduleType: ModuleInstanceType.Connection,
			},
		])
		// TODO - is this too aggressive?
		this.storeList.replace(allModules)
	})

	getModuleFriendlyName(moduleType: ModuleInstanceType, moduleId: string): string | undefined {
		return this.allModules.get(`${moduleType}:${moduleId}`)?.display.name?.replace(/;.*/, '...')
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
	readonly #versionsState = observable.map<ModuleInfoId, ModuleStoreModuleInfoStore>()
	readonly #versionsSubscribers = new Map<ModuleInfoId, VersionSubsInfo>()

	readonly #upgradeToVersionsState = observable.map<ModuleInfoId, ModuleUpgradeToOtherVersion[]>()
	readonly #upgradeToVersionsSubscribers = new Map<ModuleInfoId, VersionSubsInfo>()

	getModuleStoreVersions(moduleType: ModuleInstanceType, moduleId: string): ModuleStoreModuleInfoStore | null {
		return this.#versionsState.get(`${moduleType}:${moduleId}`) ?? null
	}

	subscribeToModuleStoreVersions(moduleType: ModuleInstanceType, moduleId: string): () => void {
		const id: ModuleInfoId = `${moduleType}:${moduleId}`

		const sessionId = nanoid()
		const unsub = () => {
			const subs = this.#versionsSubscribers.get(id)
			if (!subs) return

			subs.subscribers.delete(sessionId)

			if (subs.subscribers.size === 0) {
				this.#versionsSubscribers.delete(id)

				subs.sub.unsubscribe()
			}
		}

		let subscribers = this.#versionsSubscribers.get(id)
		if (subscribers) {
			// Add to existing
			subscribers.subscribers.add(sessionId)

			return unsub
		}

		// First subscriber, actually subscribe
		const sub = trpc.instances.modulesStore.watchModuleInfo
			.subscriptionOptions({
				moduleType,
				moduleId,
			})
			.subscribe({
				onData: (data) => {
					runInAction(() => {
						if (data) {
							this.#versionsState.set(id, data)
						} else {
							this.#versionsState.delete(id)
						}
					})
				},
				onError: (err) => {
					console.error('Failed to subscribe to module store', err)
				},
			})

		// Setup new store
		subscribers = { subscribers: new Set([sessionId]), sub: sub }
		this.#versionsSubscribers.set(id, subscribers)

		return unsub
	}

	getModuleUpgradeToVersions(moduleType: ModuleInstanceType, moduleId: string): ModuleUpgradeToOtherVersion[] {
		return this.#upgradeToVersionsState.get(`${moduleType}:${moduleId}`) ?? []
	}

	subscribeToModuleUpgradeToVersions(moduleType: ModuleInstanceType, moduleId: string): () => void {
		const id: ModuleInfoId = `${moduleType}:${moduleId}`

		const sessionId = nanoid()
		const unsub = () => {
			const subs = this.#upgradeToVersionsSubscribers.get(id)
			if (!subs) return

			subs.subscribers.delete(sessionId)

			if (subs.subscribers.size === 0) {
				this.#upgradeToVersionsSubscribers.delete(id)

				subs.sub.unsubscribe()
			}
		}

		let subscribers = this.#upgradeToVersionsSubscribers.get(id)
		if (subscribers) {
			// Add to existing
			subscribers.subscribers.add(sessionId)

			return unsub
		}

		// First subscriber, actually subscribe
		const sub = trpc.instances.modules.watchUpgradeToOther
			.subscriptionOptions({
				moduleType,
				moduleId,
			})
			.subscribe({
				onData: (data) => {
					runInAction(() => {
						if (data) {
							this.#upgradeToVersionsState.set(id, data)
						} else {
							this.#upgradeToVersionsState.delete(id)
						}
					})
				},
				onError: (err) => {
					console.error('Failed to subscribe to module store', err)
				},
			})

		// Setup new store
		subscribers = { subscribers: new Set([sessionId]), sub: sub }
		this.#upgradeToVersionsSubscribers.set(id, subscribers)

		return unsub
	}
}
