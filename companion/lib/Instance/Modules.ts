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

import fs from 'fs-extra'
import { isPackaged } from '../Resources/Util.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { cloneDeep, compact } from 'lodash-es'
import jsonPatch from 'fast-json-patch'
import { InstanceModuleScanner } from './ModuleScanner.js'
import LogController from '../Log/Controller.js'
import type express from 'express'
import { assertNever, type ModuleManifest } from '@companion-module/base'
import type {
	ModuleDisplayInfo,
	NewClientModuleInfo,
	NewClientModuleVersionInfo,
	NewModuleUseVersion,
} from '@companion-app/shared/Model/ModuleInfo.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { HelpDescription } from '@companion-app/shared/Model/Common.js'
import { InstanceController } from './Controller.js'

const ModulesRoom = 'modules'

export interface ModuleInfo {
	basePath: string
	helpPath: string | null
	display: ModuleDisplayInfo
	manifest: ModuleManifest
	isOverride?: boolean
	isPackaged: boolean
}

export interface NewModuleVersionInfo {
	basePath: string
	helpPath: string | null
	display: ModuleDisplayInfo
	manifest: ModuleManifest
	isPackaged: boolean
	versionId: string
}

class NewModuleInfo {
	id: string

	replacedByIds: string[] = []

	builtinModule: NewModuleVersionInfo | null = null

	devVersions: Record<string, NewModuleVersionInfo | undefined> = {}

	userVersions: Record<string, NewModuleVersionInfo | undefined> = {}

	useVersion: NewModuleUseVersion | null = null

	constructor(id: string) {
		this.id = id
	}

	get allVersions(): NewModuleVersionInfo[] {
		return compact([...Object.values(this.devVersions), ...Object.values(this.userVersions), this.builtinModule])
	}

	getSelectedVersion(): NewModuleVersionInfo | null {
		if (!this.useVersion) return null
		switch (this.useVersion.type) {
			case 'builtin':
				return this.builtinModule
			case 'dev':
				if (!this.useVersion.id) return null
				return this.devVersions[this.useVersion.id] ?? null
			case 'user':
				if (!this.useVersion.id) return null
				return this.userVersions[this.useVersion.id] ?? null
			default:
				assertNever(this.useVersion.type)
				return null
		}
	}

	findVersion(versionId: string | null): NewModuleVersionInfo | null {
		if (versionId == null) return this.getSelectedVersion()

		for (const moduleVersion of this.allVersions) {
			if (moduleVersion && moduleVersion.versionId === versionId) return moduleVersion
		}

		return null
	}
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
	#lastModulesJson: Record<string, NewClientModuleInfo> | null = null

	/**
	 * Known module info
	 */
	readonly #knownModules = new Map<string, NewModuleInfo>()

	// /**
	//  * Module renames
	//  */
	// readonly #moduleRenames = new Map<string, string>()

	/**
	 * Module scanner helper
	 */
	readonly #moduleScanner = new InstanceModuleScanner()

	constructor(io: UIHandler, api_router: express.Router, instance: InstanceController) {
		this.#io = io
		this.#instanceController = instance

		api_router.get('/help/module/:moduleId/:versionId/*', this.#getHelpAsset)
	}

	/**
	 *
	 */
	#getOrCreateModuleEntry(id: string): NewModuleInfo {
		let moduleInfo = this.#knownModules.get(id)
		if (!moduleInfo) {
			moduleInfo = new NewModuleInfo(id)
			this.#knownModules.set(id, moduleInfo)
		}
		return moduleInfo
	}

	/**
	 * Initialise instances
	 * @param extraModulePath - extra directory to search for modules
	 */
	async initInstances(extraModulePath: string): Promise<void> {
		function generatePath(subpath: string): string {
			if (isPackaged()) {
				return path.join(__dirname, subpath)
			} else {
				return fileURLToPath(new URL(path.join('../../..', subpath), import.meta.url))
			}
		}

		const searchDirs = [
			// Paths to look for modules, lowest to highest priority
			path.resolve(generatePath('bundled-modules')),
		]

		const legacyCandidates = await this.#moduleScanner.loadInfoForModulesInDir(
			generatePath('bundled-modules/_legacy'),
			false
		)

		// Start with 'legacy' candidates
		for (const candidate of legacyCandidates) {
			candidate.display.isLegacy = true
			const moduleInfo = this.#getOrCreateModuleEntry(candidate.manifest.id)
			moduleInfo.builtinModule = candidate
		}

		// Load modules from other folders in order of priority
		for (const searchDir of searchDirs) {
			const candidates = await this.#moduleScanner.loadInfoForModulesInDir(searchDir, false)
			for (const candidate of candidates) {
				const moduleInfo = this.#getOrCreateModuleEntry(candidate.manifest.id)
				moduleInfo.builtinModule = candidate
			}
		}

		if (extraModulePath) {
			this.#logger.info(`Looking for extra modules in: ${extraModulePath}`)
			const candidates = await this.#moduleScanner.loadInfoForModulesInDir(extraModulePath, true)
			for (const candidate of candidates) {
				const moduleInfo = this.#getOrCreateModuleEntry(candidate.manifest.id)
				moduleInfo.devVersions['dev'] = {
					...candidate,
					versionId: 'dev', // TODO - allow multiple
				}
			}

			this.#logger.info(`Found ${candidates.length} extra modules`)
		}

		// Figure out the redirects. We do this afterwards, to ensure we avoid collisions and circles
		// TODO - could this have infinite loops?
		const allModuleEntries = Array.from(this.#knownModules.entries()).sort((a, b) => a[0].localeCompare(b[0]))
		for (const [id, moduleInfo] of allModuleEntries) {
			for (const moduleVersion of moduleInfo.allVersions) {
				if (moduleVersion && Array.isArray(moduleVersion.manifest.legacyIds)) {
					for (const legacyId of moduleVersion.manifest.legacyIds) {
						const fromEntry = this.#getOrCreateModuleEntry(legacyId)
						fromEntry.replacedByIds.push(id)
					}
				}
				// TODO - is there a risk of a legacy module replacing a modern one?
			}
		}

		// /**
		//  *
		//  * @param {[id: string, NewModuleVersionInfo | undefined][]} versions
		//  * @returns {string | null}
		//  */
		// function chooseBestVersion(versions) {
		// 	const versionStrings = versions.map((ver) => ver[0])
		// 	if (versionStrings.length <= 1) return versionStrings[0] ?? null

		// 	versionStrings.sort((a, b) => {
		// 		const a2 = semver.parse(a)
		// 		if (!a2) return 1

		// 		const b2 = semver.parse(b)
		// 		if (!b2) return -1

		// 		return a2.compare(b2)
		// 	})

		// 	return versionStrings[0]
		// }

		// Choose the version of each to use
		for (const [_id, moduleInfo] of allModuleEntries) {
			if (moduleInfo.replacedByIds.length > 0) continue

			const firstDevVersion = Object.keys(moduleInfo.devVersions)[0]
			if (firstDevVersion) {
				// TODO - properly
				moduleInfo.useVersion = {
					type: 'dev',
					id: firstDevVersion,
				}
				continue
			}

			const firstUserVersion = Object.keys(moduleInfo.userVersions)[0]
			if (firstUserVersion) {
				// TODO - properly
				moduleInfo.useVersion = {
					type: 'user',
					id: firstUserVersion,
				}
				continue
			}

			if (moduleInfo.builtinModule) {
				moduleInfo.useVersion = { type: 'builtin' }
				continue
			}
		}

		// Log the loaded modules
		for (const id of Array.from(this.#knownModules.keys()).sort()) {
			const moduleInfo = this.#knownModules.get(id)
			if (!moduleInfo || !moduleInfo.useVersion) continue

			const moduleVersion = moduleInfo.getSelectedVersion()
			if (!moduleVersion) continue

			if (moduleInfo.useVersion.type === 'dev') {
				this.#logger.info(
					`${moduleVersion.display.id}@${moduleVersion.display.version}: ${moduleVersion.display.name} (Overridden${
						moduleVersion.isPackaged ? ' & Packaged' : ''
					})`
				)
			} else {
				this.#logger.debug(
					`${moduleVersion.display.id}@${moduleVersion.display.version}: ${moduleVersion.display.name}`
				)
			}
		}
	}

	/**
	 * Reload modules from developer path
	 */
	async reloadExtraModule(fullpath: string): Promise<void> {
		this.#logger.info(`Attempting to reload module in: ${fullpath}`)

		// nocommit redo this

		// const reloadedModule = await this.#moduleScanner.loadInfoForModule(fullpath, true)
		// if (reloadedModule) {
		// 	this.#logger.info(
		// 		`Found new module "${reloadedModule.display.id}" v${reloadedModule.display.version} in: ${fullpath}`
		// 	)

		// 	// Replace any existing module
		// 	this.#knownModules.set(reloadedModule.manifest.id, {
		// 		...reloadedModule,
		// 		isOverride: true,
		// 	})

		// 	const newJson = cloneDeep(this.getModulesJson())

		// 	// Now broadcast to any interested clients
		// 	if (this.#io.countRoomMembers(ModulesRoom) > 0) {
		// 		const oldObj = this.#lastModulesJson?.[reloadedModule.manifest.id]
		// 		if (oldObj) {
		// 			const patch = jsonPatch.compare(oldObj, reloadedModule.display)
		// 			if (patch.length > 0) {
		// 				this.#io.emitToRoom(ModulesRoom, `modules:patch`, {
		// 					type: 'update',
		// 					id: reloadedModule.manifest.id,
		// 					patch,
		// 				})
		// 			}
		// 		} else {
		// 			this.#io.emitToRoom(ModulesRoom, `modules:patch`, {
		// 				type: 'add',
		// 				id: reloadedModule.manifest.id,
		// 				info: reloadedModule.display,
		// 			})
		// 		}
		// 	}

		// 	this.#lastModulesJson = newJson

		// 	// restart usages of this module
		// 	this.#instanceController.reloadUsesOfModule(reloadedModule.manifest.id)
		// } else {
		// 	this.#logger.info(`Failed to find module in: ${fullpath}`)
		// }
	}

	/**
	 * Checks whether an instance_type has been renamed
	 * @returns the instance_type that should be used (often the provided parameter)
	 */
	verifyInstanceTypeIsCurrent(instance_type: string): string {
		const moduleInfo = this.#knownModules.get(instance_type)
		if (!moduleInfo || moduleInfo.replacedByIds.length === 0) return instance_type

		// TODO - should this handle deeper references?
		// TODO - should this choose one of the ids properly?
		return moduleInfo.replacedByIds[0]
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

		client.onPromise('connections:get-help', this.#getHelpForModule)
	}

	/**
	 * Get display version of module infos
	 */
	getModulesJson(): Record<string, NewClientModuleInfo> {
		const result: Record<string, NewClientModuleInfo> = {}

		function translateVersion(
			version: NewModuleVersionInfo,
			type: NewModuleUseVersion['type']
		): NewClientModuleVersionInfo {
			return {
				version: version.versionId,
				isLegacy: version.display.isLegacy ?? false,
				type,
				hasHelp: !!version.helpPath,
			}
		}

		for (const [id, module] of this.#knownModules.entries()) {
			const moduleVersion = module.getSelectedVersion()
			if (moduleVersion) {
				result[id] = {
					baseInfo: moduleVersion.display,
					selectedVersion: translateVersion(moduleVersion, module.useVersion?.type ?? 'builtin'),
					allVersions: compact([
						module.builtinModule ? translateVersion(module.builtinModule, 'builtin') : undefined,
						...Object.values(module.userVersions).map((ver) => ver && translateVersion(ver, 'user')),
						...Object.values(module.devVersions).map((ver) => ver && translateVersion(ver, 'dev')),
					]),
				}
			}
		}

		return result
	}

	/**
	 *
	 */
	getModuleManifest(moduleId: string): ModuleInfo | undefined {
		return this.#knownModules.get(moduleId)?.getSelectedVersion() ?? undefined
	}

	/**
	 * Load the help markdown file for a specified moduleId
	 */
	#getHelpForModule = async (
		moduleId: string,
		versionId: string | null
	): Promise<[err: string, result: null] | [err: null, result: HelpDescription]> => {
		try {
			const moduleInfo = this.#knownModules.get(moduleId)?.findVersion(versionId)
			if (moduleInfo && moduleInfo.helpPath) {
				const stats = await fs.stat(moduleInfo.helpPath)
				if (stats.isFile()) {
					const data = await fs.readFile(moduleInfo.helpPath)
					return [
						null,
						{
							markdown: data.toString(),
							baseUrl: `/int/help/module/${moduleId}/${versionId ?? 'current'}`,
						},
					]
				} else {
					this.#logger.silly(`Error loading help for ${moduleId}`, moduleInfo.helpPath)
					this.#logger.silly('Not a file')
					return ['nofile', null]
				}
			} else {
				return ['nofile', null]
			}
		} catch (err) {
			this.#logger.silly(`Error loading help for ${moduleId}`)
			this.#logger.silly(err)
			return ['nofile', null]
		}
	}

	/**
	 * Return a module help asset over http
	 */
	#getHelpAsset = (
		req: express.Request<{ moduleId: string; versionId: string }>,
		res: express.Response,
		next: express.NextFunction
	): void => {
		const moduleId = req.params.moduleId.replace(/\.\.+/g, '')
		const versionId = req.params.versionId
		// @ts-ignore
		const file = req.params[0].replace(/\.\.+/g, '')

		const moduleInfo = this.#knownModules.get(moduleId)?.findVersion(versionId === 'current' ? null : versionId) // TODO - better selection
		if (moduleInfo && moduleInfo.helpPath && moduleInfo.basePath) {
			const fullpath = path.join(moduleInfo.basePath, 'companion', file)
			if (file.match(/\.(jpe?g|gif|png|pdf|companionconfig)$/) && fs.existsSync(fullpath)) {
				// Send the file, then stop
				res.sendFile(fullpath)
				return
			}
		}

		// Try next handler
		next()
	}
}
