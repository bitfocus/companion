/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import path from 'path'
import { InstanceModuleScanner } from './ModuleScanner.js'
import type express from 'express'
import type {
	ClientModuleInfo,
	ModuleInfoUpdate,
	ModuleInfoUpdateId,
	ModuleUpgradeToOtherVersion,
} from '@companion-app/shared/Model/ModuleInfo.js'
import LogController from '../Log/Controller.js'
import type { InstanceController } from './Controller.js'
import jsonPatch from 'fast-json-patch'
import type { ModuleStoreService } from './ModuleStore.js'
import { router, publicProcedure, toIterable } from '../UI/TRPC.js'
import EventEmitter from 'node:events'
import z from 'zod'
import { InstanceModuleInfo } from './ModuleInfo.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { SomeModuleVersionInfo } from './Types.js'
import type { AppInfo } from '../Registry.js'
import type { SomeModuleManifest } from '@companion-app/shared/Model/ModuleManifest.js'
import { assertNever } from '@companion-app/shared/Util.js'

type InstanceModulesEvents = {
	modulesUpdate: [change: ModuleInfoUpdate]
	[id: `upgradeToOther:${string}:${string}`]: [data: ModuleUpgradeToOtherVersion[]]
}

export class InstanceModules {
	readonly #logger = LogController.createLogger('Instance/Modules')

	/**
	 * The core instance controller
	 */
	readonly #instanceController: InstanceController

	/**
	 * Last module info sent to clients
	 */
	#lastModulesJson: Record<string, ClientModuleInfo> = {}

	/**
	 * Known module info
	 */
	readonly #knownConnectionModules = new Map<string, InstanceModuleInfo>()
	readonly #knownSurfaceModules = new Map<string, InstanceModuleInfo>()

	/**
	 * Module scanner helper
	 */
	readonly #moduleScanner = new InstanceModuleScanner()

	/**
	 * Which rooms are active for watching the upgrade to other versions subscription
	 * Note: values are not removed from this, until the subscription data is invalidated
	 */
	readonly #activeModuleUpgradeConnectionRooms = new Set<string>()

	readonly #modulesDirs: AppInfo['modulesDirs']
	readonly #builtinModuleDirs: AppInfo['builtinModuleDirs']

	readonly #events = new EventEmitter<InstanceModulesEvents>()

	constructor(instance: InstanceController, apiRouter: express.Router, appInfo: AppInfo) {
		this.#instanceController = instance
		this.#modulesDirs = appInfo.modulesDirs
		this.#builtinModuleDirs = appInfo.builtinModuleDirs

		this.#events.setMaxListeners(0)

		apiRouter.get('/help/module/:moduleType/:moduleId/:versionId/*path', this.#getHelpAsset)
	}

	#getModuleMapForType(type: ModuleInstanceType): Map<string, InstanceModuleInfo> {
		switch (type) {
			case ModuleInstanceType.Connection:
				return this.#knownConnectionModules
			case ModuleInstanceType.Surface:
				return this.#knownSurfaceModules
			default:
				assertNever(type)
				throw new Error(`Invalid module type: ${type}`)
		}
	}

	/**
	 * Parse and init a new module which has just been installed on disk
	 * @param moduleDir Freshly installed module directory
	 * @param manifest The module's manifest
	 */
	async loadInstalledModule(moduleDir: string, manifest: SomeModuleManifest): Promise<void> {
		this.#logger.info(`New ${manifest.type} module installed: ${manifest.id}`)

		const loadedModuleInfo = await this.#moduleScanner.loadInfoForModule(moduleDir, false)

		if (!loadedModuleInfo) throw new Error(`Failed to load installed module. Missing from disk at "${moduleDir}"`)
		if (loadedModuleInfo?.manifest.id !== manifest.id)
			throw new Error(`Mismatched module id: ${loadedModuleInfo?.manifest.id} !== ${manifest.id}`)

		// Update the module info
		const moduleType = (manifest.type as ModuleInstanceType) || ModuleInstanceType.Connection
		const moduleInfo = this.#getOrCreateModuleEntry(moduleType, manifest.id)
		moduleInfo.installedVersions[loadedModuleInfo.versionId] = {
			...loadedModuleInfo,
			isPackaged: true,
		}

		// Notify clients
		this.#emitModuleUpdate(moduleType, manifest.id)
		this.#invalidateModuleUpgradeRoom(moduleType, manifest.id)

		// Ensure any modules using this version are started
		await this.#instanceController.reloadUsesOfModule(moduleType, manifest.id, manifest.version)
	}

	/**
	 * Cleanup any uses of a module, so that it can be removed from disk
	 * @param moduleId The module's id
	 * @param mode Whether the module is a custom or release module
	 * @param versionId The version of the module
	 */
	async uninstallModule(moduleType: ModuleInstanceType, moduleId: string, versionId: string): Promise<void> {
		const moduleInfo = this.#getModuleMapForType(moduleType).get(moduleId)
		if (!moduleInfo) throw new Error('Module not found when removing version')

		// Make sure the module is not in use
		const { labels } = this.#instanceController.findActiveUsagesOfModule(moduleType, moduleId, versionId)
		if (labels.length > 0)
			throw new Error(
				`Cannot uninstall ${moduleType} module ${moduleId} version ${versionId} while it is in use by: ${labels.join(', ')}`
			)

		delete moduleInfo.installedVersions[versionId]

		// Notify clients
		this.#emitModuleUpdate(moduleType, moduleId)
		this.#invalidateModuleUpgradeRoom(moduleType, moduleId)

		// // Ensure any modules using this version are started
		// await this.#instanceController.reloadUsesOfModule(moduleId, versionId)
	}

	/**
	 *
	 */
	#getOrCreateModuleEntry(moduleType: ModuleInstanceType, id: string): InstanceModuleInfo {
		const knownModules = this.#getModuleMapForType(moduleType)

		let moduleInfo = knownModules.get(id)
		if (!moduleInfo) {
			moduleInfo = new InstanceModuleInfo(moduleType, id)
			knownModules.set(id, moduleInfo)
		}
		return moduleInfo
	}

	async #initModulesOfType(moduleType: ModuleInstanceType): Promise<void> {
		const installedModules = await this.#moduleScanner.loadInfoForModulesInDir(this.#modulesDirs[moduleType], true)
		for (const candidate of installedModules) {
			if (candidate.type !== moduleType) {
				this.#logger.warn(
					`Skipping module ${candidate.manifest.id} in installed modules dir, as it is not a ${moduleType} module`
				)
				continue
			}

			const moduleInfo = this.#getOrCreateModuleEntry(candidate.type, candidate.manifest.id)
			moduleInfo.installedVersions[candidate.versionId] = {
				...candidate,
				isPackaged: true,
			}
		}

		// If supported, also find any 'builtin' modules. These are one which are shipped with companion and can't be uninstalled
		const builtinModuleDir = this.#builtinModuleDirs[moduleType]
		if (builtinModuleDir) {
			const builtinModules = await this.#moduleScanner.loadInfoForModulesInDir(builtinModuleDir, true)
			for (const candidate of builtinModules) {
				if (candidate.type !== moduleType) {
					this.#logger.warn(
						`Skipping module ${candidate.manifest.id} in builtin modules dir, as it is not a ${moduleType} module`
					)
					continue
				}

				const moduleInfo = this.#getOrCreateModuleEntry(candidate.type, candidate.manifest.id)
				moduleInfo.builtinModule = {
					...candidate,
					versionId: 'builtin',
					isPackaged: true,
				}
			}
		}
	}

	/**
	 * Initialise modules from disk
	 * @param extraModulePath - extra directory to search for modules
	 */
	async initModules(extraModulePath: string): Promise<void> {
		// Add modules from the installed modules directory
		await this.#initModulesOfType(ModuleInstanceType.Connection)
		await this.#initModulesOfType(ModuleInstanceType.Surface)

		if (extraModulePath) {
			this.#logger.info(`Looking for extra modules in: ${extraModulePath}`)
			const candidates = await this.#moduleScanner.loadInfoForModulesInDir(extraModulePath, true)
			for (const candidate of candidates) {
				const moduleInfo = this.#getOrCreateModuleEntry(candidate.type, candidate.manifest.id)
				moduleInfo.devModule = {
					...candidate,
					versionId: 'dev',
					isBeta: false,
				}
			}

			this.#logger.info(`Found ${candidates.length} extra modules`)
		}

		this.#lastModulesJson = this.#compileClientModulesJson()

		// Log the loaded modules
		this.#logLoadedModules(this.#knownConnectionModules, 'Connection:')
		this.#logLoadedModules(this.#knownSurfaceModules, 'Surface:')
	}

	#logLoadedModules(knownModules: Map<string, InstanceModuleInfo>, prefix: string): void {
		const sorted = Array.from(knownModules.entries()).sort(([a], [b]) => a.localeCompare(b))
		for (const [_id, moduleInfo] of sorted) {
			if (moduleInfo.devModule) {
				this.#logger.info(
					`${prefix} ${moduleInfo.devModule.display.id}: ${moduleInfo.devModule.display.name} (Dev${
						moduleInfo.devModule.isPackaged ? ' & Packaged' : ''
					})`
				)
			}

			if (moduleInfo.builtinModule) {
				this.#logger.info(
					`${prefix} Builtin: ${moduleInfo.builtinModule.display.id}@${moduleInfo.builtinModule.versionId}: ${moduleInfo.builtinModule.display.name}`
				)
			}

			for (const moduleVersion of Object.values(moduleInfo.installedVersions)) {
				if (!moduleVersion) continue
				this.#logger.info(
					`${prefix} ${moduleVersion.display.id}@${moduleVersion.versionId}: ${moduleVersion.display.name}`
				)
			}
		}
	}

	/**
	 * Reload modules from developer path
	 */
	async reloadExtraModule(fullpath: string): Promise<void> {
		this.#logger.info(`Attempting to reload module in: ${fullpath}`)

		const reloadedModule = await this.#moduleScanner.loadInfoForModule(fullpath, true)
		if (reloadedModule) {
			this.#logger.info(
				`Found new ${reloadedModule.type} module ${reloadedModule.display.id}@${reloadedModule.versionId} in: ${fullpath}`
			)

			// Replace any existing module
			const moduleInfo = this.#getOrCreateModuleEntry(reloadedModule.type, reloadedModule.manifest.id)
			moduleInfo.devModule = {
				...reloadedModule,
				versionId: 'dev',
				isBeta: false,
			}

			this.#emitModuleUpdate(reloadedModule.type, reloadedModule.manifest.id)

			// restart usages of this module
			await this.#instanceController.reloadUsesOfModule(reloadedModule.type, reloadedModule.manifest.id, 'dev')
		} else {
			this.#logger.info(`Failed to find module in: ${fullpath}`)

			let changedModule: InstanceModuleInfo | undefined

			const findModule = (modules: Map<string, InstanceModuleInfo>): void => {
				for (const moduleInfo of modules.values()) {
					if (moduleInfo.devModule?.basePath === fullpath) {
						moduleInfo.devModule = null
						changedModule = moduleInfo
						break
					}
				}
			}

			// Find the dev module which shares this path, and remove it as an option
			findModule(this.#knownConnectionModules)
			findModule(this.#knownSurfaceModules)

			if (changedModule) {
				this.#emitModuleUpdate(changedModule.moduleType, changedModule.id)

				// restart usages of this module
				await this.#instanceController.reloadUsesOfModule(changedModule.moduleType, changedModule.id, 'dev')
			}
		}
	}

	#emitModuleUpdate = (moduleType: ModuleInstanceType, changedModuleId: string): void => {
		// Fetch the old and new module json
		const changedModuleIdFull = `${moduleType}:${changedModuleId}` as const
		const oldModuleJson = this.#lastModulesJson[changedModuleIdFull]
		const newModuleJson = this.#getModuleMapForType(moduleType).get(changedModuleId)?.toClientJson() ?? null

		// Update stored
		if (newModuleJson) {
			this.#lastModulesJson[changedModuleIdFull] = structuredClone(newModuleJson)
		} else {
			delete this.#lastModulesJson[changedModuleIdFull]
		}

		if (this.#events.listenerCount('modulesUpdate') == 0) return

		// Now broadcast to any interested clients
		if (!newModuleJson) {
			this.#events.emit('modulesUpdate', {
				type: 'remove',
				id: changedModuleIdFull,
			})
		} else if (oldModuleJson) {
			const patch = jsonPatch.compare(oldModuleJson, newModuleJson)
			if (patch.length > 0) {
				this.#events.emit('modulesUpdate', {
					type: 'update',
					id: changedModuleIdFull,
					patch,
				})
			}
		} else {
			this.#events.emit('modulesUpdate', {
				type: 'add',
				id: changedModuleIdFull,
				info: newModuleJson,
			})
		}
	}

	getLatestVersionOfModule(moduleType: ModuleInstanceType, moduleId: string, allowDev: boolean): string | null {
		const moduleInfo = this.#getModuleMapForType(moduleType).get(moduleId)
		if (!moduleInfo) return null

		if (moduleInfo.devModule && allowDev) return 'dev'

		const latest = moduleInfo.getLatestVersion(false)?.versionId
		if (latest) return latest

		// For surface modules, builtin is also an option
		if (moduleType === ModuleInstanceType.Surface && moduleInfo.builtinModule) return 'builtin'

		return null
	}

	createTrpcRouter() {
		const self = this
		return router({
			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'modulesUpdate', signal)

				yield {
					type: 'init',
					info: self.#lastModulesJson,
				} satisfies ModuleInfoUpdate

				for await (const [change] of changes) {
					yield change
				}
			}),

			watchUpgradeToOther: publicProcedure
				.input(
					z.object({
						moduleType: z.enum(ModuleInstanceType),
						moduleId: z.string(),
					})
				)
				.subscription(async function* ({ input, signal }) {
					try {
						const changes = toIterable(self.#events, `upgradeToOther:${input.moduleType}:${input.moduleId}`, signal)

						self.#activeModuleUpgradeConnectionRooms.add(input.moduleId)

						// Future: maybe this should be cached, but it may not be worth the cost
						yield self.#getModuleUpgradeCandidates(input.moduleType, input.moduleId)

						for await (const [change] of changes) {
							yield change
						}
					} finally {
						if (self.#events.listenerCount(`upgradeToOther:${input.moduleType}:${input.moduleId}`) === 0) {
							// If no listeners are left, remove the room
							self.#activeModuleUpgradeConnectionRooms.delete(input.moduleId)
						}
					}
				}),
		})
	}

	listenToStoreEvents(modulesStore: ModuleStoreService): void {
		modulesStore.on('storeListUpdated', () => {
			// Invalidate any module upgrade data
			for (const moduleId of this.#activeModuleUpgradeConnectionRooms) {
				this.#invalidateModuleUpgradeRoom(ModuleInstanceType.Connection, moduleId)
			}
		})
	}

	#invalidateModuleUpgradeRoom = (moduleType: ModuleInstanceType, moduleId: string): void => {
		if (this.#events.listenerCount(`upgradeToOther:${moduleType}:${moduleId}`) == 0) {
			// Abort if no clients are listening
			this.#activeModuleUpgradeConnectionRooms.delete(moduleId)
			return
		}

		// Compile and emit data
		const newData = this.#getModuleUpgradeCandidates(moduleType, moduleId)
		this.#events.emit(`upgradeToOther:${moduleType}:${moduleId}`, newData)
	}

	/**
	 * Compile a list of modules which a module could be 'upgraded' to
	 */
	#getModuleUpgradeCandidates(moduleType: ModuleInstanceType, moduleId: string): ModuleUpgradeToOtherVersion[] {
		const candidateVersions: ModuleUpgradeToOtherVersion[] = []

		// First, push the store versions of each module
		const cachedStoreInfo = this.#instanceController.modulesStore.getCachedStoreList(moduleType)
		for (const [storeModuleId, storeModuleInfo] of Object.entries(cachedStoreInfo)) {
			if (storeModuleId === moduleId || storeModuleInfo.deprecationReason) continue
			if (storeModuleInfo.legacyIds.includes(moduleId)) {
				// Create a new entry to report that the module can upgrade to the latest version of this store module
				candidateVersions.push({
					moduleId: storeModuleId,
					displayName: storeModuleInfo.name,
					helpPath: storeModuleInfo.helpUrl,
					versionId: null,
				})
			}
		}

		// Next, push the latest installed versions of each module
		for (const [knownModuleId, knownModuleInfo] of this.#getModuleMapForType(moduleType)) {
			if (knownModuleId === moduleId) continue
			const latestVersion = knownModuleInfo.getLatestVersion(false)
			if (!latestVersion) continue

			if ('legacyIds' in latestVersion.manifest && latestVersion.manifest.legacyIds.includes(moduleId)) {
				candidateVersions.push({
					moduleId: knownModuleId,
					displayName: latestVersion.display.name,
					helpPath: latestVersion.helpPath,
					versionId: latestVersion.versionId,
				})
			}
		}

		return candidateVersions
	}

	/**
	 * Get display version of module infos
	 */
	#compileClientModulesJson(): Record<ModuleInfoUpdateId, ClientModuleInfo> {
		const result: Record<ModuleInfoUpdateId, ClientModuleInfo> = {}

		const processMap = (moduleType: ModuleInstanceType, map: Map<string, InstanceModuleInfo>) => {
			for (const [id, moduleInfo] of map.entries()) {
				const clientModuleInfo = moduleInfo.toClientJson()
				if (!clientModuleInfo) continue

				result[`${moduleType}:${id}`] = clientModuleInfo
			}
		}

		processMap(ModuleInstanceType.Connection, this.#knownConnectionModules)
		processMap(ModuleInstanceType.Surface, this.#knownSurfaceModules)

		return result
	}

	/**
	 * Get the manifest for a module
	 */
	getModuleManifest(
		moduleType: ModuleInstanceType,
		moduleId: string,
		versionId: string | null
	): SomeModuleVersionInfo | undefined {
		return this.#getModuleMapForType(moduleType).get(moduleId)?.getVersion(versionId) ?? undefined
	}

	/**
	 * Check whether a module is known and has a version installed
	 */
	hasModule(moduleType: ModuleInstanceType, moduleId: string): boolean {
		return this.#getModuleMapForType(moduleType).has(moduleId)
	}

	/**
	 * Return a module help asset over http
	 */
	#getHelpAsset = (
		req: express.Request<{ moduleType: string; moduleId: string; versionId: string; path: string[] }>,
		res: express.Response,
		next: express.NextFunction
	): void => {
		const moduleType = req.params.moduleType as ModuleInstanceType
		const moduleId = req.params.moduleId.replace(/\.\.+/g, '')
		const versionId = req.params.versionId
		const file = req.params.path?.join('/')?.replace(/\.\.+/g, '')

		const moduleInfo = this.#getModuleMapForType(moduleType).get(moduleId)?.getVersion(versionId)
		if (moduleInfo && moduleInfo.helpPath && moduleInfo.basePath) {
			const basePath = path.join(moduleInfo.basePath, 'companion')
			if (file.match(/\.(jpe?g|gif|png|pdf|companionconfig|md)$/)) {
				// Send the file, then stop
				res.sendFile(file, {
					root: basePath, // This is needed to prevent path traversal, and because this could be inside a dotfile
				})
				return
			}
		}

		// Try next handler
		next()
	}
}
