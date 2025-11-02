#!/usr/bin/env zx

import { generateMiniVersionString, generateVersionString } from '../lib.mts'
import archiver from 'archiver'
import { $, fs, usePowerShell, argv } from 'zx'
import { createRequire } from 'node:module'
import path from 'node:path'
import yaml from 'yaml'
import { determinePlatformInfo } from './util.mts'

$.verbose = true

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

const companionPkgJsonPath = new URL('../../package.json', import.meta.url)
const companionPkgJsonStr = await fs.readFile(companionPkgJsonPath)
const companionPkgJson = JSON.parse(companionPkgJsonStr.toString())

const platformInfo = determinePlatformInfo(argv._[0])

/**
 * @param {String} sourceDir: /some/folder/to/compress
 * @param {String} outPath: /path/to/created.zip
 * @returns {Promise}
 */
async function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
	const archive = archiver('zip', { zlib: { level: 9 } })
	const stream = fs.createWriteStream(outPath)

	return new Promise<void>((resolve, reject) => {
		archive
			.directory(sourceDir, false)
			.on('error', (err) => reject(err))
			.pipe(stream)

		stream.on('close', () => resolve())
		archive.finalize()
	})
}

await $`tsx tools/build_writefile.mts`

const buildString = await generateMiniVersionString()

// Trash old
await fs.remove('dist')

// Build application
await $`yarn workspace @companion-app/shared build:ts`
await $`yarn workspace companion build`

// Build webui
await $`yarn workspace @companion-app/webui build`
await $`yarn workspace @companion-app/launcher-ui build`

// generate the 'static' zip files to serve
await zipDirectory('./webui/build', 'dist/webui.zip')
await zipDirectory('./docs', 'dist/docs.zip')

// generate a package.json for the required native dependencies
const require = createRequire(import.meta.url)
const dependencies = {}
const webpackConfig = require('../../companion/webpack.config.cjs')
const neededDependencies = Object.keys(webpackConfig.externals)
for (const name of neededDependencies) {
	const pkgJson = require(`${name}/package.json`)
	dependencies[name] = pkgJson.version
}

if (platformInfo.runtimePlatform === 'linux' && platformInfo.runtimeArch !== 'x64') {
	// These have no prebuilds available
	delete dependencies['bufferutil']
}

const packageResolutions = {
	// Force the same custom `node-gyp-build` version to allow better cross compiling
	'node-gyp-build': companionPkgJson.resolutions['node-gyp-build'],
	// Use an empty package for node-gyp, to avoid installing it
	'node-gyp': 'npm:empty-npm-package@1.0.0',
}
// Preserve some resolutions to the dist package.json
for (const [name, version] of Object.entries(companionPkgJson.resolutions)) {
	if (name.startsWith('@napi-rs/canvas')) {
		packageResolutions[name] = version
	}
}

const nodeVersion = await fs.readFile('.node-version')
await fs.writeFile(
	'dist/package.json',
	JSON.stringify(
		{
			name: 'companion',
			version: buildString,
			license: 'MIT',
			main: 'main.js',
			dependencies: dependencies,
			engines: { node: nodeVersion.toString().trim() },
			resolutions: packageResolutions,
			packageManager: companionPkgJson.packageManager,
		},
		undefined,
		2
	)
)
await fs.copyFile('yarn.lock', 'dist/yarn.lock') // use the same yarn.lock file, to keep deps as similar as possible
await fs.copyFile('.node-version', 'dist/.node-version')
await fs.writeFile(
	'dist/.yarnrc.yml',
	yaml.stringify({
		nodeLinker: 'node-modules',
		supportedArchitectures: {
			os: platformInfo.nodePlatform,
			cpu: platformInfo.nodeArch,
		},
	})
)

// Copy prebuilds
const copyPrebuildsFromDependencies = [
	'@julusian/jpeg-turbo',
	'node-hid',
	'@julusian/image-rs',
	'@julusian/segfault-raub',
]
for (const name of copyPrebuildsFromDependencies) {
	await fs.mkdirp('dist/prebuilds')
	await fs.copy(path.join('node_modules', name, 'prebuilds'), 'dist/prebuilds')
}

// Make sure the sqlite3 prebuild for the target is installed, then copy it to the output
// (Note: w/o --platform, the wrong binary is loaded when building win32 on WSL)
await $`yarn --cwd node_modules/better-sqlite3 prebuild-install --arch=${platformInfo.nodeArch} --platform=${platformInfo.nodePlatform}`
await fs.copy('node_modules/better-sqlite3/build/Release/better_sqlite3.node', 'dist/prebuilds/better_sqlite3.node')
// now restore the correct one or `yarn dev` will be broken after a cross-platform build!
await $`yarn --cwd node_modules/better-sqlite3 prebuild-install`

// Copy fonts
await fs.mkdirp('dist/assets/Fonts')
await fs.copy(path.join('assets', 'Fonts'), 'dist/assets/Fonts')
