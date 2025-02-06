import LogController from '../Log/Controller.js'
import path from 'path'
import fs from 'fs-extra'
import { ModuleManifest, validateManifest } from '@companion-module/base'
import type { ModuleVersionInfo } from './Types.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'

export class InstanceModuleScanner {
	readonly #logger = LogController.createLogger('Instance/ModuleScanner')

	/**
	 * Load information about all modules in a directory
	 * @access private
	 * @param searchDir - Path to search for modules
	 * @param checkForPackaged - Whether to check for a packaged version
	 */
	async loadInfoForModulesInDir(searchDir: string, checkForPackaged: boolean): Promise<ModuleVersionInfo[]> {
		if (await fs.pathExists(searchDir)) {
			const candidates = await fs.readdir(searchDir)

			const ps: Promise<ModuleVersionInfo | undefined>[] = []

			for (const candidate of candidates) {
				const candidatePath = path.join(searchDir, candidate)
				ps.push(this.loadInfoForModule(candidatePath, checkForPackaged))
			}

			const res = await Promise.all(ps)
			return res.filter((v) => !!v)
		} else {
			return []
		}
	}

	/**
	 * Load information about a module
	 * @param fullpath - Fullpath to the module
	 * @param checkForPackaged - Whether to check for a packaged version
	 */
	async loadInfoForModule(fullpath: string, checkForPackaged: boolean): Promise<ModuleVersionInfo | undefined> {
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
			const manifestJson: ModuleManifest = JSON.parse(manifestJsonStr.toString())

			validateManifest(manifestJson, true)

			const helpPath = path.join(fullpath, 'companion/HELP.md')
			const isLegacyPath = path.join(fullpath, '.is-legacy') // TODO - provide for modules

			const hasHelp = await fs.pathExists(helpPath)
			const isLegacy = await fs.pathExists(isLegacyPath)

			const moduleDisplay: ModuleDisplayInfo = {
				id: manifestJson.id,
				name: manifestJson.manufacturer + ': ' + manifestJson.products.join('; '),
				// version: manifestJson.version,
				helpPath: getHelpPathForInstalledModule(manifestJson.id, manifestJson.version),
				bugUrl: manifestJson.bugs || manifestJson.repository,
				shortname: manifestJson.shortname,
				manufacturer: manifestJson.manufacturer,
				products: manifestJson.products,
				keywords: manifestJson.keywords,
			}

			const moduleManifestExt: ModuleVersionInfo = {
				versionId: manifestJson.version,
				manifest: manifestJson,
				basePath: path.resolve(fullpath),
				helpPath: hasHelp ? helpPath : null,
				display: moduleDisplay,
				isPackaged: isPackaged,
				isLegacy: isLegacy,
				isBeta: !!manifestJson.isPrerelease,
			}

			this.#logger.silly(`found module ${moduleDisplay.id}@${manifestJson.version}`)

			return moduleManifestExt
		} catch (e) {
			this.#logger.silly(`Error loading module from ${fullpath}`, e)
			this.#logger.error(`Error loading module from "${fullpath}": ` + e)
			return undefined
		}
	}
}

export function getHelpPathForInstalledModule(moduleId: string, versionId: string) {
	return `/int/help/module/${moduleId}/${versionId}/HELP.md`
}
