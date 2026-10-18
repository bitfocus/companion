import { z } from 'zod'

/**
 * Discovery: how installations find each other, and which protocol versions they speak.
 *
 * This is the one part of the protocol that is the same for every major version, as it is how two installations find
 * out which major version to use (see Versions.ts). So it must stay readable by every version: only ever add optional
 * fields to the announcement, and never change the discovery topics. `yarn build:link-schema` generates
 * `assets/link-announcement.schema.json` from it.
 */

export const LinkAnnouncementSchema = z
	.object({
		name: z.string().max(200).describe('Human readable name of the installation'),
		companionVersion: z.string().describe('Companion application version'),
		protocolVersions: z
			.array(z.string())
			.min(1)
			.describe(
				'The Link protocol versions (semver) this installation speaks, one per major version. Two installations use the highest major version they both speak'
			),
		announceIntervalMs: z
			.number()
			.int()
			.positive()
			.describe('How often this announcement is repeated. Peers consider it gone after missing a few'),
	})
	.describe(
		'Periodic announcement of an installation, on the discovery topic of its id. Published retained, an empty payload means it went offline. Readable by anyone who can see the discovery topics, including installations that are not allowed to use this one, so it carries only what is needed to find it: add anything else to a message that is only sent to peers allowed it'
	)

export type LinkAnnouncement = z.infer<typeof LinkAnnouncementSchema>

/** Retained announcement of a peer. An empty payload means it has gone offline */
export function linkDiscoveryTopic(peerId: string): string {
	return `discovery/${peerId}`
}

export const LINK_DISCOVERY_WILDCARD = 'discovery/+'

/** Parse the peer id from a discovery topic */
export function parseLinkDiscoveryTopic(topic: string): string | null {
	const prefix = 'discovery/'
	if (!topic.startsWith(prefix)) return null
	const id = topic.slice(prefix.length)
	return id && !id.includes('/') ? id : null
}

/** How often each installation repeats its announcement */
export const LINK_ANNOUNCE_INTERVAL_MS = 15_000

/** A peer is considered offline after missing this many announcements */
export const LINK_ANNOUNCE_MISSED_LIMIT = 3

export function encodeLinkAnnouncement(announcement: LinkAnnouncement): string {
	return JSON.stringify(announcement)
}

/**
 * Parse and validate an announcement from the wire
 * @returns the announcement, or an error describing why it was rejected
 */
export function decodeLinkAnnouncement(
	raw: string
): { ok: true; announcement: LinkAnnouncement } | { ok: false; error: string } {
	let json: unknown
	try {
		json = JSON.parse(raw)
	} catch {
		return { ok: false, error: 'Invalid JSON' }
	}

	const result = LinkAnnouncementSchema.safeParse(json)
	if (!result.success) return { ok: false, error: z.prettifyError(result.error) }

	return { ok: true, announcement: result.data }
}
