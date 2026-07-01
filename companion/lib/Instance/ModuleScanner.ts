import path from 'node:path'
import fs from 'fs-extra'
import semver from 'semver'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { SomeModuleManifest } from '@companion-app/shared/Model/ModuleManifest.js'
import { assertNever } from '@companion-app/shared/Util.js'
import {
	validateManifest as validateManifestOld,
	type ModuleManifest as ModuleManifestOld,
} from '@companion-module/base-old'
import { validateManifest, type ModuleManifest } from '@companion-module/base/manifest'
import { validateSurfaceManifest, type SurfaceModuleManifest } from '@companion-surface/base'
import LogController from '../Log/Controller.js'
import type { ConnectionModuleVersionInfo, SomeModuleVersionInfo, SurfaceModuleVersionInfo } from './Types.js'

export class InstanceModuleScanner {
	readonly #logger = LogController.createLogger('Instance/ModuleScanner')

	/**
	 * Load information about all modules in a directory
	 * @access private
	 * @param searchDir - Path to search for modules
	 * @param checkForPackaged - Whether to check for a packaged version
	 */
	async loadInfoForModulesInDir(searchDir: string, checkForPackaged: boolean): Promise<SomeModuleVersionInfo[]> {
		if (await fs.pathExists(searchDir)) {
			const candidates = await fs.readdir(searchDir)

			const ps: Promise<SomeModuleVersionInfo | undefined>[] = []

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
	async loadInfoForModule(fullpath: string, checkForPackaged: boolean): Promise<SomeModuleVersionInfo | undefined> {
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
			const manifestJson: SomeModuleManifest = JSON.parse(manifestJsonStr.toString())
			const manifestType = manifestJson.type

			// A self-contained build (e.g. produced by `yarn package`) bundles its base library and so declares it as a
			// dependency nowhere, whereas a source checkout always declares it - even before `node_modules` is installed.
			// So a module which doesn't depend on its base library is a packaged build, and its manifest apiVersion can be
			// trusted. This catches builds dropped into the dev folder without the `DEBUG-PACKAGED`/`pkg` layout.
			if (!isPackaged) {
				const baseLibName = manifestType === 'surface' ? '@companion-surface/base' : '@companion-module/base'
				if (!(await this.#moduleDeclaresDependency(fullpath, baseLibName))) {
					isPackaged = true
				}
			}

			// Parse the manifest based on the type
			if (manifestJson.type === undefined) {
				return await this.#parseConnectionManifest(manifestJson, fullpath, isPackaged)
			} else if (manifestJson.type === 'connection') {
				return await this.#parseConnectionV2Manifest(manifestJson as ModuleManifest, fullpath, isPackaged)
			} else if (manifestJson.type === 'surface') {
				return await this.#parseSurfaceManifest(manifestJson, fullpath, isPackaged)
			} else {
				assertNever(manifestJson)
				throw new Error(`Unknown module type "${manifestType}" in manifest`)
			}
		} catch (e) {
			this.#logger.silly(`Error loading module from ${fullpath}`, e)
			this.#logger.error(`Error loading module from "${fullpath}": ` + e)
			return undefined
		}
	}

	/**
	 * Check whether a module's own `package.json` declares the given dependency in any dependency field.
	 * A missing or unparsable `package.json` is treated as not declaring it.
	 */
	async #moduleDeclaresDependency(basePath: string, name: string): Promise<boolean> {
		try {
			const pkg = JSON.parse(await fs.readFile(path.join(basePath, 'package.json'), 'utf-8'))
			return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
		} catch {
			return false
		}
	}

	async #parseConnectionManifest(
		manifestJson: ModuleManifestOld,
		fullpath: string,
		isPackaged: boolean
	): Promise<ConnectionModuleVersionInfo> {
		// Treat as connection manifest if we reach here

		validateManifestOld(manifestJson, true)

		const helpPath = path.join(fullpath, 'companion/HELP.md')
		const hasHelp = await fs.pathExists(helpPath)

		const moduleDisplay: ModuleDisplayInfo = {
			id: manifestJson.id,
			name:
				manifestJson.products.length === 0
					? manifestJson.manufacturer
					: manifestJson.manufacturer + ': ' + manifestJson.products.join('; '),
			// version: manifestJson.version,
			helpPath: getHelpPathForInstalledModule(ModuleInstanceType.Connection, manifestJson.id, manifestJson.version),
			bugUrl: manifestJson.bugs || manifestJson.repository,
			shortname: manifestJson.shortname,
			products:
				manifestJson.products.length === 0
					? [manifestJson.manufacturer]
					: manifestJson.products.map((p) => `${manifestJson.manufacturer}: ${p}`),
			keywords: manifestJson.keywords,
		}

		const moduleManifestExt: ConnectionModuleVersionInfo = {
			type: ModuleInstanceType.Connection,
			versionId: manifestJson.version,
			manifest: {
				...manifestJson,
				type: 'connection',
			},
			basePath: path.resolve(fullpath),
			helpPath: hasHelp ? helpPath : null,
			display: moduleDisplay,
			isPackaged: isPackaged,
			isLegacy: false,
			isBeta: !!manifestJson.isPrerelease,
		}

		// Make sure the versionId is valid semver
		if (!semver.parse(moduleManifestExt.versionId, { loose: true }))
			throw new Error(`Invalid version "${moduleManifestExt.versionId}" `)

		this.#logger.silly(`found module ${moduleDisplay.id}@${manifestJson.version}`)

		return moduleManifestExt
	}

	async #parseConnectionV2Manifest(
		manifestJson: ModuleManifest,
		fullpath: string,
		isPackaged: boolean
	): Promise<ConnectionModuleVersionInfo> {
		// Treat as connection manifest if we reach here

		validateManifest(manifestJson, true)

		const helpPath = path.join(fullpath, 'companion/HELP.md')
		const hasHelp = await fs.pathExists(helpPath)

		let moduleName = manifestJson.name
		if (moduleName === manifestJson.id) {
			moduleName =
				manifestJson.products.length === 0
					? manifestJson.manufacturer
					: manifestJson.manufacturer + ': ' + manifestJson.products.join('; ')
		}

		const moduleDisplay: ModuleDisplayInfo = {
			id: manifestJson.id,
			name: moduleName,
			// version: manifestJson.version,
			helpPath: getHelpPathForInstalledModule(ModuleInstanceType.Connection, manifestJson.id, manifestJson.version),
			bugUrl: manifestJson.bugs || manifestJson.repository,
			shortname: manifestJson.shortname,
			products:
				manifestJson.products.length === 0
					? [manifestJson.manufacturer]
					: manifestJson.products.map((p) => `${manifestJson.manufacturer}: ${p}`),
			keywords: manifestJson.keywords,
		}

		const moduleManifestExt: ConnectionModuleVersionInfo = {
			type: ModuleInstanceType.Connection,
			versionId: manifestJson.version,
			manifest: {
				...manifestJson,
				type: 'connection',
			},
			basePath: path.resolve(fullpath),
			helpPath: hasHelp ? helpPath : null,
			display: moduleDisplay,
			isPackaged: isPackaged,
			isLegacy: false,
			isBeta: !!manifestJson.isPrerelease,
		}

		// Make sure the versionId is valid semver
		if (!semver.parse(moduleManifestExt.versionId, { loose: true }))
			throw new Error(`Invalid version "${moduleManifestExt.versionId}" `)

		this.#logger.silly(`found module ${moduleDisplay.id}@${manifestJson.version}`)

		return moduleManifestExt
	}

	async #parseSurfaceManifest(
		manifestJson: SurfaceModuleManifest,
		fullpath: string,
		isPackaged: boolean
	): Promise<SurfaceModuleVersionInfo> {
		validateSurfaceManifest(manifestJson, true)

		const helpPath = path.join(fullpath, 'companion/HELP.md')
		const hasHelp = await fs.pathExists(helpPath)

		const moduleDisplay: ModuleDisplayInfo = {
			id: manifestJson.id,
			name: manifestJson.name,
			// version: manifestJson.version,
			helpPath: getHelpPathForInstalledModule(ModuleInstanceType.Surface, manifestJson.id, manifestJson.version),
			bugUrl: manifestJson.bugs || manifestJson.repository,
			shortname: manifestJson.id,
			products: manifestJson.products,
			keywords: manifestJson.keywords,
		}

		const moduleManifestExt: SurfaceModuleVersionInfo = {
			type: ModuleInstanceType.Surface,
			versionId: manifestJson.version,
			manifest: manifestJson,
			basePath: path.resolve(fullpath),
			helpPath: hasHelp ? helpPath : null,
			display: moduleDisplay,
			isPackaged: isPackaged,
			isBeta: !!manifestJson.isPrerelease,
			isLegacy: false,
			isBuiltin: false, // Overridden later if needed
		}

		// Make sure the versionId is valid semver
		if (!semver.parse(moduleManifestExt.versionId, { loose: true }))
			throw new Error(`Invalid version "${moduleManifestExt.versionId}" `)

		this.#logger.silly(`found surface module ${moduleDisplay.id}@${manifestJson.version}`)

		return moduleManifestExt
	}
}

export function getHelpPathForInstalledModule(
	moduleType: ModuleInstanceType,
	moduleId: string,
	versionId: string
): string {
	return `/int/help/module/${moduleType}/${moduleId}/${versionId}/HELP.md`
}
