#!/usr/bin/env zx

const pkgJsonStr = await fs.readFile('module-legacy/package.json')
const pkgJson = JSON.parse(pkgJsonStr.toString())

const PREFIX = 'companion-module-'

for (const name of Object.keys(pkgJson.dependencies)) {
	if (!name.startsWith(PREFIX)) continue

	if (fs.existsSync(path.join('bundled-modules', name.slice(PREFIX.length)))) console.log(name)
}
