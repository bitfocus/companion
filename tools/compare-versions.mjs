#!/usr/bin/env zx

if (argv._.length < 3) {
	console.log('Needs two refs to compare')
	process.exit(1)
}

const oldRev = argv._[1]
const newRev = argv._[2]

const [oldPkg, newPkg] = await Promise.all([
	fetch(`https://raw.githubusercontent.com/bitfocus/companion/${oldRev}/package.json`),
	fetch(`https://raw.githubusercontent.com/bitfocus/companion/${newRev}/package.json`),
])

const [oldPkgJson, newPkgJson] = await Promise.all([oldPkg.json(), newPkg.json()])

const modulesAdded = []
const modulesChanged = []
const modulesRemoved = []

for (const [name, newVersion] of Object.entries(newPkgJson.dependencies)) {
	if (name.startsWith('companion-module-')) {
		const newMatch = newVersion.match(/^github:(.*)#(.*)$/)
		const oldVersion = oldPkgJson.dependencies[name]
		const oldMatch = oldVersion?.match(/^github:(.*)#(.*)$/)

		if (oldVersion !== newVersion) {
			if (oldVersion) {
				modulesChanged.push(`${name.substring(17)} - ${oldMatch?.[2] ?? oldVersion} > ${newMatch?.[2] ?? newVersion}`)
			} else {
				// New
				modulesAdded.push(`${name.substring(17)} - ${newMatch?.[2] ?? newVersion}`)
			}
		}
	}
}

for (const [name, oldVersion] of Object.entries(oldPkgJson.dependencies)) {
	if (name.startsWith('companion-module-')) {
		const oldMatch = oldVersion?.match(/^github:(.*)#(.*)$/)

		if (!newPkgJson.dependencies[name]) {
			modulesRemoved.push(`${name.substring(17)} - ${oldMatch?.[2] ?? oldVersion}`)
		}
	}
}

if (modulesAdded.length) {
	console.log('Added:')
	console.log(modulesAdded.join('\n'))
	console.log('')
}
if (modulesChanged.length) {
	console.log('Changed:')
	console.log(modulesChanged.join('\n'))
	console.log('')
}
if (modulesRemoved.length) {
	console.log('Removed:')
	console.log(modulesRemoved.join('\n'))
	console.log('')
}
