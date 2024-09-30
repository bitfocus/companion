import LogController from '../Log/Controller.js'
import path from 'path'
import fs from 'fs-extra'
import type { InstanceModules } from './Modules.js'
import type { AppInfo } from '../Registry.js'
import type { ClientSocket } from '../UI/Handler.js'
import { DataDatabase } from '../Data/Database.js'
import type { UserModuleEntry } from '@companion-app/shared/Model/UserModules.js'
import zlib from 'node:zlib'
import * as ts from 'tar-stream'
import { Readable } from 'node:stream'
import { ModuleManifest } from '@companion-module/base'
import * as tarfs from 'tar-fs'
import { head } from 'lodash-es'
import { EventEmitter } from 'node:events'

interface InstalledModulesEvents {
	installed: [moduleDir: string, manifest: ModuleManifest]
}

export class InstanceInstalledModulesManager extends EventEmitter {
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

	/**
	 * The directory store fetched modules will be stored in
	 */
	get storeModulesDir(): string {
		return this.#storeModulesDir
	}

	/**
	 * The directory user loaded modules will be stored in
	 */
	get customModulesDir(): string {
		return this.#customModulesDir
	}

	constructor(modulesManager: InstanceModules, db: DataDatabase, appInfo: AppInfo) {
		super()

		this.#modulesManager = modulesManager
		this.#db = db
		this.#storeModulesDir = path.join(appInfo.configDir, 'store-modules')
		this.#customModulesDir = path.join(appInfo.configDir, 'custom-modules')

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
		// TODO
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

				Readable.from(uncompressedData).pipe(tarfs.extract(moduleDir, { strip: 1 }))
			} catch (e) {
				// cleanup the dir, just to be sure it doesn't get stranded
				await fs.rmdir(moduleDir, { recursive: true }).catch(() => null)
			}

			// Let other interested parties know that a module has been installed
			this.emit('installed', moduleDir, manifestJson)

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
