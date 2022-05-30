#!/usr/bin/env zx

import { generateVersionString } from './lib.mjs'
import archiver from 'archiver'
import { fetch, fs } from 'zx'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
const streamPipeline = promisify(pipeline)

const toPosix = (str) => str.split(path.sep).join(path.posix.sep)

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

let electronBuilderArgs = []
let nodeArch = process.arch
let sharpPlatform = process.platform
let sharpArch = process.arch

await $`zx tools/build_writefile.mjs`

const buildString = await generateVersionString()

if (!platform) {
	console.log('No platform specified, building for current')
} else {
	console.log(`Building for platform: ${platform}`)

	if (platform === 'mac-x64') {
		electronBuilderArgs.push('--x64', '--mac')
		nodeArch = 'x64'
		sharpPlatform = 'darwin'
		sharpArch = 'x64'
	} else if (platform === 'mac-arm64') {
		electronBuilderArgs.push('--arm64', '--mac')
		nodeArch = 'arm64'
		sharpPlatform = 'darwin'
		sharpArch = 'arm64'
	} else if (platform === 'win-x64') {
		electronBuilderArgs.push('--x64', '--win')
		nodeArch = 'x64'
		sharpPlatform = 'win32'
		sharpArch = 'x64'
	} else if (platform === 'linux-x64') {
		electronBuilderArgs.push('--x64', '--linux')
		nodeArch = 'x64'
		sharpPlatform = 'linux'
		sharpArch = 'x64'
	} else if (platform === 'linux-arm7') {
		electronBuilderArgs.push('--armv7l', '--linux')
		nodeArch = 'armv7l'
		sharpPlatform = 'linux'
		sharpArch = 'arm'
	} else if (platform === 'linux-arm64') {
		electronBuilderArgs.push('--arm64', '--linux')
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
await $`yarn --cwd webui build`

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

const nodeVersion = await fs.readFile('./.node-version')
let runtimePlatform = sharpPlatform
if (runtimePlatform === 'win32') runtimePlatform = 'win'
if (runtimePlatform === 'arm') runtimePlatform = 'armv7l'
const isZip = runtimePlatform === 'win'

// Download and cache build of nodejs
const cacheDir = '.cache/node'
await fs.mkdirp(cacheDir)
const tarFilename = `node-v${nodeVersion}-${runtimePlatform}-${nodeArch}.${isZip ? 'zip' : 'tar.gz'}`
const tarPath = path.join(cacheDir, tarFilename)
if (!(await fs.pathExists(tarPath))) {
	const tarUrl =
		sharpPlatform === 'darwin' && nodeArch === 'arm64'
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
	await fs.move(`dist/node-v${nodeVersion}-${runtimePlatform}-${nodeArch}`, runtimeDir)
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

const require = createRequire(import.meta.url)
const dependencies = {}
const neededDependnecies = ['@julusian/jpeg-turbo', 'node-hid', 'sharp']
for (const name of neededDependnecies) {
	const pkgJson = require(`${name}/package.json`)
	dependencies[name] = pkgJson.version
}

await fs.writeFile(
	'dist/package.json',
	JSON.stringify(
		{
			name: 'companion-dist',
			version: buildString,
			license: 'MIT',
			main: 'main.js',
			dependencies: dependencies,
		},
		undefined,
		2
	)
)
await fs.copyFile('yarn.lock', 'dist/yarn.lock') // use the same yarn.lock file, to keep deps as similar as possible
await $`yarn --cwd dist install`

// Build legacy modules
await $`yarn --cwd module-legacy generate-manifests`

// if (!platform) {
// 	// If for our own platform, make sure the correct deps are installed
// 	await $`electron-builder install-app-deps`
// }

// TODO - make optional from flag
if (process.env.ELECTRON !== '0') {
	// perform the electron build
	await fs.remove('./electron-output')
	await $`yarn --cwd launcher install`
	await $`yarn --cwd launcher electron-builder --publish=never ${electronBuilderArgs}`
} else {
	// TODO - populate dist with the rest of the bits
}
