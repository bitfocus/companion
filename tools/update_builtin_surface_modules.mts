import fs from 'node:fs/promises'
import path from 'node:path'
import { generateVersionString } from './lib.mts'
import type { paths as ModuleStoreOpenApiPaths } from '@companion-app/shared/OpenApi/ModuleStore.js'
import createClient from 'openapi-fetch'
import pQueue from 'p-queue'
import pRetry from 'p-retry'
import { isSurfaceApiVersionCompatible } from '../shared-lib/lib/ModuleApiVersionCheck.js'

const builtinSurfaceModulesPath = path.join(import.meta.dirname, '../assets/builtin-surface-modules.json')

const existingModules = JSON.parse(await fs.readFile(builtinSurfaceModulesPath, 'utf8'))

const baseUrl = process.env.STAGING_MODULE_API
	? 'https://developer-staging.bitfocus.io/api'
	: 'https://developer.bitfocus.io/api'

const userAgent = `Companion builtin module scraper ${await generateVersionString()}`
const ModuleOpenApiClient = createClient<ModuleStoreOpenApiPaths>({
	baseUrl,
	headers: {
		'User-Agent': userAgent,
	},
})

console.log('existing modules:\n', existingModules)

const moduleQueue = new pQueue({
	concurrency: 10,
})
for (const moduleId of Object.keys(existingModules)) {
	moduleQueue.add(async () => {
		await pRetry(
			async () => {
				const { data: moduleInfoData, error } = await ModuleOpenApiClient.GET(
					`/v1/companion/modules/{moduleType}/{moduleName}`,
					{
						params: {
							path: { moduleType: 'surface', moduleName: moduleId },
						},
					}
				)
				if (error) {
					throw new Error(`Error fetching module ${moduleId}: ${error}`)
				}
				if (!moduleInfoData) {
					throw new Error(`Module ${moduleId} not found`)
				}

				// This assumes the modules are ordered with newest first
				const latestCompatibleVersion =
					moduleInfoData.versions.find(
						// Find latest release version
						(version) =>
							isSurfaceApiVersionCompatible(version.apiVersion) &&
							version.tarUrl &&
							version.tarSha &&
							!version.isPrerelease
					) ||
					moduleInfoData.versions.find(
						// Find latest prerelease version
						(version) => isSurfaceApiVersionCompatible(version.apiVersion) && version.tarUrl && version.tarSha
					)
				if (!latestCompatibleVersion) {
					console.log('No compatible version found for', moduleId)
					return
				}

				existingModules[moduleId] = {
					version: latestCompatibleVersion.id,
					tarUrl: latestCompatibleVersion.tarUrl!, // Note: asserted in the find above
					tarSha: latestCompatibleVersion.tarSha!, // Note: asserted in the find above
				}

				console.log(`Found ${moduleId} (${latestCompatibleVersion.id})`)
			},
			{
				retries: 3,
			}
		).catch((err) => {
			throw new Error(`Failed to fetch ${moduleId}: ${err}`)
		})
	})
}

// Wait for all modules to be processed
await moduleQueue.onIdle()

console.log('All modules processed')

await fs.writeFile(builtinSurfaceModulesPath, JSON.stringify(existingModules, null, '\t') + '\n')

console.log('Done updating builtin surface modules.', existingModules)
