#!/usr/bin/env zx

import fs from 'fs-extra'

const modulesDir = 'module-tmp'

console.log('Cloning all modules')
await fs.remove(modulesDir)
await fs.mkdir(modulesDir)

const pkgJsonStr = await fs.readFile('./module-legacy/package.json')
const pkgJson = JSON.parse(pkgJsonStr.toString())

const res2 = []
try {
	const ps = []
	async function doModule(name) {
		const repoUrl = `https://github.com/bitfocus/companion-module-${name}.git`
		const targetDir = `${modulesDir}/${name}`

		if (await fs.pathExists(targetDir)) return

		await $`git clone ${repoUrl} ${targetDir}`

		return [name, targetDir]
	}

	const mods = await fs.readdir('./bundled-modules')
	for (const name of mods) {
		if (!name.startsWith('.') && (await fs.stat(path.join('./bundled-modules', name))).isDirectory()) {
			ps.push(doModule(name))
		}
	}

	for (const [name, version] of Object.entries(pkgJson.dependencies)) {
		if (name.startsWith('companion-module-')) {
			ps.push(doModule(name.slice('companion-module-'.length)))
		}
	}

	const targetDirs = await Promise.all(ps)

	console.log(targetDirs)

	for (const raw of targetDirs) {
		if (!raw) continue

		const [name, dir] = raw
		const res = await $` cloc --json ${dir} --timeout 10`
		const json = JSON.parse(res.stdout)

		let sum = 0

		if (json['JavaScript']) {
			sum += json['JavaScript'].code
		}
		if (json['TypeScript']) {
			sum += json['TypeScript'].code
		}
		res2.push(`${name},${sum}`)
	}
} catch (e) {
	//
	console.error(e)
}

console.log(res2.join('\n'))
