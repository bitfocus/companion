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
import type { ModuleStoreService } from './ModuleStore.js'
import { promisify } from 'util'

const gunzipP = promisify(zlib.gunzip)

const MAX_MODULE_TAR_SIZE = 1024 * 1024 * 10 // 50MB

export class InstanceInstalledModulesManager {
	readonly #logger = LogController.createLogger('Instance/UserModulesManager')

	/**
	 */
	readonly #db: DataDatabase

	/**
	 */
	readonly #modulesManager: InstanceModules

	readonly #modulesStore: ModuleStoreService

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

	constructor(modulesManager: InstanceModules, modulesStore: ModuleStoreService, db: DataDatabase, dirs: ModuleDirs) {
		this.#modulesManager = modulesManager
		this.#modulesStore = modulesStore
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
			this.#logger.debug('modules:install-custom-module', data)

			if (!(data instanceof Uint8Array)) return 'Invalid data. Expected UInt8Array'

			// TODO - error handling for this whole function

			const decompressedData = await gunzipP(data)
			if (!decompressedData) {
				this.#logger.warn(`Failed to decompress module data`)
				return 'Failed to decompress data'
			}

			const manifestJson = await extractManifestFromTar(decompressedData).catch((e) => {
				this.#logger.error(`Failed to extract manifest from module`, e)
			})
			if (!manifestJson) {
				this.#logger.warn(`Failed to find manifest in module archive`)
				return "Doesn't look like a valid module, missing manifest"
			}

			const moduleDir = path.join(this.#customModulesDir, `${manifestJson.id}-${manifestJson.version}`)
			if (fs.existsSync(moduleDir)) {
				this.#logger.warn(`Module ${manifestJson.id} v${manifestJson.version} already exists on disk`)
				return `Module ${manifestJson.id} v${manifestJson.version} already exists`
			}

			return this.#installModuleFromTarBuffer('custom', moduleDir, manifestJson, decompressedData)
		})

		client.onPromise('modules:uninstall-custom-module', async (moduleId, versionId) => {
			return this.#uninstallModule('custom', this.#customModulesDir, moduleId, versionId)
		})

		client.onPromise('modules:install-store-module', async (moduleId, moduleVersion) => {
			this.#logger.debug('modules:install-store-module', moduleId, moduleVersion)

			this.#logger.info(`Installing ${moduleId} v${moduleVersion} from store`)

			const moduleDir = path.join(this.#storeModulesDir, `${moduleId}-${moduleVersion}`)
			if (fs.existsSync(moduleDir)) {
				this.#logger.warn(`Module ${moduleId} v${moduleVersion} already exists on disk`)
				return `Module ${moduleId} v${moduleVersion} already exists`
			}

			const versionInfo = this.#modulesStore.getModuleVersionInfo(moduleId, moduleVersion)
			if (!versionInfo) {
				this.#logger.warn(`Unable to install ${moduleId} v${moduleVersion}, it is not known in the store`)
				return `Module ${moduleId} v${moduleVersion} not found`
			}

			if (!versionInfo.tarUrl) throw new Error('Module version info is missing tarUrl')

			const timeBeforeDownload = Date.now()

			const abortControl = new AbortController()
			const response = await fetch(versionInfo.tarUrl, {
				headers: {
					'User-Agent': 'Companion', // TODO - fill out more
				},
				signal: abortControl.signal,
			})
			if (!response.body) throw new Error('Failed to fetch module, got no body')

			// Download into memory with a size limit
			const chunks: Uint8Array[] = []
			let bytesReceived = 0
			for await (const chunk of response.body as ReadableStream<Uint8Array>) {
				bytesReceived += chunk.byteLength
				if (bytesReceived > MAX_MODULE_TAR_SIZE) {
					abortControl.abort()
					throw new Error(`Module too large to download safely`)
				}
				chunks.push(chunk)
			}

			this.#logger.info(
				`Downloaded ${moduleId} v${moduleVersion} in ${Date.now() - timeBeforeDownload}ms (${bytesReceived} bytes)`
			)

			const decompressedData = await gunzipP(Buffer.concat(chunks))
			if (!decompressedData) {
				this.#logger.error(`Failed to decompress module data`)
				return 'Failed to decompress data'
			}

			const manifestJson = await extractManifestFromTar(decompressedData).catch((e) => {
				this.#logger.error(`Failed to extract manifest from module`, e)
			})
			if (!manifestJson) {
				this.#logger.warn(`Failed to find manifest in module archive`)
				return "Doesn't look like a valid module, missing manifest"
			}

			if (manifestJson.name !== moduleId || manifestJson.version !== moduleVersion) {
				this.#logger.warn('Module manifest does not match requested module')
				return 'Module manifest does not match requested module'
			}

			return this.#installModuleFromTarBuffer('release', moduleDir, manifestJson, decompressedData)
		})

		client.onPromise('modules:uninstall-store-module', async (moduleId, versionId) => {
			return this.#uninstallModule('release', this.#storeModulesDir, moduleId, versionId)
		})
	}

	async #installModuleFromTarBuffer(
		type: 'release' | 'custom',
		moduleDir: string,
		manifestJson: ModuleManifest,
		uncompressedData: Buffer
	): Promise<string | null> {
		try {
			await fs.mkdirp(moduleDir)

			await new Promise((resolve, reject) => {
				Readable.from(uncompressedData)
					.pipe(tarfs.extract(moduleDir, { strip: 1 }))
					.on('finish', resolve)
					.on('error', reject)
			})

			console.log('extracted to', moduleDir)
		} catch (e) {
			// cleanup the dir, just to be sure it doesn't get stranded
			await fs.rm(moduleDir, { recursive: true }).catch(() => null)
		}

		this.#logger.info(`Installed module ${manifestJson.id} v${manifestJson.version}`)

		// Let other interested parties know that a module has been installed
		await this.#modulesManager.loadInstalledModule(moduleDir, type, manifestJson)

		return null
	}

	async #uninstallModule(
		type: 'release' | 'custom',
		modulesDir: string,
		moduleId: string,
		versionId: string
	): Promise<string | null> {
		this.#logger.info(`Uninstalling ${type} ${moduleId} v${versionId}`)

		try {
			const moduleDir = path.join(modulesDir, `${moduleId}-${versionId}`)
			if (!fs.existsSync(moduleDir)) return `Module ${moduleId} v${versionId} doesn't exist`

			// Stop any usages of the module
			await this.#modulesManager.uninstallModule(moduleId, type, versionId)

			// Delete the module code
			await fs.rm(moduleDir, { recursive: true }).catch(() => null)
		} catch (_e) {
			this.#logger.error(`Error uninstalling module`, _e)
			return 'Internal error uninstalling module'
		}

		return null
	}
}

async function extractManifestFromTar(tarData: Buffer): Promise<ModuleManifest | null> {
	return new Promise<ModuleManifest | null>((resolve, reject) => {
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
					const manifestStr = Buffer.concat(dataBuffers).toString('utf8')

					try {
						resolve(JSON.parse(manifestStr))
					} catch (e) {
						reject(e)
					}

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
