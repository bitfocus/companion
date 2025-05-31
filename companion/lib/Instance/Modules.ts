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
import { cloneDeep } from 'lodash-es'
import { InstanceModuleScanner } from './ModuleScanner.js'
import type express from 'express'
import { type ModuleManifest } from '@companion-module/base'
import type { ClientModuleInfo, ModuleUpgradeToOtherVersion } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import LogController from '../Log/Controller.js'
import type { InstanceController } from './Controller.js'
import jsonPatch from 'fast-json-patch'
import type { ModuleVersionInfo } from './Types.js'
import { InstanceModuleInfo } from './ModuleInfo.js'
import { ModuleStoreService } from './ModuleStore.js'

const ModulesRoom = 'modules'
function ModuleUpgradeToVersionsRoom(moduleId: string): string {
	return `modules-upgrade-to-other:${moduleId}`
}

export class InstanceModules {
	readonly #logger = LogController.createLogger('Instance/Modules')

	/**
	 * The core instance controller
	 */
	readonly #instanceController: InstanceController

	/**
	 * The core interface client
	 */
	readonly #io: UIHandler

	/**
	 * Last module info sent to clients
	 */
	#lastModulesJson: Record<string, ClientModuleInfo> | null = null

	/**
	 * Known module info
	 */
	readonly #knownModules = new Map<string, InstanceModuleInfo>()

	/**
	 * Module scanner helper
	 */
	readonly #moduleScanner = new InstanceModuleScanner()

	/**
	 * Which rooms are active for watching the upgrade to other versions subscription
	 * Note: values are not removed from this, until the subscription data is invalidated
	 */
	readonly #activeModuleUpgradeRooms = new Set<string>()

	readonly #installedModulesDir: string

	constructor(io: UIHandler, instance: InstanceController, apiRouter: express.Router, installedModulesDir: string) {
		this.#io = io
		this.#instanceController = instance
		this.#installedModulesDir = installedModulesDir

		apiRouter.get('/help/module/:moduleId/:versionId/*path', this.#getHelpAsset)
	}

	/**
	 * Parse and init a new module which has just been installed on disk
	 * @param moduleDir Freshly installed module directory
	 * @param manifest The module's manifest
	 */
	async loadInstalledModule(moduleDir: string, manifest: ModuleManifest): Promise<void> {
		this.#logger.info(`New module installed: ${manifest.id}`)

		const loadedModuleInfo = await this.#moduleScanner.loadInfoForModule(moduleDir, false)

		if (!loadedModuleInfo) throw new Error(`Failed to load installed module. Missing from disk at "${moduleDir}"`)
		if (loadedModuleInfo?.manifest.id !== manifest.id)
			throw new Error(`Mismatched module id: ${loadedModuleInfo?.manifest.id} !== ${manifest.id}`)

		// Update the module info
		const moduleInfo = this.#getOrCreateModuleEntry(manifest.id)
		moduleInfo.installedVersions[loadedModuleInfo.versionId] = {
			...loadedModuleInfo,
			isPackaged: true,
		}

		// Notify clients
		this.#emitModuleUpdate(manifest.id)
		this.#invalidateModuleUpgradeRoom(manifest.id)

		// Ensure any modules using this version are started
		await this.#instanceController.reloadUsesOfModule(manifest.id, manifest.version)
	}

	/**
	 * Cleanup any uses of a module, so that it can be removed from disk
	 * @param moduleId The module's id
	 * @param mode Whether the module is a custom or release module
	 * @param versionId The version of the module
	 */
	async uninstallModule(moduleId: string, versionId: string): Promise<void> {
		const moduleInfo = this.#knownModules.get(moduleId)
		if (!moduleInfo) throw new Error('Module not found when removing version')

		delete moduleInfo.installedVersions[versionId]

		// Notify clients
		this.#emitModuleUpdate(moduleId)
		this.#invalidateModuleUpgradeRoom(moduleId)

		// Ensure any modules using this version are started
		await this.#instanceController.reloadUsesOfModule(moduleId, versionId)
	}

	/**
	 *
	 */
	#getOrCreateModuleEntry(id: string): InstanceModuleInfo {
		let moduleInfo = this.#knownModules.get(id)
		if (!moduleInfo) {
			moduleInfo = new InstanceModuleInfo(id)
			this.#knownModules.set(id, moduleInfo)
		}
		return moduleInfo
	}

	/**
	 * Initialise instances
	 * @param extraModulePath - extra directory to search for modules
	 */
	async initInstances(extraModulePath: string): Promise<void> {
		// Add modules from the installed modules directory
		const storeModules = await this.#moduleScanner.loadInfoForModulesInDir(this.#installedModulesDir, true)
		for (const candidate of storeModules) {
			const moduleInfo = this.#getOrCreateModuleEntry(candidate.manifest.id)
			moduleInfo.installedVersions[candidate.versionId] = {
				...candidate,
				isPackaged: true,
			}
		}

		if (extraModulePath) {
			this.#logger.info(`Looking for extra modules in: ${extraModulePath}`)
			const candidates = await this.#moduleScanner.loadInfoForModulesInDir(extraModulePath, true)
			for (const candidate of candidates) {
				const moduleInfo = this.#getOrCreateModuleEntry(candidate.manifest.id)
				moduleInfo.devModule = {
					...candidate,
					versionId: 'dev',
					isBeta: false,
				}
			}

			this.#logger.info(`Found ${candidates.length} extra modules`)
		}

		// Log the loaded modules
		for (const id of Array.from(this.#knownModules.keys()).sort()) {
			const moduleInfo = this.#knownModules.get(id)
			if (!moduleInfo) continue

			if (moduleInfo.devModule) {
				this.#logger.info(
					`${moduleInfo.devModule.display.id}: ${moduleInfo.devModule.display.name} (Dev${
						moduleInfo.devModule.isPackaged ? ' & Packaged' : ''
					})`
				)
			}

			for (const moduleVersion of Object.values(moduleInfo.installedVersions)) {
				if (!moduleVersion) continue
				this.#logger.info(`${moduleVersion.display.id}@${moduleVersion.versionId}: ${moduleVersion.display.name}`)
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
			this.#logger.info(`Found new module ${reloadedModule.display.id}@${reloadedModule.versionId} in: ${fullpath}`)

			// Replace any existing module
			const moduleInfo = this.#getOrCreateModuleEntry(reloadedModule.manifest.id)
			moduleInfo.devModule = {
				...reloadedModule,
				versionId: 'dev',
				isBeta: false,
			}

			this.#emitModuleUpdate(reloadedModule.manifest.id)

			// restart usages of this module
			await this.#instanceController.reloadUsesOfModule(reloadedModule.manifest.id, 'dev')
		} else {
			this.#logger.info(`Failed to find module in: ${fullpath}`)

			let changedModuleId: string | undefined

			// Find the dev module which shares this path, and remove it as an option
			for (const moduleInfo of this.#knownModules.values()) {
				if (moduleInfo.devModule?.basePath === fullpath) {
					moduleInfo.devModule = null
					changedModuleId = moduleInfo.id
					break
				}
			}

			if (changedModuleId) {
				this.#emitModuleUpdate(changedModuleId)

				// restart usages of this module
				await this.#instanceController.reloadUsesOfModule(changedModuleId, 'dev')
			}
		}
	}

	#emitModuleUpdate = (changedModuleId: string): void => {
		const newJson = cloneDeep(this.getModulesJson())

		const newObj = newJson[changedModuleId]

		// Now broadcast to any interested clients
		if (this.#io.countRoomMembers(ModulesRoom) > 0) {
			const oldObj = this.#lastModulesJson?.[changedModuleId]
			if (!newObj) {
				this.#io.emitToRoom(ModulesRoom, `modules:patch`, {
					type: 'remove',
					id: changedModuleId,
				})
			} else if (oldObj) {
				const patch = jsonPatch.compare(oldObj, newObj)
				if (patch.length > 0) {
					this.#io.emitToRoom(ModulesRoom, `modules:patch`, {
						type: 'update',
						id: changedModuleId,
						patch,
					})
				}
			} else {
				this.#io.emitToRoom(ModulesRoom, `modules:patch`, {
					type: 'add',
					id: changedModuleId,
					info: newObj,
				})
			}
		}

		this.#lastModulesJson = newJson
	}

	getLatestVersionOfModule(instance_type: string, allowDev: boolean): string | null {
		const moduleInfo = this.#knownModules.get(instance_type)
		if (!moduleInfo) return null

		if (moduleInfo.devModule && allowDev) return 'dev'

		return moduleInfo.getLatestVersion(false)?.versionId ?? null
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('modules:subscribe', () => {
			client.join(ModulesRoom)

			return this.#lastModulesJson || this.getModulesJson()
		})

		client.onPromise('modules:unsubscribe', () => {
			client.leave(ModulesRoom)
		})

		client.onPromise('modules-upgrade-to-other:subscribe', (moduleId: string) => {
			client.join(ModuleUpgradeToVersionsRoom(moduleId))
			this.#activeModuleUpgradeRooms.add(moduleId)

			// Future: maybe this should be cached, but it may not be worth the cost
			return this.#getModuleUpgradeCandidates(moduleId)
		})

		client.onPromise('modules-upgrade-to-other:unsubscribe', (moduleId: string) => {
			client.leave(ModuleUpgradeToVersionsRoom(moduleId))

			// Note: we could update `this.#activeModuleUpgradeRooms`, here but then we would also need to handle the case where the client disconnects
			// It is simpler to forget about it, and skip the update when it gets invalidated
		})
	}

	listenToStoreEvents(modulesStore: ModuleStoreService) {
		modulesStore.on('storeListUpdated', () => {
			// Invalidate any module upgrade data
			for (const moduleId of this.#activeModuleUpgradeRooms) {
				this.#invalidateModuleUpgradeRoom(moduleId)
			}
		})
	}

	#invalidateModuleUpgradeRoom = (moduleId: string): void => {
		const roomId = ModuleUpgradeToVersionsRoom(moduleId)
		if (this.#io.countRoomMembers(roomId) == 0) {
			// Abort if no clients are listening
			this.#activeModuleUpgradeRooms.delete(moduleId)
			return
		}

		// Compile and emit data
		const newData = this.#getModuleUpgradeCandidates(moduleId)
		this.#io.emitToRoom(roomId, 'modules-upgrade-to-other:data', moduleId, newData)
	}

	/**
	 * Compile a list of modules which a module could be 'upgraded' to
	 */
	#getModuleUpgradeCandidates(moduleId: string): ModuleUpgradeToOtherVersion[] {
		const candidateVersions: ModuleUpgradeToOtherVersion[] = []

		// First, push the store versions of each module
		const cachedStoreInfo = this.#instanceController.modulesStore.getCachedStoreList()
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
		for (const [knownModuleId, knownModuleInfo] of this.#knownModules) {
			if (knownModuleId === moduleId) continue
			const latestVersion = knownModuleInfo.getLatestVersion(false)
			if (!latestVersion) continue

			if (latestVersion.manifest.legacyIds.includes(moduleId)) {
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
	getModulesJson(): Record<string, ClientModuleInfo> {
		const result: Record<string, ClientModuleInfo> = {}

		for (const [id, moduleInfo] of this.#knownModules.entries()) {
			const clientModuleInfo = moduleInfo.toClientJson()
			if (!clientModuleInfo) continue

			result[id] = clientModuleInfo
		}

		return result
	}

	/**
	 * Get the manifest for a module
	 */
	getModuleManifest(moduleId: string, versionId: string | null): ModuleVersionInfo | undefined {
		return this.#knownModules.get(moduleId)?.getVersion(versionId) ?? undefined
	}

	/**
	 * Check whether a module is known and has a version installed
	 */
	hasModule(moduleId: string): boolean {
		return this.#knownModules.has(moduleId)
	}

	/**
	 * Return a module help asset over http
	 */
	#getHelpAsset = (
		req: express.Request<{ moduleId: string; versionId: string; path: string[] }>,
		res: express.Response,
		next: express.NextFunction
	): void => {
		const moduleId = req.params.moduleId.replace(/\.\.+/g, '')
		const versionId = req.params.versionId
		const file = req.params.path?.join('/')?.replace(/\.\.+/g, '')

		const moduleInfo = this.#knownModules.get(moduleId)?.getVersion(versionId)
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
