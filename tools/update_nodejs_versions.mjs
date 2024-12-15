import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { SemVer } from 'semver'

const nodejsVersionsPath = fileURLToPath(new URL('../nodejs-versions.json', import.meta.url))

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
