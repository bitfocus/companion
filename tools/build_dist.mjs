#!/usr/bin/env zx

import { generateVersionString, generateMiniVersionString, $withoutEscaping } from './lib.mjs'
import archiver from 'archiver'
import { fs } from 'zx'

/**
 * @param {String} sourceDir: /some/folder/to/compress
 * @param {String} outPath: /path/to/created.zip
 * @returns {Promise}
 */
function zipDirectory(sourceDir, outPath) {
	const archive = archiver('zip', { zlib: { level: 9 } })
	const stream = fs.createWriteStream(outPath)

	return new Promise((resolve, reject) => {
		archive
			.directory(sourceDir, false)
			.on('error', (err) => reject(err))
			.pipe(stream)

		stream.on('close', () => resolve())
		archive.finalize()
	})
}

const platform = argv._[1]

// let electronBuilderArgs = []
let nodeArch = process.arch
let sharpPlatform = process.platform
let sharpArch = process.arch

const buildString = await generateVersionString()
console.log('Writing:', buildString)
await fs.writeFile(new URL('../BUILD', import.meta.url), buildString)

if (!platform) {
	console.log('No platform specified, building for current')

	// if (process.platform === 'darwin') {
	// 	electronBuilderArgs.push(`-c.buildVersion="${buildString}"`)
	// } else if (process.platform === 'win32') {
	// 	const miniBuildString = await generateMiniVersionString()
	// 	electronBuilderArgs.push(`-c.buildVersion="${miniBuildString}"`)
	// }
} else {
	console.log(`Building for platform: ${platform}`)

	if (platform === 'mac-x64') {
		// electronBuilderArgs.push('--x64', '--mac')
		nodeArch = 'x64'
		sharpPlatform = 'darwin'
		sharpArch = 'x64'

		electronBuilderArgs.push(`-c.buildVersion="${buildString}"`)
	} else if (platform === 'mac-arm64') {
		// electronBuilderArgs.push('--arm64', '--mac')
		nodeArch = 'arm64'
		sharpPlatform = 'darwin'
		sharpArch = 'arm64'

		electronBuilderArgs.push(`-c.buildVersion="${buildString}"`)
	} else if (platform === 'win-x64') {
		// electronBuilderArgs.push('--x64', '--win')
		nodeArch = 'x64'
		sharpPlatform = 'win32'
		sharpArch = 'x64'

		const miniBuildString = await generateMiniVersionString()
		electronBuilderArgs.push(`-c.buildVersion="${miniBuildString}"`)
	} else if (platform === 'linux-x64') {
		// electronBuilderArgs.push('--x64', '--linux')
		nodeArch = 'x64'
		sharpPlatform = 'linux'
		sharpArch = 'x64'
	} else if (platform === 'linux-arm7') {
		// electronBuilderArgs.push('--armv7l', '--linux')
		nodeArch = 'armv7l'
		sharpPlatform = 'linux'
		sharpArch = 'arm'
	} else if (platform === 'linux-arm64') {
		// electronBuilderArgs.push('--arm64', '--linux')
		nodeArch = 'arm64'
		sharpPlatform = 'linux'
		sharpArch = 'arm64'
	} else {
		console.error('Unknwon platform')
		process.exit(1)
	}
}

// await $`yarn --cwd webui build`

// generat the 'static' zip files to serve
await zipDirectory('./webui/build', 'dist/webui.zip')
await zipDirectory('./docs', 'dist/docs.zip')

// Ensure we have the correct sharp libs
let sharpArgs = []
if (sharpPlatform) sharpArgs.push(`npm_config_platform=${sharpPlatform}`)
if (sharpArch) sharpArgs.push(`npm_config_arch=${nodeArch}`)
// await $`cross-env ${sharpArgs} yarn dist:prepare`
await $`yarn --cwd dist install`

const sharpVendorDir = './dist/node_modules/sharp/vendor/'
const sharpVersionDirs = await fs.readdir(sharpVendorDir)
if (sharpVersionDirs.length !== 1) {
	console.error(`Failed to determine sharp lib version`)
	process.exit(1)
}

const sharpPlatformDirs = await fs.readdir(path.join(sharpVendorDir, sharpVersionDirs[0]))
if (sharpPlatformDirs.length !== 1) {
	console.error(`Failed to determine sharp lib platform`)
	process.exit(1)
}

const vipsVendorName = path.join(sharpVersionDirs[0], sharpPlatformDirs[0])
process.env.VIPS_VENDOR = vipsVendorName

const nodeVersion = '14.19.0'

await $`rm -R dist/node-runtime || true`
await $`mkdir dist/node-runtime`
await $`mkdir dist/tmp || true`
const url = `https://nodejs.org/download/release/v${nodeVersion}/node-v${nodeVersion}-${sharpPlatform}-${nodeArch}.tar.gz`
await $`wget ${url} -O dist/tmp/node.tar.gz`
await $`tar -xvzf dist/tmp/node.tar.gz --strip-components=1 -C dist/node-runtime/`
await $`rm -R dist/node-runtime/share dist/node-runtime/include dist/tmp`

// if (!platform) {
// 	// If for our own platform, make sure the correct deps are installed
// 	await $`electron-builder install-app-deps`
// }

// // perform the electron build
// await fs.remove('./electron-output')
// await $withoutEscaping` electron-builder --publish=never ${electronBuilderArgs.join(' ')} `
