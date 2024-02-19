import LogController from '../Log/Controller.js'
import path from 'path'
import fs from 'fs-extra'
import { validateManifest } from '@companion-module/base'

export class InstanceModuleScanner {
	#logger = LogController.createLogger('Instance/ModuleScanner')

	/**
	 * Load information about all modules in a directory
	 * @access private
	 * @param {string} searchDir - Path to search for modules
	 * @param {boolean} checkForPackaged - Whether to check for a packaged version
	 * @returns {Promise<import('./Modules.js').ModuleInfo[]>}
	 */
	async loadInfoForModulesInDir(searchDir, checkForPackaged) {
		if (await fs.pathExists(searchDir)) {
			const candidates = await fs.readdir(searchDir)

			const ps = []

			for (const candidate of candidates) {
				const candidatePath = path.join(searchDir, candidate)
				ps.push(this.loadInfoForModule(candidatePath, checkForPackaged))
			}

			const res = await Promise.all(ps)
			// @ts-ignore
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
	async loadInfoForModule(fullpath, checkForPackaged) {
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
				this.#logger.silly(`Ignoring "${fullpath}", as it is not a new module`)
				return
			}
			const manifestJsonStr = await fs.readFile(manifestPath)
			/** @type {import('@companion-module/base').ModuleManifest} */
			const manifestJson = JSON.parse(manifestJsonStr.toString())

			validateManifest(manifestJson)

			const helpPath = path.join(fullpath, 'companion/HELP.md')

			const hasHelp = await fs.pathExists(helpPath)
			/** @type {import('./Modules.js').ModuleDisplayInfo} */
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

			/** @type {import('./Modules.js').ModuleInfo} */
			const moduleManifestExt = {
				manifest: manifestJson,
				basePath: path.resolve(fullpath),
				helpPath: hasHelp ? helpPath : null,
				display: moduleDisplay,
				isPackaged: isPackaged,
			}

			this.#logger.silly(`found module ${moduleDisplay.id}@${moduleDisplay.version}`)

			return moduleManifestExt
		} catch (e) {
			this.#logger.silly(`Error loading module from ${fullpath}`, e)
			this.#logger.error(`Error loading module from "${fullpath}": ` + e)
			return undefined
		}
	}
}
