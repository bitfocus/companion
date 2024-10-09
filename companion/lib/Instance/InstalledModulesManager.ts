import LogController from '../Log/Controller.js'
import path from 'path'
import fs from 'fs-extra'
import type { InstanceModules } from './Modules.js'
import type { ClientSocket } from '../UI/Handler.js'
import { DataDatabase } from '../Data/Database.js'
import type { UserModuleEntry } from '@companion-app/shared/Model/UserModules.js'
import zlib from 'node:zlib'
import * as ts from 'tar-stream'
import { Readable } from 'node:stream'
import { ModuleManifest } from '@companion-module/base'
import * as tarfs from 'tar-fs'
import type { ModuleDirs } from './types.js'

export class InstanceInstalledModulesManager {
	readonly #logger = LogController.createLogger('Instance/UserModulesManager')

	/**
	 */
	readonly #db: DataDatabase

	/**
	 */
	readonly #modulesManager: InstanceModules

	/**
	 * Absolute path for storing store modules on disk
	 */
	readonly #storeModulesDir: string

	/**
	 * Absolute path for storing custom modules on disk
	 */
	readonly #customModulesDir: string

	/**
	 */
	#store: UserModuleEntry[]

	constructor(modulesManager: InstanceModules, db: DataDatabase, dirs: ModuleDirs) {
		this.#modulesManager = modulesManager
		this.#db = db
		this.#storeModulesDir = dirs.storeModulesDir
		this.#customModulesDir = dirs.customModulesDir

		this.#store = db.getKey('user-modules', [])
	}

	/**
	 * Initialise the user modules manager
	 */
	async init() {
		await fs.mkdirp(this.#storeModulesDir)
		await fs.mkdirp(this.#customModulesDir)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('modules:install-custom-module', async (data) => {
			console.log('modules:install-custom-module', data)

			if (!(data instanceof Uint8Array)) return 'Invalid data. Expected UInt8Array'

			// TODO - error handling for this whole function

			const uncompressedData = await new Promise<Buffer>((resolve, reject) =>
				zlib.gunzip(data, (err, result) => {
					if (err) reject(err)
					else resolve(result)
				})
			)
			if (!uncompressedData) return 'Failed to uncompress data'

			const manifestStr = await extractManifestFromTar(uncompressedData)
			if (!manifestStr) return "Doesn't look like a valid module, missing manifest"

			const manifestJson: ModuleManifest = JSON.parse(manifestStr)
			console.log('manifest', manifestJson)

			const moduleDir = path.join(this.#customModulesDir, `${manifestJson.id}-${manifestJson.version}`)
			if (fs.existsSync(moduleDir)) return `Module ${manifestJson.id} v${manifestJson.version} already exists`

			try {
				await fs.mkdirp(moduleDir)

				await new Promise((resolve) => {
					Readable.from(uncompressedData)
						.pipe(tarfs.extract(moduleDir, { strip: 1 }))
						.on('finish', resolve)
				})

				console.log('extracted to', moduleDir)
			} catch (e) {
				// cleanup the dir, just to be sure it doesn't get stranded
				await fs.rm(moduleDir, { recursive: true }).catch(() => null)
			}

			// Let other interested parties know that a module has been installed
			await this.#modulesManager.loadInstalledModule(moduleDir, 'custom', manifestJson)

			return null
		})

		client.onPromise('modules:uninstall-custom-module', async (moduleId, versionId) => {
			console.log('modules:uninstall-custom-module', moduleId, versionId)

			const moduleDir = path.join(this.#customModulesDir, `${moduleId}-${versionId}`)
			if (!fs.existsSync(moduleDir)) return `Module ${moduleId} v${versionId} doesn't exist`

			// Stop any usages of the module
			await this.#modulesManager.uninstallModule(moduleId, 'custom', versionId)

			// Delete the module code
			await fs.rm(moduleDir, { recursive: true }).catch(() => null)

			return null
		})

		client.onPromise('modules:uninstall-store-module', async (moduleId, versionId) => {
			console.log('modules:uninstall-store-module', moduleId, versionId)

			const moduleDir = path.join(this.#storeModulesDir, `${moduleId}-${versionId}`)
			if (!fs.existsSync(moduleDir)) return `Module ${moduleId} v${versionId} doesn't exist`

			// Stop any usages of the module
			await this.#modulesManager.uninstallModule(moduleId, 'release', versionId)

			// Delete the module code
			await fs.rm(moduleDir, { recursive: true }).catch(() => null)

			return null
		})
	}
}

async function extractManifestFromTar(tarData: Buffer): Promise<string | null> {
	return new Promise<string | null>((resolve, reject) => {
		const extract = ts.extract()

		let rootDir: string | undefined // Determine the root directory of the tarball

		extract.on('entry', (header, stream, next) => {
			if (rootDir === undefined) {
				// The first entry must be the root directory, we can use that to know what to trim off the other filenames
				// if (header.type !== 'directory') throw new Error('expected first entry to be a directory')
				// TODO: throwing here is BAD, and goes uncaught, we need to make sure that doesn't happen

				rootDir = header.type === 'directory' ? header.name : undefined
			}

			const filename = rootDir && header.name.startsWith(rootDir) ? header.name.slice(rootDir.length) : header.name

			if (filename === 'companion/manifest.json') {
				let dataBuffers: Buffer[] = []

				stream.on('end', () => {
					// The file we need has been found
					resolve(Buffer.concat(dataBuffers).toString('utf8'))

					extract.destroy()

					next() // ready for next entry
				})

				stream.on('data', (data) => {
					dataBuffers.push(data)
				})
			} else {
				// Skip the irrelevant files

				stream.on('end', () => {
					next() // ready for next entry
				})

				stream.resume() // just auto drain the stream
			}
		})

		extract.on('finish', () => {
			// all entries read, if a value hasn't been resolved then the manifest wasn't found
			resolve(null)
		})

		extract.on('error', (err) => {
			reject(err)

			extract.destroy()
		})

		Readable.from(tarData).pipe(extract)
	})
}
