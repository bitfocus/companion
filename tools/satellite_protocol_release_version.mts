import fs from 'node:fs'
import path from 'node:path'
import { resolveReleaseVersion, type ReleaseRequest } from './satellite-protocol/release-version.mts'

/**
 * Used by the satellite-protocol release workflow: determines the version and npm dist-tag to publish, writes
 * a prerelease version into the package, and reports the dist-tag through $GITHUB_OUTPUT.
 */

const packageJsonPath = path.join(import.meta.dirname, '../satellite-protocol/package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

function env(name: string): string {
	const value = process.env[name]
	if (value === undefined) throw new Error(`Missing environment variable ${name}`)
	return value
}

const eventName = env('EVENT_NAME')
let request: ReleaseRequest
if (eventName === 'push') {
	request = { event: 'push', tag: env('TAG'), packageVersion: packageJson.version }
} else if (eventName === 'workflow_dispatch') {
	request = {
		event: 'workflow_dispatch',
		packageVersion: packageJson.version,
		bump: env('INPUT_BUMP'),
		distTag: env('INPUT_DIST_TAG'),
		runNumber: Number(env('RUN_NUMBER')),
		runAttempt: Number(env('RUN_ATTEMPT')),
		sha: env('SHA'),
	}
} else {
	throw new Error(`Unsupported event ${eventName}`)
}

const { version, distTag } = resolveReleaseVersion(request)

if (version !== packageJson.version) {
	packageJson.version = version
	fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
}

console.log(`Publishing ${version} with dist-tag ${distTag}`)
fs.appendFileSync(env('GITHUB_OUTPUT'), `dist-tag=${distTag}\n`)
