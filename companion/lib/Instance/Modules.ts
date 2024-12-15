/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import path from 'path'
import { cloneDeep } from 'lodash-es'
import { InstanceModuleScanner } from './ModuleScanner.js'
import type express from 'express'
import { type ModuleManifest } from '@companion-module/base'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import LogController from '../Log/Controller.js'
import type { InstanceController } from './Controller.js'
import jsonPatch from 'fast-json-patch'
import type { ModuleVersionInfo } from './Types.js'
import { InstanceModuleInfo } from './ModuleInfo.js'

const ModulesRoom = 'modules'

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

	// /**
	//  * Module renames
	//  */
	// readonly #moduleRenames = new Map<string, string>()

	/**
	 * Module scanner helper
	 */
	readonly #moduleScanner = new InstanceModuleScanner()

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

		// nocommit redo this
		// // Figure out the redirects. We do this afterwards, to ensure we avoid collisions and circles
		// // TODO - could this have infinite loops?
		// const allModuleEntries = Array.from(this.#knownModules.entries()).sort((a, b) => a[0].localeCompare(b[0]))
		// for (const [id, moduleInfo] of allModuleEntries) {
		// 	for (const moduleVersion of moduleInfo.allVersions) {
		// 		if (moduleVersion && Array.isArray(moduleVersion.manifest.legacyIds)) {
		// 			for (const legacyId of moduleVersion.manifest.legacyIds) {
		// 				const fromEntry = this.#getOrCreateModuleEntry(legacyId)
		// 				fromEntry.replacedByIds.push(id)
		// 			}
		// 		}
		// 		// TODO - is there a risk of a legacy module replacing a modern one?
		// 	}
		// }

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

	/**
	 * Checks whether an instance_type has been renamed
	 * @returns the instance_type that should be used (often the provided parameter)
	 */
	verifyInstanceTypeIsCurrent(instance_type: string): string {
		const moduleInfo = this.#knownModules.get(instance_type)
		if (!moduleInfo || moduleInfo.replacedByIds.length === 0) return instance_type

		// TODO - should this ignore redirects if there are valid versions (that aren't legacy?)

		// TODO - should this handle deeper references?
		// TODO - should this choose one of the ids properly?
		return moduleInfo.replacedByIds[0]
	}

	getLatestVersionOfModule(instance_type: string): string | null {
		const moduleInfo = this.#knownModules.get(instance_type)
		if (!moduleInfo) return null

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
