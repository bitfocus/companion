#!/usr/bin/env zx

import { generateVersionString, generateMiniVersionString, $withoutEscaping } from './lib.mjs'
import archiver from 'archiver'

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
let sharpPlatform = null
let sharpArch = null

const buildString = await generateVersionString()
console.log('Writing:', buildString)
await fs.writeFile(new URL('../BUILD', import.meta.url), buildString)

if (!platform) {
	console.log('No platform specified, building for current')

	if (process.platform === 'darwin') {
		electronBuilderArgs.push(`-c.buildVersion="${buildString}"`)
	} else if (process.platform === 'win32') {
		const miniBuildString = await generateMiniVersionString()
		electronBuilderArgs.push(`-c.buildVersion="${miniBuildString}"`)
	}
} else {
	console.log(`Building for platform: ${platform}`)

	if (platform === 'mac-x64') {
		electronBuilderArgs.push('--x64', '--mac')
		sharpPlatform = 'darwin'
		sharpArch = 'x64'

		electronBuilderArgs.push(`-c.buildVersion="${buildString}"`)
	} else if (platform === 'mac-arm64') {
		electronBuilderArgs.push('--arm64', '--mac')
		sharpPlatform = 'darwin'
		sharpArch = 'arm64'

		electronBuilderArgs.push(`-c.buildVersion="${buildString}"`)
	} else if (platform === 'win-x64') {
		electronBuilderArgs.push('--x64', '--win')
		sharpPlatform = 'win32'
		sharpArch = 'x64'

		const miniBuildString = await generateMiniVersionString()
		electronBuilderArgs.push(`-c.buildVersion="${miniBuildString}"`)
	} else if (platform === 'linux-x64') {
		electronBuilderArgs.push('--x64', '--linux')
		sharpPlatform = 'linux'
		sharpArch = 'x64'
	} else if (platform === 'linux-arm7') {
		electronBuilderArgs.push('--armv7l', '--linux')
		sharpPlatform = 'linux'
		sharpArch = 'arm'
	} else {
		console.error('Unknwon platform')
		process.exit(1)
	}
}

await $`yarn --cwd webui build`

// generat the 'static' zip files to serve
await zipDirectory('./webui/build', 'bundle-webui.zip')
await zipDirectory('./docs', 'bundle-docs.zip')

// Ensure we have the correct sharp libs
let sharpArgs = []
if (sharpPlatform) sharpArgs.push(`npm_config_platform=${sharpPlatform}`)
if (sharpArch) sharpArgs.push(`npm_config_arch=${sharpArch}`)
await $`cross-env ${sharpArgs} yarn dist:prepare:sharp`

if (!platform) {
	// If for our own platform, make sure the correct deps are installed
	await $`electron-builder install-app-deps`
}

// perform the electron build
await fs.remove('./electron-output')
await $withoutEscaping`electron-builder --publish=never ${electronBuilderArgs.join(' ')} `
