#!/usr/bin/env zx

import path from 'path'
import { fs } from 'zx'

// const toolsDir = path.join(__dirname, '..')
const toolsDir = path.dirname(require.resolve('@companion-module/tools'))
const frameworkDir = path.dirname(require.resolve('@companion-module/base'))
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

const packageJson = {
	name: manifestJson.name,
	version: manifestJson.version,
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
					const extPath = path.join(path.dirname(require.resolve(external)), 'package.json')
					const extJson = JSON.parse(await fs.readFile(extPath))
					packageJson.dependencies[external] = extJson.version
				}
			}
		}
	}
}

// Write the package.json
await fs.writeFile('pkg/package.json', JSON.stringify(packageJson))

// Create tgz of the build
await $`yarn --cwd pkg pack --filename pkg/package.tgz`
