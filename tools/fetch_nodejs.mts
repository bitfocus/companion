import { fetch, fs, path, $ } from 'zx'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { toPosix } from './build/util.mts'
import { type PlatformInfo } from './build/util.mts'
import nodeVersionsJson from '../assets/nodejs-versions.json'

const streamPipeline = promisify(pipeline)

const cacheRoot = path.join(import.meta.dirname, '../.cache')
const cacheDir = path.join(cacheRoot, 'node')
const cacheRuntimeDir = path.join(cacheRoot, 'node-runtime')

export async function fetchNodejs(platformInfo: PlatformInfo) {
	await fs.mkdirp(cacheDir)
	await fs.mkdirp(cacheRuntimeDir)

	return Promise.all(
		Object.entries(nodeVersionsJson).map(async ([name, version]) => {
			const runtimeDir = await fetchSingleVersion(platformInfo, version)
			return [name, runtimeDir]
		})
	)
}

async function fetchSingleVersion(platformInfo: PlatformInfo, nodeVersion: string) {
	const isZip = platformInfo.runtimePlatform === 'win'

	// Download and cache build of nodejs
	const tarFilename = `node-v${nodeVersion}-${platformInfo.runtimePlatform}-${platformInfo.runtimeArch}.${
		isZip ? 'zip' : 'tar.gz'
	}`
	const tarPath = path.join(cacheDir, tarFilename)
	if (!(await fs.pathExists(tarPath))) {
		const tarUrl = `https://nodejs.org/download/release/v${nodeVersion}/${tarFilename}`

		const response = await fetch(tarUrl)
		if (!response.ok || !response.body) throw new Error(`unexpected response ${response.statusText}`)
		await streamPipeline(response.body, createWriteStream(tarPath))
	}

	// Extract nodejs and discard 'junk'
	const runtimeDir = path.join(cacheRuntimeDir, `${platformInfo.nodePlatform}-${platformInfo.nodeArch}-${nodeVersion}`)
	if (!(await fs.pathExists(runtimeDir))) {
		if (isZip) {
			const tmpDir = path.join(cacheRuntimeDir, `tmp-${nodeVersion}`)
			await fs.remove(tmpDir)
			if (process.platform === 'win32') {
				await $`Expand-Archive ${toPosix(tarPath)} -DestinationPath ${toPosix(tmpDir)}`
			} else {
				await $`unzip ${toPosix(tarPath)} -d ${toPosix(tmpDir)}`
			}
			await fs.move(
				path.join(tmpDir, `node-v${nodeVersion}-${platformInfo.runtimePlatform}-${platformInfo.runtimeArch}`),
				runtimeDir
			)
			await fs.remove(tmpDir)
			// TODO - can this be simplified and combined into the extract step?
			await fs.remove(path.join(runtimeDir, 'node_modules/npm'))
			await fs.remove(path.join(runtimeDir, 'npm'))
			await fs.remove(path.join(runtimeDir, 'npx'))
		} else {
			await fs.mkdirp(runtimeDir)
			await $`tar -xzf ${tarPath} --strip-components=1 -C ${runtimeDir}`
			// We need to keep some portions of this to have corepack/yarn work, but npm is large and unnecessary
			// TODO - can this be simplified and combined into the extract step?
			await fs.remove(path.join(runtimeDir, 'lib/node_modules/npm'))
			if (platformInfo.runtimePlatform === 'darwin') {
				// macos doesn't like symlinks
				await fs.remove(path.join(runtimeDir, 'bin/npm'))
				await fs.remove(path.join(runtimeDir, 'bin/npx'))
			}
		}
		await fs.remove(path.join(runtimeDir, 'share'))
		await fs.remove(path.join(runtimeDir, 'include'))
	}

	return runtimeDir
}
