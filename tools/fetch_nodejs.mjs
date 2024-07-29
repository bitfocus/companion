// @ts-check

import { fetch, fs, path, $ } from 'zx'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { determinePlatformInfo, toPosix } from './build/util.mjs'
import { fileURLToPath } from 'node:url'
const streamPipeline = promisify(pipeline)

const nodeVersionsJsonPath = new URL('../nodejs-versions.json', import.meta.url)
const nodeVersionsStr = await fs.readFile(nodeVersionsJsonPath)
const nodeVersionsJson = JSON.parse(nodeVersionsStr.toString())

const cacheRoot = fileURLToPath(new URL('../.cache', import.meta.url))
const cacheDir = path.join(cacheRoot, 'node')
const cacheRuntimeDir = path.join(cacheRoot, 'node-runtime')

export async function fetchNodejs(targetName) {
	await fs.mkdirp(cacheDir)
	await fs.mkdirp(cacheRuntimeDir)

	const platformInfo = determinePlatformInfo(targetName)

	await Promise.all(
		Object.entries(nodeVersionsJson).map(([name, version]) => fetchSingleVersion(platformInfo, name, version))
	)
}

async function fetchSingleVersion(platformInfo, name, nodeVersion) {
	const isZip = platformInfo.runtimePlatform === 'win'

	// Download and cache build of nodejs
	const tarFilename = `node-v${nodeVersion}-${platformInfo.runtimePlatform}-${platformInfo.runtimeArch}.${
		isZip ? 'zip' : 'tar.gz'
	}`
	const tarPath = path.join(cacheDir, tarFilename)
	if (!(await fs.pathExists(tarPath))) {
		const tarUrl = `https://nodejs.org/download/release/v${nodeVersion}/${tarFilename}`

		const response = await fetch(tarUrl)
		if (!response.ok) throw new Error(`unexpected response ${response.statusText}`)
		await streamPipeline(response.body, createWriteStream(tarPath))
	}

	// Extract nodejs and discard 'junk'
	const runtimeDir = path.join(cacheRuntimeDir, `${platformInfo.nodePlatform}-${platformInfo.nodeArch}-${nodeVersion}`)
	if (!(await fs.pathExists(runtimeDir))) {
		if (isZip) {
			await $`unzip ${toPosix(tarPath)} -d dist`
			await fs.remove(runtimeDir)
			await fs.move(`dist/node-v${nodeVersion}-${platformInfo.runtimePlatform}-${platformInfo.runtimeArch}`, runtimeDir)
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
}
