#!/usr/bin/env zx

import { $, fs, usePowerShell } from 'zx'
import type { components, paths as ModuleStoreOpenApiPaths } from '@companion-app/shared/OpenApi/ModuleStore.js'
import createClient from 'openapi-fetch'
import pQueue from 'p-queue'
import pRetry, { AbortError } from 'p-retry'
import path from 'path'
import {
	isModuleApiVersionCompatible,
	isSurfaceApiVersionCompatible,
} from '@companion-app/shared/ModuleApiVersionCheck.js'
import { generateVersionString } from './lib.mjs'
import crypto from 'crypto'
import { gunzip } from 'zlib'
import { promisify } from 'util'
import { Readable } from 'stream'
import * as tarfs from 'tar-fs'
import { MAX_MODULE_TAR_SIZE } from '../companion/lib/Instance/Constants.js'

const gunzipP = promisify(gunzip)

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

const baseUrl = process.env.STAGING_MODULE_API
	? 'https://developer-staging.bitfocus.io/api'
	: 'https://developer.bitfocus.io/api'

const userAgent = `Companion offline-bundle ${await generateVersionString()}`
const ModuleOpenApiClient = createClient<ModuleStoreOpenApiPaths>({
	baseUrl,
	headers: {
		'User-Agent': userAgent,
	},
})

// prepare a new folder
const offlinePath = path.join(import.meta.dirname, '../offline-bundle')
await fs.rm(offlinePath, { recursive: true, force: true })
await fs.mkdir(offlinePath, { recursive: true })

const { data, error } = await ModuleOpenApiClient.GET('/v1/companion/modules/{moduleType}', {
	params: {
		path: {
			moduleType: 'connection',
		},
	},
})
const { data: dataSurfaces, error: errorSurfaces } = await ModuleOpenApiClient.GET(
	'/v1/companion/modules/{moduleType}',
	{
		params: {
			path: {
				moduleType: 'surface',
			},
		},
	}
)

if (error || errorSurfaces) {
	console.error('Error fetching modules:', error || errorSurfaces)
	process.exit(1)
}

console.log(`Module API reported ${data.modules.length + dataSurfaces.modules.length} modules`)

const moduleQueue = new pQueue({
	concurrency: 10,
})
const processModule = async (
	moduleInfo: components['schemas']['CompanionModuleInfo'],
	moduleType: 'connection' | 'surface',
	isCompatible: (version: string) => boolean,
	dirPrefix?: string
) => {
	if (moduleInfo.deprecationReason) {
		console.log(`Skipping ${moduleInfo.id} (${moduleInfo.deprecationReason})`)
		return
	}

	moduleQueue.add(async () => {
		await pRetry(
			async () => {
				const moduleDir = path.join(offlinePath, (dirPrefix ?? '') + moduleInfo.id)

				// Purge previous attempt
				await fs.rm(moduleDir, { recursive: true, force: true })
				// await fs.mkdir(moduleDir, { recursive: true })

				const { data: moduleInfoData, error } = await ModuleOpenApiClient.GET(
					`/v1/companion/modules/{moduleType}/{moduleName}`,
					{
						params: {
							path: { moduleType: moduleType, moduleName: moduleInfo.id },
						},
					}
				)
				if (error) {
					throw new Error(`Error fetching module ${moduleInfo.id}: ${error}`)
				}
				if (!moduleInfoData) {
					throw new Error(`Module ${moduleInfo.id} not found`)
				}

				// This assumes the modules are ordered with newest first
				const latestCompatibleVersion =
					moduleInfoData.versions.find(
						// Find latest release version
						(version) => isCompatible(version.apiVersion) && version.tarUrl && !version.isPrerelease
					) ||
					moduleInfoData.versions.find(
						// Find latest prerelease version
						(version) => isCompatible(version.apiVersion) && version.tarUrl
					)
				if (!latestCompatibleVersion) {
					console.log('No compatible version found for', moduleInfo.id)
					return
				}

				const tarUrl = latestCompatibleVersion.tarUrl! // Note: asserted in the find above

				const abortControl = new AbortController()
				const response = await fetch(tarUrl, {
					headers: {
						'User-Agent': userAgent,
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
						throw new AbortError('Module is too large to download safely')
					}
					chunks.push(chunk)
				}

				const fullTarBuffer = Buffer.concat(chunks)

				const bufferChecksum = crypto.createHash('sha256').update(fullTarBuffer).digest('hex')
				if (bufferChecksum !== latestCompatibleVersion.tarSha) {
					throw new Error('Download did not match checksum')
				}

				const decompressedData = await gunzipP(fullTarBuffer)
				if (!decompressedData) {
					throw new Error('Failed to decompress data')
				}

				await fs.mkdirp(moduleDir)

				await new Promise((resolve, reject) => {
					Readable.from(decompressedData)
						.pipe(tarfs.extract(moduleDir, { strip: 1 }))
						.on('finish', resolve)
						.on('error', reject)
				})

				console.log(`Fetched ${moduleInfo.id} (${latestCompatibleVersion.id})`)
			},
			{
				retries: 3,
			}
		).catch((err) => {
			throw new Error(`Failed to fetch ${moduleInfo.id}: ${err}`)
		})
	})
}
for (const moduleInfo of data.modules) {
	processModule(moduleInfo, 'connection', isModuleApiVersionCompatible)
}
for (const moduleInfo of dataSurfaces.modules) {
	processModule(moduleInfo, 'surface', isSurfaceApiVersionCompatible, 'surface-')
}

// Wait for all modules to be processed
await moduleQueue.onIdle()

console.log('All modules processed')

await $`tar -czf ${offlinePath + '.tar.gz'} -C ${offlinePath} .`

await fs.rm(offlinePath, { recursive: true, force: true })

console.log('all done!')
