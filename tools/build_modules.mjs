import fs from 'fs'
import path from 'path'

const appPath = '.'

console.log(`Rebuilding modules`)
console.log('')

const possibleModuleFolders = fs.readdirSync(path.join(appPath, 'node_modules'))
for (const folder of possibleModuleFolders) {
	if (folder.match(/companion-module-/)) {
		try {
			const pkgBuffer = fs.readFileSync(path.join(appPath, 'node_modules', folder, 'package.json'))
			const pkgJson = JSON.parse(pkgBuffer.toString())

			if (pkgJson.scripts && pkgJson.scripts.build) {
				console.log(`Building module "${folder}"`)

				await $`cd ${path.join(appPath, 'node_modules', folder)} && yarn build`

				console.log()
			}
		} catch (e) {
			console.error(`  Failed ${e?.toString?.() ?? e}`)
			if (e && e.stack) {
				console.log(e.stack)
			}
			process.exit(1)
		}
	}
}

console.log('Done')
