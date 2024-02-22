#!/usr/bin/env zx

import { fs, path, $ } from 'zx'
import parseAuthor from 'parse-author'

import type { ModuleManifest, ModuleManifestMaintainer } from '@companion-module/base'
const moduleBasePkgStr = fs
	.readFileSync(new URL('../../node_modules/@companion-module/base/package.json', import.meta.url))
	.toString()
const moduleBasePkg = JSON.parse(moduleBasePkgStr)

await $`yarn build`

// remove old manifests
const outerManifest = './manifests'
await fs.rm(outerManifest, {
	recursive: true,
	force: true,
})

// remove old entrypoints
const outerEntrypoints = './entrypoints'
await fs.rm(outerEntrypoints, {
	recursive: true,
	force: true,
})
await fs.mkdir(outerEntrypoints)

const outerDir = './node_modules'
const dirs = await fs.readdir(outerDir)

const ignoreNames: string[] = [
	// Add any modules which are broken here, so that they are ignored, and not available
	// 'companion-module-something'
	'companion-module-figure53-go-button', // Uses ../../lib/resources/icons.js
]

for (const folder of dirs) {
	if (folder.match(/companion-module-/) && !ignoreNames.includes(folder)) {
		const moduleDir = path.join(outerDir, folder)
		const moduleNewDir = path.join(outerManifest, folder)
		const manifestDir = path.join(moduleNewDir, 'companion')

		const pkgJsonStr = await fs.readFile(path.join(moduleDir, 'package.json'))
		const pkgJson = JSON.parse(pkgJsonStr.toString())

		const maintainers: ModuleManifestMaintainer[] = []

		function tryParsePerson(person: any) {
			try {
				if (person) {
					const rawAuthor = typeof person === 'string' ? parseAuthor(person) : person
					if (rawAuthor.name) {
						maintainers.push({
							name: rawAuthor.name,
							email: rawAuthor.email,
						})
					}
				}
			} catch (e) {
				// Ignore
			}
		}

		tryParsePerson(pkgJson.author)
		if (Array.isArray(pkgJson.contributors)) {
			for (const person of pkgJson.contributors) {
				tryParsePerson(person)
			}
		}

		let products = pkgJson.products || pkgJson.product || []
		if (typeof products === 'string') products = [products]

		const manifest: ModuleManifest = {
			id: pkgJson.name,
			name: pkgJson.name,
			shortname: pkgJson.shortname ?? pkgJson.name,
			description: pkgJson.description ?? pkgJson.name,
			version: pkgJson.version ?? '0.0.0',
			license: pkgJson.license,
			repository: pkgJson.repository?.url ?? `https://github.com/bitfocus/companion-module-${pkgJson.name}.git`,
			bugs: pkgJson.bugs?.url ?? `https://github.com/bitfocus/companion-module-${pkgJson.name}/issues`,
			maintainers: maintainers,
			legacyIds: [...(pkgJson.legacy || [])],

			runtime: {
				type: 'node18',
				api: 'nodejs-ipc',
				apiVersion: moduleBasePkg.version,

				// entrypoint: '../../dist/index.js',
				entrypoint: '../index.js',
				// universal: boolean
			},

			manufacturer: pkgJson.manufacturer ?? '',
			products: products,
			keywords: pkgJson.keywords || [],
		}

		await fs.mkdirp(manifestDir)
		await fs.writeFile(path.join(manifestDir, 'manifest.json'), JSON.stringify(manifest, undefined, '\t'))

		if (await fs.pathExists(path.join(moduleDir, 'HELP.md'))) {
			await fs.copy(path.join(moduleDir, 'HELP.md'), path.join(manifestDir, 'HELP.md'))

			// guess at what images might be needed by the help
			if (await fs.pathExists(path.join(moduleDir, 'images')))
				await fs.copy(path.join(moduleDir, 'images'), path.join(manifestDir, 'images'))
			if (await fs.pathExists(path.join(moduleDir, 'documentation')))
				await fs.copy(path.join(moduleDir, 'documentation'), path.join(manifestDir, 'documentation'))
		}

		await fs.writeFile(
			path.join(outerEntrypoints, `${pkgJson.name}.cjs`),
			`
global.modulePkg = require('companion-module-${pkgJson.name}/package.json')
global.moduleFactory = require('companion-module-${pkgJson.name}')
global.moduleName = "${pkgJson.name}"
import('../../dist/index.js')
			`,
		)
	}
}

console.log('Bundling code. This will take a couple of minutes')
await $`yarn run -B webpack`

// trick node into treating them all as cjs
await fs.writeFile(`manifests/package.json`, '{}')

// const useDir = await fs.pathExists('./module/legacy')
// const baseDir = useDir ? './module/legacy' : './node_modules/companion-wrapped-module'
