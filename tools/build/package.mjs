#!/usr/bin/env zx

import { fetch, fs } from 'zx'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { determinePlatformInfo } from './util.mjs'
const streamPipeline = promisify(pipeline)

const toPosix = (str) => str.split(path.sep).join(path.posix.sep)

// Determine some environment info
const platformInfo = determinePlatformInfo(argv._[1])
if (platformInfo.nodePlatform) process.env.npm_config_platform = platformInfo.nodePlatform
if (platformInfo.nodeArch) process.env.npm_config_arch = platformInfo.nodeArch

// Ensure we have the correct sharp libs
// await $`cross-env ${sharpArgs} yarn dist:prepare`

// const sharpVendorDir = './dist/node_modules/sharp/vendor/'
// const sharpVersionDirs = await fs.readdir(sharpVendorDir)
// if (sharpVersionDirs.length !== 1) {
// 	console.error(`Failed to determine sharp lib version`)
// 	process.exit(1)
// }

// const sharpPlatformDirs = await fs.readdir(path.join(sharpVendorDir, sharpVersionDirs[0]))
// if (sharpPlatformDirs.length !== 1) {
// 	console.error(`Failed to determine sharp lib platform`)
// 	process.exit(1)
// }

// const vipsVendorName = path.join(sharpVersionDirs[0], sharpPlatformDirs[0])
// process.env.VIPS_VENDOR = vipsVendorName

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
	const tarUrl =
		platformInfo.nodePlatform === 'darwin' && platformInfo.nodeArch === 'arm64'
			? `https://builds.julusian.dev/nodejs/${tarFilename}`
			: `https://nodejs.org/download/release/v${nodeVersion}/${tarFilename}`

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

await $`yarn --cwd dist install`

// if (!platform) {
// 	// If for our own platform, make sure the correct deps are installed
// 	await $`electron-builder install-app-deps`
// }

// TODO - make optional from flag
if (process.env.ELECTRON !== '0') {
	// perform the electron build
	await fs.remove('./electron-output')
	await $`yarn --cwd launcher install`
	await $`yarn --cwd launcher electron-builder --publish=never ${platformInfo.electronBuilderArgs}`
} else {
	// TODO - populate dist with the rest of the bits
}
