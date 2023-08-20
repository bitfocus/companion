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
import { validateManifest } from '@companion-module/base'
import { fileURLToPath } from 'url'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'

const ModulesRoom = 'modules'

class InstanceModules extends CoreBase {
	#lastModulesJson = null

	constructor(registry) {
		super(registry, 'instance', 'Instance/Modules')

		/** Object of the known modules that can be loaded */
		this.known_modules = {}
		/** Sometimes modules get renamed/merged. This lets that happen */
		this.module_renames = {}

		this.registry.api_router.get('/help/module/:module_id/*', (req, res, next) => {
			const module_id = req.params.module_id.replace(/\.\.+/g, '')
			const file = req.params[0].replace(/\.\.+/g, '')

			const moduleInfo = this.known_modules[module_id]
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
		})
	}

	/**
	 * Initialise instances
	 * @param {string} extraModulePath - extra directory to search for modules
	 */
	async initInstances(extraModulePath) {
		const rootPath = isPackaged() ? path.join(__dirname, '.') : fileURLToPath(new URL('../../', import.meta.url))

		const searchDirs = [
			// Paths to look for modules, lowest to highest priority
			path.resolve(path.join(rootPath, 'bundled-modules')),
		]

		const legacyCandidates = await this.#loadInfoForModulesInDir(path.join(rootPath, '/module-legacy/manifests'), false)

		// Start with 'legacy' candidates
		for (const candidate of legacyCandidates) {
			candidate.display.isLegacy = true
			this.known_modules[candidate.manifest.id] = candidate
		}

		// Load modules from other folders in order of priority
		for (const searchDir of searchDirs) {
			const candidates = await this.#loadInfoForModulesInDir(searchDir, false)
			for (const candidate of candidates) {
				// Replace any existing candidate
				this.known_modules[candidate.manifest.id] = candidate
			}
		}

		if (extraModulePath) {
			this.logger.info(`Looking for extra modules in: ${extraModulePath}`)
			const candidates = await this.#loadInfoForModulesInDir(extraModulePath, true)
			for (const candidate of candidates) {
				// Replace any existing candidate
				this.known_modules[candidate.manifest.id] = {
					...candidate,
					isOverride: true,
				}
			}

			this.logger.info(`Found ${candidates.length} extra modules`)
		}

		// Figure out the redirects. We do this afterwards, to ensure we avoid collisions and stuff
		for (const id of Object.keys(this.known_modules).sort()) {
			const moduleInfo = this.known_modules[id]
			if (moduleInfo && Array.isArray(moduleInfo.manifest.legacyIds)) {
				if (moduleInfo.display.isLegacy) {
					// Handle legacy modules differently. They should never replace a new style one
					for (const legacyId of moduleInfo.manifest.legacyIds) {
						const otherInfo = this.known_modules[legacyId]
						if (!otherInfo || otherInfo.display.isLegacy) {
							// Other is not known or is legacy
							this.module_renames[legacyId] = id
							delete this.known_modules[legacyId]
						}
					}
				} else {
					// These should replace anything
					for (const legacyId of moduleInfo.manifest.legacyIds) {
						this.module_renames[legacyId] = id
						delete this.known_modules[legacyId]
					}
				}
			}
		}

		// Log the loaded modules
		for (const id of Object.keys(this.known_modules).sort()) {
			const moduleInfo = this.known_modules[id]
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

	async reloadExtraModule(fullpath) {
		this.logger.info(`Attempting to reload module in: ${fullpath}`)

		const reloadedModule = await this.#loadInfoForModule(fullpath, true)
		if (reloadedModule) {
			this.logger.info(
				`Found new module "${reloadedModule.display.id}" v${reloadedModule.display.version} in: ${fullpath}`
			)

			// Replace any existing module
			this.known_modules[reloadedModule.manifest.id] = {
				...reloadedModule,
				isOverride: true,
			}

			const newJson = cloneDeep(this.getModulesJson())

			// Now broadcast to any interested clients
			if (this.io.countRoomMembers(ModulesRoom) > 0) {
				const patch = jsonPatch.compare(this.#lastModulesJson || {}, newJson || {})
				if (patch.length > 0) {
					this.io.emitToRoom(ModulesRoom, `modules:patch`, patch)
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
		return this.module_renames[instance_type] || instance_type
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

		client.onPromise('instances:get-help', async (module_id) => {
			try {
				const res = await this.getHelpForModule(module_id)
				if (res) {
					return [null, res]
				} else {
					return ['nofile', null]
				}
			} catch (err) {
				this.logger.silly(`Error loading help for ${module_id}`)
				this.logger.silly(err)
				return ['nofile', null]
			}
		})
	}

	getModulesJson() {
		const result = {}

		for (const [id, module] of Object.entries(this.known_modules)) {
			result[id] = module.display
		}

		return result
	}

	/**
	 *
	 * @access public
	 * @param {string} module_id
	 */
	getModuleManifest(module_id) {
		return this.known_modules[module_id]
	}

	/**
	 * Load the help markdown file for a specified module_id
	 * @access public
	 * @param {string} module_id
	 */
	async getHelpForModule(module_id) {
		const moduleInfo = this.known_modules[module_id]
		if (moduleInfo && moduleInfo.helpPath) {
			const stats = await fs.stat(moduleInfo.helpPath)
			if (stats.isFile()) {
				const data = await fs.readFile(moduleInfo.helpPath)
				return {
					markdown: data.toString(),
					baseUrl: `/int/help/module/${module_id}/`,
				}
			} else {
				this.logger.silly(`Error loading help for ${module_id}`, moduleInfo.helpPath)
				this.logger.silly('Not a file')
				return undefined
			}
		} else {
			return undefined
		}
	}

	/**
	 * Load information about all modules in a directory
	 * @access private
	 * @param {string} searchDir - Path to search for modules
	 * @param {boolean} checkForPackaged - Whether to check for a packaged version
	 */
	async #loadInfoForModulesInDir(searchDir, checkForPackaged) {
		if (await fs.pathExists(searchDir)) {
			const candidates = await fs.readdir(searchDir)

			const ps = []

			for (const candidate of candidates) {
				const candidatePath = path.join(searchDir, candidate)
				ps.push(this.#loadInfoForModule(candidatePath, checkForPackaged))
			}

			const res = await Promise.all(ps)
			return res.filter((v) => !!v)
		} else {
			return []
		}
	}

	/**
	 * Load information about a module
	 * @access private
	 * @param {string} fullpath - Fullpath to the module
	 * @param {boolean} checkForPackaged - Whether to check for a packaged version
	 */
	async #loadInfoForModule(fullpath, checkForPackaged) {
		try {
			let isPackaged = false
			const pkgDir = path.join(fullpath, 'pkg')
			if (
				checkForPackaged &&
				(await fs.pathExists(path.join(fullpath, 'DEBUG-PACKAGED'))) &&
				(await fs.pathExists(pkgDir))
			) {
				fullpath = pkgDir
				isPackaged = true
			}

			const manifestPath = path.join(fullpath, 'companion/manifest.json')
			if (!(await fs.pathExists(manifestPath))) {
				this.logger.silly(`Ignoring "${fullpath}", as it is not a new module`)
				return
			}
			const manifestJsonStr = await fs.readFile(manifestPath)
			const manifestJson = JSON.parse(manifestJsonStr.toString())

			validateManifest(manifestJson)

			const helpPath = path.join(fullpath, 'companion/HELP.md')

			const hasHelp = await fs.pathExists(helpPath)
			const moduleDisplay = {
				id: manifestJson.id,
				name: manifestJson.manufacturer + ': ' + manifestJson.products.join('; '),
				version: manifestJson.version,
				hasHelp: hasHelp,
				bugUrl: manifestJson.bugs || manifestJson.repository,
				shortname: manifestJson.shortname,
				manufacturer: manifestJson.manufacturer,
				products: manifestJson.products,
				keywords: manifestJson.keywords,
			}

			const moduleManifestExt = {
				manifest: manifestJson,
				basePath: path.resolve(fullpath),
				helpPath: hasHelp ? helpPath : null,
				display: moduleDisplay,
				isPackaged: isPackaged,
			}

			this.logger.silly(`found module ${moduleDisplay.id}@${moduleDisplay.version}`)

			return moduleManifestExt
		} catch (e) {
			this.logger.silly(`Error loading module from ${fullpath}`, e)
			this.logger.error(`Error loading module from "${fullpath}": ` + e)
		}
	}
}

export default InstanceModules
