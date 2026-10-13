import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Used by the satellite-protocol release workflow: determines the version and npm dist-tag to publish, writes
 * a prerelease version into the package, and reports the dist-tag through $GITHUB_OUTPUT.
 */

export type ReleaseBump = 'patch' | 'minor' | 'major' | 'as-is'

export type ReleaseRequest =
	| {
			/** A release, from pushing a `satellite-protocol-v<version>` tag */
			event: 'push'
			tag: string
			packageVersion: string
	  }
	| {
			/** A prerelease build, from running the workflow manually */
			event: 'workflow_dispatch'
			packageVersion: string
			bump: string
			distTag: string
			runNumber: number
			runAttempt: number
			sha: string
	  }

export interface ReleaseVersion {
	version: string
	distTag: string
}

export const RELEASE_TAG_PREFIX = 'satellite-protocol-v'

const BUMPS: readonly ReleaseBump[] = ['patch', 'minor', 'major', 'as-is']

/**
 * Determine the version and npm dist-tag to publish the satellite-protocol package as
 */
export function resolveReleaseVersion(request: ReleaseRequest): ReleaseVersion {
	const match = /^(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(request.packageVersion)
	if (!match) throw new Error(`Invalid package version '${request.packageVersion}'`)

	if (request.event === 'push') {
		if (request.tag !== `${RELEASE_TAG_PREFIX}${request.packageVersion}`) {
			throw new Error(`Tag ${request.tag} does not match the package version ${request.packageVersion}`)
		}

		return {
			version: request.packageVersion,
			distTag: match[4] ? 'next' : 'latest',
		}
	}

	if (!/^[a-z][a-z0-9-]*$/.test(request.distTag) || request.distTag === 'latest' || request.distTag === 'next') {
		throw new Error(`Invalid dist-tag '${request.distTag}': must be lowercase, and not 'latest' or 'next'`)
	}
	if (!BUMPS.includes(request.bump as ReleaseBump)) {
		throw new Error(`Invalid bump '${request.bump}'`)
	}
	if (!/^[0-9a-f]{7,}$/.test(request.sha)) throw new Error(`Invalid commit sha '${request.sha}'`)

	// The version this will be released as, ignoring any prerelease suffix of the package version
	const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])]
	let base: string
	switch (request.bump as ReleaseBump) {
		case 'major':
			base = `${major + 1}.0.0`
			break
		case 'minor':
			base = `${major}.${minor + 1}.0`
			break
		case 'patch':
			base = `${major}.${minor}.${patch + 1}`
			break
		case 'as-is':
			base = `${major}.${minor}.${patch}`
			break
	}

	// A unique prerelease version for this run, eg 0.1.1-dev.12.1.gabc1234. The sha is prefixed so that an
	// all-digit sha can't form a numeric identifier with a leading zero, which semver forbids
	return {
		version: `${base}-${request.distTag}.${request.runNumber}.${request.runAttempt}.g${request.sha.slice(0, 7)}`,
		distTag: request.distTag,
	}
}

// Run as the workflow step; importing this file (eg from tests) only provides resolveReleaseVersion
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const packageJsonPath = path.join(import.meta.dirname, '../satellite-protocol/package.json')
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

	const env = (name: string): string => {
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
}
