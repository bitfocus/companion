import { fs, path } from 'zx'
import parseAuthor from 'parse-author'

import type { ModuleManifest, ModuleManifestMaintainer } from '@companion-module/base'

// remove old manifests
const outerManifest = './manifests'
await fs.rm(outerManifest, {
	recursive: true,
	force: true,
})

const outerDir = './node_modules'
const dirs = await fs.readdir(outerDir)

const ignoreNames: string[] = [
	// Add any modules which are broken here, so that they are ignored, and not available
	// 'companion-module-something'
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

		const manifest: ModuleManifest = {
			id: `bitfocus.${pkgJson.name}`,
			name: pkgJson.name,
			shortname: pkgJson.shortname ?? pkgJson.name,
			description: pkgJson.description ?? pkgJson.name,
			version: pkgJson.version ?? '0.0.0',
			license: pkgJson.license,
			repository: pkgJson.repository?.url ?? `https://github.com/bitfocus/companion-module-${pkgJson.name}.git`,
			maintainers: maintainers,
			legacyIds: [pkgJson.name],

			runtime: {
				type: 'node14',
				api: 'socket.io',

				entrypoint: '../../dist/index.js',
				// universal: boolean
			},

			manufacturer: pkgJson.manufacturer ?? '',
			products: pkgJson.products ?? (pkgJson.product ? [pkgJson.product] : []),
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
	}
}

const useDir = await fs.pathExists('./module/legacy')
const baseDir = useDir ? './module/legacy' : './node_modules/companion-wrapped-module'
