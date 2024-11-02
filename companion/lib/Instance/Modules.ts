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
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'
import { InstanceModuleScanner } from './ModuleScanner.js'
import type express from 'express'
import type { ModuleManifest } from '@companion-module/base'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { HelpDescription } from '@companion-app/shared/Model/Common.js'
import LogController from '../Log/Controller.js'
import type { InstanceController } from './Controller.js'

const ModulesRoom = 'modules'

export interface ModuleInfo {
	basePath: string
	helpPath: string | null
	display: ModuleDisplayInfo
	manifest: ModuleManifest
	isOverride?: boolean
	isPackaged: boolean
}

export class InstanceModules {
	readonly #logger = LogController.createLogger('Instance/Modules')

	readonly #io: UIHandler
	readonly #instance: InstanceController

	/**
	 * Last module info sent to clients
	 */
	#lastModulesJson: Record<string, ModuleDisplayInfo> | null = null

	/**
	 * Known module info
	 */
	readonly #knownModules = new Map<string, ModuleInfo>()

	/**
	 * Module renames
	 */
	readonly #moduleRenames = new Map<string, string>()

	/**
	 * Module scanner helper
	 */
	readonly #moduleScanner = new InstanceModuleScanner()

	constructor(io: UIHandler, instance: InstanceController, apiRouter: express.Router) {
		this.#io = io
		this.#instance = instance

		apiRouter.get('/help/module/:moduleId/*path', this.#getHelpAsset)
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
			this.#knownModules.set(candidate.manifest.id, candidate)
		}

		// Load modules from other folders in order of priority
		for (const searchDir of searchDirs) {
			const candidates = await this.#moduleScanner.loadInfoForModulesInDir(searchDir, false)
			for (const candidate of candidates) {
				// Replace any existing candidate
				this.#knownModules.set(candidate.manifest.id, candidate)
			}
		}

		if (extraModulePath) {
			this.#logger.info(`Looking for extra modules in: ${extraModulePath}`)
			const candidates = await this.#moduleScanner.loadInfoForModulesInDir(extraModulePath, true)
			for (const candidate of candidates) {
				// Replace any existing candidate
				this.#knownModules.set(candidate.manifest.id, {
					...candidate,
					isOverride: true,
				})
			}

			this.#logger.info(`Found ${candidates.length} extra modules`)
		}

		// Figure out the redirects. We do this afterwards, to ensure we avoid collisions and stuff
		for (const id of Array.from(this.#knownModules.keys()).sort()) {
			const moduleInfo = this.#knownModules.get(id)
			if (moduleInfo && Array.isArray(moduleInfo.manifest.legacyIds)) {
				if (moduleInfo.display.isLegacy) {
					// Handle legacy modules differently. They should never replace a new style one
					for (const legacyId of moduleInfo.manifest.legacyIds) {
						const otherInfo = this.#knownModules.get(legacyId)
						if (!otherInfo || otherInfo.display.isLegacy) {
							// Other is not known or is legacy
							this.#moduleRenames.set(legacyId, id)
							this.#knownModules.delete(legacyId)
						}
					}
				} else {
					// These should replace anything
					for (const legacyId of moduleInfo.manifest.legacyIds) {
						this.#moduleRenames.set(legacyId, id)
						this.#knownModules.delete(legacyId)
					}
				}
			}
		}

		// Log the loaded modules
		for (const id of Array.from(this.#knownModules.keys()).sort()) {
			const moduleInfo = this.#knownModules.get(id)
			if (!moduleInfo) continue

			if (moduleInfo.isOverride) {
				this.#logger.info(
					`${moduleInfo.display.id}@${moduleInfo.display.version}: ${moduleInfo.display.name} (Overridden${
						moduleInfo.isPackaged ? ' & Packaged' : ''
					})`
				)
			} else {
				this.#logger.debug(`${moduleInfo.display.id}@${moduleInfo.display.version}: ${moduleInfo.display.name}`)
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
				`Found new module "${reloadedModule.display.id}" v${reloadedModule.display.version} in: ${fullpath}`
			)

			// Replace any existing module
			this.#knownModules.set(reloadedModule.manifest.id, {
				...reloadedModule,
				isOverride: true,
			})

			const newJson = cloneDeep(this.getModulesJson())

			// Now broadcast to any interested clients
			if (this.#io.countRoomMembers(ModulesRoom) > 0) {
				const oldObj = this.#lastModulesJson?.[reloadedModule.manifest.id]
				if (oldObj) {
					const patch = jsonPatch.compare(oldObj, reloadedModule.display)
					if (patch.length > 0) {
						this.#io.emitToRoom(ModulesRoom, `modules:patch`, {
							type: 'update',
							id: reloadedModule.manifest.id,
							patch,
						})
					}
				} else {
					this.#io.emitToRoom(ModulesRoom, `modules:patch`, {
						type: 'add',
						id: reloadedModule.manifest.id,
						info: reloadedModule.display,
					})
				}
			}

			this.#lastModulesJson = newJson

			// restart usages of this module
			this.#instance.reloadUsesOfModule(reloadedModule.manifest.id)
		} else {
			this.#logger.info(`Failed to find module in: ${fullpath}`)
		}
	}

	/**
	 * Checks whether an instance_type has been renamed
	 * @returns the instance_type that should be used (often the provided parameter)
	 */
	verifyInstanceTypeIsCurrent(instance_type: string): string {
		return this.#moduleRenames.get(instance_type) || instance_type
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
	getModulesJson(): Record<string, ModuleDisplayInfo> {
		const result: Record<string, ModuleDisplayInfo> = {}

		for (const [id, module] of this.#knownModules.entries()) {
			if (module) result[id] = module.display
		}

		return result
	}

	/**
	 *
	 */
	getModuleManifest(moduleId: string): ModuleInfo | undefined {
		return this.#knownModules.get(moduleId)
	}

	/**
	 * Load the help markdown file for a specified moduleId
	 */
	#getHelpForModule = async (
		moduleId: string
	): Promise<[err: string, result: null] | [err: null, result: HelpDescription]> => {
		try {
			const moduleInfo = this.#knownModules.get(moduleId)
			if (moduleInfo && moduleInfo.helpPath) {
				const stats = await fs.stat(moduleInfo.helpPath)
				if (stats.isFile()) {
					const data = await fs.readFile(moduleInfo.helpPath)
					return [
						null,
						{
							markdown: data.toString(),
							baseUrl: `/int/help/module/${moduleId}/`,
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
		req: express.Request<{ moduleId: string; path: string[] }>,
		res: express.Response,
		next: express.NextFunction
	): void => {
		const moduleId = req.params.moduleId.replace(/\.\.+/g, '')
		const file = req.params.path?.join('/')?.replace(/\.\.+/g, '')

		const moduleInfo = this.#knownModules.get(moduleId)
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
