#!/usr/bin/env zx

import fs from 'fs'
import path from 'path'

console.log(`Rebuilding modules`)
console.log('')

cd('node_modules')
const possibleModuleFolders = fs.readdirSync('.')
for (const folder of possibleModuleFolders) {
	if (folder.match(/companion-module-/)) {
		try {
			const pkgBuffer = fs.readFileSync(path.join(folder, 'package.json'))
			const pkgJson = JSON.parse(pkgBuffer.toString())

			if (pkgJson.scripts && pkgJson.scripts.build) {
				console.log(`Building module "${folder}"`)

				cd(folder)
				await $`yarn build`
				cd('..')

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
