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
import CoreBase from '../Core/Base.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'
import { InstanceModuleScanner } from './ModuleScanner.js'

const ModulesRoom = 'modules'

/**
 * @typedef {{
 *   basePath: string
 *   helpPath: string | null
 *   display: ModuleDisplayInfo
 *   manifest: import('@companion-module/base').ModuleManifest
 *   isOverride?: boolean
 *   isPackaged: boolean
 * }} ModuleInfo
 */

/**
 * @typedef {import('@companion-app/shared/Model/ModuleInfo.js').ModuleDisplayInfo} ModuleDisplayInfo
 */

class InstanceModules extends CoreBase {
	/**
	 * Last module info sent to clients
	 * @type {Record<string, ModuleDisplayInfo> | null}
	 * @access private
	 */
	#lastModulesJson = null

	/**
	 * Known module info
	 * @type {Map<string, ModuleInfo >}
	 * @access private
	 * @readonly
	 */
	#knownModules = new Map()

	/**
	 * Module renames
	 * @type {Map<string, string>}
	 * @access private
	 * @readonly
	 */
	#moduleRenames = new Map()

	/**
	 * Module scanner helper
	 * @access private
	 * @readonly
	 */
	#moduleScanner = new InstanceModuleScanner()

	/**
	 * @param {import("../Registry.js").default} registry
	 */
	constructor(registry) {
		super(registry, 'Instance/Modules')

		this.registry.api_router.get('/help/module/:moduleId/*', this.#getHelpAsset)
	}

	/**
	 * Initialise instances
	 * @param {string} extraModulePath - extra directory to search for modules
	 */
	async initInstances(extraModulePath) {
		/**
		 * @param {string} subpath
		 * @returns {string}
		 */
		function generatePath(subpath) {
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
			generatePath('module-legacy/manifests'),
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
			this.logger.info(`Looking for extra modules in: ${extraModulePath}`)
			const candidates = await this.#moduleScanner.loadInfoForModulesInDir(extraModulePath, true)
			for (const candidate of candidates) {
				// Replace any existing candidate
				this.#knownModules.set(candidate.manifest.id, {
					...candidate,
					isOverride: true,
				})
			}

			this.logger.info(`Found ${candidates.length} extra modules`)
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
				this.logger.info(
					`${moduleInfo.display.id}@${moduleInfo.display.version}: ${moduleInfo.display.name} (Overridden${
						moduleInfo.isPackaged ? ' & Packaged' : ''
					})`
				)
			} else {
				this.logger.debug(`${moduleInfo.display.id}@${moduleInfo.display.version}: ${moduleInfo.display.name}`)
			}
		}
	}

	/**
	 * Reload modules from developer path
	 * @param {string} fullpath
	 */
	async reloadExtraModule(fullpath) {
		this.logger.info(`Attempting to reload module in: ${fullpath}`)

		const reloadedModule = await this.#moduleScanner.loadInfoForModule(fullpath, true)
		if (reloadedModule) {
			this.logger.info(
				`Found new module "${reloadedModule.display.id}" v${reloadedModule.display.version} in: ${fullpath}`
			)

			// Replace any existing module
			this.#knownModules.set(reloadedModule.manifest.id, {
				...reloadedModule,
				isOverride: true,
			})

			const newJson = cloneDeep(this.getModulesJson())

			// Now broadcast to any interested clients
			if (this.io.countRoomMembers(ModulesRoom) > 0) {
				const oldObj = this.#lastModulesJson?.[reloadedModule.manifest.id]
				if (oldObj) {
					const patch = jsonPatch.compare(oldObj, reloadedModule.display)
					if (patch.length > 0) {
						this.io.emitToRoom(ModulesRoom, `modules:patch`, {
							type: 'update',
							id: reloadedModule.manifest.id,
							patch,
						})
					}
				} else {
					this.io.emitToRoom(ModulesRoom, `modules:patch`, {
						type: 'add',
						id: reloadedModule.manifest.id,
						info: reloadedModule.display,
					})
				}
			}

			this.#lastModulesJson = newJson

			// restart usages of this module
			this.instance.reloadUsesOfModule(reloadedModule.manifest.id)
		} else {
			this.logger.info(`Failed to find module in: ${fullpath}`)
		}
	}

	/**
	 * Checks whether an instance_type has been renamed
	 * @param {string} instance_type
	 * @returns {string} the instance_type that should be used (often the provided parameter)
	 */
	verifyInstanceTypeIsCurrent(instance_type) {
		return this.#moduleRenames.get(instance_type) || instance_type
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
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
	 * @returns {Record<string, ModuleDisplayInfo>}
	 */
	getModulesJson() {
		/** @type {Record<string, ModuleDisplayInfo>} */
		const result = {}

		for (const [id, module] of this.#knownModules.entries()) {
			if (module) result[id] = module.display
		}

		return result
	}

	/**
	 *
	 * @access public
	 * @param {string} moduleId
	 * @return {ModuleInfo | undefined}
	 */
	getModuleManifest(moduleId) {
		return this.#knownModules.get(moduleId)
	}

	/**
	 * Load the help markdown file for a specified moduleId
	 * @access public
	 * @param {string} moduleId
	 * @returns {Promise<[err: string, result: null] | [err: null, result: import('@companion-app/shared/Model/Common.js').HelpDescription]>}
	 */
	#getHelpForModule = async (moduleId) => {
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
					this.logger.silly(`Error loading help for ${moduleId}`, moduleInfo.helpPath)
					this.logger.silly('Not a file')
					return ['nofile', null]
				}
			} else {
				return ['nofile', null]
			}
		} catch (err) {
			this.logger.silly(`Error loading help for ${moduleId}`)
			this.logger.silly(err)
			return ['nofile', null]
		}
	}

	/**
	 * Return a module help asset over http
	 * @param {import('express').Request<{ moduleId:string }>} req
	 * @param {import('express').Response} res
	 * @param {import('express').NextFunction} next
	 * @returns
	 */
	#getHelpAsset = (req, res, next) => {
		const moduleId = req.params.moduleId.replace(/\.\.+/g, '')
		// @ts-ignore
		const file = req.params[0].replace(/\.\.+/g, '')

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

export default InstanceModules
