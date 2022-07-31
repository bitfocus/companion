#!/usr/bin/env zx

import { generateVersionString } from '../lib.mjs'
import archiver from 'archiver'
import { fs } from 'zx'
import { createRequire } from 'node:module'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import path from 'node:path'
import tar from 'tar'

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
const neededDependencies = ['node-hid', 'sharp']
for (const name of neededDependencies) {
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
await fs.copyFile('.node-version', 'dist/.node-version')

// Copy prebuilds
const copyPrebuildsFromDependencies = ['@julusian/jpeg-turbo']
for (const name of copyPrebuildsFromDependencies) {
	await fs.mkdirp('dist/prebuilds')
	await fs.copy(path.join('node_modules', name, 'prebuilds'), 'dist/prebuilds')
}

// Build legacy modules
await $`yarn --cwd module-legacy generate-manifests`
await fs.mkdir('dist/module-legacy')
await fs.copy('module-legacy/manifests', 'dist/module-legacy/manifests')

// Bundle in modules
const modulesPath = 'dist/bundled-modules'
// const moduleTmp = 'dist/module-tmp'
await fs.mkdir(modulesPath)
const bundleJson = JSON.parse(await fs.readFile('./bundled-modules.json'))

// Download them all
for (const [id, url] of Object.entries(bundleJson)) {
	console.log('url', url)
	if (url) {
		// Download and extract to tmp dir
		const response = await fetch(url)
		if (!response.ok) throw new Error(`unexpected response ${response.statusText}`)

		const moduleDir = path.join(modulesPath, id)
		await fs.mkdir(moduleDir)
		await streamPipeline(
			response.body,
			tar.x({
				strip: 1,
				C: moduleDir,
			})
		)

		// const modJson = JSON.parse(await fs.readFile(path.join(moduleTmp, 'companion/manifest.json')))

		// const targetDir = path.join(modulesPath, id)
		// // await fs.rmdir()
		// await fs.move(moduleTmp, targetDir)
	}
}
