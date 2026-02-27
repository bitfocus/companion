import LogController from '../Log/Controller.js'
import path from 'path'
import fs from 'fs-extra'
import { validateManifest, type ModuleManifest } from '@companion-module/base/manifest'
import {
	validateManifest as validateManifestOld,
	type ModuleManifest as ModuleManifestOld,
} from '@companion-module/base-old'
import type { ConnectionModuleVersionInfo, SomeModuleVersionInfo, SurfaceModuleVersionInfo } from './Types.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import semver from 'semver'
import { assertNever } from '@companion-app/shared/Util.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { SomeModuleManifest } from '@companion-app/shared/Model/ModuleManifest.js'
import { validateSurfaceManifest, type SurfaceModuleManifest } from '@companion-surface/base'

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

			// Parse the manifest based on the type
			if (manifestJson.type === undefined) {
				return await this.#parseConnectionManifest(manifestJson, fullpath, isPackaged)
			} else if (manifestJson.type === 'connection') {
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
				return await this.#parseConnectionV2Manifest(manifestJson as ModuleManifest, fullpath, isPackaged)
			} else if (manifestJson.type === 'surface') {
				return await this.#parseSurfaceManifest(manifestJson, fullpath, isPackaged)
			} else {
				assertNever(manifestJson.type)
				throw new Error(`Unknown module type "${manifestJson.type}" in manifest`)
			}
		} catch (e) {
			this.#logger.silly(`Error loading module from ${fullpath}`, e)
			this.#logger.error(`Error loading module from "${fullpath}": ` + e)
			return undefined
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

		let products = manifestJson.products.map((p) => `${manifestJson.manufacturer}: ${p}`)
		if (products.length === 0) {
			products = [manifestJson.manufacturer]
		}

		const moduleDisplay: ModuleDisplayInfo = {
			id: manifestJson.id,
			name: products.join('; '),
			// version: manifestJson.version,
			helpPath: getHelpPathForInstalledModule(ModuleInstanceType.Connection, manifestJson.id, manifestJson.version),
			bugUrl: manifestJson.bugs || manifestJson.repository,
			shortname: manifestJson.shortname,
			products: products,
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

		let products = manifestJson.products.map((p) => `${manifestJson.manufacturer}: ${p}`)
		if (products.length === 0) {
			products = [manifestJson.manufacturer]
		}

		const moduleDisplay: ModuleDisplayInfo = {
			id: manifestJson.id,
			name: products.join('; '),
			// version: manifestJson.version,
			helpPath: getHelpPathForInstalledModule(ModuleInstanceType.Connection, manifestJson.id, manifestJson.version),
			bugUrl: manifestJson.bugs || manifestJson.repository,
			shortname: manifestJson.shortname,
			products: products,
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
			name: manifestJson.products.join('; '),
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
