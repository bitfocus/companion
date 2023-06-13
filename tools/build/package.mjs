#!/usr/bin/env zx

import { fetch, fs } from 'zx'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { determinePlatformInfo } from './util.mjs'
import { generateVersionString } from '../lib.mjs'
const streamPipeline = promisify(pipeline)

const toPosix = (str) => str.split(path.sep).join(path.posix.sep)

// Determine some environment info
const platformInfo = determinePlatformInfo(argv._[0])
if (platformInfo.nodePlatform) process.env.npm_config_platform = platformInfo.nodePlatform
if (platformInfo.nodeArch) {
	process.env.npm_config_arch = platformInfo.nodeArch
	process.env.npm_config_target_arch = platformInfo.nodeArch
}

const nodeVersion = await fs.readFile('./dist/.node-version')
const isZip = platformInfo.runtimePlatform === 'win'

// Download and cache build of nodejs
const cacheDir = '.cache/node'
await fs.mkdirp(cacheDir)
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
const runtimeDir = 'dist/node-runtime/'
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
	// TODO - can this be simplified and combined into the extract step?
	await fs.remove(path.join(runtimeDir, 'lib/node_modules/npm'))
	await fs.remove(path.join(runtimeDir, 'bin/npm'))
	await fs.remove(path.join(runtimeDir, 'bin/npx'))
}
await fs.remove(path.join(runtimeDir, 'share'))
await fs.remove(path.join(runtimeDir, 'include'))

// Prune out any prebuilds from other platforms
// TODO

// Install dependencies
await $`yarn --cwd dist install`

if (!process.env.SKIP_LAUNCH_CHECK) {
	const launchCheck = await $`node dist/main.js check-launches`.exitCode
	if (launchCheck !== 89) throw new Error("Launch check failed. Build looks like it won't launch!")
}

// if (!platform) {
// 	// If for our own platform, make sure the correct deps are installed
// 	await $`electron-builder install-app-deps`
// }

// TODO - make optional from flag
if (process.env.ELECTRON !== '0') {
	// Set version of the launcher to match the contents of the BUILD file

	const launcherPkgJsonPath = new URL('../../launcher/package.json', import.meta.url)
	const launcherPkgJsonStr = await fs.readFile(launcherPkgJsonPath)

	const versionInfo = await generateVersionString()

	const launcherPkgJson = JSON.parse(launcherPkgJsonStr.toString())
	launcherPkgJson.version = versionInfo

	await fs.writeFile(launcherPkgJsonPath, JSON.stringify(launcherPkgJson))

	try {
		// perform the electron build
		await $`yarn --cwd launcher install`
		await $`yarn --cwd launcher electron-builder --publish=never ${platformInfo.electronBuilderArgs}`
	} finally {
		// undo the changes made
		await fs.writeFile(launcherPkgJsonPath, launcherPkgJsonStr)
	}
} else {
	// TODO - populate dist with the rest of the bits
}
