#!/usr/bin/env zx

import { generateVersionString } from '../lib.mjs'
import archiver from 'archiver'
import { fs } from 'zx'
import { createRequire } from 'node:module'
import path from 'node:path'
import { determinePlatformInfo } from './util.mjs'

const companionPkgJsonPath = new URL('../../package.json', import.meta.url)
const companionPkgJsonStr = await fs.readFile(companionPkgJsonPath)
const companionPkgJson = JSON.parse(companionPkgJsonStr.toString())

const platformInfo = determinePlatformInfo(argv._[0])

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

await $`zx tools/build_writefile.mjs`

const buildString = await generateVersionString()

// Trash old
await fs.remove('dist')

// Build application
await $`yarn webpack`

// Build webui
await $`yarn --cwd webui build`

// generate the 'static' zip files to serve
await zipDirectory('./webui/build', 'dist/webui.zip')
await zipDirectory('./docs', 'dist/docs.zip')

// generate a package.json for the required native dependencies
const require = createRequire(import.meta.url)
const dependencies = {}
const webpackConfig = require('../../webpack.config.cjs')
const neededDependencies = Object.keys(webpackConfig.externals)
for (const name of neededDependencies) {
	const pkgJson = require(`${name}/package.json`)
	dependencies[name] = pkgJson.version
}

if (platformInfo.runtimePlatform === 'linux' && platformInfo.runtimeArch !== 'x64') {
	// These have no prebuilds available
	delete dependencies['bufferutil']
	delete dependencies['utf-8-validate']
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
			resolutions: {
				// Force the same custom `node-gyp-build` version to allow better cross compiling
				'node-gyp-build': companionPkgJson.resolutions['node-gyp-build'],
			},
		},
		undefined,
		2
	)
)
await fs.copyFile('yarn.lock', 'dist/yarn.lock') // use the same yarn.lock file, to keep deps as similar as possible
await fs.copyFile('.node-version', 'dist/.node-version')

// Copy prebuilds
const copyPrebuildsFromDependencies = ['@julusian/jpeg-turbo', 'node-hid', '@julusian/image-rs']
for (const name of copyPrebuildsFromDependencies) {
	await fs.mkdirp('dist/prebuilds')
	await fs.copy(path.join('node_modules', name, 'prebuilds'), 'dist/prebuilds')
}
// Copy fonts
await fs.mkdirp('dist/assets/Fonts')
await fs.copy(path.join('assets', 'Fonts'), 'dist/assets/Fonts')

// Build legacy modules
await $`yarn --cwd module-legacy generate-manifests`
await fs.mkdir('dist/module-legacy')
await fs.copy('module-legacy/manifests', 'dist/module-legacy/manifests')

// Bundle in modules
await fs.copy('bundled-modules', 'dist/bundled-modules')
