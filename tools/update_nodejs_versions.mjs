import fs from 'node:fs/promises'
import { SemVer } from 'semver'
import path from 'node:path'

const nodejsVersionsPath = path.join(import.meta.dirname, '../assets/nodejs-versions.json')

const existingVersionsStr = await fs.readFile(nodejsVersionsPath, 'utf8')
const existingVersions = JSON.parse(existingVersionsStr)

console.log('existing versions:', existingVersions)

const apiReleases = await fetch('https://nodejs.org/download/release/index.json').then((res) => res.json())
console.log(`Found ${apiReleases.length} nodejs releases!`)

const newVersions = { ...existingVersions }

for (const [versionName, currentVersion] of Object.entries(existingVersions)) {
	if (!versionName.startsWith('node')) continue

	let latestVersion = new SemVer(currentVersion)
	for (const apiRelease of apiReleases) {
		const apiSemver = new SemVer(apiRelease.version)
		if (apiSemver.major === latestVersion.major && apiSemver.compare(latestVersion) > 0) {
			latestVersion = apiSemver
		}
	}

	console.log(`Latest version for ${versionName}: ${latestVersion}`)
	newVersions[versionName] = latestVersion.version
}

await fs.writeFile(nodejsVersionsPath, JSON.stringify(newVersions, null, '\t') + '\n')

// Update the .node-version file
const nodeVersionFilePath = path.join(import.meta.dirname, '../.node-version')
const existingNodeVersion = await fs.readFile(nodeVersionFilePath, 'utf8')
const existingNodeMajor = Number(existingNodeVersion.trim().split('.')[0])
if (isNaN(existingNodeMajor)) throw new Error(`Invalid node version in .node-version: ${existingNodeVersion}`)

const newVersion = newVersions[`node${existingNodeMajor}`]
if (!newVersion) throw new Error(`No new version found for node${existingNodeMajor}`)

await fs.writeFile(nodeVersionFilePath, newVersion + '\n')

// Update the engines in any package.json files

async function updatePackageJsonEngines(packageJsonPath) {
	const packageJsonStr = await fs.readFile(packageJsonPath, 'utf8')
	const packageJson = JSON.parse(packageJsonStr)

	if (!packageJson.engines || !packageJson.engines.node) return // Nothing to update

	packageJson.engines.node = `>=${newVersion} <${existingNodeMajor + 1}`
	await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
	console.log(`Updated engines.node in ${packageJsonPath} to >=${newVersion}`)
}

await updatePackageJsonEngines(path.join(import.meta.dirname, '../package.json'))
await updatePackageJsonEngines(path.join(import.meta.dirname, '../companion/package.json'))
