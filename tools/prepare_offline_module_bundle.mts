#!/usr/bin/env zx

import { $, fs, usePowerShell } from 'zx'
import type { paths as ModuleStoreOpenApiPaths } from '@companion-app/shared/OpenApi/ModuleStore.js'
import createClient from 'openapi-fetch'
import pQueue from 'p-queue'
import pRetry, { AbortError } from 'p-retry'
import path from 'path'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import { generateVersionString } from './lib.mjs'
import crypto from 'crypto'
import { gunzip } from 'zlib'
import { promisify } from 'util'
import { Readable } from 'stream'
import * as tarfs from 'tar-fs'

const gunzipP = promisify(gunzip)

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

const MAX_MODULE_TAR_SIZE = 1024 * 1024 * 20 // 20MB

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

if (error) {
	console.error('Error fetching modules:', error)
	process.exit(1)
}

console.log(`Module API reported ${data.modules.length} modules`)

const moduleQueue = new pQueue({
	concurrency: 10,
})
for (const moduleInfo of data.modules) {
	if (moduleInfo.deprecationReason) {
		console.log(`Skipping ${moduleInfo.id} (${moduleInfo.deprecationReason})`)
		continue
	}

	moduleQueue.add(async () => {
		await pRetry(
			async () => {
				const moduleDir = path.join(offlinePath, moduleInfo.id)

				// Purge previous attempt
				await fs.rm(moduleDir, { recursive: true, force: true })
				// await fs.mkdir(moduleDir, { recursive: true })

				const { data: moduleInfoData, error } = await ModuleOpenApiClient.GET(
					`/v1/companion/modules/{moduleType}/{moduleName}`,
					{
						params: {
							path: { moduleType: 'connection', moduleName: moduleInfo.id },
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
				const latestCompatibleVersion = moduleInfoData.versions.find(
					(version) => isModuleApiVersionCompatible(version.apiVersion) && version.tarUrl
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

// Wait for all modules to be processed
await moduleQueue.onIdle()

console.log('All modules processed')

await $`tar -czf ${offlinePath + '.tar.gz'} -C ${offlinePath} .`

await fs.rm(offlinePath, { recursive: true, force: true })

console.log('all done!')
