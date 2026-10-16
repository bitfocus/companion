import { parseApiVersion } from '@companion-app/satellite-protocol/versions'

/**
 * The versions of the Link protocol this installation speaks, one per major version, each following semver:
 * - MAJOR: incompatible change. Two installations use the highest major they both speak
 * - MINOR: a new feature. Only use it towards a peer that announced a version of the same major that has it
 * - PATCH: a fix that doesn't change what goes over the wire
 *
 * To give users a transition period when bumping the major version, keep speaking the previous one alongside it for
 * a few releases, so that installations can be upgraded one at a time.
 *
 * 1.0.0 - Initial release: discovery, access (permissions), ping, button subscriptions, press and rotate
 */
export const LINK_PROTOCOL_VERSIONS: readonly string[] = ['1.0.0']

/**
 * Choose the protocol version to use with a peer: the highest major version both speak
 * @param ours - the versions we speak
 * @param theirs - the versions the peer announced
 * @returns the peer's version for that major (to check which minor features it has), or null if there is none
 */
export function negotiateLinkProtocolVersion(ours: readonly string[], theirs: readonly string[]): string | null {
	const ourMajors = new Set(ours.map((version) => parseApiVersion(version)?.[0]))

	let best: { major: number; version: string } | null = null
	for (const version of theirs) {
		const major = parseApiVersion(version)?.[0]
		if (major === undefined || !ourMajors.has(major)) continue
		if (!best || major > best.major) best = { major, version }
	}
	return best?.version ?? null
}
