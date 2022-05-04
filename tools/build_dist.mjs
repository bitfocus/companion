#!/usr/bin/env zx

import { generateVersionString, generateMiniVersionString, $withoutEscaping } from './lib.mjs'
import archiver from 'archiver'
import { fetch, fs } from 'zx'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
const streamPipeline = promisify(pipeline)

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

		// electronBuilderArgs.push(`-c.buildVersion="${buildString}"`)
	} else if (platform === 'mac-arm64') {
		// electronBuilderArgs.push('--arm64', '--mac')
		nodeArch = 'arm64'
		sharpPlatform = 'darwin'
		sharpArch = 'arm64'

		// electronBuilderArgs.push(`-c.buildVersion="${buildString}"`)
	} else if (platform === 'win-x64') {
		// electronBuilderArgs.push('--x64', '--win')
		nodeArch = 'x64'
		sharpPlatform = 'win32'
		sharpArch = 'x64'

		// const miniBuildString = await generateMiniVersionString()
		// electronBuilderArgs.push(`-c.buildVersion="${miniBuildString}"`)
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

// Trash old
await fs.remove('dist')

// Build application
await $`yarn webpack`

// Build webui
// await $`yarn --cwd webui build`

// generat the 'static' zip files to serve
await zipDirectory('./webui/build', 'dist/webui.zip')
await zipDirectory('./docs', 'dist/docs.zip')

// Ensure we have the correct sharp libs
let sharpArgs = []
if (sharpPlatform) sharpArgs.push(`npm_config_platform=${sharpPlatform}`)
if (sharpArch) sharpArgs.push(`npm_config_arch=${nodeArch}`)
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

const nodeVersion = '14.19.0'

// Download and cache build of nodejs
const cacheDir = '.cache/node'
await fs.mkdirp(cacheDir)
const tarFilename = `node-v${nodeVersion}-${sharpPlatform}-${nodeArch}.tar.gz`
const tarPath = path.join(cacheDir, tarFilename)
if (!(await fs.pathExists(tarPath))) {
	const response = await fetch(`https://nodejs.org/download/release/v${nodeVersion}/${tarFilename}`)
	if (!response.ok) throw new Error(`unexpected response ${response.statusText}`)
	await streamPipeline(response.body, createWriteStream(tarPath))
}

// Extract nodejs and discard 'junk'
const runtimeDir = 'dist/node-runtime/'
await fs.mkdirp(runtimeDir)
// TODO - can this be simplified and combined into one step?
await $`tar -xzf ${tarPath} --strip-components=1 -C ${runtimeDir}`
await fs.remove(path.join(runtimeDir, 'share'))
await fs.remove(path.join(runtimeDir, 'include'))
await fs.remove(path.join(runtimeDir, 'lib/node_modules/npm'))

await fs.writeFile(
	'dist/package.json',
	JSON.stringify(
		{
			name: 'companion-dist',
			version: buildString,
			license: 'MIT',
			main: 'main.js',
			dependencies: {
				// TODO - make this list be generated properly
				'@julusian/jpeg-turbo': '^1.1.2',
				'node-hid': '^2.1.1',
				sharp: '^0.30.4',
			},
		},
		undefined,
		2
	)
)
await fs.copyFile('yarn.lock', 'dist/yarn.lock') // use the same yarn.lock file, to keep deps as similar as possible
await $`yarn --cwd dist install`

// if (!platform) {
// 	// If for our own platform, make sure the correct deps are installed
// 	await $`electron-builder install-app-deps`
// }

// TODO - make optional from flag
// perform the electron build
await fs.remove('./electron-output')
await $`yarn --cwd launcher install`
await $`yarn --cwd launcher electron-builder --publish=never `
