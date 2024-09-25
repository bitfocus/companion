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
import { compact } from 'lodash-es'
import { InstanceModuleScanner } from './ModuleScanner.js'
import LogController from '../Log/Controller.js'
import type express from 'express'
import { type ModuleManifest } from '@companion-module/base'
import type {
	ModuleDisplayInfo,
	ModuleVersionMode,
	NewClientModuleInfo,
	NewClientModuleVersionInfo2,
} from '@companion-app/shared/Model/ModuleInfo.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { HelpDescription } from '@companion-app/shared/Model/Common.js'
import { InstanceController } from './Controller.js'
import semver from 'semver'

const ModulesRoom = 'modules'

export interface ModuleVersionInfoBase {
	basePath: string
	helpPath: string | null
	display: ModuleDisplayInfo
	manifest: ModuleManifest
	isPackaged: boolean
}

export interface ReleaseModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'release'
	releaseType: 'stable' | 'prerelease'
	versionId: string
	isBuiltin: boolean
}
export interface DevModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'dev'
	isPackaged: boolean
}
export interface CustomModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'custom'
	versionId: string
}
export type SomeModuleVersionInfo = ReleaseModuleVersionInfo | DevModuleVersionInfo | CustomModuleVersionInfo

class NewModuleInfo {
	id: string

	replacedByIds: string[] = []

	// builtinModule: ReleaseModuleVersionInfo | null = null

	devModule: DevModuleVersionInfo | null = null

	releaseVersions: Record<string, ReleaseModuleVersionInfo | undefined> = {}
	customVersions: Record<string, CustomModuleVersionInfo | undefined> = {}

	constructor(id: string) {
		this.id = id
	}

	getVersion(versionMode: ModuleVersionMode, versionId: string | null): SomeModuleVersionInfo | null {
		switch (versionMode) {
			case 'stable': {
				if (this.devModule) return this.devModule

				let latest: ReleaseModuleVersionInfo | null = null
				for (const version of Object.values(this.releaseVersions)) {
					if (!version || version.releaseType !== 'stable') continue
					if (!latest || semver.compare(version.display.version, latest.display.version) > 0) {
						latest = version
					}
				}

				return latest
			}
			case 'prerelease': {
				if (this.devModule) return this.devModule

				let latest: ReleaseModuleVersionInfo | null = null
				for (const version of Object.values(this.releaseVersions)) {
					if (!version || version.releaseType !== 'prerelease') continue
					if (!latest || semver.compare(version.display.version, latest.display.version) > 0) {
						latest = version
					}
				}

				return latest
			}
			case 'specific-version':
				return versionId ? (this.releaseVersions[versionId] ?? null) : null
			case 'custom':
				return versionId ? (this.customVersions[versionId] ?? null) : null
			default:
				return null
		}
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

		api_router.get('/help/module/:moduleId/:versionMode/:versionId/*', this.#getHelpAsset)
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

		const legacyCandidates = await this.#moduleScanner.loadInfoForModulesInDir(
			generatePath('bundled-modules/_legacy'),
			false
		)

		// Start with 'legacy' candidates
		for (const candidate of legacyCandidates) {
			candidate.display.isLegacy = true
			const moduleInfo = this.#getOrCreateModuleEntry(candidate.manifest.id)
			moduleInfo.releaseVersions[candidate.display.version] = {
				...candidate,
				type: 'release',
				releaseType: 'stable',
				versionId: candidate.display.version,
				isBuiltin: true,
			}
		}

		// Load bundled modules
		const candidates = await this.#moduleScanner.loadInfoForModulesInDir(
			path.resolve(generatePath('bundled-modules')),
			false
		)
		for (const candidate of candidates) {
			const moduleInfo = this.#getOrCreateModuleEntry(candidate.manifest.id)
			moduleInfo.releaseVersions[candidate.display.version] = {
				...candidate,
				type: 'release',
				releaseType: 'stable',
				versionId: candidate.display.version,
				isBuiltin: true,
			}
		}

		// TODO - search other user dirs

		if (extraModulePath) {
			this.#logger.info(`Looking for extra modules in: ${extraModulePath}`)
			const candidates = await this.#moduleScanner.loadInfoForModulesInDir(extraModulePath, true)
			for (const candidate of candidates) {
				const moduleInfo = this.#getOrCreateModuleEntry(candidate.manifest.id)
				moduleInfo.devModule = {
					...candidate,
					type: 'dev',
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
					`${moduleInfo.devModule.display.id}: ${moduleInfo.devModule.display.name} (Overridden${
						moduleInfo.devModule.isPackaged ? ' & Packaged' : ''
					})`
				)
			}

			for (const moduleVersion of Object.values(moduleInfo.releaseVersions)) {
				if (!moduleVersion) continue
				this.#logger.info(
					`${moduleVersion.display.id}@${moduleVersion.display.version}: ${moduleVersion.display.name}${moduleVersion.isBuiltin ? ' (Builtin)' : ''}`
				)
			}

			for (const moduleVersion of Object.values(moduleInfo.releaseVersions)) {
				if (!moduleVersion) continue
				this.#logger.info(
					`${moduleVersion.display.id}@${moduleVersion.display.version}: ${moduleVersion.display.name} (Custom)`
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

		// TODO - should this ignore redirects if there are valid versions (that aren't legacy?)

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

		client.onPromise('modules:activate-version', (moduleId, versionId) => {
			// TODO
		})
	}

	/**
	 * Get display version of module infos
	 */
	getModulesJson(): Record<string, NewClientModuleInfo> {
		const result: Record<string, NewClientModuleInfo> = {}

		for (const [id, module] of this.#knownModules.entries()) {
			const stableVersion = module.getVersion('stable', null)
			const prereleaseVersion = module.getVersion('prerelease', null)

			const baseVersion =
				stableVersion ??
				prereleaseVersion ??
				Object.values(module.releaseVersions)[0] ??
				Object.values(module.customVersions)[0]
			if (!baseVersion) continue

			result[id] = {
				baseInfo: baseVersion.display,

				hasDevVersion: !!module.devModule,

				stableVersion: translateStableVersion(stableVersion),
				prereleaseVersion: translatePrereleaseVersion(prereleaseVersion),

				releaseVersions: compact(Object.values(module.releaseVersions)).map(translateReleaseVersion),
				customVersions: compact(Object.values(module.customVersions)).map(translateCustomVersion),
			}
		}

		return result
	}

	/**
	 *
	 */
	getModuleManifest(
		moduleId: string,
		versionMode: ModuleVersionMode,
		versionId: string | null
	): SomeModuleVersionInfo | undefined {
		return this.#knownModules.get(moduleId)?.getVersion(versionMode, versionId) ?? undefined
	}

	/**
	 *
	 */
	hasModule(moduleId: string): boolean {
		return this.#knownModules.has(moduleId)
	}

	/**
	 * Load the help markdown file for a specified moduleId
	 */
	#getHelpForModule = async (
		moduleId: string,
		versionMode: ModuleVersionMode,
		versionId: string | null
	): Promise<[err: string, result: null] | [err: null, result: HelpDescription]> => {
		try {
			const moduleInfo = this.#knownModules.get(moduleId)?.getVersion(versionMode, versionId)
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
		req: express.Request<{ moduleId: string; versionMode: ModuleVersionMode; versionId: string }>,
		res: express.Response,
		next: express.NextFunction
	): void => {
		const moduleId = req.params.moduleId.replace(/\.\.+/g, '')
		const versionId = req.params.versionId
		const versionMode = req.params.versionMode
		// @ts-ignore
		const file = req.params[0].replace(/\.\.+/g, '')

		const moduleInfo = this.#knownModules.get(moduleId)?.getVersion(versionMode, versionId)
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

function translateStableVersion(version: SomeModuleVersionInfo | null): NewClientModuleVersionInfo2 | null {
	if (!version) return null
	if (version.type === 'dev') {
		return {
			displayName: 'Latest Stable (Dev)',
			isLegacy: false,
			isDev: true,
			isBuiltin: false,
			hasHelp: version.helpPath !== null,
			version: {
				mode: 'stable',
				id: null,
			},
		}
	} else if (version.type === 'release') {
		return {
			displayName: `Latest Stable (v${version.versionId})`,
			isLegacy: version.display.isLegacy ?? false,
			isDev: false,
			isBuiltin: version.isBuiltin,
			hasHelp: version.helpPath !== null,
			version: {
				mode: 'stable',
				id: null,
			},
		}
	}
	return null
}

function translatePrereleaseVersion(version: SomeModuleVersionInfo | null): NewClientModuleVersionInfo2 | null {
	if (!version) return null
	if (version.type === 'dev') {
		return {
			displayName: 'Latest Prerelease (Dev)',
			isLegacy: false,
			isDev: true,
			isBuiltin: false,
			hasHelp: version.helpPath !== null,
			version: {
				mode: 'prerelease',
				id: null,
			},
		}
	} else if (version.type === 'release') {
		return {
			displayName: `Latest Prerelease (v${version.versionId})`,
			isLegacy: version.display.isLegacy ?? false,
			isDev: false,
			isBuiltin: version.isBuiltin,
			hasHelp: version.helpPath !== null,
			version: {
				mode: 'prerelease',
				id: null,
			},
		}
	}
	return null
}

function translateReleaseVersion(version: ReleaseModuleVersionInfo): NewClientModuleVersionInfo2 {
	return {
		displayName: `v${version.versionId}`,
		isLegacy: version.display.isLegacy ?? false,
		isDev: false,
		isBuiltin: version.isBuiltin,
		hasHelp: version.helpPath !== null,
		version: {
			mode: 'specific-version',
			id: version.versionId,
		},
	}
}

function translateCustomVersion(version: CustomModuleVersionInfo): NewClientModuleVersionInfo2 {
	return {
		displayName: `Custom XXX v${version.versionId}`,
		isLegacy: false,
		isDev: false,
		isBuiltin: false,
		hasHelp: version.helpPath !== null,
		version: {
			mode: 'custom',
			id: version.versionId,
		},
	}
}
