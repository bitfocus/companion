#!/usr/bin/env zx

import { generateVersionString } from '../lib.mjs'
import archiver from 'archiver'
import { fs } from 'zx'
import { createRequire } from 'node:module'

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
// await $`yarn --cwd webui build`

// generate the 'static' zip files to serve
await zipDirectory('./webui/build', 'dist/webui.zip')
await zipDirectory('./docs', 'dist/docs.zip')

// generate a package.json for the required native dependencies
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
await fs.copyFile('.node-version', 'dist/.node-version')

// Build legacy modules
// await $`yarn --cwd module-legacy generate-manifests`
await fs.mkdir('dist/module-legacy')
await fs.copy('module-legacy/manifests', 'dist/module-legacy/manifests')
