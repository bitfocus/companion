#!/usr/bin/env node
import { $, fs, question } from 'zx'
import { goSilent } from './lib.mts'

/**
 * Bump the version of @companion-app/satellite-protocol, then commit and tag it. Pushing the tag triggers
 * .github/workflows/satellite-protocol-release.yml, which publishes it to npm.
 *
 * Usage: yarn release:satellite-protocol <major|minor|patch|x.y.z[-pre]>
 */

const PACKAGE_JSON_PATH = new URL('../satellite-protocol/package.json', import.meta.url)

function fail(message: string): never {
	console.error(`Error: ${message}`)
	process.exit(1)
}

function parseVersion(version: string): [number, number, number] | null {
	const m = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/.exec(version)
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

function resolveVersion(current: string, arg: string): string {
	const parsed = parseVersion(current)
	if (!parsed) fail(`current version "${current}" is not valid semver`)
	const [major, minor, patch] = parsed

	switch (arg) {
		case 'major':
			return `${major + 1}.0.0`
		case 'minor':
			return `${major}.${minor + 1}.0`
		case 'patch':
			return `${major}.${minor}.${patch + 1}`
		default:
			if (!parseVersion(arg)) fail(`"${arg}" is not major, minor, patch or a version like 1.2.3`)
			return arg
	}
}

const arg = process.argv[2]
if (!arg) fail('usage: yarn release:satellite-protocol <major|minor|patch|x.y.z[-pre]>')

await goSilent(async () => {
	const branch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim()
	if (branch !== 'main') fail(`on branch "${branch}", releases are tagged from main`)

	if ((await $`git status --porcelain`).stdout.trim()) fail('working tree is not clean')

	const remote = (await $`git config branch.main.remote`).stdout.trim()
	await $`git fetch ${remote} main --tags`
	const behind = Number((await $`git rev-list --count HEAD..${remote}/main`).stdout.trim())
	if (behind > 0) fail(`main is ${behind} commit(s) behind ${remote}/main, pull first`)

	const packageJson = JSON.parse(await fs.readFile(PACKAGE_JSON_PATH, 'utf-8')) as { version: string }
	const version = resolveVersion(packageJson.version, arg)
	const tag = `satellite-protocol-v${version}`

	if ((await $`git tag --list ${tag}`).stdout.trim()) fail(`tag ${tag} already exists`)

	console.log(`Releasing @companion-app/satellite-protocol ${packageJson.version} -> ${version}`)

	// The same checks the release workflow runs, so a bad release fails here rather than after tagging
	console.log('Checking generated assets are up to date...')
	await $`yarn build:satellite-schema --check`
	console.log('Running tests...')
	await $`yarn vitest run --project satellite-protocol`

	packageJson.version = version
	await fs.writeFile(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n')

	await $`git add ${PACKAGE_JSON_PATH.pathname}`
	await $`git commit -m ${`chore: release satellite-protocol v${version}`}`
	await $`git tag -a ${tag} -m ${`@companion-app/satellite-protocol v${version}`}`
	console.log(`Committed and tagged ${tag}`)

	const answer = await question(`Push main and ${tag} to ${remote} now? [y/N] `)
	if (answer.trim().toLowerCase() === 'y') {
		await $`git push --atomic ${remote} main ${tag}`
		console.log(
			`Pushed. The publish runs at https://github.com/bitfocus/companion/actions/workflows/satellite-protocol-release.yml`
		)
	} else {
		console.log(`Not pushed. To publish, run:\n  git push --atomic ${remote} main ${tag}`)
	}
})
