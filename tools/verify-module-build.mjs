import meow from 'meow'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

{
	const require = createRequire(import.meta.url)
	require('asar-node').register()
}

const cli = meow(
	`
	Usage
	  $ foo <input>

	Examples
	  $ foo .
	  $ foo app.asar
`,
	{
		importMeta: import.meta,
		flags: {
			// rainbow: {
			// 	type: 'boolean',
			// 	alias: 'r',
			// },
		},
	}
)

const appPath = cli.input[0]
if (!appPath) throw new Error('Missing input argument')

console.log(`Running for "${appPath}"`)
console.log('')

const failedModules = []

const possibleModuleFolders = fs.readdirSync(path.join(appPath, 'node_modules'))
for (const folder of possibleModuleFolders) {
	if (folder.match(/companion-module-/)) {
		console.log(`Found module "${folder}"`)
		try {
			const pkgBuffer = fs.readFileSync(path.join(appPath, 'node_modules', folder, 'package.json'))
			const pkgJson = JSON.parse(pkgBuffer.toString())

			if (!pkgJson.main) throw new Error(`Missing main in package.json`)

			const mainPath = path.join(appPath, 'node_modules', folder, pkgJson.main)
			if (!fs.existsSync(mainPath)) throw new Error('Missing entrypoint')

			const stat = fs.statSync(mainPath)
			if (!stat.isFile()) throw new Error('Invalid entrypoint')
		} catch (e) {
			console.error(`  Failed ${e?.toString?.() ?? e}`)
			if (e && e.stack) {
				console.log(e.stack)
			}
			failedModules.push(folder)
		}
	}
}

console.log('')

if (failedModules.length > 0) {
	console.error(`Failed: ${failedModules.join(', ')}`)
	process.exit(1)
} else {
	console.log('All success')
	process.exit(0)
}
