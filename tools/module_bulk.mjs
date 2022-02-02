#!/usr/bin/env zx

import fs from 'fs-extra'

const modulesDir = 'module-tmp'

const pkgJsonStr = await fs.readFile('./package.json')
const pkgJson = JSON.parse(pkgJsonStr.toString())

if (argv._[1] === 'clone') {
	const answer = await question('Are you sure? This will delete a previous clone, and any local changes')
	if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
		console.log('Cancelled')
		process.exit(0)
	}

	console.log('Cloning all modules')
	await fs.remove(modulesDir)
	await fs.mkdir(modulesDir)

	const ps = []

	for (const [name, version] of Object.entries(pkgJson.dependencies)) {
		if (name.startsWith('companion-module-')) {
			const match = version.match(/^github:(.*)#(.*)$/)
			if (!match) {
				console.error(`Failed to match version for ${name}`)
			} else {
				const repoUrl = `https://github.com/${match[1]}.git`
				const targetDir = `${modulesDir}/${name}`
				ps.push($`git clone ${repoUrl} ${targetDir}`)
			}
		}
	}

	// Run all the clones in parallel
	await Promise.all(ps)
} else if (argv._[1] === 'find-untagged-commits') {
	let countWithChanges = 0

	const output = []

	const folders = await fs.readdir(modulesDir)
	for (const folder of folders) {
		const fullDir = `${modulesDir}/${folder}`

		const entry = pkgJson.dependencies[folder]
		if (!entry) {
			output.push(`Missing module "${folder}" in package.json!`)
			continue
		}

		const match = entry.match(/^github:(.*)#(.*)$/)
		if (!match) {
			output.push(`Failed to match version for ${folder}`)
			continue
		}
		const taggedVersion = match[2]

		try {
			await $`git -C ${fullDir} describe --exact-match --tags HEAD`
		} catch (e) {
			output.push(`"${folder}" has untagged commits`)

			const range = `${taggedVersion}...HEAD`
			const changes = await $`git -C ${fullDir} log --pretty=oneline ${range}`
			output.push(changes, '')
			countWithChanges++
		}
	}

	console.log(output.join('\n'))

	console.log()
	console.log(`${countWithChanges} modules have untagged commits`)
} else if (argv._[1] === 'find-changes') {
	let countWithChanges = 0

	const folders = await fs.readdir(modulesDir)
	for (const folder of folders) {
		const fullDir = `${modulesDir}/${folder}`

		const changes = await $`git -C ${fullDir} status --porcelain`
		if (changes.stdout.trim().length > 0) {
			countWithChanges++

			// console.log(changes.stdout)
			// console.log()
		}
	}

	console.log()
	console.log(`${countWithChanges} modules have changes`)
} else if (argv._[1] === 'commit-all') {
	const message = await question('Commit message:')

	let countChanged = 0

	const ps = []

	const folders = await fs.readdir(modulesDir)
	for (const folder of folders) {
		const fullDir = `${modulesDir}/${folder}`

		try {
			const changes = await $`git -C ${fullDir} commit -a -m ${message}`
			if (changes.stdout.trim().length > 0) {
				countChanged++

				console.log()
			}
		} catch (e) {
			console.error(e)
		}
	}

	await Promise.allSettled(ps)

	console.log()
	console.log(`${countChanged} modules were changed`)
} else if (argv._[1] === 'push-all') {
	let countChanged = 0

	const ps = []

	const folders = await fs.readdir(modulesDir)
	for (const folder of folders) {
		const fullDir = `${modulesDir}/${folder}`

		ps.push($`git -C ${fullDir} push`)
	}

	await Promise.allSettled(ps)

	console.log()
	console.log(`${countChanged} modules were changed`)
} else if (argv._[1] === 'pull-all') {
	let countChanged = 0

	const ps = []

	const folders = await fs.readdir(modulesDir)
	for (const folder of folders) {
		const fullDir = `${modulesDir}/${folder}`

		ps.push($`git -C ${fullDir} pull --rebase`)
	}

	await Promise.allSettled(ps)

	console.log()
	console.log(`${countChanged} modules were changed`)
} else if (argv._[1] === 'tag-all-changed') {
	if (argv._[2] !== 'minor' && argv._[2] !== 'patch') {
		console.error(`Must specify patch or minor`)
		process.exit(1)
	}

	const versionArg = `--${argv._[2]}`

	let countChanged = 0

	// const ps = []
	const output = []

	const folders = await fs.readdir(modulesDir)
	for (const folder of folders) {
		const fullDir = `${modulesDir}/${folder}`

		try {
			await $`git -C ${fullDir} describe --exact-match --tags HEAD`
		} catch (e) {
			try {
				await $`yarn --cwd ${fullDir} version ${versionArg}`
				await $`git -C ${fullDir} push`
				await $`git -C ${fullDir} push --tags`

				const tagNameRaw = await $`git -C ${fullDir} describe --exact-match --tags HEAD`
				const tagName = tagNameRaw.stdout.trim()
				pkgJson.dependencies[folder] = `github:bitfocus/${folder}#${tagName}`

				output.push(`Tagged "${folder}" as ${tagName}`)
				countChanged++
			} catch (e) {
				output.push(`Failed to bump "${folder}": ${e}`)
			}
		}
	}

	// await Promise.allSettled(ps)

	console.log(output.join('\n'))

	console.log()
	console.log(`${countChanged} modules were changed`)

	console.log('Updating package.json')
	await fs.writeFile('package.json', JSON.stringify(pkgJson, undefined, '\t') + '\n')

	await $`yarn install`
} else {
	console.error(`Unsupported operation ${argv._[1]}`)
	process.exit(1)
}
