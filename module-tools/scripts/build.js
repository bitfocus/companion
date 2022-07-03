#!/usr/bin/env zx

import path from 'path'
import { fs } from 'zx'
import { findUp } from 'find-up'
import * as tar from 'tar'

async function findModuleDir(cwd) {
	const stat = await fs.stat(cwd)
	if (stat.isFile()) cwd = path.dirname(cwd)

	const pkgJsonPath = await findUp('package.json', { cwd })
	return path.dirname(pkgJsonPath)
}

// const toolsDir = path.join(__dirname, '..')
const toolsDir = await findModuleDir(require.resolve('@companion-module/tools'))
const frameworkDir = await findModuleDir(require.resolve('@companion-module/base'))
console.log(`Building for: ${process.cwd()}`)

console.log(`Tools path: ${toolsDir}`)
console.log(`Framework path: ${frameworkDir}`)

// clean old
await fs.remove('pkg')

// build the code
const webpackConfig = path.join(toolsDir, 'webpack.config.cjs')
await $`yarn webpack -c ${webpackConfig}`

// copy in the metadata
await fs.copy('companion', 'pkg/companion')

const manifestJson = JSON.parse(await fs.readFile(path.resolve('./companion/manifest.json')))
manifestJson.runtime.entrypoint = '../main.js'
await fs.writeFile(path.resolve('./pkg/companion/manifest.json'), JSON.stringify(manifestJson))

// Generate a minimal package.json
const packageJson = {
	name: manifestJson.name,
	version: manifestJson.version,
	license: manifestJson.license,
	// Minimal content
	type: 'commonjs',
	dependencies: {},
}

// Ensure that any externals are added as dependencies
const webpackExtPath = path.resolve('webpack-ext.cjs')
if (fs.existsSync(webpackExtPath)) {
	const webpackExt = require(webpackExtPath)
	if (webpackExt.externals) {
		const extArray = Array.isArray(webpackExt.externals) ? webpackExt.externals : [webpackExt.externals]
		for (const extGroup of extArray) {
			if (typeof extGroup === 'object') {
				// TODO - does this need to be a stricter object check?

				for (const external of Object.keys(extGroup)) {
					const extPath = await findUp('package.json', { cwd: require.resolve(external) })
					const extJson = JSON.parse(await fs.readFile(extPath))
					packageJson.dependencies[external] = extJson.version
				}
			}
		}
	}
}

// Write the package.json
// packageJson.bundleDependencies = Object.keys(packageJson.dependencies)
await fs.writeFile('pkg/package.json', JSON.stringify(packageJson))

if (Object.keys(packageJson.dependencies).length) {
	await $`yarn --cwd pkg`
}

// Create tgz of the build
// await $`yarn --cwd pkg pack --filename pkg/package.tgz`

await tar
	.c(
		// or tar.create
		{
			gzip: true,
		},
		['pkg']
	)
	.pipe(fs.createWriteStream('pkg.tgz'))
